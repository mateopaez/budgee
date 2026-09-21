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

/** Reads Sandbox credentials. Refuses any other Plaid environment. */
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
  if (env !== 'sandbox') {
    throw new HttpError(500, 'PLAID_ENV must be sandbox');
  }
  return { clientId, secret, serviceAccountJson };
}
