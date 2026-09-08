import type { Budget, BudgetCategoryPlan, Category, CategoryGroup, Transaction, Wallet } from '../models';

/** Small builders so specs stay about the maths, not about object literals. */

export function makeTransaction(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: patch.id ?? `tx_${Math.random().toString(36).slice(2, 8)}`,
    type: 'expense',
    amountCents: 1_000,
    currency: 'CAD',
    date: '2026-09-05',
    categoryId: 'cat_groceries',
    merchant: 'Test merchant',
    fromWalletId: 'wal_spending',
    toWalletId: null,
    excludedFromBudget: false,
    recurrence: 'none',
    needsReview: false,
    linkedAccountId: null,
    createdAt: '2026-09-05T12:00:00.000Z',
    updatedAt: '2026-09-05T12:00:00.000Z',
    ...patch,
  };
}

export function makeWallet(patch: Partial<Wallet> = {}): Wallet {
  return {
    id: 'wal_spending',
    name: 'Spending',
    kind: 'spending',
    openingBalanceCents: 0,
    color: '#fff',
    icon: 'wallet',
    ...patch,
  };
}

export function makeCategory(patch: Partial<Category> = {}): Category {
  return {
    id: 'cat_groceries',
    name: 'Groceries',
    groupId: 'grp_food',
    kind: 'expense',
    icon: 'cart',
    color: '#6ba6f5',
    ...patch,
  };
}

export function makeGroup(patch: Partial<CategoryGroup> = {}): CategoryGroup {
  return { id: 'grp_food', name: 'Food', color: '#6ba6f5', order: 1, ...patch };
}

export function makePlan(patch: Partial<BudgetCategoryPlan> = {}): BudgetCategoryPlan {
  return {
    categoryId: 'cat_groceries',
    plannedCents: 50_000,
    kind: 'expense',
    expenseKind: 'variable',
    ...patch,
  };
}

export function makeBudget(patch: Partial<Budget> = {}): Budget {
  return {
    id: 'bud_test',
    name: 'Test budget',
    icon: 'home',
    periodType: 'monthly',
    monthlyStartDay: 1,
    weekStartsOn: 0,
    biweeklyAnchor: '2026-09-04',
    semiMonthlyDays: [1, 16],
    yearlyStartMonth: 1,
    yearlyStartDay: 1,
    includeAllTransactions: true,
    includeSavingsTransfers: true,
    includeDebtTransfers: false,
    insights: {
      dailyBudget: true,
      breakdown: true,
      projection: true,
      order: ['dailyBudget', 'breakdown', 'projection'],
    },
    plans: [makePlan()],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}
