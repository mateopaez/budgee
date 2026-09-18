import { makeTransaction } from '../testing/factories';
import {
  budgetExpenseAllocations,
  budgetExpenseCents,
  displayCategoryId,
  hasSplits,
} from './transaction-split.util';

describe('transaction splits', () => {
  it('treats unsplit expenses as a single allocation', () => {
    const tx = makeTransaction({ categoryId: 'cat_restaurant', amountCents: 10_000 });
    expect(hasSplits(tx)).toBe(false);
    expect(budgetExpenseCents(tx)).toBe(10_000);
    expect(budgetExpenseAllocations(tx)).toEqual([
      { categoryId: 'cat_restaurant', amountCents: 10_000 },
    ]);
  });

  it('allocates split lines and skips settled ones', () => {
    const tx = makeTransaction({
      categoryId: 'cat_restaurant',
      amountCents: 10_000,
      splits: [
        { id: 's1', categoryId: 'cat_restaurant', amountCents: 3_000, settled: false },
        { id: 's2', categoryId: 'cat_expected_reimbursement', amountCents: 7_000, settled: false },
      ],
    });
    expect(hasSplits(tx)).toBe(true);
    expect(budgetExpenseAllocations(tx)).toEqual([
      { categoryId: 'cat_restaurant', amountCents: 3_000 },
      { categoryId: 'cat_expected_reimbursement', amountCents: 7_000 },
    ]);
    expect(budgetExpenseCents(tx)).toBe(10_000);

    const settled = makeTransaction({
      ...tx,
      splits: [
        { id: 's1', categoryId: 'cat_restaurant', amountCents: 3_000, settled: false },
        { id: 's2', categoryId: 'cat_expected_reimbursement', amountCents: 7_000, settled: true },
      ],
    });
    expect(budgetExpenseAllocations(settled)).toEqual([
      { categoryId: 'cat_restaurant', amountCents: 3_000 },
    ]);
    expect(budgetExpenseCents(settled)).toBe(3_000);
    expect(displayCategoryId(settled)).toBe('cat_restaurant');
  });

  it('ignores excluded transactions entirely', () => {
    const tx = makeTransaction({
      excludedFromBudget: true,
      amountCents: 10_000,
      splits: [
        { id: 's1', categoryId: 'cat_restaurant', amountCents: 3_000, settled: false },
        { id: 's2', categoryId: 'cat_expected_reimbursement', amountCents: 7_000, settled: false },
      ],
    });
    expect(budgetExpenseCents(tx)).toBe(0);
    expect(budgetExpenseAllocations(tx)).toEqual([]);
  });
});
