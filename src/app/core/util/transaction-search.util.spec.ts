import { makeTransaction } from '../testing/factories';
import { searchTransactions } from './transaction-search.util';

describe('transaction search', () => {
  const transactions = [
    makeTransaction({ id: 'tx_1', merchant: 'Maple Grocers', amountCents: 1_240 }),
    makeTransaction({
      id: 'tx_2',
      merchant: 'Transit pass',
      amountCents: 15_600,
      categoryId: 'cat_transit',
    }),
    makeTransaction({ id: 'tx_3', merchant: '', amountCents: 120_000, note: 'September rent' }),
  ];
  const names: Record<string, string> = { cat_groceries: 'Groceries', cat_transit: 'Transit' };
  const categoryName = (id: string) => names[id] ?? '';
  const ids = (query: string) =>
    searchTransactions(transactions, query, categoryName).map((tx) => tx.id);

  it('matches the title, category and note without case', () => {
    expect(ids('maple')).toEqual(['tx_1']);
    expect(ids('TRANSIT')).toEqual(['tx_2']);
    expect(ids('rent')).toEqual(['tx_3']);
  });

  it('matches amounts typed as numbers', () => {
    expect(ids('12.4')).toEqual(['tx_1']);
    expect(ids('$1,200')).toEqual(['tx_3']);
  });

  it('returns nothing for a blank or unmatched query', () => {
    expect(ids('   ')).toEqual([]);
    expect(ids('zzz')).toEqual([]);
  });
});
