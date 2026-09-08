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
import { DEFAULT_CATEGORIES, DEFAULT_GROUPS } from './taxonomy';
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

export type WorkspaceDataMode = 'demo' | 'manual';

/**
 * Everything one signed in user owns. The whole workspace is hydrated into
 * signals after authentication; Firestore is the only persistent store.
 */
export interface Workspace {
  readonly version: number;
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly onboardingCompleted: boolean;
  readonly activeBudgetId: string | null;
  readonly dataMode: WorkspaceDataMode;
  readonly demoSeededAt: string | null;
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

/** A brand new user with the default taxonomy, two wallets and no transactions. */
export function createEmptyWorkspace(identity: WorkspaceIdentity, createdAt: string): Workspace {
  const preferences = { ...defaultPreferences(), demoMode: false };
  return {
    version: WORKSPACE_VERSION,
    uid: identity.uid,
    displayName: identity.displayName,
    email: identity.email,
    createdAt,
    updatedAt: createdAt,
    onboardingCompleted: true,
    activeBudgetId: null,
    dataMode: 'manual',
    demoSeededAt: null,
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
    updatedAt: createdAt,
    onboardingCompleted: true,
    activeBudgetId: DEMO_BUDGET_ID,
    dataMode: 'demo',
    demoSeededAt: createdAt,
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
