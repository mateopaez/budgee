import { Timestamp, type DocumentData } from 'firebase/firestore';

export interface FirestoreSnapLike {
  readonly id: string;
  data(): DocumentData;
}
import type {
  Budget,
  BudgetCategoryPlan,
  BudgetInsightSettings,
  BudgetPeriodType,
  Category,
  CategoryGroup,
  CategoryKind,
  LinkedAccount,
  LinkedAccountType,
  PlannedExpenseKind,
  PlanKind,
  ProviderConnection,
  ConnectionProvider,
  ConnectionStatus,
  RecurrenceRule,
  Transaction,
  TransactionType,
  UserPreferences,
  Wallet,
  WalletKind,
} from '../models';
import type { IconName } from '../../shared/ui/icon-set';
import type { WorkspaceDataMode } from './workspace';

/** Profile fields stored on users/{uid}. Collections live as subcollections. */
export interface UserProfileDoc {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly onboardingCompleted: boolean;
  readonly activeBudgetId: string | null;
  readonly dataMode: WorkspaceDataMode;
  readonly demoSeededAt: string | null;
  readonly preferences: UserPreferences;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

/** Accepts Firestore Timestamp, ISO string, or Date. */
export function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date(0).toISOString();
}

export function isoToTimestamp(iso: string): Timestamp {
  const date = new Date(iso);
  return Timestamp.fromDate(Number.isNaN(date.getTime()) ? new Date(0) : date);
}

export function mapPreferences(raw: unknown): UserPreferences {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    currency: asString(data['currency'], 'CAD') as UserPreferences['currency'],
    locale: asString(data['locale'], 'en-CA'),
    showDoubleDecimals: asBoolean(data['showDoubleDecimals'], false),
    roundSummaryAmounts: asBoolean(data['roundSummaryAmounts'], true),
    showSaveInTabBar: asBoolean(data['showSaveInTabBar'], true),
    defaultExpenseCategoryId: asString(data['defaultExpenseCategoryId']),
    defaultIncomeCategoryId: asString(data['defaultIncomeCategoryId']),
    defaultTransferCategoryId: asString(data['defaultTransferCategoryId']),
    overviewAccent: asString(data['overviewAccent'], 'overview'),
    budgetAccent: asString(data['budgetAccent'], 'budget'),
    walletAccent: asString(data['walletAccent'], 'tools'),
    demoMode: asBoolean(data['demoMode'], false),
  };
}

export function mapUserProfile(id: string, data: DocumentData): UserProfileDoc {
  const dataModeRaw = data['dataMode'];
  const dataMode: WorkspaceDataMode =
    dataModeRaw === 'demo' || dataModeRaw === 'manual' ? dataModeRaw : 'manual';
  return {
    displayName: asNullableString(data['displayName']),
    email: asNullableString(data['email']),
    createdAt: timestampToIso(data['createdAt']),
    updatedAt: timestampToIso(data['updatedAt']),
    onboardingCompleted: asBoolean(data['onboardingCompleted'], false),
    activeBudgetId: asNullableString(data['activeBudgetId']),
    dataMode,
    demoSeededAt: data['demoSeededAt'] ? timestampToIso(data['demoSeededAt']) : null,
    preferences: mapPreferences(data['preferences']),
  };
}

export function userProfileToDoc(profile: UserProfileDoc): DocumentData {
  return {
    displayName: profile.displayName,
    email: profile.email,
    createdAt: isoToTimestamp(profile.createdAt),
    updatedAt: isoToTimestamp(profile.updatedAt),
    onboardingCompleted: profile.onboardingCompleted,
    activeBudgetId: profile.activeBudgetId,
    dataMode: profile.dataMode,
    demoSeededAt: profile.demoSeededAt ? isoToTimestamp(profile.demoSeededAt) : null,
    preferences: { ...profile.preferences },
  };
}

export function mapCategoryGroup(snap: FirestoreSnapLike): CategoryGroup {
  const data = snap.data();
  return {
    id: snap.id,
    name: asString(data['name']),
    color: asString(data['color']),
    order: asNumber(data['order']),
  };
}

