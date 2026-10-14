import { getXPath } from './xpath';

describe('xpath', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <p>a</p>
        <p>b <span>c</span></p>
      </div>
      <div id="twin"></div><div id="twin"></div>`;
  });

  it('uses the id shortcut when it is unique', () => {
    expect(getXPath(document.getElementById('root')!)).toBe('//*[@id="root"]');
  });

  it('falls back to a positional path for duplicate ids', () => {
    const second = document.querySelectorAll('#twin')[1];
    expect(getXPath(second)).toBe('/html/body/div[3]');
  });

  it('indexes only when siblings share the tag', () => {
    expect(getXPath(document.querySelector('span')!)).toBe(
      '/html/body/div[1]/p[2]/span',
    );
  });
});
