import type {
  Budget,
  BudgetCategoryPlan,
  Category,
  CategoryGroup,
  LinkedAccount,
  ProviderConnection,
  Transaction,
  UserPreferences,
  Wallet,
} from '../models';
import { addMonths, addDays, daysInMonth, parseIsoDate, startOfMonth, type IsoDate } from '../util/date.util';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, DEFAULT_GROUPS } from './taxonomy';

/**
 * Deterministic Canadian dollar demo dataset.
 *
 * Fixed recurring commitments are declared explicitly. Everyday variable
 * spending is generated from a seeded pseudo random sequence so the dataset is
 * rich but reproducible: the same seed always produces the same transactions,
 * which keeps charts, calendars and budget figures coherent between reloads.
 */

/** The pinned "today" used by demo mode. */
export const DEMO_TODAY: IsoDate = '2026-09-26';

export const WALLET_IDS = {
  spending: 'wal_spending',
  savings: 'wal_savings',
  credit: 'wal_credit',
  cash: 'wal_cash',
} as const;

export const DEMO_CONNECTION_ID = 'con_demo_northline';

export function demoWallets(): Wallet[] {
  return [
    { id: WALLET_IDS.spending, name: 'Spending', kind: 'spending', openingBalanceCents: 142_200, color: 'var(--color-cat-food)', icon: 'wallet' },
    { id: WALLET_IDS.savings, name: 'Savings', kind: 'savings', openingBalanceCents: 519_200, color: 'var(--color-cat-savings)', icon: 'piggy' },
    { id: WALLET_IDS.credit, name: 'Credit card', kind: 'debt', openingBalanceCents: -84_300, color: 'var(--color-cat-entertainment)', icon: 'card' },
    { id: WALLET_IDS.cash, name: 'Cash', kind: 'cash', openingBalanceCents: 6_000, color: 'var(--color-cat-income)', icon: 'banknote' },
  ];
}

export function demoCategories(): Category[] {
  return [...DEFAULT_CATEGORIES];
}

export function demoGroups(): CategoryGroup[] {
  return [...DEFAULT_GROUPS];
}

export function demoConnections(): ProviderConnection[] {
  return [
    {
      id: DEMO_CONNECTION_ID,
      provider: 'demo',
      institutionName: 'Northline Bank (demo)',
      status: 'connected',
      lastSyncAt: `${DEMO_TODAY}T09:12:00.000Z`,
    },
  ];
}

export function demoLinkedAccounts(): LinkedAccount[] {
  return [
    {
      id: 'acc_demo_checking',
      connectionId: DEMO_CONNECTION_ID,
      institutionName: 'Northline Bank (demo)',
      name: 'Everyday Chequing',
      mask: '4821',
      type: 'checking',
      balanceCents: 142_200,
      walletId: WALLET_IDS.spending,
    },
    {
      id: 'acc_demo_savings',
      connectionId: DEMO_CONNECTION_ID,
      institutionName: 'Northline Bank (demo)',
      name: 'High Interest Savings',
      mask: '7730',
      type: 'savings',
      balanceCents: 519_200,
      walletId: WALLET_IDS.savings,
    },
  ];
}

const PLANS: readonly BudgetCategoryPlan[] = [
  { categoryId: CATEGORY_IDS.rent, plannedCents: 175_000, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.internet, plannedCents: 5_900, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.insurance, plannedCents: 14_000, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.utilities, plannedCents: 11_000, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.groceries, plannedCents: 55_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.restaurant, plannedCents: 25_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.coffee, plannedCents: 8_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.gas, plannedCents: 18_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.parking, plannedCents: 6_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.healthcare, plannedCents: 15_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.gym, plannedCents: 4_500, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.clothes, plannedCents: 12_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.subscription, plannedCents: 4_500, kind: 'expense', expenseKind: 'fixed' },
  { categoryId: CATEGORY_IDS.cinema, plannedCents: 4_000, kind: 'expense', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.salary, plannedCents: 380_000, kind: 'income', expenseKind: 'variable' },
  { categoryId: CATEGORY_IDS.savings, plannedCents: 50_000, kind: 'savings', expenseKind: 'variable' },
];

export const DEMO_BUDGET_ID = 'bud_demo';

