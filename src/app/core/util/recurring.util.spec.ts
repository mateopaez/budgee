import { makeTransaction } from '../testing/factories';
import {
  detectRecurringPayments,
  monthlyEquivalent,
  nextDueDate,
  normaliseMerchant,
  yearlyBillsTotal,
} from './recurring.util';

const TODAY = '2026-09-08';

describe('recurring payment heuristic', () => {
  it('normalises merchant strings before grouping', () => {
    expect(normaliseMerchant('SQ *STREAMLY 00123')).toBe('sq streamly');
    expect(normaliseMerchant('Streamly')).toBe('streamly');
  });

  it('detects a monthly subscription from repeated charges', () => {
    const payments = detectRecurringPayments(
      [
        makeTransaction({ id: '1', merchant: 'Streamly', amountCents: 1_899, date: '2026-07-05' }),
        makeTransaction({ id: '2', merchant: 'Streamly', amountCents: 1_899, date: '2026-08-05' }),
        makeTransaction({ id: '3', merchant: 'Streamly', amountCents: 1_899, date: '2026-09-05' }),
      ],
      TODAY,
    );
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      merchant: 'Streamly',
      cadence: 'monthly',
      amountCents: 1_899,
      occurrences: 3,
      nextDueOn: '2026-10-05',
    });
  });

  it('ignores a merchant seen only once', () => {
    const payments = detectRecurringPayments(
      [makeTransaction({ merchant: 'Wovenwear', amountCents: 8_800, date: '2026-09-02' })],
      TODAY,
    );
    expect(payments).toHaveLength(0);
  });

  it('ignores irregular gaps', () => {
    const payments = detectRecurringPayments(
      [
        makeTransaction({ id: '1', merchant: 'Corner Fresh', amountCents: 4_000, date: '2026-08-01' }),
        makeTransaction({ id: '2', merchant: 'Corner Fresh', amountCents: 4_000, date: '2026-08-04' }),
        makeTransaction({ id: '3', merchant: 'Corner Fresh', amountCents: 4_000, date: '2026-09-01' }),
      ],
      TODAY,
    );
    expect(payments).toHaveLength(0);
  });

  it('ignores amounts that swing too far apart', () => {
    const payments = detectRecurringPayments(
      [
        makeTransaction({ id: '1', merchant: 'Maple Grocers', amountCents: 2_000, date: '2026-07-05' }),
        makeTransaction({ id: '2', merchant: 'Maple Grocers', amountCents: 9_000, date: '2026-08-05' }),
        makeTransaction({ id: '3', merchant: 'Maple Grocers', amountCents: 9_500, date: '2026-09-05' }),
      ],
      TODAY,
    );
    expect(payments).toHaveLength(0);
  });

  it('never treats income as a recurring bill', () => {
    const payments = detectRecurringPayments(
      [
        makeTransaction({ id: '1', type: 'income', merchant: 'Payroll', amountCents: 190_000, date: '2026-08-05' }),
        makeTransaction({ id: '2', type: 'income', merchant: 'Payroll', amountCents: 190_000, date: '2026-09-05' }),
      ],
      TODAY,
    );
    expect(payments).toHaveLength(0);
  });

  it('normalises cadence into a monthly cost', () => {
    expect(monthlyEquivalent(1_200, 'monthly')).toBe(1_200);
    expect(monthlyEquivalent(1_200, 'yearly')).toBe(100);
    expect(monthlyEquivalent(1_000, 'weekly')).toBe(Math.round((1_000 * 52) / 12));
  });

  it('rolls the next due date forward past today', () => {
    expect(nextDueDate('2026-06-05', 'monthly', TODAY)).toBe('2026-10-05');
  });

  it('totals the yearly cost of every detected bill', () => {
    const payments = detectRecurringPayments(
      [
        makeTransaction({ id: '1', merchant: 'Streamly', amountCents: 1_000, date: '2026-08-05' }),
        makeTransaction({ id: '2', merchant: 'Streamly', amountCents: 1_000, date: '2026-09-05' }),
      ],
      TODAY,
    );
    expect(yearlyBillsTotal(payments)).toBe(12_000);
  });
});
