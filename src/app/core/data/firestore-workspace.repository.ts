import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore';
import { FirestoreService } from '../firebase/firestore';
import type { WorkspaceRepository } from './repository';
import {
  WORKSPACE_VERSION,
  type Workspace,
  type WorkspaceIdentity,
  createDemoWorkspace,
  createEmptyWorkspace,
} from './workspace';
import {
  budgetToDoc,
  categoryGroupToDoc,
  categoryToDoc,
  connectionToDoc,
  linkedAccountToDoc,
  mapBudget,
  mapCategory,
  mapCategoryGroup,
  mapConnection,
  mapLinkedAccount,
  mapTransaction,
  mapUserProfile,
  mapWallet,
  transactionToDoc,
  userProfileToDoc,
  walletToDoc,
  type UserProfileDoc,
} from './firestore-mappers';
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

const BATCH_LIMIT = 450;

type UserCollectionName =
  | 'transactions'
  | 'wallets'
  | 'categories'
  | 'categoryGroups'
  | 'budgets'
  | 'connections'
  | 'linkedAccounts'
  | 'recurringPayments';

const USER_COLLECTIONS: readonly UserCollectionName[] = [
  'transactions',
  'wallets',
  'categories',
  'categoryGroups',
  'budgets',
  'connections',
  'linkedAccounts',
  'recurringPayments',
] as const;

export type WorkspaceListener = (workspace: Workspace | null) => void;

