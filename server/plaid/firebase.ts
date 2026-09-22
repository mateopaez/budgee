import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpError, plaidConfig } from './config';

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
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccountFromJson(plaidConfig().serviceAccountJson)) });
  }
  return getApps()[0];
}

export function adminAuth() {
  return getAuth(app());
}

export function adminDb(): Firestore {
  return getFirestore(app());
}
