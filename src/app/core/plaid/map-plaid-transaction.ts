import { CATEGORY_IDS } from '../data/taxonomy';
import type { LinkedAccountType } from '../models/connection.model';
import type { CurrencyCode } from '../models/money.model';
import type { Transaction } from '../models/transaction.model';
import { addDays, type IsoDate } from '../util/date.util';

/**
 * Plaid's Transactions default is 90 days. Production will not request fewer
 * than 30, so one month is the shortest history a new connection can pull.
 */
export const TRANSACTION_HISTORY_DAYS = 30;

/** First calendar day included in a sync window of {@link TRANSACTION_HISTORY_DAYS}. */
export function transactionHistoryStart(today: IsoDate): IsoDate {
  return addDays(today, -(TRANSACTION_HISTORY_DAYS - 1));
}

/**
 * Pure Plaid → Budgee mapping. This file imports neither the Plaid SDK nor
 * any secret, so unit tests can run it with plain objects.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PlaidTransactionInput {
  readonly transactionId: string;
  readonly accountId: string;
  readonly amount: number;
  readonly isoCurrencyCode: string | null;
  readonly date: string;
  readonly name: string;
  readonly merchantName: string | null;
  readonly pending: boolean;
}

export interface PlaidAccountLink {
  readonly linkedAccountId: string;
  readonly walletId: string | null;
}

export interface ApplyPlaidSyncInput {
  readonly added: readonly PlaidTransactionInput[];
  readonly modified: readonly PlaidTransactionInput[];
  readonly removedIds: readonly string[];
  readonly existing: readonly Transaction[];
  readonly accountsByPlaidId: ReadonlyMap<string, PlaidAccountLink>;
  readonly now: string;
  readonly createId: () => string;
  /**
   * When set, new rows dated before this day are skipped. Updates to rows
   * already stored still apply, so a shorter window does not freeze old edits.
   */
  readonly oldestDate?: IsoDate;
}

export interface PlaidSyncUpsert {
  readonly transaction: Transaction;
  /** False when a row with this external id was already stored. */
  readonly isNew: boolean;
}

export interface ApplyPlaidSyncResult {
  readonly upserts: readonly PlaidSyncUpsert[];
  readonly deleteIds: readonly string[];
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
  readonly skipped: number;
}

/**
 * Plaid returns only changes after a stored cursor. After a reset those rows
 * are gone, so the next sync must omit the cursor and download history again.
 */
export function syncCursor(storedCursor: string, localImportCount: number): string {
  if (localImportCount > 0) return storedCursor;
  return '';
}

/** Expense leaves the wallet. Income arrives in the wallet. */
export function walletIdsForImport(
  type: 'expense' | 'income',
  walletId: string | null,
): { fromWalletId: string | null; toWalletId: string | null } {
  if (type === 'income') return { fromWalletId: null, toWalletId: walletId };
  return { fromWalletId: walletId, toWalletId: null };
}

/** Plaid account type onto Budgee's account union. Unknown kinds are skipped. */
export function mapPlaidAccountKind(
  type: string,
  subtype: string | null,
): LinkedAccountType | null {
  if (type === 'credit') return 'credit';
  if (type === 'loan') return 'loan';
  if (type === 'depository' && subtype === 'checking') return 'checking';
  if (type === 'depository' && subtype === 'savings') return 'savings';
  return null;
}

export function applyPlaidSync(input: ApplyPlaidSyncInput): ApplyPlaidSyncResult {
  const existingIds = new Set(
    input.existing.flatMap((tx) => (tx.externalId ? [tx.externalId] : [])),
  );
  const byExternal = new Map<string, Transaction>();
  for (const tx of input.existing) {
    if (tx.externalId) byExternal.set(tx.externalId, tx);
  }

  const upserts = new Map<string, PlaidSyncUpsert>();
  let added = 0;
  let modified = 0;
  let skipped = 0;

  const consider = (row: PlaidTransactionInput): void => {
    const prior = byExternal.get(row.transactionId);
    if (!prior && input.oldestDate && row.date < input.oldestDate) {
      skipped += 1;
      return;
    }
    const mapped = mapOne(row, prior, input);
    if (!mapped) {
      skipped += 1;
      return;
    }
    if (prior) modified += 1;
    else added += 1;
    byExternal.set(row.transactionId, mapped);
    upserts.set(mapped.id, { transaction: mapped, isNew: !prior });
  };

  for (const row of input.added) consider(row);
  for (const row of input.modified) consider(row);

  const deleteIds: string[] = [];
  let removed = 0;
  for (const externalId of input.removedIds) {
    const prior = byExternal.get(externalId);
    if (!prior) continue;
    const staged = upserts.get(prior.id);
    if (staged) {
      if (staged.isNew) added -= 1;
      else modified -= 1;
      upserts.delete(prior.id);
    }
    if (existingIds.has(externalId)) {
      deleteIds.push(prior.id);
      removed += 1;
    }
    byExternal.delete(externalId);
  }

  return {
    upserts: [...upserts.values()],
    deleteIds,
    added,
    modified,
    removed,
    skipped,
  };
}

function mapOne(
  row: PlaidTransactionInput,
  prior: Transaction | undefined,
  input: ApplyPlaidSyncInput,
): Transaction | null {
  if (row.pending) return null;
  if (!Number.isFinite(row.amount) || row.amount === 0) return null;
  if (row.isoCurrencyCode !== 'CAD' && row.isoCurrencyCode !== 'USD') return null;
  if (!ISO_DATE.test(row.date)) return null;
  const link = input.accountsByPlaidId.get(row.accountId);
  if (!link) return null;

  const currency: CurrencyCode = row.isoCurrencyCode;
  const type = row.amount > 0 ? 'expense' : 'income';
  const amountCents = Math.round(Math.abs(row.amount) * 100);
  if (amountCents <= 0) return null;
  const merchant = row.merchantName?.trim() || row.name.trim() || 'Unknown merchant';
  const { fromWalletId, toWalletId } = walletIdsForImport(type, link.walletId);

  if (prior) {
    return {
      ...prior,
      type,
      amountCents,
      currency,
      date: row.date,
      merchant,
      fromWalletId,
      toWalletId,
      linkedAccountId: link.linkedAccountId,
      updatedAt: input.now,
    };
  }

  return {
    id: input.createId(),
    type,
    amountCents,
    currency,
    date: row.date,
    categoryId: CATEGORY_IDS.unknown,
    merchant,
    fromWalletId,
    toWalletId,
    excludedFromBudget: currency !== 'CAD',
    recurrence: 'none',
    needsReview: true,
    linkedAccountId: link.linkedAccountId,
    externalId: row.transactionId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
