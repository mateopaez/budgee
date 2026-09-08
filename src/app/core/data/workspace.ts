import type {
  Budget,
  Category,
  CategoryGroup,
  LinkedAccount,
  ProviderConnection,
  Transaction,
  UserPreferences,
  Wallet,
} from '../models';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, DEFAULT_GROUPS } from './taxonomy';
import {
  DEMO_BUDGET_ID,
  defaultPreferences,
  demoBudget,
  demoCategories,
  demoConnections,
  demoGroups,
  demoLinkedAccounts,
  demoTransactions,
  demoWallets,
  WALLET_IDS,
} from './demo-seed';

/** Schema version so a future migration can recognise older stored payloads. */
export const WORKSPACE_VERSION = 1;

/**
 * Everything one signed in user owns. The whole workspace is loaded into
 * signals at startup and written back on change, which keeps the UI layer free
 * of persistence concerns.
 */
export interface Workspace {
  readonly version: number;
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly createdAt: string;
  readonly onboardingCompleted: boolean;
  readonly activeBudgetId: string | null;
  readonly preferences: UserPreferences;
  readonly groups: readonly CategoryGroup[];
  readonly categories: readonly Category[];
  readonly wallets: readonly Wallet[];
  readonly budgets: readonly Budget[];
  readonly transactions: readonly Transaction[];
  readonly connections: readonly ProviderConnection[];
  readonly linkedAccounts: readonly LinkedAccount[];
}

export interface WorkspaceIdentity {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
}

/** A brand new user with the default taxonomy, one wallet and no transactions. */
export function createEmptyWorkspace(identity: WorkspaceIdentity, createdAt: string): Workspace {
  const preferences = { ...defaultPreferences(), demoMode: false };
  return {
    version: WORKSPACE_VERSION,
    uid: identity.uid,
    displayName: identity.displayName,
    email: identity.email,
    createdAt,
    onboardingCompleted: false,
    activeBudgetId: null,
    preferences,
    groups: [...DEFAULT_GROUPS],
    categories: [...DEFAULT_CATEGORIES],
    wallets: [
      {
        id: WALLET_IDS.spending,
        name: 'Spending',
        kind: 'spending',
        openingBalanceCents: 0,
        color: 'var(--color-cat-food)',
        icon: 'wallet',
      },
      {
        id: WALLET_IDS.savings,
        name: 'Savings',
        kind: 'savings',
        openingBalanceCents: 0,
        color: 'var(--color-cat-savings)',
        icon: 'piggy',
      },
    ],
    budgets: [],
    transactions: [],
    connections: [],
    linkedAccounts: [],
  };
}

/** The seeded demo workspace. Only ever written for the signed in user. */
export function createDemoWorkspace(identity: WorkspaceIdentity, createdAt: string): Workspace {
  return {
    version: WORKSPACE_VERSION,
    uid: identity.uid,
    displayName: identity.displayName,
    email: identity.email,
    createdAt,
    onboardingCompleted: true,
    activeBudgetId: DEMO_BUDGET_ID,
    preferences: defaultPreferences(),
    groups: demoGroups(),
    categories: demoCategories(),
    wallets: demoWallets(),
    budgets: [demoBudget()],
    transactions: demoTransactions(),
    connections: demoConnections(),
    linkedAccounts: demoLinkedAccounts(),
  };
}

export const FALLBACK_CATEGORY_IDS = CATEGORY_IDS;
