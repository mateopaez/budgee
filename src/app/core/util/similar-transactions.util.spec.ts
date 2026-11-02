import { CATEGORY_IDS } from '../data/taxonomy';
import { makeTransaction } from '../testing/factories';
import { findSimilarUncategorized, merchantKey } from './similar-transactions.util';

describe('similar transactions', () => {
  const unknown = { categoryId: CATEGORY_IDS.unknown, needsReview: true };
  const ids = (
    source: ReturnType<typeof makeTransaction>,
    others: ReturnType<typeof makeTransaction>[],
  ) => findSimilarUncategorized(source, [source, ...others]).map((tx) => tx.id);

  it('drops store numbers, case and province codes from merchant names', () => {
    expect(merchantKey('NO FRILLS #3512 TORONTO ON')).toBe('no frills toronto');
    expect(merchantKey('No Frills 0841')).toBe('no frills');
  });

  it('matches the same store with different branch details', () => {
    const source = makeTransaction({ id: 'src', merchant: 'No Frills 0841' });
    expect(
      ids(source, [
        makeTransaction({ id: 'a', merchant: 'NO FRILLS #3512 TORONTO ON', ...unknown }),
        makeTransaction({ id: 'b', merchant: 'Metro', ...unknown }),
      ]),
    ).toEqual(['a']);
  });

  it('only picks transactions that still need a category', () => {
    const source = makeTransaction({
      id: 'src',
      merchant: 'NSLSC',
      categoryId: 'cat_student_loan',
    });
    expect(
      ids(source, [
        makeTransaction({ id: 'a', merchant: 'NSLSC', ...unknown }),
        makeTransaction({ id: 'b', merchant: 'NSLSC', categoryId: 'cat_gifts' }),
        makeTransaction({
          id: 'c',
          merchant: 'NSLSC',
          ...unknown,
          type: 'income',
          toWalletId: 'w',
        }),
      ]),
    ).toEqual(['a']);
  });

  it('matches e-transfers by name, or by amount when there is no name', () => {
    const named = makeTransaction({
      id: 'src',
      merchant: 'E-TRANSFER SENT Jane Doe',
      categoryId: 'cat_rent',
    });
    expect(
      ids(named, [
        makeTransaction({ id: 'a', merchant: 'Interac e-Transfer sent JANE DOE', ...unknown }),
        makeTransaction({ id: 'b', merchant: 'E-TRANSFER SENT Sam Lee', ...unknown }),
      ]),
    ).toEqual(['a']);

    const bare = makeTransaction({
      id: 'src',
      merchant: 'INTERAC E-TRANSFER',
      amountCents: 150_000,
    });
    expect(
      ids(bare, [
        makeTransaction({
          id: 'a',
          merchant: 'INTERAC E-TRANSFER',
          amountCents: 150_000,
          ...unknown,
        }),
        makeTransaction({
          id: 'b',
          merchant: 'INTERAC E-TRANSFER',
          amountCents: 4_000,
          ...unknown,
        }),
      ]),
    ).toEqual(['a']);
  });

  it('offers nothing for an Unknown choice or a short name', () => {
    expect(
      ids(makeTransaction({ id: 'src', merchant: 'NSLSC', ...unknown }), [
        makeTransaction({ id: 'a', merchant: 'NSLSC', ...unknown }),
      ]),
    ).toEqual([]);
    expect(
      ids(makeTransaction({ id: 'src', merchant: 'A&W' }), [
        makeTransaction({ id: 'a', merchant: 'A&W Calgary', ...unknown }),
      ]),
    ).toEqual([]);
  });
});
