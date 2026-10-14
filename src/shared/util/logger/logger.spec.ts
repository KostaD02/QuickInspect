import { Logger } from './logger';

describe('logger', () => {
  it('prefixes every level', () => {
    const fake = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Console;
    const logger = new Logger('Test', fake);
    logger.log('a');
    logger.warn('b');
    logger.error('c');
    expect((fake.log as jest.Mock).mock.calls[0][0]).toMatch(/^\[Test\] \[/);
    expect((fake.warn as jest.Mock).mock.calls[0][1]).toBe('b');
    expect((fake.error as jest.Mock).mock.calls[0][1]).toBe('c');
  });
});
