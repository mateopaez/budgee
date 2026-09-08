import {
  makeBudget,
  makeCategory,
  makeGroup,
  makePlan,
  makeTransaction,
  makeWallet,
} from '../testing/factories';
import { periodContaining } from './budget-period.util';
import {
  categoryStatus,
  computeBudgetSummary,
  expenseSpendByCategory,
  isBudgetIncluded,
  projectPeriod,
  totalByType,
} from './budget-calc.util';

const TODAY = '2026-09-08';

const wallets = [
  makeWallet(),
  makeWallet({ id: 'wal_savings', name: 'Savings', kind: 'savings' }),
  makeWallet({ id: 'wal_credit', name: 'Credit card', kind: 'debt' }),
];

const categories = [
  makeCategory(),
  makeCategory({ id: 'cat_rent', name: 'Rent', groupId: 'grp_home', icon: 'home' }),
  makeCategory({ id: 'cat_misc', name: 'Miscellaneous', groupId: 'grp_misc', icon: 'box' }),
  makeCategory({ id: 'cat_salary', name: 'Salary', groupId: 'grp_income', kind: 'income', icon: 'banknote' }),
  makeCategory({ id: 'cat_savings', name: 'Savings', groupId: 'grp_income', kind: 'transfer', icon: 'piggy' }),
];

const groups = [
  makeGroup(),
  makeGroup({ id: 'grp_home', name: 'Household', order: 2 }),
  makeGroup({ id: 'grp_misc', name: 'Miscellaneous', order: 3 }),
  makeGroup({ id: 'grp_income', name: 'Income', order: 4 }),
];

function summaryFor(transactions: ReturnType<typeof makeTransaction>[], budgetPatch = {}) {
  const budget = makeBudget({
    plans: [
      makePlan({ categoryId: 'cat_groceries', plannedCents: 50_000, expenseKind: 'variable' }),
      makePlan({ categoryId: 'cat_rent', plannedCents: 100_000, expenseKind: 'fixed' }),
      makePlan({ categoryId: 'cat_salary', plannedCents: 200_000, kind: 'income' }),
      makePlan({ categoryId: 'cat_savings', plannedCents: 20_000, kind: 'savings' }),
    ],
    ...budgetPatch,
  });
  return computeBudgetSummary({
    budget,
    period: periodContaining(budget, TODAY),
    transactions,
    categories,
    groups,
    wallets,
    today: TODAY,
  });
}

describe('transaction totals by type', () => {
  const transactions = [
    makeTransaction({ type: 'expense', amountCents: 5_000 }),
    makeTransaction({ type: 'expense', amountCents: 2_500 }),
    makeTransaction({ type: 'income', amountCents: 190_000 }),
    makeTransaction({ type: 'transfer', amountCents: 20_000 }),
  ];

  it('sums each type independently', () => {
    expect(totalByType(transactions, 'expense')).toBe(7_500);
    expect(totalByType(transactions, 'income')).toBe(190_000);
    expect(totalByType(transactions, 'transfer')).toBe(20_000);
  });

  it('groups expense spend by category', () => {
    const spend = expenseSpendByCategory(transactions);
    expect(spend.get('cat_groceries')).toBe(7_500);
  });
});

describe('transfer handling', () => {
  const budget = makeBudget();
  const byId = new Map(wallets.map((w) => [w.id, w]));

  it('ignores wallet to wallet transfers that touch neither savings nor debt', () => {
    const tx = makeTransaction({
      type: 'transfer',
      fromWalletId: 'wal_spending',
      toWalletId: 'wal_spending',
    });
    expect(isBudgetIncluded(tx, budget, byId)).toBe(false);
  });

  it('includes savings transfers when the budget opts in', () => {
    const tx = makeTransaction({
      type: 'transfer',
      fromWalletId: 'wal_spending',
      toWalletId: 'wal_savings',
    });
    expect(isBudgetIncluded(tx, budget, byId)).toBe(true);
    expect(isBudgetIncluded(tx, makeBudget({ includeSavingsTransfers: false }), byId)).toBe(false);
  });

  it('excludes debt transfers unless the budget opts in', () => {
    const tx = makeTransaction({
      type: 'transfer',
      fromWalletId: 'wal_spending',
      toWalletId: 'wal_credit',
    });
    expect(isBudgetIncluded(tx, budget, byId)).toBe(false);
    expect(isBudgetIncluded(tx, makeBudget({ includeDebtTransfers: true }), byId)).toBe(true);
  });

  it('never counts a transfer as income or an expense', () => {
    const summary = summaryFor([
      makeTransaction({
        type: 'transfer',
        amountCents: 20_000,
        categoryId: 'cat_savings',
        fromWalletId: 'wal_spending',
        toWalletId: 'wal_savings',
      }),
    ]);
    expect(summary.incomeCents).toBe(0);
    expect(summary.expensesCents).toBe(0);
    expect(summary.transfersCents).toBe(20_000);
    expect(summary.breakdown.savingsActual).toBe(20_000);
  });
});

