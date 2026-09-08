import type { Cents } from '../models/money.model';
import type { Transaction } from '../models/transaction.model';
import {
  addDays,
  daysInMonth,
  diffDays,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
  type IsoDate,
} from './date.util';

export interface DayGroup {
  readonly date: IsoDate;
  readonly transactions: readonly Transaction[];
  /** Income minus expenses for the day. Transfers are ignored. */
  readonly netCents: Cents;
}

/** Groups transactions by calendar day, newest day first. */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const byDate = new Map<IsoDate, Transaction[]>();
  for (const tx of transactions) {
    const list = byDate.get(tx.date) ?? [];
    list.push(tx);
    byDate.set(tx.date, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      transactions: [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      netCents: list.reduce(
        (sum, tx) =>
          tx.type === 'income' ? sum + tx.amountCents : tx.type === 'expense' ? sum - tx.amountCents : sum,
        0,
      ),
    }));
}

export interface CalendarCell {
  readonly date: IsoDate | null;
  readonly dayOfMonth: number | null;
  readonly spentCents: Cents;
  readonly incomeCents: Cents;
  readonly inFuture: boolean;
}

/**
 * Builds a Sunday first month grid with per day totals derived from
 * transactions. Leading blanks keep the first row aligned to the weekday.
 */
export function buildMonthCalendar(
  monthAnchor: IsoDate,
  transactions: readonly Transaction[],
  today: IsoDate,
): CalendarCell[] {
  const first = startOfMonth(monthAnchor);
  const firstDate = parseIsoDate(first);
  const total = daysInMonth(firstDate.getFullYear(), firstDate.getMonth());
  const leading = firstDate.getDay();

  const spend = new Map<IsoDate, Cents>();
  const income = new Map<IsoDate, Cents>();
  for (const tx of transactions) {
    if (tx.excludedFromBudget || tx.type === 'transfer') continue;
    const target = tx.type === 'expense' ? spend : income;
    target.set(tx.date, (target.get(tx.date) ?? 0) + tx.amountCents);
  }

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push({ date: null, dayOfMonth: null, spentCents: 0, incomeCents: 0, inFuture: false });
  }
  for (let day = 0; day < total; day += 1) {
    const date = addDays(first, day);
    cells.push({
      date,
      dayOfMonth: day + 1,
      spentCents: spend.get(date) ?? 0,
      incomeCents: income.get(date) ?? 0,
      inFuture: date > today,
    });
  }
  return cells;
}

export interface CumulativePoint {
  readonly date: IsoDate;
  readonly dayOfMonth: number;
  readonly cumulativeCents: Cents;
}

/**
 * Running total of expenses across a date range. Used by the spend line chart,
 * which stops drawing at "today" so the future is not implied to be flat.
 */
export function cumulativeSpend(
  startInclusive: IsoDate,
  endExclusive: IsoDate,
  transactions: readonly Transaction[],
): CumulativePoint[] {
  const perDay = new Map<IsoDate, Cents>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.excludedFromBudget) continue;
    perDay.set(tx.date, (perDay.get(tx.date) ?? 0) + tx.amountCents);
  }
  const length = Math.max(0, diffDays(startInclusive, endExclusive));
  const points: CumulativePoint[] = [];
  let running = 0;
  for (let i = 0; i < length; i += 1) {
    const date = addDays(startInclusive, i);
    running += perDay.get(date) ?? 0;
    points.push({ date, dayOfMonth: parseIsoDate(date).getDate(), cumulativeCents: running });
  }
  return points;
}

export interface CategoryTotal {
  readonly categoryId: string;
  readonly totalCents: Cents;
}

export function totalsByCategory(
  transactions: readonly Transaction[],
  type: Transaction['type'],
): CategoryTotal[] {
  const map = new Map<string, Cents>();
  for (const tx of transactions) {
    if (tx.type !== type || tx.excludedFromBudget) continue;
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountCents);
  }
  return [...map.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function totalsByGroup(
  transactions: readonly Transaction[],
  type: Transaction['type'],
  groupOf: (categoryId: string) => string | undefined,
): CategoryTotal[] {
  const map = new Map<string, Cents>();
  for (const tx of transactions) {
    if (tx.type !== type || tx.excludedFromBudget) continue;
    const groupId = groupOf(tx.categoryId) ?? 'unknown';
    map.set(groupId, (map.get(groupId) ?? 0) + tx.amountCents);
  }
  return [...map.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Last N calendar months ending at the month containing `anchor`, oldest first. */
export function recentMonths(anchor: IsoDate, count: number): IsoDate[] {
  const months: IsoDate[] = [];
  const d = parseIsoDate(startOfMonth(anchor));
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(toIsoDate(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return months;
}
