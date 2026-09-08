import type { Cents } from '../models/money.model';
import type { RecurringCadence, RecurringPayment } from '../models/recurring.model';
import type { Transaction } from '../models/transaction.model';
import { addDays, addMonths, addYears, diffDays, type IsoDate } from './date.util';

/**
 * Recurring payment detection.
 *
 * This is a transparent heuristic over the user's own transactions, not a
 * judgement about whether a payment is needed. Budgee only reports that money
 * leaves on a regular rhythm so the user can review it.
 *
 * The rule: group expenses by a normalised merchant name, require at least two
 * occurrences, require the gaps between them to be consistent, and require the
 * amounts to be close to each other.
 */

const CADENCE_DAYS: Record<RecurringCadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

/** Tolerance in days around the nominal gap for each cadence. */
const CADENCE_TOLERANCE: Record<RecurringCadence, number> = {
  weekly: 2,
  biweekly: 3,
  monthly: 6,
  quarterly: 12,
  yearly: 30,
};

export function normaliseMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#*]/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyGap(days: number): RecurringCadence | null {
  const entries = Object.entries(CADENCE_DAYS) as [RecurringCadence, number][];
  for (const [cadence, nominal] of entries) {
    if (Math.abs(days - nominal) <= CADENCE_TOLERANCE[cadence]) return cadence;
  }
  return null;
}

export function monthlyEquivalent(amountCents: Cents, cadence: RecurringCadence): Cents {
  switch (cadence) {
    case 'weekly':
      return Math.round((amountCents * 52) / 12);
    case 'biweekly':
      return Math.round((amountCents * 26) / 12);
    case 'monthly':
      return amountCents;
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
  }
}

export function advanceByCadence(date: IsoDate, cadence: RecurringCadence): IsoDate {
  switch (cadence) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addMonths(date, 3);
    case 'yearly':
      return addYears(date, 1);
  }
}

export function nextDueDate(lastChargedOn: IsoDate, cadence: RecurringCadence, today: IsoDate): IsoDate {
  let next = advanceByCadence(lastChargedOn, cadence);
  let guard = 0;
  while (next < today && guard < 60) {
    next = advanceByCadence(next, cadence);
    guard += 1;
  }
  return next;
}

/**
 * Finds recurring expenses. Returns them sorted by monthly cost, biggest first.
 */
export function detectRecurringPayments(
  transactions: readonly Transaction[],
  today: IsoDate,
): RecurringPayment[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = normaliseMerchant(tx.merchant);
    if (key.length < 3) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const results: RecurringPayment[] = [];

  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(diffDays(sorted[i - 1].date, sorted[i].date));
    }
    const cadences = gaps.map(classifyGap);
    const cadence = cadences[0];
    if (!cadence || !cadences.every((c) => c === cadence)) continue;

    const amounts = sorted.map((t) => t.amountCents);
    const typical = amounts[amounts.length - 1];
    const spread = Math.max(...amounts) - Math.min(...amounts);
    // Amounts must be within 15 percent of the latest charge to count.
    if (typical > 0 && spread / typical > 0.15) continue;

    const last = sorted[sorted.length - 1];
    results.push({
      id: `rec_${key.replace(/ /g, '-')}`,
      merchant: last.merchant,
      categoryId: last.categoryId,
      amountCents: typical,
      cadence,
      monthlyCents: monthlyEquivalent(typical, cadence),
      lastChargedOn: last.date,
      nextDueOn: nextDueDate(last.date, cadence, today),
      occurrences: sorted.length,
      transactionIds: sorted.map((t) => t.id),
    });
  }

  return results.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

export function yearlyBillsTotal(payments: readonly RecurringPayment[]): Cents {
  return payments.reduce((sum, p) => sum + p.monthlyCents * 12, 0);
}
