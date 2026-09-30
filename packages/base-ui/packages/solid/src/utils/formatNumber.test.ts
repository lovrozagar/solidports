import { expect } from 'vitest';
import { getFormatter } from './formatNumber';

const getOptions = (): Intl.NumberFormatOptions => ({
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
});

describe('NumberField format', () => {
  describe('getFormatter', () => {
    it('caches the formatter based on options', () => {
      const formatter1 = getFormatter(undefined, getOptions());
      const formatter2 = getFormatter(undefined, getOptions());
      expect(formatter1).toBe(formatter2);
    });
  });

  describe('formatNumber', () => {
    it('formats a number', () => {
      const expected = new Intl.NumberFormat(undefined, {
        currency: 'USD',
        style: 'currency',
      }).format(1234.56);
      expect(getFormatter(undefined, getOptions()).format(1234.56)).toBe(expected);
    });

    it('formats a number with different options', () => {
      expect(getFormatter('en-US', { style: 'percent' }).format(0.1234)).toBe('12%');
    });
  });
});
