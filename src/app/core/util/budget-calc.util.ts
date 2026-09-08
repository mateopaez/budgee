import type { Budget, BudgetPeriod } from '../models/budget.model';
import type { Category, CategoryGroup } from '../models/category.model';
import type { Cents } from '../models/money.model';
import type { Transaction } from '../models/transaction.model';
import type { Wallet } from '../models/wallet.model';
import { isWithin, type IsoDate } from './date.util';
import { remainingDaysInPeriod } from './budget-period.util';

/**
 * Budget mathematics.
 *
 * The rules, in one place:
 *
 *  - Expense transactions reduce the availability of their category.
 *  - Income transactions increase income totals only.
 *  - Transfers are ignored by default. They are counted only when the budget
 *    opts in to savings or debt transfers, and even then they never become
 *    income or an expense: a transfer into a savings wallet lands in the
 *    savings bucket.
 *  - Transactions flagged `excludedFromBudget` never affect any total.
 *  - categoryRemaining = plannedAmount - includedExpenseSpend
 *  - leftToSpend      = sum(planned expense) - sum(included expenses in planned expense categories)
 *  - dailyBudget      = leftToSpend / max(1, remainingDaysInBudgetPeriod)
 *  - Included expenses in categories with no plan are reported separately as
 *    "Other expenses" and are never folded into leftToSpend.
 */

export type BudgetState = 'under' | 'exact' | 'over';

export interface CategoryStatus {
  readonly categoryId: string;
  readonly plannedCents: Cents;
  readonly spentCents: Cents;
  /** planned - spent. Negative means over budget. */
  readonly remainingCents: Cents;
  /** 0..1 clamped, used to draw progress rings. */
  readonly progress: number;
  readonly state: BudgetState;
}

export interface GroupStatus {
  readonly groupId: string;
  readonly name: string;
  readonly color: string;
  readonly plannedCents: Cents;
  readonly spentCents: Cents;
  readonly remainingCents: Cents;
  readonly state: BudgetState;
  readonly categories: readonly CategoryStatus[];
}

export interface BudgetBreakdown {
  readonly incomeActual: Cents;
  readonly incomePlanned: Cents;
  readonly savingsActual: Cents;
  readonly savingsPlanned: Cents;
  readonly fixedActual: Cents;
  readonly fixedPlanned: Cents;
  readonly variableActual: Cents;
  readonly variablePlanned: Cents;
  readonly otherActual: Cents;
}

export interface BudgetProjection extends BudgetBreakdown {
  readonly projectedIncome: Cents;
  readonly projectedSavings: Cents;
  readonly projectedFixed: Cents;
  readonly projectedVariable: Cents;
  readonly projectedOther: Cents;
  readonly projectedResult: Cents;
}

export interface BudgetSummary {
  readonly period: BudgetPeriod;
  readonly incomeCents: Cents;
  readonly expensesCents: Cents;
  readonly transfersCents: Cents;
  readonly plannedExpenseCents: Cents;
  readonly plannedIncomeCents: Cents;
  readonly plannedSavingsCents: Cents;
  readonly spentOnPlannedCents: Cents;
  readonly otherExpensesCents: Cents;
  readonly leftToSpendCents: Cents;
  readonly dailyBudgetCents: Cents;
  readonly remainingDays: number;
  readonly groups: readonly GroupStatus[];
  readonly breakdown: BudgetBreakdown;
  readonly projection: BudgetProjection;
}

export function isInPeriod(tx: Transaction, period: BudgetPeriod): boolean {
  return isWithin(tx.date, period.start, period.end);
}

/**
 * Decides whether a transaction may influence budget totals at all.
 * Transfers are only admitted when the budget opts in for the wallet kinds
 * involved.
 */
export function isBudgetIncluded(
  tx: Transaction,
  budget: Budget,
  walletsById: ReadonlyMap<string, Wallet>,
): boolean {
  if (tx.excludedFromBudget) return false;
  if (tx.type !== 'transfer') return true;

  const from = tx.fromWalletId ? walletsById.get(tx.fromWalletId) : undefined;
  const to = tx.toWalletId ? walletsById.get(tx.toWalletId) : undefined;
  const kinds = [from?.kind, to?.kind];
  if (kinds.includes('savings')) return budget.includeSavingsTransfers;
  if (kinds.includes('debt')) return budget.includeDebtTransfers;
  return false;
}

