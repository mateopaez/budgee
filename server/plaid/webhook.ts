import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import {
  checkBodyHash,
  checkTokenAge,
  checkVerificationJwt,
  isRejectedPlaidToken,
  planWebhookAction,
  readWebhookEvent,
} from '../../src/app/core/plaid/plaid-webhook';
import { plaidClient, plaidFailure } from './client';
import { HttpError } from './config';
import { adminDb } from './firebase';
import { loadJose } from './load-jose';
import {
  disconnectStoredItem,
  storedItemFromSnapshot,
  syncStoredItem,
  markConnectionStatus,
  type PlaidRequest,
} from './handlers';

interface VerificationKey {
  readonly kty: string;
  readonly crv: string;
  readonly x: string;
  readonly y: string;
  readonly kid: string;
  readonly use: string;
  readonly alg: string;
  readonly expiredAt: number | null;
}

const keyCache = new Map<string, VerificationKey>();
const SYNC_BUDGET_MS = 50_000;

/**
 * Plaid calls this with no Firebase user. The JWT is checked against the raw
 * body before the JSON is trusted. Item ids, access tokens, and the JWT itself
 * are never logged.
 */
export async function receivePlaidWebhook(req: PlaidRequest): Promise<{ body: { received: true } }> {
  const header = req.header('plaid-verification');
  const jwtCheck = checkVerificationJwt(header);
  const raw = req.rawBody ?? null;
  if (!jwtCheck.ok || !jwtCheck.token || !raw || raw.byteLength === 0) {
    throw new HttpError(401, 'Invalid webhook verification');
  }

  await verifySignature(raw, jwtCheck.token);

  const event = readWebhookEvent(parseJson(raw));
  if (!event) return { body: { received: true } };

  const db = adminDb();
  const item = event.itemId ? await loadItemByItemId(event.itemId) : null;
  const effect = planWebhookAction({
    itemFound: item != null,
    webhookType: event.webhookType,
    webhookCode: event.webhookCode,
    errorCode: event.errorCode,
  });
  if (!item || effect === 'ignore') return { body: { received: true } };

  try {
    if (effect === 'needs_attention') {
      await markConnectionStatus(db, item.uid, item.connectionId, 'needs_attention');
      return { body: { received: true } };
    }
    if (effect === 'disconnect') {
      await disconnectStoredItem(db, item);
      return { body: { received: true } };
    }
    await syncStoredItem(db, item, {
      waitForReady: false,
      deadlineAt: Date.now() + SYNC_BUDGET_MS,
    });
    return { body: { received: true } };
  } catch (error) {
    if (error instanceof HttpError && error.status === 409 && isRejectedPlaidToken(error.code)) {
      return { body: { received: true } };
    }
    if (!(error instanceof HttpError) || error.status >= 500) logWebhookFailure(error);
    throw error;
  }
}

async function verifySignature(rawBody: Uint8Array, jwt: string): Promise<void> {
  const { decodeProtectedHeader, importJWK, jwtVerify } = await loadJose();
  let kid = '';
  try {
    const header = decodeProtectedHeader(jwt);
    if (header.alg !== 'ES256' || typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid)) {
      throw new HttpError(401, 'Invalid webhook verification');
    }
    kid = header.kid;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Invalid webhook verification');
  }

  let payload: { readonly iat?: unknown; readonly request_body_sha256?: unknown };
  try {
    const key = await verificationKey(kid);
    const verified = await jwtVerify(
      jwt,
      await importJWK(
        {
          kty: key.kty,
          crv: key.crv,
          x: key.x,
          y: key.y,
          kid: key.kid,
          use: key.use,
          alg: 'ES256',
        },
        'ES256',
      ),
      { algorithms: ['ES256'], maxTokenAge: '5 min', clockTolerance: '30s' },
    );
    payload = verified.payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logWebhookFailure(error);
    throw new HttpError(401, 'Invalid webhook verification');
  }

  const hash = await checkBodyHash(rawBody, payload.request_body_sha256);
  const age = checkTokenAge(payload.iat, Date.now());
  if (!hash.ok || !age.ok) throw new HttpError(401, 'Invalid webhook verification');
}

async function verificationKey(kid: string): Promise<VerificationKey> {
  if (!keyCache.has(kid)) {
    const refresh = [kid];
    for (const [id, key] of keyCache) {
      if (key.expiredAt == null) refresh.push(id);
    }
    for (const id of refresh) {
      try {
        const response = await plaidClient().webhookVerificationKeyGet({ key_id: id });
        const key = response.data.key;
        const stored: VerificationKey = {
          kty: key.kty,
          crv: key.crv,
          x: key.x,
          y: key.y,
          kid: key.kid,
          use: key.use,
          alg: key.alg,
          expiredAt: key.expired_at,
        };
        keyCache.set(id, stored);
        if (key.kid) keyCache.set(key.kid, stored);
      } catch (error) {
        keyCache.delete(id);
        if (id === kid) {
          logWebhookFailure(error);
          throw new HttpError(401, 'Invalid webhook verification');
        }
      }
    }
  }

  const key = keyCache.get(kid);
  if (!key || key.expiredAt != null) {
    keyCache.delete(kid);
    throw new HttpError(401, 'Invalid webhook verification');
  }
  return key;
}

async function loadItemByItemId(itemId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(itemId)) return null;
  const snap = await adminDb().collectionGroup('plaidItems').where('itemId', '==', itemId).limit(2).get();
  if (snap.size > 1) {
    console.error('Plaid webhook failed', 'AmbiguousPlaidItem', '');
    return null;
  }
  const doc = snap.docs[0] as QueryDocumentSnapshot | undefined;
  if (!doc) return null;
  return storedItemFromSnapshot(doc);
}

function parseJson(raw: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function logWebhookFailure(error: unknown): void {
  const failure = plaidFailure(error);
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : '';
  const firestoreCode = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode) : '';
  const httpCode = error instanceof HttpError ? (error.code ?? '') : '';
  const code = failure.code || httpCode || firestoreCode;
  const name =
    firestoreCode === 'failed-precondition' || firestoreCode === '9' ? 'FirestoreIndex' : error instanceof Error ? error.name : 'Error';
  console.error('Plaid webhook failed', name, code);
}
