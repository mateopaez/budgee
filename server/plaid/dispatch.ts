import { plaidFailure } from './client';
import { HttpError } from './config';
import {
  createLinkToken,
  disconnectConnection,
  exchangePublicToken,
  syncConnection,
  type PlaidRequest,
} from './handlers';
import { receivePlaidWebhook } from './webhook';

const ACTIONS = {
  'link-token': createLinkToken,
  exchange: exchangePublicToken,
  sync: syncConnection,
  disconnect: disconnectConnection,
  webhook: receivePlaidWebhook,
} as const;

export type PlaidAction = keyof typeof ACTIONS;

export function isPlaidAction(value: string): value is PlaidAction {
  return Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

/** Runs one Plaid endpoint and returns the HTTP status plus JSON body. */
export async function dispatchPlaid(
  action: string,
  req: PlaidRequest,
): Promise<{ status: number; body: unknown }> {
  if (!isPlaidAction(action)) {
    return { status: 404, body: { error: 'Not found' } };
  }
  try {
    const result = await ACTIONS[action](req);
    return { status: 200, body: result.body };
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        status: error.status,
        body: { error: error.message, ...(error.code ? { code: error.code } : {}) },
      };
    }
    const failure = plaidFailure(error);
    if (failure.code) {
      return { status: 502, body: { error: failure.message, code: failure.code } };
    }
    console.error('Plaid endpoint failed', error instanceof Error ? error.name : 'Error');
    return { status: 500, body: { error: safeErrorMessage(error) } };
  }
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || error.message.length === 0) return 'Something went wrong';
  const message = error.message.replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, '').trim();
  if (/private_key|PLAID_SECRET|BEGIN PRIVATE/i.test(message)) return 'Server configuration failed';
  return message.slice(0, 240);
}
