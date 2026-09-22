import type { CountryCode, PlaidApi, Products } from 'plaid';
import { plaidConfig } from './config';
import { loadNative } from './load-native';

type PlaidModule = typeof import('plaid');

let client: PlaidApi | null = null;

function plaidModule(): PlaidModule {
  return loadNative<PlaidModule>('plaid');
}

export function plaidClient(): PlaidApi {
  if (client) return client;
  const { Configuration, PlaidApi: Api, PlaidEnvironments } = plaidModule();
  const { clientId, secret } = plaidConfig();
  client = new Api(
    new Configuration({
      basePath: PlaidEnvironments['sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    }),
  );
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
