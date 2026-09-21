import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from 'plaid';
import { plaidConfig } from './config';

let client: PlaidApi | null = null;

export function plaidClient(): PlaidApi {
  if (client) return client;
  const { clientId, secret } = plaidConfig();
  client = new PlaidApi(
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

export const LINK_PRODUCTS = [Products.Transactions];
export const LINK_COUNTRIES = [CountryCode.Ca, CountryCode.Us];

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
