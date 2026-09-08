import type { Budget, BudgetPeriod, BudgetPeriodType } from '../models/budget.model';
import {
  addDays,
  addYears,
  daysInMonth,
  diffDays,
  monthLabel,
  parseIsoDate,
  shortDateLabel,
  startOfWeek,
  toIsoDate,
  type IsoDate,
} from './date.util';

/**
 * Budget period boundaries.
 *
 * Every period is a half open interval [start, end). Periods tile the calendar
 * with no gaps and no overlaps, which is what makes "which period does this
 * transaction belong to" a single comparison.
 */

export const PERIOD_LABELS: Record<BudgetPeriodType, string> = {
  monthly: 'Monthly budget',
  weekly: 'Weekly budget',
  biweekly: 'Biweekly budget',
  semiMonthly: 'Semi-monthly budget',
  yearly: 'Yearly budget',
};

function dayInMonth(year: number, monthIndex: number, day: number): IsoDate {
  const clamped = Math.min(day, daysInMonth(year, monthIndex));
  return toIsoDate(new Date(year, monthIndex, clamped));
}

function monthlyStartOnOrBefore(date: IsoDate, startDay: number): IsoDate {
  const d = parseIsoDate(date);
  const candidate = dayInMonth(d.getFullYear(), d.getMonth(), startDay);
  if (candidate <= date) return candidate;
  return dayInMonth(d.getFullYear(), d.getMonth() - 1, startDay);
}

function semiMonthlyStartOnOrBefore(date: IsoDate, days: readonly [number, number]): IsoDate {
  const [first, second] = [...days].sort((a, b) => a - b);
  const d = parseIsoDate(date);
  const candidates = [
    dayInMonth(d.getFullYear(), d.getMonth() - 1, second),
    dayInMonth(d.getFullYear(), d.getMonth(), first),
    dayInMonth(d.getFullYear(), d.getMonth(), second),
  ].filter((c) => c <= date);
  return candidates[candidates.length - 1];
}

function yearlyStartOnOrBefore(date: IsoDate, month: number, day: number): IsoDate {
  const d = parseIsoDate(date);
  const candidate = dayInMonth(d.getFullYear(), month - 1, day);
  if (candidate <= date) return candidate;
  return dayInMonth(d.getFullYear() - 1, month - 1, day);
}

/** First day of the budget period that contains `date`. */
export function periodStartFor(budget: Budget, date: IsoDate): IsoDate {
  switch (budget.periodType) {
    case 'monthly':
      return monthlyStartOnOrBefore(date, budget.monthlyStartDay);
    case 'weekly':
      return startOfWeek(date, budget.weekStartsOn);
    case 'biweekly': {
      const offset = diffDays(budget.biweeklyAnchor, date);
      const periods = Math.floor(offset / 14);
      return addDays(budget.biweeklyAnchor, periods * 14);
    }
    case 'semiMonthly':
      return semiMonthlyStartOnOrBefore(date, budget.semiMonthlyDays);
    case 'yearly':
      return yearlyStartOnOrBefore(date, budget.yearlyStartMonth, budget.yearlyStartDay);
  }
}

/** First day of the period that follows the one starting at `start`. */
export function nextPeriodStart(budget: Budget, start: IsoDate): IsoDate {
  const d = parseIsoDate(start);
  switch (budget.periodType) {
    case 'monthly':
      return dayInMonth(d.getFullYear(), d.getMonth() + 1, budget.monthlyStartDay);
    case 'weekly':
      return addDays(start, 7);
    case 'biweekly':
      return addDays(start, 14);
    case 'semiMonthly': {
      const [first, second] = [...budget.semiMonthlyDays].sort((a, b) => a - b);
      const isFirstHalf = d.getDate() === Math.min(first, daysInMonth(d.getFullYear(), d.getMonth()));
      return isFirstHalf
        ? dayInMonth(d.getFullYear(), d.getMonth(), second)
        : dayInMonth(d.getFullYear(), d.getMonth() + 1, first);
    }
    case 'yearly':
      return addYears(start, 1);
  }
}

export function previousPeriodStart(budget: Budget, start: IsoDate): IsoDate {
  // Stepping back one day lands inside the previous period by construction.
  return periodStartFor(budget, addDays(start, -1));
}

export function periodLabel(budget: Budget, start: IsoDate, endExclusive: IsoDate): string {
  const lastDay = addDays(endExclusive, -1);
  if (budget.periodType === 'monthly' && budget.monthlyStartDay === 1) {
    return monthLabel(start);
  }
  if (budget.periodType === 'yearly') {
    return `${shortDateLabel(start)}, ${parseIsoDate(start).getFullYear()} - ${shortDateLabel(lastDay)}, ${parseIsoDate(lastDay).getFullYear()}`;
  }
  return `${shortDateLabel(start)} - ${shortDateLabel(lastDay)}`;
}

/** The budget period containing `date`. */
export function periodContaining(budget: Budget, date: IsoDate): BudgetPeriod {
  const start = periodStartFor(budget, date);
  const end = nextPeriodStart(budget, start);
  return { start, end, label: periodLabel(budget, start, end) };
}

/** Moves `offset` whole periods forward (positive) or back (negative). */
export function shiftPeriod(budget: Budget, period: BudgetPeriod, offset: number): BudgetPeriod {
  let start = period.start;
  for (let i = 0; i < Math.abs(offset); i += 1) {
    start = offset > 0 ? nextPeriodStart(budget, start) : previousPeriodStart(budget, start);
  }
  const end = nextPeriodStart(budget, start);
  return { start, end, label: periodLabel(budget, start, end) };
}

export function periodLengthInDays(period: BudgetPeriod): number {
  return diffDays(period.start, period.end);
}

/**
 * Days still to come in the period, counting today as remaining. Clamped to at
 * least one so the daily budget never divides by zero, and clamped to the
 * period length when `today` sits before the period starts.
 */
export function remainingDaysInPeriod(period: BudgetPeriod, today: IsoDate): number {
  const length = periodLengthInDays(period);
  if (today < period.start) return length;
  if (today >= period.end) return 0;
  return Math.max(1, diffDays(today, period.end));
}

/** Days already elapsed, counting today as in progress. */
export function elapsedDaysInPeriod(period: BudgetPeriod, today: IsoDate): number {
  const length = periodLengthInDays(period);
  if (today < period.start) return 0;
  if (today >= period.end) return length;
  return Math.min(length, diffDays(period.start, today) + 1);
}
