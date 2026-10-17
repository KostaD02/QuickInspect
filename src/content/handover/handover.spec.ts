import { claimPage } from './handover';

describe('handover', () => {
  it('releases the previous instance when a new one claims the page', () => {
    const first = jest.fn();
    const second = jest.fn();
    const third = jest.fn();

    claimPage(first);
    expect(first).not.toHaveBeenCalled();

    claimPage(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    claimPage(third);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
  });
});
