import { join } from 'node:path';

/**
 * Loads a local `.env` when the process was not already given Plaid credentials.
 * Vercel injects the same variables, so a missing file there is expected.
 * Never import this from `src/app`.
 */
export function loadLocalEnv(): void {
  if (process.env['PLAID_CLIENT_ID']) return;
  try {
    process.loadEnvFile(join(process.cwd(), '.env'));
  } catch {
    // The file is absent in production, where the host provides the variables.
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface PlaidConfig {
  readonly clientId: string;
  readonly secret: string;
  readonly serviceAccountJson: string;
}

/** Production webhook Link subscribes to. Override with `PLAID_WEBHOOK_URL` for another host. */
export const PLAID_WEBHOOK_URL = 'https://budgee0.vercel.app/api/plaid/webhook';

/** Reads Production credentials. Refuses Sandbox and every other environment. */
export function plaidConfig(): PlaidConfig {
  loadLocalEnv();
  const clientId = process.env['PLAID_CLIENT_ID']?.trim() ?? '';
  const secret = process.env['PLAID_SECRET']?.trim() ?? '';
  const env = process.env['PLAID_ENV']?.trim() ?? '';
  const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON']?.trim() ?? '';
  const missing: string[] = [];
  if (!clientId) missing.push('PLAID_CLIENT_ID');
  if (!secret) missing.push('PLAID_SECRET');
  if (!serviceAccountJson) missing.push('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (missing.length > 0) {
    throw new HttpError(500, `Missing server configuration: ${missing.join(', ')}`);
  }
  if (env !== 'production') {
    throw new HttpError(500, 'PLAID_ENV must be production');
  }
  return { clientId, secret, serviceAccountJson };
}

/** URL sent on `linkTokenCreate`. The value is not a secret. */
export function plaidWebhookUrl(): string {
  loadLocalEnv();
  const configured = process.env['PLAID_WEBHOOK_URL']?.trim() ?? '';
  if (!configured) return PLAID_WEBHOOK_URL;
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new HttpError(500, 'PLAID_WEBHOOK_URL must be an https URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new HttpError(500, 'PLAID_WEBHOOK_URL must be an https URL');
  }
  return parsed.toString();
}
