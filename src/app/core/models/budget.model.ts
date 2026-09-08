import type { Cents } from './money.model';

export type BudgetPeriodType = 'monthly' | 'weekly' | 'biweekly' | 'semiMonthly' | 'yearly';

/** How a planned expense behaves, used by the Insights breakdown. */
export type PlannedExpenseKind = 'fixed' | 'variable';

/**
 * `savings` plans are money the user intends to move out of spending and into
 * a savings wallet. They are planned outflows but they are not expenses, so
 * they sit in their own bucket in the Insights breakdown.
 */
export type PlanKind = 'expense' | 'income' | 'savings';

export interface BudgetCategoryPlan {
  readonly categoryId: string;
  readonly plannedCents: Cents;
  readonly kind: PlanKind;
  /** Only meaningful for expense plans. */
  readonly expenseKind: PlannedExpenseKind;
}

export interface BudgetInsightSettings {
  readonly dailyBudget: boolean;
  readonly breakdown: boolean;
  readonly projection: boolean;
  /** Presentational ordering of the insight cards. */
  readonly order: readonly ('dailyBudget' | 'breakdown' | 'projection')[];
}

export interface Budget {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly periodType: BudgetPeriodType;
  /** 1..28 for monthly budgets. */
  readonly monthlyStartDay: number;
  /** 0 = Sunday .. 6 = Saturday, for weekly and biweekly budgets. */
  readonly weekStartsOn: number;
  /** ISO date of any known period start, used to phase biweekly periods. */
  readonly biweeklyAnchor: string;
  /** Two days of the month for semi monthly budgets, for example [1, 16]. */
  readonly semiMonthlyDays: readonly [number, number];
  /** 1..12 and 1..28 for yearly budgets. */
  readonly yearlyStartMonth: number;
  readonly yearlyStartDay: number;
  /** Count spending in unplanned categories as "Other expenses". */
  readonly includeAllTransactions: boolean;
  /** Count transfers that move money into or out of savings wallets. */
  readonly includeSavingsTransfers: boolean;
  /** Count transfers that move money into or out of debt wallets. */
  readonly includeDebtTransfers: boolean;
  readonly insights: BudgetInsightSettings;
  readonly plans: readonly BudgetCategoryPlan[];
  readonly createdAt: string;
}

/** Half open interval [start, end) covering exactly one budget period. */
export interface BudgetPeriod {
  /** ISO yyyy-mm-dd, inclusive. */
  readonly start: string;
  /** ISO yyyy-mm-dd, exclusive. */
  readonly end: string;
  /** Human label such as "September 2026" or "Sep 1 - Sep 14". */
  readonly label: string;
}
