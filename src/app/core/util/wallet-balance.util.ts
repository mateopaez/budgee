import type { Cents } from '../models/money.model';
import type { Transaction, Wallet } from '../models';

/**
 * Ledger-derived wallet balances.
 *
 * Wallets store only an opening balance. Current balances are always computed
 * from the transaction ledger so they cannot drift from recorded movements.
 *
 * currentBalance = openingBalance
 *   + income entering the wallet
 *   - expenses leaving the wallet
 *   + transfers entering the wallet
 *   - transfers leaving the wallet
 *
 * Excluded-from-budget transactions still affect wallet balances.
 */
export function computeWalletBalances(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
): ReadonlyMap<string, Cents> {
  const balances = new Map<string, number>();
  for (const wallet of wallets) balances.set(wallet.id, wallet.openingBalanceCents);

  for (const tx of transactions) {
    if (tx.type === 'expense' && tx.fromWalletId) {
      balances.set(tx.fromWalletId, (balances.get(tx.fromWalletId) ?? 0) - tx.amountCents);
    } else if (tx.type === 'income' && tx.toWalletId) {
      balances.set(tx.toWalletId, (balances.get(tx.toWalletId) ?? 0) + tx.amountCents);
    } else if (tx.type === 'transfer') {
      if (tx.fromWalletId) {
        balances.set(tx.fromWalletId, (balances.get(tx.fromWalletId) ?? 0) - tx.amountCents);
      }
      if (tx.toWalletId) {
        balances.set(tx.toWalletId, (balances.get(tx.toWalletId) ?? 0) + tx.amountCents);
      }
    }
  }

  return balances;
}
