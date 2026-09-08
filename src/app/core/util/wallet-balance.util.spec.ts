import { computeWalletBalances } from './wallet-balance.util';
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
});
