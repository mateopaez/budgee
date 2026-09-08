import type { Category, Transaction, Wallet } from '../../core/models';

/**
 * Local CSV export. Everything happens in the browser; no data leaves the
 * device.
 */
export function transactionsToCsv(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  wallets: ReadonlyMap<string, Wallet>,
): string {
  const header = [
    'date',
    'type',
    'amount_cad',
    'category',
    'merchant',
    'from_wallet',
    'to_wallet',
    'excluded_from_budget',
    'recurrence',
  ];
  const rows = transactions.map((tx) => [
    tx.date,
    tx.type,
    (tx.amountCents / 100).toFixed(2),
    categories.get(tx.categoryId)?.name ?? '',
    tx.merchant,
    tx.fromWalletId ? (wallets.get(tx.fromWalletId)?.name ?? '') : '',
    tx.toWalletId ? (wallets.get(tx.toWalletId)?.name ?? '') : '',
    tx.excludedFromBudget ? 'yes' : 'no',
    tx.recurrence,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

function escapeCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportTransactionsCsv(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  wallets: ReadonlyMap<string, Wallet>,
): void {
  if (typeof document === 'undefined') return;
  const csv = transactionsToCsv(transactions, categories, wallets);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'budgee-transactions.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
