import { EDITS_STORAGE_PREFIX } from '@/shared/consts';
import { hasEdits, revertEdits, writeField } from '../edits/edits';
import { EditRecord, SavedEdits } from './saved';

const key = `${EDITS_STORAGE_PREFIX}http://localhost`;
const get = chrome.storage.local.get as jest.Mock;
const set = chrome.storage.local.set as jest.Mock;
const remove = chrome.storage.local.remove as jest.Mock;

function record(selector: string, path = '/'): EditRecord {
  return {
    path,
    selector,
    styles: { color: 'blue' },
    attributes: { 'data-saved': '1' },
  };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 6; tick += 1) await Promise.resolve();
}

describe('saved edits', () => {
  let saved: SavedEdits;

  beforeEach(() => {
    jest.useFakeTimers();
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(0), 16) as unknown as number;
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    get.mockReset();
    set.mockReset().mockResolvedValue(undefined);
    remove.mockReset().mockResolvedValue(undefined);
    document.body.innerHTML = '';
    saved = new SavedEdits();
  });

  afterEach(() => {
    saved.setEnabled(false);
    jest.useRealTimers();
  });

  it('replays saved edits for this path on unique matches only', async () => {
    document.body.innerHTML =
      '<p id="one">1</p><p class="many">a</p><p class="many">b</p><p id="other">o</p>';
    get.mockResolvedValue({
      [key]: [
        record('#one'),
        record('.many'),
        record('#other', '/elsewhere'),
        record('p:::bad'),
      ],
    });
    saved.setEnabled(true);
    await settle();
    expect(get).toHaveBeenCalledWith(key);
    const one = document.getElementById('one')!;
    expect(one.style.color).toBe('blue');
    expect(one.getAttribute('data-saved')).toBe('1');
    expect(hasEdits(one)).toBe(true);
    expect(document.querySelector('.many[data-saved]')).toBeNull();
    expect(document.getElementById('other')!.hasAttribute('data-saved')).toBe(
      false,
    );
  });

  it('applies saved edits to elements that render later', async () => {
    get.mockResolvedValue({ [key]: [record('#late')] });
    saved.setEnabled(true);
    await settle();
    const late = document.createElement('p');
    late.id = 'late';
    document.body.append(late);
    await settle();
    jest.advanceTimersByTime(20);
    expect(late.style.color).toBe('blue');
  });

  it('saves the net change under the selector taken before the first edit', async () => {
    get.mockResolvedValue({});
    document.body.innerHTML = '<main><p class="a">x</p></main>';
    const el = document.querySelector('.a')!;
    saved.setEnabled(true);
    await settle();
    const selector = saved.selectorOf(el);
    writeField(el, { kind: 'attribute', name: 'class' }, 'b');
    saved.remember(el);
    await settle();
    expect(saved.selectorOf(el)).toBe(selector);
    expect(set).toHaveBeenLastCalledWith({
      [key]: [
        {
          path: '/',
          selector,
          styles: {},
          attributes: { class: 'b' },
        },
      ],
    });
    revertEdits(el);
    saved.remember(el);
    await settle();
    expect(remove).toHaveBeenCalledWith(key);
  });

  it('saves edits made before it was turned on and ignores shadow roots', async () => {
    get.mockResolvedValue({});
    document.body.innerHTML = '<p id="early">x</p><div id="host"></div>';
    const early = document.getElementById('early')!;
    writeField(early, { kind: 'style', property: 'color' }, 'red');
    const root = document
      .getElementById('host')!
      .attachShadow({ mode: 'open' });
    root.innerHTML = '<span>s</span>';
    const inner = root.querySelector('span')!;
    writeField(inner, { kind: 'style', property: 'color' }, 'red');

    saved.remember(early);
    expect(set).not.toHaveBeenCalled();
    saved.setEnabled(true);
    await settle();
    expect(set).toHaveBeenLastCalledWith({
      [key]: [expect.objectContaining({ selector: '#early' })],
    });
    saved.remember(inner);
    await settle();
    expect(set).toHaveBeenCalledTimes(1);
    revertEdits(early);
    revertEdits(inner);
  });

  it('ignores storage that is missing or fails', async () => {
    get.mockResolvedValue({ [key]: 'nope' });
    saved.setEnabled(true);
    await settle();
    saved.setEnabled(false);
    get.mockRejectedValue(new Error('gone'));
    saved.setEnabled(true);
    await settle();
    document.body.innerHTML = '<p id="x">x</p>';
    const el = document.getElementById('x')!;
    set.mockRejectedValue(new Error('full'));
    writeField(el, { kind: 'style', property: 'color' }, 'red');
    saved.remember(el);
    await settle();
    expect(set).toHaveBeenCalled();
    revertEdits(el);
  });
});
