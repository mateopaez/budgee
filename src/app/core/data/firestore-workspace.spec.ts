import { Timestamp } from 'firebase/firestore';
import {
  budgetToDoc,
  categoryToDoc,
  mapBudget,
  mapCategory,
  mapTransaction,
  mapUserProfile,
  mapWallet,
  transactionToDoc,
  userProfileToDoc,
  walletToDoc,
} from './firestore-mappers';
import { userCollectionPath, userDocInCollection, userDocPath } from './firestore-paths';
import { createDemoWorkspace, createEmptyWorkspace } from './workspace';
import { DEMO_BUDGET_ID, WALLET_IDS, demoTransactions } from './demo-seed';
import { MemoryWorkspaceRepository } from './memory-workspace.repository';
import { computeWalletBalances } from '../util/wallet-balance.util';
import { makeTransaction, makeWallet } from '../testing/factories';

describe('firestore paths', () => {
  it('scopes every document under the authenticated uid', () => {
    const uid = 'user_abc';
    expect(userDocPath(uid)).toBe('users/user_abc');
    expect(userCollectionPath(uid, 'transactions')).toBe('users/user_abc/transactions');
    expect(userDocInCollection(uid, 'transactions', 'tx_1')).toBe(
      'users/user_abc/transactions/tx_1',
    );
    expect(userDocInCollection(uid, 'wallets', 'wal_1')).toBe('users/user_abc/wallets/wal_1');
    expect(userDocInCollection(uid, 'budgets', 'bud_1')).toBe('users/user_abc/budgets/bud_1');
  });
});

describe('firestore mappers', () => {
  it('round-trips a transaction through document mapping', () => {
    const original = makeTransaction({
      id: 'tx_demo_1',
      type: 'expense',
      amountCents: 2_450,
      merchant: 'Maple Grocers',
      excludedFromBudget: true,
    });
    const doc = transactionToDoc(original);
    const mapped = mapTransaction({ id: original.id, data: () => doc });
    expect(mapped.id).toBe(original.id);
    expect(mapped.amountCents).toBe(2_450);
    expect(mapped.excludedFromBudget).toBe(true);
    expect(mapped.merchant).toBe('Maple Grocers');
    expect(mapped.createdAt).toContain('2026-09-05');
  });

  it('round-trips wallet opening balances without a derived currentBalance', () => {
    const wallet = makeWallet({
      id: WALLET_IDS.spending,
      openingBalanceCents: 10_000,
    });
    const doc = walletToDoc(wallet);
    expect(doc).not.toHaveProperty('currentBalance');
    expect(doc).not.toHaveProperty('currentBalanceCents');
    const mapped = mapWallet({ id: wallet.id, data: () => doc });
    expect(mapped.openingBalanceCents).toBe(10_000);
  });

  it('maps user profile flags including dataMode', () => {
    const profile = mapUserProfile('uid_1', {
      displayName: 'Alex',
      email: 'alex@example.com',
      createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')),
      updatedAt: Timestamp.fromDate(new Date('2026-01-02T00:00:00.000Z')),
      onboardingCompleted: true,
      activeBudgetId: DEMO_BUDGET_ID,
      dataMode: 'demo',
      demoSeededAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')),
      preferences: {
        currency: 'CAD',
        locale: 'en-CA',
        showDoubleDecimals: false,
        roundSummaryAmounts: true,
        showSaveInTabBar: true,
        defaultExpenseCategoryId: 'cat_misc',
        defaultIncomeCategoryId: 'cat_salary',
        defaultTransferCategoryId: 'cat_savings',
        overviewAccent: 'overview',
        budgetAccent: 'budget',
        walletAccent: 'tools',
        demoMode: true,
      },
    });
    expect(profile.dataMode).toBe('demo');
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.activeBudgetId).toBe(DEMO_BUDGET_ID);

    const written = userProfileToDoc(profile);
    expect(written['dataMode']).toBe('demo');
    expect(written['onboardingCompleted']).toBe(true);
  });

  it('round-trips budgets and categories with stable ids', () => {
    const workspace = createDemoWorkspace(
      { uid: 'u1', displayName: 'Test', email: 't@example.com' },
      '2026-01-01T00:00:00.000Z',
    );
    const budget = workspace.budgets[0]!;
    const category = workspace.categories[0]!;
    expect(mapBudget({ id: budget.id, data: () => budgetToDoc(budget) }).id).toBe(DEMO_BUDGET_ID);
    expect(mapCategory({ id: category.id, data: () => categoryToDoc(category) }).id).toBe(
      category.id,
    );
  });
});

