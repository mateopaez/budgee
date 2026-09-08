/**
 * Calendar date helpers.
 *
 * Budgee stores dates as plain ISO calendar strings (yyyy-mm-dd) with no time
 * or zone component. Every helper here converts through a local midnight Date
 * so that a transaction dated 2026-09-01 belongs to September no matter what
 * timezone the browser reports.
 */

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): Date {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new Error(`Not an ISO calendar date: ${value}`);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = parseIsoDate(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(targetDay, daysInMonth(d.getFullYear(), d.getMonth())));
  return toIsoDate(d);
}

export function addYears(date: IsoDate, years: number): IsoDate {
  const d = parseIsoDate(date);
  d.setFullYear(d.getFullYear() + years);
  return toIsoDate(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function startOfMonth(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonthExclusive(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

/** Whole days between two calendar dates, `to` minus `from`. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from).getTime();
  const b = parseIsoDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive lower bound, exclusive upper bound. */
export function isWithin(date: IsoDate, startInclusive: IsoDate, endExclusive: IsoDate): boolean {
  return date >= startInclusive && date < endExclusive;
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Moves back to the most recent occurrence of `weekday` (0 = Sunday). */
export function startOfWeek(date: IsoDate, weekStartsOn = 0): IsoDate {
  const d = parseIsoDate(date);
  const delta = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - delta);
  return toIsoDate(d);
}

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT = MONTH_LONG.map((m) => m.slice(0, 3));
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthLabel(date: IsoDate): string {
  const d = parseIsoDate(date);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDateLabel(date: IsoDate): string {
  const d = parseIsoDate(date);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function longDateLabel(date: IsoDate): string {
  const d = parseIsoDate(date);
  return `${MONTH_SHORT[d.getMonth()].toUpperCase()} ${d.getDate()}, ${d.getFullYear()}`;
}

export function weekdayShort(date: IsoDate): string {
  return WEEKDAY_SHORT[parseIsoDate(date).getDay()];
}

export function weekdayNames(weekStartsOn = 0): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStartsOn) % 7]);
}

/**
 * "Today", "Yesterday" or "Wed, Jul 29" style heading used by grouped lists.
 */
export function relativeDayLabel(date: IsoDate, today: IsoDate): string {
  const delta = diffDays(date, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta === -1) return 'Tomorrow';
  return `${weekdayShort(date)}, ${shortDateLabel(date)}`;
}

export function dueInLabel(date: IsoDate, today: IsoDate): string {
  const delta = diffDays(today, date);
  if (delta < 0) return 'Overdue';
  if (delta === 0) return 'Due today';
  if (delta === 1) return 'Due tomorrow';
  return `Due in ${delta} days`;
}
