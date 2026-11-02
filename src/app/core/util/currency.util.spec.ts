import {
  centsToInputString,
  formatMoney,
  parseMoneyToCents,
  hasTooManyDecimals,
  sanitizeAmountInput,
} from './currency.util';

describe('currency utilities', () => {
  it('formats whole dollars by default', () => {
    expect(formatMoney(446_600)).toBe('$4,466');
  });

  it('formats cents when asked', () => {
    expect(formatMoney(4_197, { decimals: true })).toBe('$41.97');
  });

  it('marks positive amounts when signed', () => {
    expect(formatMoney(19_200, { signed: true })).toBe('+$192');
  });

  it('keeps the minus sign in front for negative amounts', () => {
    expect(formatMoney(-153_900)).toBe('\u2212$1,539');
  });

  it('compacts thousands for calendar cells', () => {
    expect(formatMoney(180_000, { compact: true })).toBe('$1.8K');
    expect(formatMoney(9_800, { compact: true })).toBe('$98');
  });

  it('compacts millions so large headline figures fit', () => {
    expect(formatMoney(120_000_000, { compact: true })).toBe('$1.2M');
    expect(formatMoney(100_000_000, { compact: true })).toBe('$1M');
  });

  it('parses typed input into cents', () => {
    expect(parseMoneyToCents('1,234.50')).toBe(123_450);
    expect(parseMoneyToCents('$12')).toBe(1_200);
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
  });

  it('keeps only digits and one decimal point while typing', () => {
    expect(sanitizeAmountInput('abc')).toBe('');
    expect(sanitizeAmountInput('-5')).toBe('5');
    expect(sanitizeAmountInput('12.405')).toBe('12.405');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('$1,234.5')).toBe('1234.5');
  });

  it('flags more than two decimal places', () => {
    expect(hasTooManyDecimals('12.405')).toBe(true);
    expect(hasTooManyDecimals('12.40')).toBe(false);
    expect(hasTooManyDecimals('12')).toBe(false);
  });

  it('round trips through the editor input format', () => {
    expect(parseMoneyToCents(centsToInputString(4_197))).toBe(4_197);
  });
});
