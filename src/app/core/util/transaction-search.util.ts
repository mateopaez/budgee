import type { Transaction } from '../models/transaction.model';

/**
 * Matches transactions by name or amount.
 *
 * Text is compared case-insensitively against the title, category name and
 * note. A query that looks like a number, such as "12.4" or "$1,200", also
 * matches amounts whose two-decimal form contains it, so "12.4" finds $12.40.
 */
export function searchTransactions(
  transactions: readonly Transaction[],
  query: string,
  categoryName: (categoryId: string) => string,
): Transaction[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const amount = /^\$?[\d,]*\.?\d*$/.test(text) ? text.replace(/[$,]/g, '') : '';
  const amountQuery = /\d/.test(amount) ? amount : '';

  return transactions.filter((tx) => {
    if (amountQuery && (tx.amountCents / 100).toFixed(2).includes(amountQuery)) return true;
    return [tx.merchant, categoryName(tx.categoryId), tx.note ?? ''].some((field) =>
      field.toLowerCase().includes(text),
    );
  });
}