/**
 * Firestore-backed workspace persistence.
 *
 * All documents live under users/{uid}. Feature code talks to BudgetStore only;
 * this class owns SDK calls, mapping, batching and listener lifecycle.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreWorkspaceRepository implements WorkspaceRepository {
  private readonly firestore = inject(FirestoreService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private unsubscribers: Unsubscribe[] = [];

  private get db() {
    return this.firestore.db;
  }

  async load(uid: string): Promise<Workspace | null> {
    if (!this.browser) return null;
    const profileSnap = await getDoc(doc(this.db, 'users', uid));
    if (!profileSnap.exists()) return null;
    return this.assembleWorkspace(uid, mapUserProfile(uid, profileSnap.data()));
  }

  /**
   * Starts real-time listeners for the user profile and every owned collection.
   * Replaces any previous subscription. Returns an unsubscribe function.
   */
  listen(uid: string, onChange: WorkspaceListener, onError: (error: Error) => void): () => void {
    this.stopListening();
    if (!this.browser) {
      onChange(null);
      return () => undefined;
    }

    this.unsubscribers = [];

    let profile: UserProfileDoc | null = null;
    let groups: CategoryGroup[] = [];
    let categories: Category[] = [];
    let wallets: Wallet[] = [];
    let budgets: Budget[] = [];
    let transactions: Transaction[] = [];
    let connections: ProviderConnection[] = [];
    let linkedAccounts: LinkedAccount[] = [];
    const ready = {
      profile: false,
      groups: false,
      categories: false,
      wallets: false,
      budgets: false,
      transactions: false,
      connections: false,
      linkedAccounts: false,
    };

    const emit = (): void => {
      if (!Object.values(ready).every(Boolean)) return;
      if (!profile) {
        onChange(null);
        return;
      }
      onChange(this.toWorkspace(uid, profile, {
        groups,
        categories,
        wallets,
        budgets,
        transactions,
        connections,
        linkedAccounts,
      }));
    };

    const fail = (error: unknown): void => {
      onError(error instanceof Error ? error : new Error(String(error)));
    };

    this.unsubscribers.push(
      onSnapshot(
        doc(this.db, 'users', uid),
        (snap) => {
          ready.profile = true;
          profile = snap.exists() ? mapUserProfile(uid, snap.data()) : null;
          emit();
        },
        fail,
      ),
    );

    const watch = <T>(
      name: UserCollectionName,
      key: keyof typeof ready,
      mapper: (snap: { id: string; data: () => DocumentData }) => T,
      assign: (items: T[]) => void,
    ): void => {
      this.unsubscribers.push(
        onSnapshot(
          collection(this.db, 'users', uid, name),
          (snap) => {
            ready[key] = true;
            assign(snap.docs.map((d) => mapper(d)));
            emit();
          },
          fail,
        ),
      );
    };

    watch('categoryGroups', 'groups', mapCategoryGroup, (items) => {
      groups = items;
    });
    watch('categories', 'categories', mapCategory, (items) => {
      categories = items;
    });
    watch('wallets', 'wallets', mapWallet, (items) => {
      wallets = items;
    });
    watch('budgets', 'budgets', mapBudget, (items) => {
      budgets = items;
    });
    watch('transactions', 'transactions', mapTransaction, (items) => {
      transactions = items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    });
    watch('connections', 'connections', mapConnection, (items) => {
      connections = items;
    });
    watch('linkedAccounts', 'linkedAccounts', mapLinkedAccount, (items) => {
      linkedAccounts = items;
    });

    return () => this.stopListening();
  }

  stopListening(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  /** Whole-workspace save used by tests and rare full replaces. Prefer granular writes. */
  async save(workspace: Workspace): Promise<void> {
    if (!this.browser) return;
    await this.writeWorkspace(workspace, { replaceCollections: true });
  }

  async clear(uid: string): Promise<void> {
    if (!this.browser) return;
    await this.deleteUserCollections(uid);
    await setDoc(
      doc(this.db, 'users', uid),
      {
        onboardingCompleted: false,
        activeBudgetId: null,
        dataMode: 'manual',
        demoSeededAt: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /**
   * Seeds demo or manual data for onboarding. Idempotent for demo: if the user
   * already completed onboarding in demo mode, existing documents are left alone
   * unless `force` is true (Reset Demo Data).
   */
  async seed(
    identity: WorkspaceIdentity,
    mode: 'demo' | 'manual',
    options: { force?: boolean } = {},
  ): Promise<Workspace> {
    if (!this.browser) {
      throw new Error('Firestore is only available in the browser.');
    }

    const existing = await this.load(identity.uid);
    if (existing?.onboardingCompleted && !options.force) {
      if (mode === 'demo' && existing.dataMode === 'demo') return existing;
      if (mode === 'manual' && existing.dataMode === 'manual') return existing;
      if (existing.onboardingCompleted) return existing;
    }

    const createdAt = existing?.createdAt ?? new Date().toISOString();
    if (options.force || existing) {
      await this.deleteUserCollections(identity.uid);
    }

    const workspace =
      mode === 'demo'
        ? createDemoWorkspace(identity, createdAt)
        : createEmptyWorkspace(identity, createdAt);

    await this.writeWorkspace(workspace, { replaceCollections: false, finalizeProfile: true });
    return workspace;
  }

  async upsertTransaction(uid: string, transaction: Transaction): Promise<void> {
    await setDoc(
      doc(this.db, 'users', uid, 'transactions', transaction.id),
      transactionToDoc(transaction),
    );
    await this.touchUser(uid);
  }

  async removeTransaction(uid: string, transactionId: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, 'users', uid, 'transactions', transactionId));
    batch.set(doc(this.db, 'users', uid), { updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async getTransaction(uid: string, transactionId: string): Promise<Transaction | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'transactions', transactionId));
    if (!snap.exists()) return null;
    return mapTransaction(snap);
  }

  async upsertWallet(uid: string, wallet: Wallet): Promise<void> {
    await setDoc(doc(this.db, 'users', uid, 'wallets', wallet.id), walletToDoc(wallet));
    await this.touchUser(uid);
  }

  async removeWallet(uid: string, walletId: string): Promise<void> {
    await this.deleteDoc(uid, 'wallets', walletId);
  }

  async upsertCategory(uid: string, category: Category): Promise<void> {
    await setDoc(doc(this.db, 'users', uid, 'categories', category.id), categoryToDoc(category));
    await this.touchUser(uid);
  }

  async removeCategory(uid: string, categoryId: string): Promise<void> {
    await this.deleteDoc(uid, 'categories', categoryId);
  }

  async upsertBudget(uid: string, budget: Budget): Promise<void> {
    await setDoc(doc(this.db, 'users', uid, 'budgets', budget.id), budgetToDoc(budget));
    await this.touchUser(uid);
  }

  async removeBudget(uid: string, budgetId: string): Promise<void> {
    await this.deleteDoc(uid, 'budgets', budgetId);
  }

  async updateProfile(
    uid: string,
    patch: Partial<{
      displayName: string | null;
      email: string | null;
      onboardingCompleted: boolean;
      activeBudgetId: string | null;
      dataMode: 'demo' | 'manual';
      demoSeededAt: string | null;
      preferences: UserPreferences;
    }>,
  ): Promise<void> {
    const payload: DocumentData = { updatedAt: serverTimestamp() };
    if (patch.displayName !== undefined) payload['displayName'] = patch.displayName;
    if (patch.email !== undefined) payload['email'] = patch.email;
    if (patch.onboardingCompleted !== undefined) {
      payload['onboardingCompleted'] = patch.onboardingCompleted;
    }
    if (patch.activeBudgetId !== undefined) payload['activeBudgetId'] = patch.activeBudgetId;
    if (patch.dataMode !== undefined) payload['dataMode'] = patch.dataMode;
    if (patch.demoSeededAt !== undefined) {
      payload['demoSeededAt'] =
        patch.demoSeededAt === null ? null : serverTimestamp();
    }
    if (patch.preferences !== undefined) payload['preferences'] = { ...patch.preferences };
    await setDoc(doc(this.db, 'users', uid), payload, { merge: true });
  }

  async setConnections(
    uid: string,
    connections: readonly ProviderConnection[],
    linkedAccounts: readonly LinkedAccount[],
  ): Promise<void> {
    await this.replaceCollection(uid, 'connections', connections, (item) =>
      connectionToDoc(item),
    );
    await this.replaceCollection(uid, 'linkedAccounts', linkedAccounts, (item) =>
      linkedAccountToDoc(item),
    );
    await this.touchUser(uid);
  }

  // ---------------------------------------------------------------- private

  private async assembleWorkspace(uid: string, profile: UserProfileDoc): Promise<Workspace> {
    const [groups, categories, wallets, budgets, transactions, connections, linkedAccounts] =
      await Promise.all([
        this.listMapped(uid, 'categoryGroups', mapCategoryGroup),
        this.listMapped(uid, 'categories', mapCategory),
        this.listMapped(uid, 'wallets', mapWallet),
        this.listMapped(uid, 'budgets', mapBudget),
        this.listMapped(uid, 'transactions', mapTransaction),
        this.listMapped(uid, 'connections', mapConnection),
        this.listMapped(uid, 'linkedAccounts', mapLinkedAccount),
      ]);

    transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return this.toWorkspace(uid, profile, {
      groups,
      categories,
      wallets,
      budgets,
      transactions,
      connections,
      linkedAccounts,
    });
  }

  private toWorkspace(
    uid: string,
    profile: UserProfileDoc,
    collections: {
      groups: readonly CategoryGroup[];
      categories: readonly Category[];
      wallets: readonly Wallet[];
      budgets: readonly Budget[];
      transactions: readonly Transaction[];
      connections: readonly ProviderConnection[];
      linkedAccounts: readonly LinkedAccount[];
    },
  ): Workspace {
    return {
      version: WORKSPACE_VERSION,
      uid,
      displayName: profile.displayName ?? '',
      email: profile.email ?? '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      onboardingCompleted: profile.onboardingCompleted,
      activeBudgetId: profile.activeBudgetId,
      dataMode: profile.dataMode,
      demoSeededAt: profile.demoSeededAt,
      preferences: profile.preferences,
      groups: collections.groups,
      categories: collections.categories,
      wallets: collections.wallets,
      budgets: collections.budgets,
      transactions: collections.transactions,
      connections: collections.connections,
      linkedAccounts: collections.linkedAccounts,
    };
  }

  private async writeWorkspace(
    workspace: Workspace,
    options: { replaceCollections: boolean; finalizeProfile?: boolean },
  ): Promise<void> {
    if (options.replaceCollections) {
      await this.deleteUserCollections(workspace.uid);
    }

    const ops: Array<{ path: [string, ...string[]]; data: DocumentData }> = [];

    for (const group of workspace.groups) {
      ops.push({
        path: ['users', workspace.uid, 'categoryGroups', group.id],
        data: categoryGroupToDoc(group),
      });
    }
    for (const category of workspace.categories) {
      ops.push({
        path: ['users', workspace.uid, 'categories', category.id],
        data: categoryToDoc(category),
      });
    }
    for (const wallet of workspace.wallets) {
      ops.push({
        path: ['users', workspace.uid, 'wallets', wallet.id],
        data: walletToDoc(wallet),
      });
    }
    for (const budget of workspace.budgets) {
      ops.push({
        path: ['users', workspace.uid, 'budgets', budget.id],
        data: budgetToDoc(budget),
      });
    }
    for (const transaction of workspace.transactions) {
      ops.push({
        path: ['users', workspace.uid, 'transactions', transaction.id],
        data: transactionToDoc(transaction),
      });
    }
    for (const connection of workspace.connections) {
      ops.push({
        path: ['users', workspace.uid, 'connections', connection.id],
        data: connectionToDoc(connection),
      });
    }
    for (const account of workspace.linkedAccounts) {
      ops.push({
        path: ['users', workspace.uid, 'linkedAccounts', account.id],
        data: linkedAccountToDoc(account),
      });
    }

    await this.commitInBatches(ops);

    // Profile flags are written only after all seed records succeed.
    const profile: UserProfileDoc = {
      displayName: workspace.displayName || null,
      email: workspace.email || null,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      onboardingCompleted: workspace.onboardingCompleted,
      activeBudgetId: workspace.activeBudgetId,
      dataMode: workspace.dataMode,
      demoSeededAt: workspace.demoSeededAt,
      preferences: workspace.preferences,
    };

    if (options.finalizeProfile !== false) {
      const data = userProfileToDoc(profile);
      data['updatedAt'] = serverTimestamp();
      if (workspace.dataMode === 'demo' && workspace.onboardingCompleted) {
        data['demoSeededAt'] = serverTimestamp();
      }
      await setDoc(doc(this.db, 'users', workspace.uid), data, { merge: true });
    }
  }

  private async deleteUserCollections(uid: string): Promise<void> {
    for (const name of USER_COLLECTIONS) {
      const snap = await getDocs(collection(this.db, 'users', uid, name));
      const refs = snap.docs.map((d) => d.ref);
      for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(this.db);
        for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
        await batch.commit();
      }
    }
  }

  private async replaceCollection<T extends { id: string }>(
    uid: string,
    name: UserCollectionName,
    items: readonly T[],
    toDoc: (item: T) => DocumentData,
  ): Promise<void> {
    const snap = await getDocs(collection(this.db, 'users', uid, name));
    const ops: Array<{ path: [string, ...string[]]; data: DocumentData | null }> = [];
    for (const existing of snap.docs) {
      if (!items.some((item) => item.id === existing.id)) {
        ops.push({ path: ['users', uid, name, existing.id], data: null });
      }
    }
    for (const item of items) {
      ops.push({ path: ['users', uid, name, item.id], data: toDoc(item) });
    }
    await this.commitInBatches(ops);
  }

  private async commitInBatches(
    ops: ReadonlyArray<{ path: [string, ...string[]]; data: DocumentData | null }>,
  ): Promise<void> {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const slice = ops.slice(i, i + BATCH_LIMIT);
      const batch: WriteBatch = writeBatch(this.db);
      for (const op of slice) {
        const ref = doc(this.db, ...op.path);
        if (op.data === null) batch.delete(ref);
        else batch.set(ref, op.data);
      }
      await batch.commit();
    }
  }

  private async listMapped<T>(
    uid: string,
    name: UserCollectionName,
    mapper: (snap: { id: string; data: () => DocumentData }) => T,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, 'users', uid, name));
    return snap.docs.map((d) => mapper(d));
  }

  private async deleteDoc(uid: string, name: UserCollectionName, id: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, 'users', uid, name, id));
    batch.set(doc(this.db, 'users', uid), { updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  private async touchUser(uid: string): Promise<void> {
    await setDoc(doc(this.db, 'users', uid), { updatedAt: serverTimestamp() }, { merge: true });
  }
}
