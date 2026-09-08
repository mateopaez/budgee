import { InjectionToken } from '@angular/core';
import type { Transaction, Wallet, ProviderConnection, LinkedAccount } from '../models';
import type { Workspace } from './workspace';

/**
 * Persistence ports.
 *
 * The application talks to these interfaces only, so the local storage adapter
 * used today can be swapped for a Firestore adapter (documented in
 * docs/firestore-adapter.md) without touching a component.
 */
export interface WorkspaceRepository {
  load(uid: string): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;
  clear(uid: string): Promise<void>;
}

export interface TransactionRepository {
  list(uid: string): Promise<Transaction[]>;
  upsert(uid: string, transaction: Transaction): Promise<void>;
  remove(uid: string, transactionId: string): Promise<void>;
}

export interface WalletRepository {
  list(uid: string): Promise<Wallet[]>;
  upsert(uid: string, wallet: Wallet): Promise<void>;
  remove(uid: string, walletId: string): Promise<void>;
}

/**
 * Read side port for an external aggregation provider. No implementation ships
 * in this MVP; see docs/future-plaid-integration.md.
 */
export interface FinancialDataProvider {
  readonly name: string;
  listConnections(uid: string): Promise<ProviderConnection[]>;
  listAccounts(uid: string): Promise<LinkedAccount[]>;
  syncTransactions(uid: string, connectionId: string): Promise<Transaction[]>;
}

export const WORKSPACE_REPOSITORY = new InjectionToken<WorkspaceRepository>('WorkspaceRepository');
