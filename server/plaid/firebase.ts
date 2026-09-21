import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpError, plaidConfig } from './config';

function serviceAccountFromJson(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(
      500,
      'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the one-line jq output with no extra quotes.',
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT_JSON is not a JSON object');
  }
  const row = parsed as Record<string, unknown>;
  const projectId = readString(row, 'project_id') ?? readString(row, 'projectId');
  const clientEmail = readString(row, 'client_email') ?? readString(row, 'clientEmail');
  const privateKey = readString(row, 'private_key') ?? readString(row, 'privateKey');
  if (!projectId || !clientEmail || !privateKey) {
    throw new HttpError(
      500,
      'FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key',
    );
  }
  return { projectId, clientEmail, privateKey };
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