export function categoryGroupToDoc(group: CategoryGroup): DocumentData {
  return {
    name: group.name,
    color: group.color,
    order: group.order,
  };
}

export function mapCategory(snap: FirestoreSnapLike): Category {
  const data = snap.data();
  return {
    id: snap.id,
    name: asString(data['name']),
    groupId: asString(data['groupId']),
    kind: asString(data['kind'], 'expense') as CategoryKind,
    icon: asString(data['icon'], 'box') as IconName,
    color: asString(data['color']),
    system: data['system'] === true ? true : undefined,
    archived: data['archived'] === true ? true : undefined,
  };
}

export function categoryToDoc(category: Category): DocumentData {
  return {
    name: category.name,
    groupId: category.groupId,
    kind: category.kind,
    icon: category.icon,
    color: category.color,
    ...(category.system ? { system: true } : {}),
    ...(category.archived ? { archived: true } : {}),
  };
}

export function mapWallet(snap: FirestoreSnapLike): Wallet {
  const data = snap.data();
  return {
    id: snap.id,
    name: asString(data['name']),
    kind: asString(data['kind'], 'spending') as WalletKind,
    openingBalanceCents: asNumber(data['openingBalanceCents']),
    color: asString(data['color']),
    icon: asString(data['icon'], 'wallet') as IconName,
    archived: data['archived'] === true ? true : undefined,
  };
}

export function walletToDoc(wallet: Wallet): DocumentData {
  return {
    name: wallet.name,
    kind: wallet.kind,
    openingBalanceCents: wallet.openingBalanceCents,
    color: wallet.color,
    icon: wallet.icon,
    ...(wallet.archived ? { archived: true } : {}),
  };
}

function mapPlan(raw: unknown): BudgetCategoryPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const categoryId = asString(data['categoryId']);
  if (!categoryId) return null;
  return {
    categoryId,
    plannedCents: asNumber(data['plannedCents']),
    kind: asString(data['kind'], 'expense') as PlanKind,
    expenseKind: asString(data['expenseKind'], 'variable') as PlannedExpenseKind,
  };
}

function mapInsights(raw: unknown): BudgetInsightSettings {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const orderRaw = data['order'];
  const order =
    Array.isArray(orderRaw) && orderRaw.every((item) => typeof item === 'string')
      ? (orderRaw as BudgetInsightSettings['order'])
      : (['dailyBudget', 'breakdown', 'projection'] as const);
  return {
    dailyBudget: asBoolean(data['dailyBudget'], true),
    breakdown: asBoolean(data['breakdown'], true),
    projection: asBoolean(data['projection'], true),
    order,
  };
}

export function mapBudget(snap: FirestoreSnapLike): Budget {
  const data = snap.data();
  const plansRaw = Array.isArray(data['plans']) ? data['plans'] : [];
  const plans = plansRaw
    .map(mapPlan)
    .filter((plan): plan is BudgetCategoryPlan => plan !== null);
  const semi = Array.isArray(data['semiMonthlyDays']) ? data['semiMonthlyDays'] : [1, 16];
  return {
    id: snap.id,
    name: asString(data['name']),
    icon: asString(data['icon'], 'home'),
    periodType: asString(data['periodType'], 'monthly') as BudgetPeriodType,
    monthlyStartDay: asNumber(data['monthlyStartDay'], 1),
    weekStartsOn: asNumber(data['weekStartsOn'], 0),
    biweeklyAnchor: asString(data['biweeklyAnchor']),
    semiMonthlyDays: [asNumber(semi[0], 1), asNumber(semi[1], 16)] as const,
    yearlyStartMonth: asNumber(data['yearlyStartMonth'], 1),
    yearlyStartDay: asNumber(data['yearlyStartDay'], 1),
    includeAllTransactions: asBoolean(data['includeAllTransactions'], true),
    includeSavingsTransfers: asBoolean(data['includeSavingsTransfers'], true),
    includeDebtTransfers: asBoolean(data['includeDebtTransfers'], false),
    insights: mapInsights(data['insights']),
    plans,
    createdAt: timestampToIso(data['createdAt']),
  };
}

