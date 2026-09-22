import { Injectable, inject } from '@angular/core';
import type { LinkedAccount, ProviderConnection } from '../models';
import { AuthService } from '../auth/auth.service';

export class PlaidClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface PlaidExchangeResult {
  readonly connection: ProviderConnection;
  readonly accounts: readonly LinkedAccount[];
  readonly skippedAccounts: readonly string[];
}

export interface PlaidSyncResult {
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
}

interface PlaidLinkHandler {
  open(): void;
  destroy(): void;
}

interface PlaidLinkError {
  readonly display_message: string | null;
  readonly error_message: string;
}

interface PlaidLinkCreate {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: (error: PlaidLinkError | null) => void;
}

declare global {
  interface Window {
    Plaid?: {
      create(config: PlaidLinkCreate): PlaidLinkHandler;
    };
  }
}

let linkScript: Promise<void> | null = null;

/** Loads the Plaid Link script once. The script holds no secret. */
export function loadPlaidLink(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new PlaidClientError('Plaid Link runs in the browser'));
  }
  if (window.Plaid) return Promise.resolve();
  linkScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.dataset['plaidLink'] = 'true';
    script.onload = () => resolve();
    script.onerror = () => {
      linkScript = null;
      reject(new PlaidClientError('Could not load Plaid Link'));
    };
    document.head.appendChild(script);
  });
  return linkScript;
}

/**
 * Browser calls for the Plaid endpoints.
 * The Firebase ID token is sent; the uid is never part of the body.
 */
@Injectable({ providedIn: 'root' })
export class PlaidApi {
  private readonly auth = inject(AuthService);

  linkToken(): Promise<string> {
    return this.post<{ linkToken: string }>('/api/plaid/link-token', {}).then(
      (body) => body.linkToken,
    );
  }

  exchange(publicToken: string): Promise<PlaidExchangeResult> {
    return this.post<PlaidExchangeResult>('/api/plaid/exchange', { publicToken });
  }

  sync(connectionId: string): Promise<PlaidSyncResult> {
    return this.post<PlaidSyncResult>('/api/plaid/sync', { connectionId });
  }

  disconnect(connectionId: string): Promise<void> {
    return this.post<{ ok: true }>('/api/plaid/disconnect', { connectionId }).then(() => undefined);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const token = await this.auth.getIdToken();
    if (!token) throw new PlaidClientError('Sign in required');
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const message = typeof record['error'] === 'string' ? record['error'] : 'Something went wrong';
      const code = typeof record['code'] === 'string' ? record['code'] : undefined;
      throw new PlaidClientError(message, code);
    }
    return payload as T;
  }
}