/** Sum of included transactions of one type inside the period. */
export function totalByType(
  transactions: readonly Transaction[],
  type: Transaction['type'],
): Cents {
  return transactions.reduce((sum, tx) => (tx.type === type ? sum + tx.amountCents : sum), 0);
}

/** Spend per category id, expenses only. */
export function expenseSpendByCategory(
  transactions: readonly Transaction[],
): Map<string, Cents> {
  const map = new Map<string, Cents>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountCents);
  }
  return map;
}

/** Money moved into savings wallets, keyed by the transfer's category. */
export function savingsByCategory(
  transactions: readonly Transaction[],
  walletsById: ReadonlyMap<string, Wallet>,
): Map<string, Cents> {
  const map = new Map<string, Cents>();
  for (const tx of transactions) {
    if (tx.type !== 'transfer') continue;
    const to = tx.toWalletId ? walletsById.get(tx.toWalletId) : undefined;
    if (to?.kind !== 'savings') continue;
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountCents);
  }
  return map;
}

export function categoryStatus(plannedCents: Cents, spentCents: Cents): CategoryStatus {
  const remainingCents = plannedCents - spentCents;
  const state: BudgetState = remainingCents > 0 ? 'under' : remainingCents === 0 ? 'exact' : 'over';
  const progress = plannedCents > 0 ? Math.min(1, Math.max(0, spentCents / plannedCents)) : spentCents > 0 ? 1 : 0;
  return { categoryId: '', plannedCents, spentCents, remainingCents, progress, state };
}

export interface BudgetSummaryInput {
  readonly budget: Budget;
  readonly period: BudgetPeriod;
  readonly transactions: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly groups: readonly CategoryGroup[];
  readonly wallets: readonly Wallet[];
  readonly today: IsoDate;
}

/**
 * Single source of truth for every budget figure shown in the app.
 * Pure in, pure out, so it is straightforward to unit test.
 */