describe('excluded transactions', () => {
  it('leaves every total untouched', () => {
    const included = summaryFor([makeTransaction({ amountCents: 12_000 })]);
    const excluded = summaryFor([
      makeTransaction({ amountCents: 12_000, excludedFromBudget: true }),
    ]);
    expect(included.expensesCents).toBe(12_000);
    expect(excluded.expensesCents).toBe(0);
    expect(excluded.leftToSpendCents).toBe(150_000);
  });
});

describe('category remaining', () => {
  it('is planned minus included spend', () => {
    const status = categoryStatus(50_000, 18_000);
    expect(status.remainingCents).toBe(32_000);
    expect(status.state).toBe('under');
    expect(status.progress).toBeCloseTo(0.36, 5);
  });

  it('reports exactly on budget', () => {
    expect(categoryStatus(50_000, 50_000).state).toBe('exact');
  });

  it('reports over budget with a negative remainder and a clamped ring', () => {
    const status = categoryStatus(50_000, 62_000);
    expect(status.state).toBe('over');
    expect(status.remainingCents).toBe(-12_000);
    expect(status.progress).toBe(1);
  });
});

describe('left to spend and daily budget', () => {
  it('subtracts only spend in planned expense categories', () => {
    const summary = summaryFor([
      makeTransaction({ categoryId: 'cat_groceries', amountCents: 20_000 }),
      makeTransaction({ categoryId: 'cat_rent', amountCents: 100_000 }),
      makeTransaction({ categoryId: 'cat_misc', amountCents: 7_000 }),
    ]);
    expect(summary.plannedExpenseCents).toBe(150_000);
    expect(summary.spentOnPlannedCents).toBe(120_000);
    expect(summary.leftToSpendCents).toBe(30_000);
  });

  it('reports unplanned spend separately as other expenses', () => {
    const summary = summaryFor([makeTransaction({ categoryId: 'cat_misc', amountCents: 7_000 })]);
    expect(summary.otherExpensesCents).toBe(7_000);
    expect(summary.leftToSpendCents).toBe(150_000);
  });

  it('drops other expenses when the budget does not include all transactions', () => {
    const summary = summaryFor([makeTransaction({ categoryId: 'cat_misc', amountCents: 7_000 })], {
      includeAllTransactions: false,
    });
    expect(summary.otherExpensesCents).toBe(0);
  });

  it('divides what is left by the remaining days', () => {
    const summary = summaryFor([
      makeTransaction({ categoryId: 'cat_groceries', amountCents: 27_000 }),
    ]);
    // 150000 planned - 27000 spent = 123000 across 23 remaining days.
    expect(summary.remainingDays).toBe(23);
    expect(summary.dailyBudgetCents).toBe(Math.round(123_000 / 23));
  });

  it('never divides by zero once the period has ended', () => {
    const budget = makeBudget();
    const summary = computeBudgetSummary({
      budget,
      period: periodContaining(budget, '2026-08-15'),
      transactions: [],
      categories,
      groups,
      wallets,
      today: TODAY,
    });
    expect(summary.remainingDays).toBe(0);
    expect(Number.isFinite(summary.dailyBudgetCents)).toBe(true);
  });
});

describe('projection', () => {
  it('carries each bucket at the larger of actual and planned', () => {
    const projection = projectPeriod({
      incomeActual: 459_300,
      incomePlanned: 260_000,
      savingsActual: 50_000,
      savingsPlanned: 50_000,
      fixedActual: 208_500,
      fixedPlanned: 216_000,
      variableActual: 182_200,
      variablePlanned: 160_000,
      otherActual: 5_900,
    });
    expect(projection.projectedIncome).toBe(459_300);
    expect(projection.projectedFixed).toBe(216_000);
    expect(projection.projectedVariable).toBe(182_200);
    expect(projection.projectedResult).toBe(459_300 - 50_000 - 216_000 - 182_200 - 5_900);
  });
});

describe('group roll up', () => {
  it('rolls categories into their groups and marks the state', () => {
    const summary = summaryFor([
      makeTransaction({ categoryId: 'cat_groceries', amountCents: 60_000 }),
    ]);
    const food = summary.groups.find((g) => g.groupId === 'grp_food');
    expect(food?.spentCents).toBe(60_000);
    expect(food?.remainingCents).toBe(-10_000);
    expect(food?.state).toBe('over');
  });

  it('ignores transactions from another period', () => {
    const summary = summaryFor([
      makeTransaction({ categoryId: 'cat_groceries', amountCents: 60_000, date: '2026-08-30' }),
    ]);
    expect(summary.expensesCents).toBe(0);
  });
});
