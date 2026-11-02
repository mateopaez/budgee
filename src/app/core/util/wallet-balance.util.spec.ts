import { computeWalletBalances, openingBalanceForCurrent } from './wallet-balance.util';
import { makeTransaction, makeWallet } from '../testing/factories';

describe('computeWalletBalances', () => {
  it('starts from opening balances when there are no transactions', () => {
    const balances = computeWalletBalances(
      [
        makeWallet({ id: 'a', openingBalanceCents: 100 }),
        makeWallet({ id: 'b', openingBalanceCents: -50 }),
      ],
      [],
    );
    expect(balances.get('a')).toBe(100);
    expect(balances.get('b')).toBe(-50);
  });

  it('turns the balance a user sees today into the stored anchor', () => {
    const transactions = [
      makeTransaction({
        id: 'e1',
        type: 'expense',
        amountCents: 2_000,
        fromWalletId: 'a',
        toWalletId: null,
      }),
      makeTransaction({
        id: 'i1',
        type: 'income',
        amountCents: 5_000,
        fromWalletId: null,
        toWalletId: 'a',
      }),
    ];
    const opening = openingBalanceForCurrent('a', transactions, 10_000);
    expect(opening).toBe(7_000);
    const balances = computeWalletBalances(
      [makeWallet({ id: 'a', openingBalanceCents: opening })],
      transactions,
    );
    expect(balances.get('a')).toBe(10_000);
  });

  it('keeps the stored anchor when the entered balance already matches', () => {
    const wallet = makeWallet({ id: 'a', openingBalanceCents: 7_000 });
    const transactions = [
      makeTransaction({
        id: 'e1',
        type: 'expense',
        amountCents: 2_000,
        fromWalletId: 'a',
      }),
    ];
    const current = computeWalletBalances([wallet], transactions).get('a') ?? 0;
    expect(openingBalanceForCurrent('a', transactions, current)).toBe(7_000);
  });
});
