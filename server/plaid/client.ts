import { createHash } from 'node:crypto';
import type { CountryCode, PlaidApi, Products } from 'plaid';
import { plaidConfig } from './config';
import { loadNative } from './load-native';

type PlaidModule = typeof import('plaid');

let cached: { client: PlaidApi; fingerprint: string } | null = null;

function plaidModule(): PlaidModule {
  return loadNative<PlaidModule>('plaid');
}

/**
 * One Production client per process. The cache key changes with the credentials,
 * so a Sandbox client cannot linger after `PLAID_ENV` or the secret changes.
 */
export function plaidClient(): PlaidApi {
  const { clientId, secret } = plaidConfig();
  const fingerprint = createHash('sha256').update(clientId).update('\0').update(secret).digest('hex');
  if (cached?.fingerprint === fingerprint) return cached.client;
  const { Configuration, PlaidApi: Api, PlaidEnvironments } = plaidModule();
  const client = new Api(
    new Configuration({
      basePath: PlaidEnvironments['production'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    }),
  );
  cached = { client, fingerprint };
  return client;
}

export function linkProducts(): Products[] {
  return [plaidModule().Products.Transactions];
}

export function linkCountries(): CountryCode[] {
  const { CountryCode } = plaidModule();
  return [CountryCode.Ca, CountryCode.Us];
}

/** Pulls a Plaid error code without logging the request, which carries the secret. */
export function plaidFailure(error: unknown): { code: string | null; message: string } {
  if (!error || typeof error !== 'object') {
    return { code: null, message: 'Plaid request failed' };
  }
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') {
    return { code: null, message: 'Plaid request failed' };
  }
  const body = data as { error_code?: unknown; error_message?: unknown };
  const code = typeof body.error_code === 'string' ? body.error_code : null;
  const message =
    typeof body.error_message === 'string' && body.error_message.length > 0
      ? body.error_message.slice(0, 200)
      : 'Plaid request failed';
  return { code, message };
}