export function budgetToDoc(budget: Budget): DocumentData {
  return {
    name: budget.name,
    icon: budget.icon,
    periodType: budget.periodType,
    monthlyStartDay: budget.monthlyStartDay,
    weekStartsOn: budget.weekStartsOn,
    biweeklyAnchor: budget.biweeklyAnchor,
    semiMonthlyDays: [...budget.semiMonthlyDays],
    yearlyStartMonth: budget.yearlyStartMonth,
    yearlyStartDay: budget.yearlyStartDay,
    includeAllTransactions: budget.includeAllTransactions,
    includeSavingsTransfers: budget.includeSavingsTransfers,
    includeDebtTransfers: budget.includeDebtTransfers,
    insights: {
      dailyBudget: budget.insights.dailyBudget,
      breakdown: budget.insights.breakdown,
      projection: budget.insights.projection,
      order: [...budget.insights.order],
    },
    plans: budget.plans.map((plan) => ({ ...plan })),
    createdAt: isoToTimestamp(budget.createdAt),
  };
}

export function mapTransaction(snap: FirestoreSnapLike): Transaction {
  const data = snap.data();
  return {
    id: snap.id,
    type: asString(data['type'], 'expense') as TransactionType,
    amountCents: asNumber(data['amountCents']),
    currency: asString(data['currency'], 'CAD') as Transaction['currency'],
    date: asString(data['date']),
    categoryId: asString(data['categoryId']),
    merchant: asString(data['merchant']),
    note: typeof data['note'] === 'string' ? data['note'] : undefined,
    fromWalletId: asNullableString(data['fromWalletId']),
    toWalletId: asNullableString(data['toWalletId']),
    excludedFromBudget: asBoolean(data['excludedFromBudget'], false),
    recurrence: asString(data['recurrence'], 'none') as RecurrenceRule,
    needsReview: asBoolean(data['needsReview'], false),
    linkedAccountId: asNullableString(data['linkedAccountId']),
    createdAt: timestampToIso(data['createdAt']),
    updatedAt: timestampToIso(data['updatedAt']),
  };
}

export function transactionToDoc(transaction: Transaction): DocumentData {
  return {
    type: transaction.type,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    date: transaction.date,
    categoryId: transaction.categoryId,
    merchant: transaction.merchant,
    ...(transaction.note !== undefined ? { note: transaction.note } : {}),
    fromWalletId: transaction.fromWalletId,
    toWalletId: transaction.toWalletId,
    excludedFromBudget: transaction.excludedFromBudget,
    recurrence: transaction.recurrence,
    needsReview: transaction.needsReview,
    linkedAccountId: transaction.linkedAccountId,
    createdAt: isoToTimestamp(transaction.createdAt),
    updatedAt: isoToTimestamp(transaction.updatedAt),
  };
}

export function mapConnection(snap: FirestoreSnapLike): ProviderConnection {
  const data = snap.data();
  return {
    id: snap.id,
    provider: asString(data['provider'], 'manual') as ConnectionProvider,
    institutionName: asString(data['institutionName']),
    status: asString(data['status'], 'not_connected') as ConnectionStatus,
    lastSyncAt: asNullableString(data['lastSyncAt']),
  };
}

export function connectionToDoc(connection: ProviderConnection): DocumentData {
  return {
    provider: connection.provider,
    institutionName: connection.institutionName,
    status: connection.status,
    lastSyncAt: connection.lastSyncAt,
  };
}

export function mapLinkedAccount(snap: FirestoreSnapLike): LinkedAccount {
  const data = snap.data();
  return {
    id: snap.id,
    connectionId: asString(data['connectionId']),
    institutionName: asString(data['institutionName']),
    name: asString(data['name']),
    mask: asString(data['mask']),
    type: asString(data['type'], 'checking') as LinkedAccountType,
    balanceCents: asNumber(data['balanceCents']),
    walletId: asNullableString(data['walletId']),
  };
}

export function linkedAccountToDoc(account: LinkedAccount): DocumentData {
  return {
    connectionId: account.connectionId,
    institutionName: account.institutionName,
    name: account.name,
    mask: account.mask,
    type: account.type,
    balanceCents: account.balanceCents,
    walletId: account.walletId,
  };
}
