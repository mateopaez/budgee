/**
 * Pure Plaid webhook decisions. No network, no secrets, no Plaid SDK.
 * The server verifies the JWT, then uses these checks before it syncs.
 */

const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 30_000;
const SHA256_HEX = /^[a-f0-9]{64}$/;

export type WebhookEffect = 'sync' | 'needs_attention' | 'disconnect' | 'ignore';

export type WebhookCheck =
  | { readonly ok: true; readonly token?: string }
  | { readonly ok: false; readonly reason: 'missing_jwt' | 'body_hash_mismatch' | 'stale_token' };

export interface WebhookEvent {
  readonly webhookType: string;
  readonly webhookCode: string;
  readonly itemId: string | null;
  readonly errorCode: string | null;
}

/** Rejects a missing `Plaid-Verification` header. A present value still needs a signature check. */
export function checkVerificationJwt(header: string | string[] | null | undefined): WebhookCheck {
  const value = Array.isArray(header) ? header[0] : header;
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) return { ok: false, reason: 'missing_jwt' };
  return { ok: true, token };
}

/** SHA-256 of the raw body bytes must match the JWT claim. A re-serialized object is not valid. */
export async function checkBodyHash(body: Uint8Array, claimed: unknown): Promise<WebhookCheck> {
  if (typeof claimed !== 'string' || !SHA256_HEX.test(claimed)) {
    return { ok: false, reason: 'body_hash_mismatch' };
  }
  const actual = await sha256Bytes(body);
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) {
    diff |= (actual[index] ?? 0) ^ (hexByte(claimed, index) ?? 0);
  }
  return diff === 0 ? { ok: true } : { ok: false, reason: 'body_hash_mismatch' };
}

/** Plaid rejects webhook JWTs older than five minutes. A few seconds of clock skew is allowed. */
export function checkTokenAge(iatSeconds: unknown, nowMs: number): WebhookCheck {
  if (typeof iatSeconds !== 'number' || !Number.isFinite(iatSeconds)) {
    return { ok: false, reason: 'stale_token' };
  }
  const ageMs = nowMs - iatSeconds * 1000;
  if (ageMs < -CLOCK_SKEW_MS || ageMs > MAX_TOKEN_AGE_MS) return { ok: false, reason: 'stale_token' };
  return { ok: true };
}

/**
 * What to do after the JWT checks out. An unknown Item is ignored.
 * `ITEM_LOGIN_REQUIRED` is an `ITEM` / `ERROR` and needs the bank connected again.
 */
export function planWebhookAction(input: {
  readonly itemFound: boolean;
  readonly webhookType: string;
  readonly webhookCode: string;
  readonly errorCode: string | null;
}): WebhookEffect {
  if (!input.itemFound) return 'ignore';
  const type = input.webhookType;
  const code = input.webhookCode;
  if (type === 'TRANSACTIONS' && code === 'SYNC_UPDATES_AVAILABLE') return 'sync';
  if (type === 'ITEM' && (code === 'ERROR' || input.errorCode === 'ITEM_LOGIN_REQUIRED')) {
    return 'needs_attention';
  }
  if (type === 'ITEM' && (code === 'PENDING_EXPIRATION' || code === 'PENDING_DISCONNECT')) {
    return 'needs_attention';
  }
  if (type === 'ITEM' && code === 'USER_PERMISSION_REVOKED') return 'disconnect';
  return 'ignore';
}

export function readWebhookEvent(body: unknown): WebhookEvent | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const webhookType = readString(row['webhook_type']);
  const webhookCode = readString(row['webhook_code']);
  if (!webhookType || !webhookCode) return null;
  const error = row['error'];
  const errorCode =
    error && typeof error === 'object' && !Array.isArray(error)
      ? readString((error as Record<string, unknown>)['error_code'])
      : null;
  return {
    webhookType,
    webhookCode,
    itemId: readString(row['item_id']),
    errorCode,
  };
}

/** Sandbox access tokens are rejected by Production. The bank has to be connected again. */
export function isRejectedPlaidToken(code: string | null | undefined): boolean {
  return code === 'INVALID_ACCESS_TOKEN' || code === 'ITEM_LOGIN_REQUIRED';
}

/** Plaid no longer has this Item, so the local secret can be removed. */
export function isPlaidItemGone(code: string | null | undefined): boolean {
  return code === 'ITEM_NOT_FOUND' || code === 'INVALID_ACCESS_TOKEN';
}

/**
 * Sandbox and Development tokens cannot be revoked with Production credentials.
 * Calling `/item/remove` with one returns a wrong-environment error and leaves the link in place.
 */
export function isForeignPlaidAccessToken(token: string): boolean {
  return token.startsWith('access-sandbox-') || token.startsWith('access-development-');
}

/**
 * Production refused this token because it belongs to another environment, or the Item is already gone.
 * The local connection can be deleted. A live Production Item is not in this set.
 */
export function canForgetPlaidItem(code: string | null | undefined, message?: string | null): boolean {
  if (isPlaidItemGone(code)) return true;
  if (code !== 'INVALID_FIELD' || typeof message !== 'string') return false;
  return message.toLowerCase().includes('wrong plaid environment');
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function sha256Bytes(body: Uint8Array): Promise<Uint8Array> {
  const subtle = (
    globalThis as {
      crypto?: { subtle?: { digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> } };
    }
  ).crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 is unavailable');
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  const digest = await subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  return new Uint8Array(digest);
}

function hexByte(hex: string, index: number): number {
  return Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
}
