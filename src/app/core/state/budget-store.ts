import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  Budget,
  Category,
  CategoryGroup,
  Transaction,
  TransactionDraft,
  UserPreferences,
  Wallet,
} from '../models';
import { LocalWorkspaceRepository } from '../data/local-workspace.repository';
import {
  createDemoWorkspace,
  createEmptyWorkspace,
  type Workspace,
  type WorkspaceIdentity,
} from '../data/workspace';
import { DEMO_TODAY } from '../data/demo-seed';
import { createId } from '../util/id.util';
import { toIsoDate, type IsoDate } from '../util/date.util';
import { periodContaining, shiftPeriod } from '../util/budget-period.util';
import { computeBudgetSummary, type BudgetSummary } from '../util/budget-calc.util';
import { detectRecurringPayments } from '../util/recurring.util';

/**
 * The single application store.
 *
 * Every screen reads from these signals, and every mutation goes through one of
 * the methods below, so a transaction edit is reflected in the feed, the
 * charts, the calendar and every budget figure in the same change detection
 * pass.
 */
@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly repository = inject(LocalWorkspaceRepository);

  private readonly workspaceSignal = signal<Workspace | null>(null);
  private readonly statusSignal = signal<'idle' | 'loading' | 'ready'>('idle');
  /** Offset in whole budget periods from the period containing today. */
  private readonly periodOffsetSignal = signal(0);

  readonly workspace = this.workspaceSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly ready = computed(() => this.statusSignal() === 'ready' && this.workspaceSignal() !== null);

  readonly preferences = computed<UserPreferences | null>(
    () => this.workspaceSignal()?.preferences ?? null,
  );
  readonly categories = computed<readonly Category[]>(() => this.workspaceSignal()?.categories ?? []);
  readonly groups = computed<readonly CategoryGroup[]>(() => this.workspaceSignal()?.groups ?? []);
  readonly wallets = computed<readonly Wallet[]>(() => this.workspaceSignal()?.wallets ?? []);
  readonly budgets = computed<readonly Budget[]>(() => this.workspaceSignal()?.budgets ?? []);
  readonly transactions = computed<readonly Transaction[]>(
    () => this.workspaceSignal()?.transactions ?? [],
  );
  readonly connections = computed(() => this.workspaceSignal()?.connections ?? []);
  readonly linkedAccounts = computed(() => this.workspaceSignal()?.linkedAccounts ?? []);
  readonly onboardingCompleted = computed(() => this.workspaceSignal()?.onboardingCompleted ?? false);
  readonly demoMode = computed(() => this.workspaceSignal()?.preferences.demoMode ?? false);

  readonly categoriesById = computed(() => new Map(this.categories().map((c) => [c.id, c])));
  readonly groupsById = computed(() => new Map(this.groups().map((g) => [g.id, g])));
  readonly walletsById = computed(() => new Map(this.wallets().map((w) => [w.id, w])));

  /**
   * Demo mode pins "today" so seeded data always tells the same story.
   * Outside demo mode the real calendar date is used.
   */
  readonly today = computed<IsoDate>(() =>
    this.demoMode() ? DEMO_TODAY : toIsoDate(new Date()),
  );

  readonly activeBudget = computed<Budget | null>(() => {
    const ws = this.workspaceSignal();
    if (!ws) return null;
    return ws.budgets.find((b) => b.id === ws.activeBudgetId) ?? ws.budgets[0] ?? null;
  });

  readonly hasBudget = computed(() => this.activeBudget() !== null);

  readonly periodOffset = this.periodOffsetSignal.asReadonly();

  readonly activePeriod = computed(() => {
    const budget = this.activeBudget();
    if (!budget) return null;
    const base = periodContaining(budget, this.today());
    const offset = this.periodOffsetSignal();
    return offset === 0 ? base : shiftPeriod(budget, base, offset);
  });

  /** Transactions inside the currently selected budget period, newest first. */
  readonly periodTransactions = computed<readonly Transaction[]>(() => {
    const period = this.activePeriod();
    if (!period) return [];
    return this.transactions().filter((t) => t.date >= period.start && t.date < period.end);
  });

  readonly summary = computed<BudgetSummary | null>(() => {
    const budget = this.activeBudget();
    const period = this.activePeriod();
    if (!budget || !period) return null;
    return computeBudgetSummary({
      budget,
      period,
      transactions: this.transactions(),
      categories: this.categories(),
      groups: this.groups(),
      wallets: this.wallets(),
      today: this.today(),
    });
  });

  readonly recurringPayments = computed(() =>
    detectRecurringPayments(this.transactions(), this.today()),
  );

  readonly needsReviewCount = computed(
    () => this.transactions().filter((t) => t.needsReview).length,
  );

  /** Wallet balance = opening balance plus every movement recorded since. */
  readonly walletBalances = computed<ReadonlyMap<string, number>>(() => {
    const balances = new Map<string, number>();
    for (const wallet of this.wallets()) balances.set(wallet.id, wallet.openingBalanceCents);
    for (const tx of this.transactions()) {
      if (tx.type === 'expense' && tx.fromWalletId) {
        balances.set(tx.fromWalletId, (balances.get(tx.fromWalletId) ?? 0) - tx.amountCents);
      } else if (tx.type === 'income' && tx.toWalletId) {
        balances.set(tx.toWalletId, (balances.get(tx.toWalletId) ?? 0) + tx.amountCents);
      } else if (tx.type === 'transfer') {
        if (tx.fromWalletId) {
          balances.set(tx.fromWalletId, (balances.get(tx.fromWalletId) ?? 0) - tx.amountCents);
        }
        if (tx.toWalletId) {
          balances.set(tx.toWalletId, (balances.get(tx.toWalletId) ?? 0) + tx.amountCents);
        }
      }
    }
    return balances;
  });

  constructor() {
    // Persist on every change once the workspace has been loaded.
    effect(() => {
      const workspace = this.workspaceSignal();
      if (!workspace || this.statusSignal() !== 'ready') return;
      void this.repository.save(workspace);
    });
  }

  // ---------------------------------------------------------------- lifecycle

  /** Loads the stored workspace for a uid, or null when the user is new. */
  async loadFor(identity: WorkspaceIdentity): Promise<Workspace | null> {
    this.statusSignal.set('loading');
    const stored = await this.repository.load(identity.uid);
    if (stored) {
      this.workspaceSignal.set({
        ...stored,
        displayName: identity.displayName || stored.displayName,
        email: identity.email || stored.email,
      });
      this.statusSignal.set('ready');
      return stored;
    }
    this.workspaceSignal.set(null);
    this.statusSignal.set('ready');
    return null;
  }

  unload(): void {
    this.workspaceSignal.set(null);
    this.statusSignal.set('idle');
    this.periodOffsetSignal.set(0);
  }

  /** Creates and stores a fresh workspace. Used by onboarding. */
  async initialise(identity: WorkspaceIdentity, mode: 'demo' | 'manual'): Promise<void> {
    const createdAt = new Date().toISOString();
    const workspace =
      mode === 'demo'
        ? createDemoWorkspace(identity, createdAt)
        : createEmptyWorkspace(identity, createdAt);
    this.statusSignal.set('ready');
    this.workspaceSignal.set(workspace);
    await this.repository.save(workspace);
  }

  /** Restores the seeded demo dataset for the current user. */
  async resetToDemo(): Promise<void> {
    const ws = this.workspaceSignal();
    if (!ws) return;
    const identity = { uid: ws.uid, displayName: ws.displayName, email: ws.email };
    this.periodOffsetSignal.set(0);
    this.workspaceSignal.set(createDemoWorkspace(identity, ws.createdAt));
  }

  /** Clears all app data for the current user but keeps the account. */
  async resetToEmpty(): Promise<void> {
    const ws = this.workspaceSignal();
    if (!ws) return;
    const identity = { uid: ws.uid, displayName: ws.displayName, email: ws.email };
    this.periodOffsetSignal.set(0);
    this.workspaceSignal.set({
      ...createEmptyWorkspace(identity, ws.createdAt),
      onboardingCompleted: true,
    });
  }

  // ---------------------------------------------------------------- mutations

  private patch(mutate: (workspace: Workspace) => Workspace): void {
    const current = this.workspaceSignal();
    if (!current) return;
    this.workspaceSignal.set(mutate(current));
  }

  setPeriodOffset(offset: number): void {
    this.periodOffsetSignal.set(offset);
  }

  stepPeriod(delta: number): void {
    this.periodOffsetSignal.update((v) => v + delta);
  }

  addTransaction(draft: TransactionDraft): Transaction {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...draft,
      id: createId('tx'),
      currency: 'CAD',
      needsReview: false,
      linkedAccountId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.patch((ws) => ({ ...ws, transactions: [transaction, ...ws.transactions] }));
    return transaction;
  }

  updateTransaction(id: string, draft: TransactionDraft): void {
    const now = new Date().toISOString();
    this.patch((ws) => ({
      ...ws,
      transactions: ws.transactions.map((t) =>
        t.id === id ? { ...t, ...draft, needsReview: false, updatedAt: now } : t,
      ),
    }));
  }

  deleteTransaction(id: string): void {
    this.patch((ws) => ({ ...ws, transactions: ws.transactions.filter((t) => t.id !== id) }));
  }

  transactionById(id: string): Transaction | undefined {
    return this.transactions().find((t) => t.id === id);
  }

  upsertCategory(category: Category): void {
    this.patch((ws) => {
      const exists = ws.categories.some((c) => c.id === category.id);
      return {
        ...ws,
        categories: exists
          ? ws.categories.map((c) => (c.id === category.id ? category : c))
          : [...ws.categories, category],
      };
    });
  }

  deleteCategory(id: string, replacementId: string): void {
    this.patch((ws) => ({
      ...ws,
      categories: ws.categories.filter((c) => c.id !== id),
      transactions: ws.transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: replacementId } : t,
      ),
      budgets: ws.budgets.map((b) => ({
        ...b,
        plans: b.plans.filter((p) => p.categoryId !== id),
      })),
    }));
  }

  upsertWallet(wallet: Wallet): void {
    this.patch((ws) => {
      const exists = ws.wallets.some((w) => w.id === wallet.id);
      return {
        ...ws,
        wallets: exists
          ? ws.wallets.map((w) => (w.id === wallet.id ? wallet : w))
          : [...ws.wallets, wallet],
      };
    });
  }

  deleteWallet(id: string): void {
    this.patch((ws) => ({
      ...ws,
      wallets: ws.wallets.filter((w) => w.id !== id),
      transactions: ws.transactions.map((t) => ({
        ...t,
        fromWalletId: t.fromWalletId === id ? null : t.fromWalletId,
        toWalletId: t.toWalletId === id ? null : t.toWalletId,
      })),
    }));
  }

  saveBudget(budget: Budget): void {
    this.patch((ws) => {
      const exists = ws.budgets.some((b) => b.id === budget.id);
      return {
        ...ws,
        budgets: exists
          ? ws.budgets.map((b) => (b.id === budget.id ? budget : b))
          : [...ws.budgets, budget],
        activeBudgetId: ws.activeBudgetId ?? budget.id,
      };
    });
  }

  deleteBudget(id: string): void {
    this.patch((ws) => {
      const budgets = ws.budgets.filter((b) => b.id !== id);
      return {
        ...ws,
        budgets,
        activeBudgetId: ws.activeBudgetId === id ? (budgets[0]?.id ?? null) : ws.activeBudgetId,
      };
    });
    this.periodOffsetSignal.set(0);
  }

  setActiveBudget(id: string): void {
    this.periodOffsetSignal.set(0);
    this.patch((ws) => ({ ...ws, activeBudgetId: id }));
  }

  updatePreferences(patch: Partial<UserPreferences>): void {
    this.patch((ws) => ({ ...ws, preferences: { ...ws.preferences, ...patch } }));
  }

  setDemoMode(enabled: boolean): void {
    this.updatePreferences({ demoMode: enabled });
  }

  completeOnboarding(): void {
    this.patch((ws) => ({ ...ws, onboardingCompleted: true }));
  }

  setConnections(connections: Workspace['connections']): void {
    this.patch((ws) => ({ ...ws, connections }));
  }
}
