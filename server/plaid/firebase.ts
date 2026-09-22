import type { Firestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin/app';
import { HttpError, plaidConfig } from './config';
import { loadNative } from './load-native';

type AdminAppModule = typeof import('firebase-admin/app');
type AdminAuthModule = typeof import('firebase-admin/auth');
type AdminFirestoreModule = typeof import('firebase-admin/firestore');

function serviceAccountFromJson(raw: string): ServiceAccount {
  const parsed = parseServiceAccountJson(raw);
  const projectId = readString(parsed, 'project_id') ?? readString(parsed, 'projectId');
  const clientEmail = readString(parsed, 'client_email') ?? readString(parsed, 'clientEmail');
  const privateKey = readString(parsed, 'private_key') ?? readString(parsed, 'privateKey');
  if (!projectId || !clientEmail || !privateKey) {
    throw new HttpError(
      500,
      'FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key',
    );
  }
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
}

/**
 * Vercel sometimes stores the one-line JSON with real line breaks, or with a
 * wrapping pair of quotes. Both still have to parse.
 */
function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const candidates = [trimmed];
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    candidates.push(trimmed.slice(1, -1));
  }
  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate) ?? tryParseObject(candidate.replace(/\r?\n/g, '\\n'));
    if (parsed) return parsed;
  }
  throw new HttpError(
    500,
    'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the one-line jq output with no extra quotes.',
  );
}

function tryParseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function app() {
  const { cert, getApps, initializeApp } = loadNative<AdminAppModule>('firebase-admin/app');
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccountFromJson(plaidConfig().serviceAccountJson)) });
  }
  const current = getApps()[0];
  if (!current) throw new HttpError(500, 'Firebase admin did not start');
  return current;
}

export function adminAuth() {
  const { getAuth } = loadNative<AdminAuthModule>('firebase-admin/auth');
  return getAuth(app());
}

export function adminDb(): Firestore {
  const { getFirestore, initializeFirestore } = loadNative<AdminFirestoreModule>('firebase-admin/firestore');
  const firebaseApp = app();
  try {
    return initializeFirestore(firebaseApp, { preferRest: true });
  } catch {
    return getFirestore(firebaseApp);
  }
}
