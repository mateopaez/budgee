import { makeBudget } from '../testing/factories';
import {
  elapsedDaysInPeriod,
  periodContaining,
  periodLengthInDays,
  remainingDaysInPeriod,
  shiftPeriod,
} from './budget-period.util';

describe('budget period boundaries', () => {
  it('uses the calendar month when the start day is the first', () => {
    const period = periodContaining(makeBudget(), '2026-09-08');
    expect(period.start).toBe('2026-09-01');
    expect(period.end).toBe('2026-10-01');
    expect(period.label).toBe('September 2026');
  });

  it('shifts a monthly period backwards and forwards', () => {
    const budget = makeBudget();
    const period = periodContaining(budget, '2026-09-08');
    expect(shiftPeriod(budget, period, -1).start).toBe('2026-08-01');
    expect(shiftPeriod(budget, period, 2).start).toBe('2026-11-01');
  });

  it('honours a monthly start day other than the first', () => {
    const budget = makeBudget({ monthlyStartDay: 15 });
    expect(periodContaining(budget, '2026-09-14').start).toBe('2026-08-15');
    expect(periodContaining(budget, '2026-09-15').start).toBe('2026-09-15');
    expect(periodContaining(budget, '2026-09-15').end).toBe('2026-10-15');
  });

  it('produces seven day weekly periods', () => {
    const budget = makeBudget({ periodType: 'weekly', weekStartsOn: 1 });
    const period = periodContaining(budget, '2026-09-08');
    expect(period.start).toBe('2026-09-07');
    expect(period.end).toBe('2026-09-14');
    expect(periodLengthInDays(period)).toBe(7);
  });

  it('phases biweekly periods from the anchor', () => {
    const budget = makeBudget({ periodType: 'biweekly', biweeklyAnchor: '2026-09-04' });
    expect(periodContaining(budget, '2026-09-08').start).toBe('2026-09-04');
    expect(periodContaining(budget, '2026-09-18').start).toBe('2026-09-18');
    expect(periodContaining(budget, '2026-09-03').start).toBe('2026-08-21');
  });

  it('splits semi-monthly periods on the two chosen days', () => {
    const budget = makeBudget({ periodType: 'semiMonthly', semiMonthlyDays: [1, 16] });
    expect(periodContaining(budget, '2026-09-08')).toMatchObject({
      start: '2026-09-01',
      end: '2026-09-16',
    });
    expect(periodContaining(budget, '2026-09-20')).toMatchObject({
      start: '2026-09-16',
      end: '2026-10-01',
    });
  });

  it('runs yearly periods from the chosen month', () => {
    const budget = makeBudget({ periodType: 'yearly', yearlyStartMonth: 4, yearlyStartDay: 1 });
    expect(periodContaining(budget, '2026-09-08').start).toBe('2026-04-01');
    expect(periodContaining(budget, '2026-03-31').start).toBe('2025-04-01');
  });

  it('tiles the calendar with no gaps or overlaps', () => {
    const budget = makeBudget({ periodType: 'semiMonthly', semiMonthlyDays: [1, 16] });
    let period = periodContaining(budget, '2026-01-05');
    for (let i = 0; i < 24; i += 1) {
      const next = shiftPeriod(budget, period, 1);
      expect(next.start).toBe(period.end);
      period = next;
    }
  });

  it('counts remaining and elapsed days with today included as in progress', () => {
    const period = periodContaining(makeBudget(), '2026-09-08');
    expect(remainingDaysInPeriod(period, '2026-09-08')).toBe(23);
    expect(elapsedDaysInPeriod(period, '2026-09-08')).toBe(8);
    expect(remainingDaysInPeriod(period, '2026-09-30')).toBe(1);
    expect(remainingDaysInPeriod(period, '2026-10-05')).toBe(0);
    expect(elapsedDaysInPeriod(period, '2026-08-20')).toBe(0);
  });
});