describe('demo and manual workspace seeds', () => {
  const identity = { uid: 'seed_user', displayName: 'Sam', email: 'sam@example.com' };

  it('builds a complete deterministic demo workspace', () => {
    const a = createDemoWorkspace(identity, '2026-01-01T00:00:00.000Z');
    const b = createDemoWorkspace(identity, '2026-01-01T00:00:00.000Z');
    expect(a.dataMode).toBe('demo');
    expect(a.onboardingCompleted).toBe(true);
    expect(a.activeBudgetId).toBe(DEMO_BUDGET_ID);
    expect(a.transactions.map((t) => t.id)).toEqual(b.transactions.map((t) => t.id));
    expect(a.wallets.map((w) => w.id)).toEqual(Object.values(WALLET_IDS));
    expect(a.transactions.length).toBe(demoTransactions().length);
    expect(a.connections[0]?.provider).toBe('demo');
  });

  it('builds a manual workspace with defaults and no demo history', () => {
    const workspace = createEmptyWorkspace(identity, '2026-01-01T00:00:00.000Z');
    expect(workspace.dataMode).toBe('manual');
    expect(workspace.onboardingCompleted).toBe(true);
    expect(workspace.activeBudgetId).toBeNull();
    expect(workspace.demoSeededAt).toBeNull();
    expect(workspace.transactions).toEqual([]);
    expect(workspace.budgets).toEqual([]);
    expect(workspace.preferences.demoMode).toBe(false);
    expect(workspace.categories.length).toBeGreaterThan(0);
    expect(workspace.wallets.length).toBe(2);
  });

  it('keeps deterministic ids when demo seed data is applied twice in memory', async () => {
    const repo = new MemoryWorkspaceRepository();
    const first = createDemoWorkspace(identity, '2026-01-01T00:00:00.000Z');
    await repo.save(first);
    const second = createDemoWorkspace(identity, '2026-01-01T00:00:00.000Z');
    await repo.save(second);
    const loaded = await repo.load(identity.uid);
    expect(loaded?.transactions).toHaveLength(first.transactions.length);
    expect(new Set(loaded?.transactions.map((t) => t.id)).size).toBe(first.transactions.length);
  });

  it('clears and reseeds for reset demo behaviour in the memory adapter', async () => {
    const repo = new MemoryWorkspaceRepository();
    await repo.save(createEmptyWorkspace(identity, '2026-01-01T00:00:00.000Z'));
    await repo.clear(identity.uid);
    expect(await repo.load(identity.uid)).toBeNull();
    const demo = createDemoWorkspace(identity, '2026-01-01T00:00:00.000Z');
    await repo.save(demo);
    const loaded = await repo.load(identity.uid);
    expect(loaded?.dataMode).toBe('demo');
    expect(loaded?.activeBudgetId).toBe(DEMO_BUDGET_ID);
  });
});

describe('ledger-derived wallet balances', () => {
  const spending = makeWallet({ id: 'wal_spending', openingBalanceCents: 10_000 });
  const savings = makeWallet({
    id: 'wal_savings',
    kind: 'savings',
    openingBalanceCents: 5_000,
  });

  it('applies expense, income and transfer movements', () => {
    const balances = computeWalletBalances(
      [spending, savings],
      [
        makeTransaction({
          id: 'e1',
          type: 'expense',
          amountCents: 2_000,
          fromWalletId: 'wal_spending',
          toWalletId: null,
        }),
        makeTransaction({
          id: 'i1',
          type: 'income',
          amountCents: 3_000,
          fromWalletId: null,
          toWalletId: 'wal_spending',
        }),
        makeTransaction({
          id: 't1',
          type: 'transfer',
          amountCents: 1_500,
          fromWalletId: 'wal_spending',
          toWalletId: 'wal_savings',
        }),
      ],
    );
    expect(balances.get('wal_spending')).toBe(10_000 - 2_000 + 3_000 - 1_500);
    expect(balances.get('wal_savings')).toBe(5_000 + 1_500);
  });

  it('still moves wallet balances for excluded-from-budget transactions', () => {
    const balances = computeWalletBalances(
      [spending],
      [
        makeTransaction({
          id: 'ex1',
          type: 'expense',
          amountCents: 4_000,
          fromWalletId: 'wal_spending',
          excludedFromBudget: true,
        }),
      ],
    );
    expect(balances.get('wal_spending')).toBe(6_000);
  });

  it('produces coherent balances for the demo seed', () => {
    const workspace = createDemoWorkspace(
      { uid: 'u', displayName: 'D', email: 'd@example.com' },
      '2026-01-01T00:00:00.000Z',
    );
    const balances = computeWalletBalances(workspace.wallets, workspace.transactions);
    for (const wallet of workspace.wallets) {
      expect(balances.has(wallet.id)).toBe(true);
      expect(typeof balances.get(wallet.id)).toBe('number');
    }
  });
});

describe('transaction deep-link lookup', () => {
  it('looks up transactions by stable id, never by array index', async () => {
    const repo = new MemoryWorkspaceRepository();
    const workspace = createDemoWorkspace(
      { uid: 'deep', displayName: 'D', email: 'd@example.com' },
      '2026-01-01T00:00:00.000Z',
    );
    await repo.save(workspace);
    const loaded = await repo.load('deep');
    const target = loaded!.transactions[5]!;
    const found = loaded!.transactions.find((t) => t.id === target.id);
    expect(found?.id).toBe(target.id);
    expect(found?.id).not.toBe('5');
    expect(loaded!.transactions.find((t) => t.id === 'missing-id')).toBeUndefined();
  });
});
