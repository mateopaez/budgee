import { plaidFailure } from './client';
import { HttpError } from './config';
import {
  createLinkToken,
  disconnectConnection,
  exchangePublicToken,
  syncConnection,
  type PlaidRequest,
} from './handlers';

const ACTIONS = {
  'link-token': createLinkToken,
  exchange: exchangePublicToken,
  sync: syncConnection,
  disconnect: disconnectConnection,
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
    return { status: 500, body: { error: 'Something went wrong' } };
  }
}
