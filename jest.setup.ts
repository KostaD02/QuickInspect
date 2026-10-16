import { chrome } from 'jest-chrome';

Object.assign(global, { chrome });

Object.defineProperty(Performance.prototype, 'getEntriesByType', {
  value: (): PerformanceEntryList => [],
  configurable: true,
  writable: true,
});
