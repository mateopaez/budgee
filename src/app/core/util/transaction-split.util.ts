import type { Cents } from '../models/money.model';
import type { Transaction, TransactionSplit } from '../models/transaction.model';

export interface ExpenseAllocation {
  readonly categoryId: string;
  readonly amountCents: Cents;
}

/** True when the transaction is broken into category lines. */
export function hasSplits(tx: Pick<Transaction, 'splits'>): boolean {
  return (tx.splits?.length ?? 0) >= 2;
}

/**
 * Category lines that count toward budget / spend totals.
 * Settled splits are omitted; excluded transactions yield nothing.
 */
export function budgetExpenseAllocations(
  tx: Pick<Transaction, 'type' | 'amountCents' | 'categoryId' | 'excludedFromBudget' | 'splits'>,
): readonly ExpenseAllocation[] {
  if (tx.type !== 'expense' || tx.excludedFromBudget) return [];
  if (hasSplits(tx)) {
    return (tx.splits ?? [])
      .filter((split) => !split.settled && split.amountCents > 0)
      .map((split) => ({ categoryId: split.categoryId, amountCents: split.amountCents }));
  }
  return tx.amountCents > 0 ? [{ categoryId: tx.categoryId, amountCents: tx.amountCents }] : [];
}

/** Budget-facing expense total (settled splits excluded). */
export function budgetExpenseCents(
  tx: Pick<Transaction, 'type' | 'amountCents' | 'categoryId' | 'excludedFromBudget' | 'splits'>,
): Cents {
  return budgetExpenseAllocations(tx).reduce((sum, line) => sum + line.amountCents, 0);
}

/** Primary category for list rows: first unsettled split, else first split, else categoryId. */
export function displayCategoryId(tx: Pick<Transaction, 'categoryId' | 'splits'>): string {
  if (!hasSplits(tx) || !tx.splits) return tx.categoryId;
  const unsettled = tx.splits.find((split) => !split.settled);
  return unsettled?.categoryId ?? tx.splits[0]?.categoryId ?? tx.categoryId;
}

export function splitsSumCents(splits: readonly Pick<TransactionSplit, 'amountCents'>[]): Cents {
  return splits.reduce((sum, split) => sum + split.amountCents, 0);
}
