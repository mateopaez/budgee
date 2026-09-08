import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  Budget,
  Category,
  CategoryGroup,
  Transaction,
  TransactionDraft,
  UserPreferences,
  Wallet,
} from '../models';
import { FirestoreWorkspaceRepository } from '../data/firestore-workspace.repository';
import {
  type Workspace,
  type WorkspaceIdentity,
} from '../data/workspace';
import { DEMO_TODAY } from '../data/demo-seed';
import { createId } from '../util/id.util';
import { toIsoDate, type IsoDate } from '../util/date.util';
import { periodContaining, shiftPeriod } from '../util/budget-period.util';
import { computeBudgetSummary, type BudgetSummary } from '../util/budget-calc.util';
import { detectRecurringPayments } from '../util/recurring.util';
import { computeWalletBalances } from '../util/wallet-balance.util';

export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error' | 'seeding';

/**
 * The single application store.
 *
 * Signals hold in-memory state hydrated from Firestore after authentication.
 * Mutations write to Firestore first (or in parallel with an optimistic local
 * update), never to browser persistent storage.
 */
@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly repository = inject(FirestoreWorkspaceRepository);

  private readonly workspaceSignal = signal<Workspace | null>(null);
  private readonly statusSignal = signal<StoreStatus>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private readonly periodOffsetSignal = signal(0);
  private stopListening: (() => void) | null = null;
  private activeUid: string | null = null;

  readonly workspace = this.workspaceSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
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
  readonly dataMode = computed(() => this.workspaceSignal()?.dataMode ?? null);

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
  readonly walletBalances = computed<ReadonlyMap<string, number>>(() =>
    computeWalletBalances(this.wallets(), this.transactions()),
  );

  // ---------------------------------------------------------------- lifecycle

  /** Loads and listens to the Firestore workspace for a uid. */
  async loadFor(identity: WorkspaceIdentity): Promise<Workspace | null> {
    this.errorSignal.set(null);
    this.statusSignal.set('loading');
    this.teardownListener();
    this.activeUid = identity.uid;

    try {
      const stored = await this.repository.load(identity.uid);
      if (stored) {
        this.workspaceSignal.set({
          ...stored,
          displayName: identity.displayName || stored.displayName,
          email: identity.email || stored.email,
        });
      } else {
        this.workspaceSignal.set(null);
      }
      this.statusSignal.set('ready');
      this.startListener(identity);
      return stored;
    } catch (error) {
      this.statusSignal.set('error');
      this.errorSignal.set(friendlyStoreError(error));
      this.workspaceSignal.set(null);
      throw error;
    }
  }

  unload(): void {
    this.teardownListener();
    this.activeUid = null;
    this.workspaceSignal.set(null);
    this.statusSignal.set('idle');
    this.errorSignal.set(null);
    this.periodOffsetSignal.set(0);
  }

  async retryLoad(identity: WorkspaceIdentity): Promise<void> {
    await this.loadFor(identity);
  }

  /** Creates and stores a fresh workspace. Used by onboarding. */
  async initialise(identity: WorkspaceIdentity, mode: 'demo' | 'manual'): Promise<void> {
    this.errorSignal.set(null);
    this.statusSignal.set('seeding');
    this.teardownListener();
    this.activeUid = identity.uid;
    try {
      const workspace = await this.repository.seed(identity, mode, { force: false });
      this.workspaceSignal.set(workspace);
      this.statusSignal.set('ready');
      this.startListener(identity);
    } catch (error) {
      this.statusSignal.set('error');
      this.errorSignal.set(friendlyStoreError(error));
      throw error;
    }
  }

  /** Restores the seeded demo dataset for the current user only. */
  async resetToDemo(): Promise<void> {
    const ws = this.workspaceSignal();
    if (!ws) return;
    const identity = { uid: ws.uid, displayName: ws.displayName, email: ws.email };
    this.errorSignal.set(null);
    this.statusSignal.set('seeding');
    this.periodOffsetSignal.set(0);
    try {
      const workspace = await this.repository.seed(identity, 'demo', { force: true });
      this.workspaceSignal.set(workspace);
      this.statusSignal.set('ready');
      this.startListener(identity);
    } catch (error) {
      this.statusSignal.set('error');
      this.errorSignal.set(friendlyStoreError(error));
      throw error;
    }
  }

  /** Clears all app data for the current user but keeps the account. */
  async resetToEmpty(): Promise<void> {
    const ws = this.workspaceSignal();
    if (!ws) return;
    const identity = { uid: ws.uid, displayName: ws.displayName, email: ws.email };
    this.errorSignal.set(null);
    this.statusSignal.set('seeding');
    this.periodOffsetSignal.set(0);
    try {
      const workspace = await this.repository.seed(identity, 'manual', { force: true });
      this.workspaceSignal.set(workspace);
      this.statusSignal.set('ready');
      this.startListener(identity);
    } catch (error) {
      this.statusSignal.set('error');
      this.errorSignal.set(friendlyStoreError(error));
      throw error;
    }
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
    if (this.activeUid) {
      void this.persist(() =>
        this.repository.upsertTransaction(this.activeUid as string, transaction),
      );
    }
    return transaction;
  }

  updateTransaction(id: string, draft: TransactionDraft): void {
    const now = new Date().toISOString();
    let updated: Transaction | null = null;
    this.patch((ws) => ({
      ...ws,
      transactions: ws.transactions.map((t) => {
        if (t.id !== id) return t;
        updated = { ...t, ...draft, needsReview: false, updatedAt: now };
        return updated;
      }),
    }));
    if (updated && this.activeUid) {
      const tx = updated;
      void this.persist(() => this.repository.upsertTransaction(this.activeUid as string, tx));
    }
  }

  deleteTransaction(id: string): void {
    this.patch((ws) => ({ ...ws, transactions: ws.transactions.filter((t) => t.id !== id) }));
    if (this.activeUid) {
      void this.persist(() => this.repository.removeTransaction(this.activeUid as string, id));
    }
  }

  transactionById(id: string): Transaction | undefined {
    return this.transactions().find((t) => t.id === id);
  }

  async fetchTransaction(id: string): Promise<Transaction | null> {
    const local = this.transactionById(id);
    if (local) return local;
    if (!this.activeUid) return null;
    return this.repository.getTransaction(this.activeUid, id);
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
    if (this.activeUid) {
      void this.persist(() => this.repository.upsertCategory(this.activeUid as string, category));
    }
  }

  deleteCategory(id: string, replacementId: string): void {
    let touched: Transaction[] = [];
    this.patch((ws) => {
      touched = ws.transactions.filter((t) => t.categoryId === id);
      return {
        ...ws,
        categories: ws.categories.filter((c) => c.id !== id),
        transactions: ws.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: replacementId } : t,
        ),
        budgets: ws.budgets.map((b) => ({
          ...b,
          plans: b.plans.filter((p) => p.categoryId !== id),
        })),
      };
    });
    if (!this.activeUid) return;
    const uid = this.activeUid;
    void this.persist(async () => {
      await this.repository.removeCategory(uid, id);
      for (const tx of touched) {
        await this.repository.upsertTransaction(uid, {
          ...tx,
          categoryId: replacementId,
        });
      }
      const budgets = this.workspaceSignal()?.budgets ?? [];
      for (const budget of budgets) {
        await this.repository.upsertBudget(uid, budget);
      }
    });
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
    if (this.activeUid) {
      void this.persist(() => this.repository.upsertWallet(this.activeUid as string, wallet));
    }
  }

  deleteWallet(id: string): void {
    let touched: Transaction[] = [];
    this.patch((ws) => {
      touched = ws.transactions.filter(
        (t) => t.fromWalletId === id || t.toWalletId === id,
      );
      return {
        ...ws,
        wallets: ws.wallets.filter((w) => w.id !== id),
        transactions: ws.transactions.map((t) => ({
          ...t,
          fromWalletId: t.fromWalletId === id ? null : t.fromWalletId,
          toWalletId: t.toWalletId === id ? null : t.toWalletId,
        })),
      };
    });
    if (!this.activeUid) return;
    const uid = this.activeUid;
    void this.persist(async () => {
      await this.repository.removeWallet(uid, id);
      for (const tx of touched) {
        await this.repository.upsertTransaction(uid, {
          ...tx,
          fromWalletId: tx.fromWalletId === id ? null : tx.fromWalletId,
          toWalletId: tx.toWalletId === id ? null : tx.toWalletId,
        });
      }
    });
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
    if (!this.activeUid) return;
    const uid = this.activeUid;
    const activeBudgetId = this.workspaceSignal()?.activeBudgetId ?? budget.id;
    void this.persist(async () => {
      await this.repository.upsertBudget(uid, budget);
      await this.repository.updateProfile(uid, { activeBudgetId });
    });
  }

  deleteBudget(id: string): void {
    let nextActive: string | null = null;
    this.patch((ws) => {
      const budgets = ws.budgets.filter((b) => b.id !== id);
      nextActive = ws.activeBudgetId === id ? (budgets[0]?.id ?? null) : ws.activeBudgetId;
      return {
        ...ws,
        budgets,
        activeBudgetId: nextActive,
      };
    });
    this.periodOffsetSignal.set(0);
    if (!this.activeUid) return;
    const uid = this.activeUid;
    void this.persist(async () => {
      await this.repository.removeBudget(uid, id);
      await this.repository.updateProfile(uid, { activeBudgetId: nextActive });
    });
  }

  setActiveBudget(id: string): void {
    this.periodOffsetSignal.set(0);
    this.patch((ws) => ({ ...ws, activeBudgetId: id }));
    if (this.activeUid) {
      void this.persist(() =>
        this.repository.updateProfile(this.activeUid as string, { activeBudgetId: id }),
      );
    }
  }

  updatePreferences(patch: Partial<UserPreferences>): void {
    let next: UserPreferences | null = null;
    this.patch((ws) => {
      next = { ...ws.preferences, ...patch };
      return { ...ws, preferences: next };
    });
    if (next && this.activeUid) {
      const preferences = next;
      void this.persist(() =>
        this.repository.updateProfile(this.activeUid as string, { preferences }),
      );
    }
  }

  setDemoMode(enabled: boolean): void {
    this.updatePreferences({ demoMode: enabled });
  }

  completeOnboarding(): void {
    this.patch((ws) => ({ ...ws, onboardingCompleted: true }));
    if (this.activeUid) {
      void this.persist(() =>
        this.repository.updateProfile(this.activeUid as string, { onboardingCompleted: true }),
      );
    }
  }

  setConnections(connections: Workspace['connections']): void {
    this.patch((ws) => ({ ...ws, connections }));
    if (this.activeUid) {
      const linked = this.workspaceSignal()?.linkedAccounts ?? [];
      void this.persist(() =>
        this.repository.setConnections(this.activeUid as string, connections, linked),
      );
    }
  }

  // ---------------------------------------------------------------- private

  private startListener(identity: WorkspaceIdentity): void {
    this.teardownListener();
    this.stopListening = this.repository.listen(
      identity.uid,
      (workspace) => {
        if (this.activeUid !== identity.uid) return;
        if (workspace) {
          this.workspaceSignal.set({
            ...workspace,
            displayName: identity.displayName || workspace.displayName,
            email: identity.email || workspace.email,
          });
          if (this.statusSignal() === 'loading' || this.statusSignal() === 'seeding') {
            this.statusSignal.set('ready');
          }
        } else if (this.statusSignal() !== 'seeding') {
          this.workspaceSignal.set(null);
        }
      },
      (error) => {
        this.errorSignal.set(friendlyStoreError(error));
        this.statusSignal.set('error');
      },
    );
  }

  private teardownListener(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.repository.stopListening();
  }

  private async persist(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.errorSignal.set(friendlyStoreError(error));
      // Keep the optimistic local state visible; the user can retry or refresh.
    }
  }
}

function friendlyStoreError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong talking to Firestore. Check your connection and try again.';
}