export function demoBudget(): Budget {
  return {
    id: DEMO_BUDGET_ID,
    name: 'Demo Budget',
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
    plans: PLANS,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

export function defaultPreferences(): UserPreferences {
  return {
    currency: 'CAD',
    locale: 'en-CA',
    showDoubleDecimals: false,
    roundSummaryAmounts: true,
    showSaveInTabBar: true,
    defaultExpenseCategoryId: CATEGORY_IDS.misc,
    defaultIncomeCategoryId: CATEGORY_IDS.salary,
    defaultTransferCategoryId: CATEGORY_IDS.savings,
    overviewAccent: 'overview',
    budgetAccent: 'budget',
    walletAccent: 'tools',
    demoMode: true,
  };
}

/** Deterministic 32 bit PRNG so the dataset never shifts between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FixedEntry {
  readonly day: number;
  readonly merchant: string;
  readonly categoryId: string;
  readonly amountCents: number;
  readonly type: 'expense' | 'income' | 'transfer';
  readonly recurrence: 'monthly' | 'biweekly' | 'none';
  readonly fromWalletId?: string | null;
  readonly toWalletId?: string | null;
}

/** Merchant names here are invented for Budgee, not real businesses. */
const FIXED_ENTRIES: readonly FixedEntry[] = [
  { day: 1, merchant: 'Riverside Rentals', categoryId: CATEGORY_IDS.rent, amountCents: 175_000, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 2, merchant: 'Nimbus Internet', categoryId: CATEGORY_IDS.internet, amountCents: 5_900, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 3, merchant: 'Prairie Power', categoryId: CATEGORY_IDS.utilities, amountCents: 10_450, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 4, merchant: 'Harbour Insurance', categoryId: CATEGORY_IDS.insurance, amountCents: 14_000, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 5, merchant: 'Streamly', categoryId: CATEGORY_IDS.subscription, amountCents: 1_899, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.credit },
  { day: 6, merchant: 'Tunebox', categoryId: CATEGORY_IDS.subscription, amountCents: 1_199, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.credit },
  { day: 7, merchant: 'Cloudgym', categoryId: CATEGORY_IDS.gym, amountCents: 4_499, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 8, merchant: 'Vista Mobile', categoryId: CATEGORY_IDS.utilities, amountCents: 6_500, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 12, merchant: 'Maple Student Loan', categoryId: CATEGORY_IDS.studentLoan, amountCents: 41_928, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 15, merchant: 'Monthly account fee', categoryId: CATEGORY_IDS.bankCost, amountCents: 1_195, type: 'expense', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending },
  { day: 1, merchant: 'Payroll deposit', categoryId: CATEGORY_IDS.salary, amountCents: 190_000, type: 'income', recurrence: 'biweekly', toWalletId: WALLET_IDS.spending },
  { day: 15, merchant: 'Payroll deposit', categoryId: CATEGORY_IDS.salary, amountCents: 190_000, type: 'income', recurrence: 'biweekly', toWalletId: WALLET_IDS.spending },
  { day: 17, merchant: 'Savings transfer', categoryId: CATEGORY_IDS.savings, amountCents: 50_000, type: 'transfer', recurrence: 'monthly', fromWalletId: WALLET_IDS.spending, toWalletId: WALLET_IDS.savings },
  { day: 28, merchant: 'Interest credit', categoryId: CATEGORY_IDS.interest, amountCents: 412, type: 'income', recurrence: 'monthly', toWalletId: WALLET_IDS.savings },
];

interface VariableTemplate {
  readonly merchants: readonly string[];
  readonly categoryId: string;
  /** Expected number of purchases per 30 days. */
  readonly perMonth: number;
  readonly minCents: number;
  readonly maxCents: number;
  readonly wallet: string;
}

const VARIABLE_TEMPLATES: readonly VariableTemplate[] = [
  { merchants: ['Maple Grocers', 'Green Basket Market', 'Corner Fresh'], categoryId: CATEGORY_IDS.groceries, perMonth: 8, minCents: 2_400, maxCents: 11_800, wallet: WALLET_IDS.spending },
  { merchants: ['Bean & Bloom', 'Third Street Coffee'], categoryId: CATEGORY_IDS.coffee, perMonth: 11, minCents: 380, maxCents: 960, wallet: WALLET_IDS.spending },
  { merchants: ['Copperleaf Kitchen', 'Noodle House', 'Taco Vista', 'The Salt Room'], categoryId: CATEGORY_IDS.restaurant, perMonth: 6, minCents: 1_800, maxCents: 7_400, wallet: WALLET_IDS.credit },
  { merchants: ['Northgate Fuel', 'Highway 12 Gas'], categoryId: CATEGORY_IDS.gas, perMonth: 4, minCents: 4_200, maxCents: 9_100, wallet: WALLET_IDS.credit },
  { merchants: ['City Parking', 'Lot 44'], categoryId: CATEGORY_IDS.parking, perMonth: 5, minCents: 400, maxCents: 2_600, wallet: WALLET_IDS.spending },
  { merchants: ['Wovenwear', 'Trailhead Outfitters'], categoryId: CATEGORY_IDS.clothes, perMonth: 1, minCents: 3_500, maxCents: 14_000, wallet: WALLET_IDS.credit },
  { merchants: ['PixelPlay Cinema'], categoryId: CATEGORY_IDS.cinema, perMonth: 1, minCents: 1_600, maxCents: 4_800, wallet: WALLET_IDS.credit },
  { merchants: ['Ridgeway Pharmacy', 'Bright Dental'], categoryId: CATEGORY_IDS.healthcare, perMonth: 1, minCents: 2_000, maxCents: 12_000, wallet: WALLET_IDS.spending },
  { merchants: ['Transit pass top up'], categoryId: CATEGORY_IDS.transit, perMonth: 2, minCents: 500, maxCents: 3_200, wallet: WALLET_IDS.spending },
  { merchants: ['Hardware Depot', 'Homestead Supply'], categoryId: CATEGORY_IDS.supplies, perMonth: 1, minCents: 1_200, maxCents: 8_800, wallet: WALLET_IDS.spending },
];

function tx(partial: Omit<Transaction, 'currency' | 'createdAt' | 'updatedAt'>): Transaction {
  return {
    ...partial,
    currency: 'CAD',
    createdAt: `${partial.date}T12:00:00.000Z`,
    updatedAt: `${partial.date}T12:00:00.000Z`,
  };
}

/**
 * Builds the seeded transaction history.
 * `monthsBack` months of history are produced, ending on `today`.
 */
export function demoTransactions(today: IsoDate = DEMO_TODAY, monthsBack = 3): Transaction[] {
  const random = mulberry32(20260908);
  const result: Transaction[] = [];
  const firstMonth = startOfMonth(addMonths(today, -(monthsBack - 1)));

  for (let m = 0; m < monthsBack; m += 1) {
    const monthStart = startOfMonth(addMonths(firstMonth, m));
    const monthDate = parseIsoDate(monthStart);
    const length = daysInMonth(monthDate.getFullYear(), monthDate.getMonth());

    for (const entry of FIXED_ENTRIES) {
      if (entry.day > length) continue;
      const date = addDays(monthStart, entry.day - 1);
      if (date > today) continue;
      result.push(
        tx({
          id: `txd_${date}_${entry.categoryId}_${entry.day}`,
          type: entry.type,
          amountCents: entry.amountCents,
          date,
          categoryId: entry.categoryId,
          merchant: entry.merchant,
          fromWalletId: entry.fromWalletId ?? null,
          toWalletId: entry.toWalletId ?? null,
          excludedFromBudget: false,
          recurrence: entry.recurrence === 'none' ? 'none' : entry.recurrence,
          needsReview: false,
          linkedAccountId: 'acc_demo_checking',
        }),
      );
    }

    for (const template of VARIABLE_TEMPLATES) {
      const count = Math.round(template.perMonth * (length / 30));
      for (let i = 0; i < count; i += 1) {
        const day = 1 + Math.floor(random() * length);
        const date = addDays(monthStart, day - 1);
        if (date > today) continue;
        const amountCents =
          template.minCents + Math.round(random() * (template.maxCents - template.minCents));
        const merchant = template.merchants[Math.floor(random() * template.merchants.length)];
        result.push(
          tx({
            id: `txv_${date}_${template.categoryId}_${i}`,
            type: 'expense',
            amountCents,
            date,
            categoryId: template.categoryId,
            merchant,
            fromWalletId: template.wallet,
            toWalletId: null,
            excludedFromBudget: false,
            recurrence: 'none',
            needsReview: false,
            linkedAccountId: template.wallet === WALLET_IDS.credit ? 'acc_demo_checking' : 'acc_demo_checking',
          }),
        );
      }
    }
  }

  // A few imported looking rows that still need a category, so the review flow
  // has something real to act on.
  const review: readonly (readonly [string, string, number])[] = [
    [addDays(today, -1), 'POS PURCHASE 8841', 6_312],
    [addDays(today, -2), 'E-TFR RECEIVED', 19_200],
    [addDays(today, -4), 'SQ *VENDOR 2214', 2_845],
  ];
  review.forEach(([date, merchant, amountCents], index) => {
    result.push(
      tx({
        id: `txr_${index}`,
        type: merchant.includes('RECEIVED') ? 'income' : 'expense',
        amountCents,
        date,
        categoryId: CATEGORY_IDS.unknown,
        merchant,
        fromWalletId: merchant.includes('RECEIVED') ? null : WALLET_IDS.spending,
        toWalletId: merchant.includes('RECEIVED') ? WALLET_IDS.spending : null,
        excludedFromBudget: false,
        recurrence: 'none',
        needsReview: true,
        linkedAccountId: 'acc_demo_checking',
      }),
    );
  });

  return result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
