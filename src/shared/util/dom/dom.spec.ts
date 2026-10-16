import {
  countDeep,
  countMatches,
  deepElementFromPoint,
  HOST_TAG,
  isEditable,
  isOwnNode,
  parentOf,
  rootOf,
  walkDeep,
} from './dom';

describe('dom', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('recognises nodes inside the extension host, including its shadow root', () => {
    const host = document.createElement(HOST_TAG);
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    root.appendChild(inner);
    document.body.append(host);
    const outside = document.createElement('p');
    document.body.append(outside);

    expect(isOwnNode(inner)).toBe(true);
    expect(isOwnNode(host)).toBe(true);
    expect(isOwnNode(outside)).toBe(false);
    expect(isOwnNode(null)).toBe(false);
  });

  it('descends into open shadow roots when hit testing', () => {
    const host = document.createElement('x-host');
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    root.appendChild(inner);
    document.body.append(host);

    document.elementFromPoint = jest.fn(() => host);
    (root as unknown as { elementFromPoint: () => Element }).elementFromPoint =
      () => inner;

    expect(deepElementFromPoint(1, 1)).toBe(inner);
  });

  it('returns null when nothing is under the pointer', () => {
    document.elementFromPoint = jest.fn(() => null);
    expect(deepElementFromPoint(1, 1)).toBeNull();
  });

  it('counts matches and tolerates invalid selectors', () => {
    document.body.innerHTML = '<i></i><i></i>';
    expect(countMatches('i')).toBe(2);
    expect(countMatches('[[')).toBe(0);
  });

  it('walks and counts through open shadow roots', () => {
    document.body.innerHTML = '<i></i><x-a></x-a>';
    const host = document.querySelector('x-a')!;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<i></i><b><i></i></b>';
    const inner = root.querySelector('b > i')!;

    expect(countDeep('i')).toBe(3);
    expect(Array.from(walkDeep(document.body)).length).toBe(5);
    expect(rootOf(inner)).toBe(root);
    expect(rootOf(host)).toBe(document);
    expect(parentOf(root.firstElementChild!)).toBe(host);
    expect(parentOf(document.documentElement)).toBeNull();
  });

  it('recognises elements that take typed text', () => {
    document.body.innerHTML = `
      <input id="text"><input id="check" type="checkbox"><textarea></textarea>
      <select></select><button></button>
      <div contenteditable><b id="inner"></b></div>
      <div contenteditable="false" id="off"></div>`;
    const byId = (id: string) => document.getElementById(id);

    expect(isEditable(byId('text'))).toBe(true);
    expect(isEditable(byId('check'))).toBe(false);
    expect(isEditable(document.querySelector('textarea'))).toBe(true);
    expect(isEditable(document.querySelector('select'))).toBe(true);
    expect(isEditable(document.querySelector('button'))).toBe(false);
    expect(isEditable(byId('inner'))).toBe(true);
    expect(isEditable(byId('off'))).toBe(false);
    expect(isEditable(window)).toBe(false);
    expect(isEditable(null)).toBe(false);
  });
});
