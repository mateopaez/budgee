import { centsToInputString, formatMoney, parseMoneyToCents } from './currency.util';

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
    expect(formatMoney(-153_900)).toBe('-$1,539');
  });

  it('compacts thousands for calendar cells', () => {
    expect(formatMoney(180_000, { compact: true })).toBe('$1.8K');
    expect(formatMoney(9_800, { compact: true })).toBe('$98');
  });

  it('parses typed input into cents', () => {
    expect(parseMoneyToCents('1,234.50')).toBe(123_450);
    expect(parseMoneyToCents('$12')).toBe(1_200);
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
  });

  it('round trips through the editor input format', () => {
    expect(parseMoneyToCents(centsToInputString(4_197))).toBe(4_197);
  });
});
