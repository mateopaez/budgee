import type { Cents } from './money.model';

/**
 * Provider agnostic bank connection metadata. Plaid tokens stay on the server.
 * `needs_attention` means the bank has to be connected again.
 */
export type ConnectionProvider = 'demo' | 'manual' | 'plaid';

export type ConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'syncing'
  | 'needs_attention'
  | 'disconnected';

export interface ProviderConnection {
  readonly id: string;
  readonly provider: ConnectionProvider;
  readonly institutionName: string;
  readonly status: ConnectionStatus;
  /** ISO timestamp, or null when the connection has never synced. */
  readonly lastSyncAt: string | null;
}

export type LinkedAccountType = 'checking' | 'savings' | 'credit' | 'loan';

export interface LinkedAccount {
  readonly id: string;
  readonly connectionId: string;
  readonly institutionName: string;
  readonly name: string;
  /** Last few digits shown to the user. Never a full account number. */
  readonly mask: string;
  readonly type: LinkedAccountType;
  readonly balanceCents: Cents;
  /** Wallet this account feeds, when the user has mapped one. */
  readonly walletId: string | null;
}