export function computeBudgetSummary(input: BudgetSummaryInput): BudgetSummary {
  const { budget, period, categories, groups, today } = input;
  const walletsById = new Map(input.wallets.map((w) => [w.id, w]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const inPeriod = input.transactions.filter((tx) => isInPeriod(tx, period));
  const included = inPeriod.filter((tx) => isBudgetIncluded(tx, budget, walletsById));

  const incomeCents = totalByType(included, 'income');
  const expensesCents = totalByType(included, 'expense');
  const transfersCents = totalByType(included, 'transfer');

  const spendByCategory = expenseSpendByCategory(included);
  const savingsSpend = savingsByCategory(included, walletsById);

  const expensePlans = budget.plans.filter((p) => p.kind === 'expense');
  const incomePlans = budget.plans.filter((p) => p.kind === 'income');
  const savingsPlans = budget.plans.filter((p) => p.kind === 'savings');

  const plannedExpenseCents = sum(expensePlans.map((p) => p.plannedCents));
  const plannedIncomeCents = sum(incomePlans.map((p) => p.plannedCents));
  const plannedSavingsCents = sum(savingsPlans.map((p) => p.plannedCents));

  const plannedExpenseIds = new Set(expensePlans.map((p) => p.categoryId));
  const spentOnPlannedCents = sum(
    expensePlans.map((p) => spendByCategory.get(p.categoryId) ?? 0),
  );

  // Included expenses that have no plan at all.
  let otherExpensesCents = 0;
  if (budget.includeAllTransactions) {
    for (const [categoryId, cents] of spendByCategory) {
      if (!plannedExpenseIds.has(categoryId)) otherExpensesCents += cents;
    }
  }

  const leftToSpendCents = plannedExpenseCents - spentOnPlannedCents;
  const remainingDays = remainingDaysInPeriod(period, today);
  const dailyBudgetCents = Math.round(leftToSpendCents / Math.max(1, remainingDays));

  const groupStatuses = buildGroupStatuses({
    budget,
    groups,
    categoriesById,
    spendByCategory,
    savingsSpend,
  });

  const fixedPlans = expensePlans.filter((p) => p.expenseKind === 'fixed');
  const variablePlans = expensePlans.filter((p) => p.expenseKind === 'variable');

  const breakdown: BudgetBreakdown = {
    incomeActual: incomeCents,
    incomePlanned: plannedIncomeCents,
    savingsActual: sum(savingsPlans.map((p) => savingsSpend.get(p.categoryId) ?? 0)),
    savingsPlanned: plannedSavingsCents,
    fixedActual: sum(fixedPlans.map((p) => spendByCategory.get(p.categoryId) ?? 0)),
    fixedPlanned: sum(fixedPlans.map((p) => p.plannedCents)),
    variableActual: sum(variablePlans.map((p) => spendByCategory.get(p.categoryId) ?? 0)),
    variablePlanned: sum(variablePlans.map((p) => p.plannedCents)),
    otherActual: otherExpensesCents,
  };

  return {
    period,
    incomeCents,
    expensesCents,
    transfersCents,
    plannedExpenseCents,
    plannedIncomeCents,
    plannedSavingsCents,
    spentOnPlannedCents,
    otherExpensesCents,
    leftToSpendCents,
    dailyBudgetCents,
    remainingDays,
    groups: groupStatuses,
    breakdown,
    projection: projectPeriod(breakdown),
  };
}

/**
 * Projected end of period result.
 *
 * Assumption, stated plainly: the user will at least follow the plan for the
 * rest of the period, and where a bucket has already exceeded its plan the
 * actual figure is carried forward instead. So each bucket is projected as
 * max(actual so far, planned). Unplanned "Other expenses" have no plan to fall
 * back on, so they are carried at their actual value.
 */
export function projectPeriod(breakdown: BudgetBreakdown): BudgetProjection {
  const projectedIncome = Math.max(breakdown.incomeActual, breakdown.incomePlanned);
  const projectedSavings = Math.max(breakdown.savingsActual, breakdown.savingsPlanned);
  const projectedFixed = Math.max(breakdown.fixedActual, breakdown.fixedPlanned);
  const projectedVariable = Math.max(breakdown.variableActual, breakdown.variablePlanned);
  const projectedOther = breakdown.otherActual;
  return {
    ...breakdown,
    projectedIncome,
    projectedSavings,
    projectedFixed,
    projectedVariable,
    projectedOther,
    projectedResult:
      projectedIncome - projectedSavings - projectedFixed - projectedVariable - projectedOther,
  };
}

interface GroupStatusInput {
  readonly budget: Budget;
  readonly groups: readonly CategoryGroup[];
  readonly categoriesById: ReadonlyMap<string, Category>;
  readonly spendByCategory: ReadonlyMap<string, Cents>;
  readonly savingsSpend: ReadonlyMap<string, Cents>;
}

function buildGroupStatuses(input: GroupStatusInput): GroupStatus[] {
  const { budget, groups, categoriesById, spendByCategory, savingsSpend } = input;
  const byGroup = new Map<string, CategoryStatus[]>();

  for (const plan of budget.plans) {
    const category = categoriesById.get(plan.categoryId);
    if (!category) continue;
    const spentCents =
      plan.kind === 'savings'
        ? (savingsSpend.get(plan.categoryId) ?? 0)
        : plan.kind === 'income'
          ? 0
          : (spendByCategory.get(plan.categoryId) ?? 0);
    const status: CategoryStatus = {
      ...categoryStatus(plan.plannedCents, spentCents),
      categoryId: plan.categoryId,
    };
    const list = byGroup.get(category.groupId) ?? [];
    list.push(status);
    byGroup.set(category.groupId, list);
  }

  return groups
    .filter((g) => (byGroup.get(g.id)?.length ?? 0) > 0)
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const categories = byGroup.get(group.id) ?? [];
      const plannedCents = sum(categories.map((c) => c.plannedCents));
      const spentCents = sum(categories.map((c) => c.spentCents));
      const remainingCents = plannedCents - spentCents;
      return {
        groupId: group.id,
        name: group.name,
        color: group.color,
        plannedCents,
        spentCents,
        remainingCents,
        state: remainingCents > 0 ? 'under' : remainingCents === 0 ? 'exact' : 'over',
        categories,
      } satisfies GroupStatus;
    });
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
