import type { Cents } from '../models/money.model';
import type { Transaction, Wallet } from '../models';

/**
 * Ledger-derived wallet balances.
 *
 * A wallet stores the anchor that made the ledger match the current balance
 * the user entered. Displayed balances stay derived from the ledger, so a
 * later transaction moves them without another manual edit.
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

/**
 * Anchor that makes the ledger show `currentBalanceCents` for this wallet.
 * Transactions already recorded are subtracted, so the user can type the
 * balance their bank shows today and leave it alone after that.
 */
export function openingBalanceForCurrent(
  walletId: string,
  transactions: readonly Transaction[],
  currentBalanceCents: Cents,
): Cents {
  const net =
    computeWalletBalances([zeroAnchor(walletId)], transactions).get(walletId) ?? 0;
  return currentBalanceCents - net;
}

function zeroAnchor(id: string): Wallet {
  return {
    id,
    name: '',
    kind: 'spending',
    openingBalanceCents: 0,
    color: '',
    icon: 'wallet',
  };
}
