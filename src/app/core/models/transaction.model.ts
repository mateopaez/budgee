import type { Cents, CurrencyCode } from './money.model';

export type TransactionType = 'expense' | 'income' | 'transfer';

export type RecurrenceRule = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * A single money movement.
 *
 * amountCents is always a positive magnitude. The sign shown in the UI is
 * derived from `type`, which keeps every aggregation free of sign handling
 * bugs.
 */
export interface Transaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly amountCents: Cents;
  readonly currency: CurrencyCode;
  /** Calendar date in ISO yyyy-mm-dd form, interpreted in the user's local zone. */
  readonly date: string;
  readonly categoryId: string;
  readonly merchant: string;
  readonly note?: string;
  /** Source wallet for expenses and transfers. Null for income. */
  readonly fromWalletId: string | null;
  /** Destination wallet for income and transfers. Null for expenses. */
  readonly toWalletId: string | null;
  /** Excluded transactions never affect budget or summary totals. */
  readonly excludedFromBudget: boolean;
  readonly recurrence: RecurrenceRule;
  /** Imported rows can arrive without a confident category. */
  readonly needsReview: boolean;
  readonly linkedAccountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The shape the transaction editor produces. Ids and timestamps are added by the store. */
export interface TransactionDraft {
  readonly type: TransactionType;
  readonly amountCents: Cents;
  readonly date: string;
  readonly categoryId: string;
  readonly merchant: string;
  readonly note?: string;
  readonly fromWalletId: string | null;
  readonly toWalletId: string | null;
  readonly excludedFromBudget: boolean;
  readonly recurrence: RecurrenceRule;
}
