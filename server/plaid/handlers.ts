import type { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import type { AccountBase, RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import { createId } from '../../src/app/core/util/id.util';
import {
  applyPlaidSync,
  mapPlaidAccountKind,
  syncCursor,
  type PlaidTransactionInput,
} from '../../src/app/core/plaid/map-plaid-transaction';
import type { LinkedAccount, ProviderConnection, Transaction } from '../../src/app/core/models';
import { LINK_COUNTRIES, LINK_PRODUCTS, plaidClient, plaidFailure } from './client';
import { HttpError } from './config';
import { adminAuth, adminDb } from './firebase';

/** The few request fields the Plaid handlers read. Express and Vercel both satisfy this. */
export interface PlaidRequest {
  header(name: string): string | string[] | undefined;
  readonly body: unknown;
}

interface SecretItem {
  readonly accessToken: string;
  readonly itemId: string;
  readonly cursor: string;
  readonly connectionId: string;
  readonly accountMap: Record<string, string>;
}

export async function createLinkToken(req: PlaidRequest): Promise<{ body: { linkToken: string } }> {
  const uid = await uidFrom(req);
  const created = await plaidClient().linkTokenCreate({
    user: { client_user_id: uid },
    client_name: 'Budgee',
    products: LINK_PRODUCTS,
    country_codes: LINK_COUNTRIES,
    language: 'en',
  });
  return { body: { linkToken: created.data.link_token } };
}

export async function exchangePublicToken(req: PlaidRequest): Promise<{
  body: {
    connection: ProviderConnection;
    accounts: LinkedAccount[];
    skippedAccounts: string[];
  };
}> {
  const uid = await uidFrom(req);
  const publicToken = readStringField(req.body, 'publicToken');
  if (!publicToken || publicToken.length > 500 || /\s/.test(publicToken)) {
    throw new HttpError(400, 'Missing public token');
  }

  const client = plaidClient();
  const exchanged = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchanged.data.access_token;
  const itemId = exchanged.data.item_id;
  let persisted = false;

  try {
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const institutionName = accountsResponse.data.item.institution_name?.trim() || 'Connected bank';
    const skippedAccounts: string[] = [];
    const accounts: LinkedAccount[] = [];
    const accountMap: Record<string, string> = {};
    const connectionId = createId('conn');

    for (const account of accountsResponse.data.accounts) {
      const kind = mapPlaidAccountKind(account.type, account.subtype);
      if (!kind) {
        skippedAccounts.push(account.name || 'Account');
        continue;
      }
      const linked = toLinkedAccount(account, kind, connectionId, institutionName);
      accounts.push(linked);
      accountMap[account.account_id] = linked.id;
    }

    if (accounts.length === 0) {
      throw new HttpError(
        422,
        skippedAccounts.length > 0
          ? `No supported accounts. Skipped: ${skippedAccounts.join(', ')}`
          : 'No accounts were returned',
      );
    }

    const connection: ProviderConnection = {
      id: connectionId,
      provider: 'plaid',
      institutionName,
      status: 'connected',
      lastSyncAt: null,
    };
    const db = adminDb();
    const batch = db.batch();
    batch.set(db.doc(`private/${uid}/plaidItems/${itemId}`), {
      accessToken,
      itemId,
      cursor: '',
      connectionId,
      accountMap,
    });
    batch.set(db.doc(`users/${uid}/connections/${connectionId}`), {
      provider: connection.provider,
      institutionName: connection.institutionName,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
    });
    for (const account of accounts) {
      batch.set(db.doc(`users/${uid}/linkedAccounts/${account.id}`), {
        connectionId: account.connectionId,
        institutionName: account.institutionName,
        name: account.name,
        mask: account.mask,
        type: account.type,
        balanceCents: account.balanceCents,
        walletId: account.walletId,
      });
    }
    await batch.commit();
    persisted = true;
    return { body: { connection, accounts, skippedAccounts } };
  } catch (error) {
    if (!persisted) {
      await client.itemRemove({ access_token: accessToken }).catch(() => undefined);
    }
    throw error;
  }
}

export async function syncConnection(req: PlaidRequest): Promise<{
  body: { added: number; modified: number; removed: number };
}> {
  const uid = await uidFrom(req);
  const connectionId = readConnectionId(req.body);
  const db = adminDb();
  const item = await findItem(db, uid, connectionId);
  if (!item) throw new HttpError(404, 'Connection not found');

  await setStatus(db, uid, connectionId, 'syncing');
  let finished = false;
  try {
    const accountsByPlaidId = await accountLinks(db, uid, item.accountMap);
    const existing = await existingTransactions(db, uid);
    const linkedIds = new Set(Object.values(item.accountMap));
    const localImports = existing.filter(
      (tx) => tx.linkedAccountId != null && linkedIds.has(tx.linkedAccountId),
    ).length;
    const pages = await fetchTransactions(item.accessToken, syncCursor(item.cursor, localImports));
    const plan = applyPlaidSync({
      added: pages.added.map(toInput),
      modified: pages.modified.map(toInput),
      removedIds: pages.removed.map((row) => row.transaction_id),
      existing,
      accountsByPlaidId,
      now: new Date().toISOString(),
      createId: () => createId('tx'),
    });

    const ops: Array<(batch: WriteBatch) => void> = [];
    for (const upsert of plan.upserts) {
      const ref = db.doc(`users/${uid}/transactions/${upsert.transaction.id}`);
      if (upsert.isNew) {
        ops.push((batch) => batch.set(ref, newTransactionDoc(upsert.transaction)));
      } else {
        const tx = upsert.transaction;
        ops.push((batch) =>
          batch.update(ref, {
            type: tx.type,
            amountCents: tx.amountCents,
            currency: tx.currency,
            date: tx.date,
            merchant: tx.merchant,
            fromWalletId: tx.fromWalletId,
            toWalletId: tx.toWalletId,
            linkedAccountId: tx.linkedAccountId,
            updatedAt: tx.updatedAt,
          }),
        );
      }
    }
    for (const id of plan.deleteIds) {
      const ref = db.doc(`users/${uid}/transactions/${id}`);
      ops.push((batch) => batch.delete(ref));
    }
    await commitOps(db, ops);
    await item.ref.set({ cursor: pages.cursor }, { merge: true });
    await db.doc(`users/${uid}/connections/${connectionId}`).set(
      { status: 'connected', lastSyncAt: new Date().toISOString() },
      { merge: true },
    );
    finished = true;
    return { body: { added: plan.added, modified: plan.modified, removed: plan.removed } };
  } catch (error) {
    const failure = plaidFailure(error);
    if (failure.code === 'ITEM_LOGIN_REQUIRED') {
      await setStatus(db, uid, connectionId, 'needs_attention');
      finished = true;
      throw new HttpError(
        409,
        'This bank connection needs to be signed in again.',
        'ITEM_LOGIN_REQUIRED',
      );
    }
    if (failure.code === 'PRODUCT_NOT_READY') {
      throw new HttpError(
        409,
        'Transactions are not ready yet. Sync again in a moment.',
        'PRODUCT_NOT_READY',
      );
    }
    if (failure.code) throw new HttpError(502, failure.message, failure.code);
    throw error;
  } finally {
    if (!finished) await setStatus(db, uid, connectionId, 'connected').catch(() => undefined);
  }
}

export async function disconnectConnection(req: PlaidRequest): Promise<{ body: { ok: true } }> {
  const uid = await uidFrom(req);
  const connectionId = readConnectionId(req.body);
  const db = adminDb();
  const item = await findItem(db, uid, connectionId);
  const connectionRef = db.doc(`users/${uid}/connections/${connectionId}`);
  const connection = await connectionRef.get();
  if (!item && !connection.exists) throw new HttpError(404, 'Connection not found');

  if (item) {
    try {
      await plaidClient().itemRemove({ access_token: item.accessToken });
    } catch (error) {
      const failure = plaidFailure(error);
      if (failure.code !== 'ITEM_NOT_FOUND') {
        throw new HttpError(502, failure.message, failure.code ?? undefined);
      }
    }
    await item.ref.delete();
  }
  if (connection.exists) {
    await connectionRef.set({ status: 'disconnected' }, { merge: true });
  }
  return { body: { ok: true } };
}

async function uidFrom(req: PlaidRequest): Promise<string> {
  const header = req.header('authorization');
  const authorization = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(\S+)$/.exec(authorization ?? '');
  const token = match?.[1];
  if (!token) throw new HttpError(401, 'Sign in required');
  const auth = adminAuth();
  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.uid || decoded.uid.includes('/')) throw new HttpError(401, 'Sign in required');
    return decoded.uid;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Sign in required');
  }
}

function readConnectionId(body: unknown): string {
  const value = readStringField(body, 'connectionId');
  if (!value || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    throw new HttpError(400, 'Missing connection');
  }
  return value;
}

function readStringField(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : null;
}

function toLinkedAccount(
  account: AccountBase,
  kind: NonNullable<ReturnType<typeof mapPlaidAccountKind>>,
  connectionId: string,
  institutionName: string,
): LinkedAccount {
  const current = account.balances.current;
  return {
    id: createId('acct'),
    connectionId,
    institutionName,
    name: account.name || account.official_name || 'Account',
    mask: account.mask ?? '',
    type: kind,
    balanceCents: typeof current === 'number' && Number.isFinite(current) ? Math.round(current * 100) : 0,
    walletId: null,
  };
}

async function fetchTransactions(accessToken: string, startCursor: string): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: RemovedTransaction[];
  cursor: string;
}> {
  let attempt = 0;
  while (true) {
    try {
      return await fetchPages(accessToken, startCursor);
    } catch (error) {
      if (plaidFailure(error).code === 'PRODUCT_NOT_READY' && attempt < 3) {
        attempt += 1;
        await delay(1500);
        continue;
      }
      throw error;
    }
  }
}

async function fetchPages(accessToken: string, startCursor: string): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: RemovedTransaction[];
  cursor: string;
}> {
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: RemovedTransaction[] = [];
  let cursor = startCursor;
  let pages = 0;
  let waits = 0;

  while (pages < 20) {
    const response = await plaidClient().transactionsSync({
      access_token: accessToken,
      ...(cursor ? { cursor } : {}),
    });
    const page = response.data;
    added.push(...page.added);
    modified.push(...page.modified);
    removed.push(...page.removed);
    if (page.next_cursor) cursor = page.next_cursor;

    if (page.has_more) {
      pages += 1;
      continue;
    }

    const status = page.transactions_update_status;
    const settled =
      status === 'HISTORICAL_UPDATE_COMPLETE' ||
      (status === 'INITIAL_UPDATE_COMPLETE' && added.length + modified.length + removed.length > 0);
    if (settled || waits >= 10) break;
    waits += 1;
    await delay(1500);
  }

  return { added, modified, removed, cursor };
}

function toInput(tx: PlaidTransaction): PlaidTransactionInput {
  return {
    transactionId: tx.transaction_id,
    accountId: tx.account_id,
    amount: tx.amount,
    isoCurrencyCode: tx.iso_currency_code,
    date: tx.date,
    name: tx.name,
    merchantName: tx.merchant_name ?? null,
    pending: tx.pending,
  };
}

async function findItem(
  db: Firestore,
  uid: string,
  connectionId: string,
): Promise<(SecretItem & { ref: DocumentReference }) | null> {
  const snap = await db
    .collection(`private/${uid}/plaidItems`)
    .where('connectionId', '==', connectionId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const accessToken = doc.get('accessToken');
  const itemId = doc.get('itemId');
  if (typeof accessToken !== 'string' || typeof itemId !== 'string') return null;
  const cursor = doc.get('cursor');
  return {
    ref: doc.ref,
    accessToken,
    itemId,
    cursor: typeof cursor === 'string' ? cursor : '',
    connectionId,
    accountMap: asAccountMap(doc.get('accountMap')),
  };
}

function asAccountMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') map[key] = entry;
  }
  return map;
}

async function accountLinks(db: Firestore, uid: string, accountMap: Record<string, string>) {
  const snap = await db.collection(`users/${uid}/linkedAccounts`).get();
  const wallets = new Map<string, string | null>();
  for (const doc of snap.docs) {
    const walletId = doc.get('walletId');
    wallets.set(doc.id, typeof walletId === 'string' ? walletId : null);
  }
  const links = new Map<string, { linkedAccountId: string; walletId: string | null }>();
  for (const [plaidAccountId, linkedAccountId] of Object.entries(accountMap)) {
    links.set(plaidAccountId, {
      linkedAccountId,
      walletId: wallets.get(linkedAccountId) ?? null,
    });
  }
  return links;
}

async function existingTransactions(db: Firestore, uid: string) {
  const snap = await db.collection(`users/${uid}/transactions`).get();
  const rows = [];
  for (const doc of snap.docs) {
    const externalId = doc.get('externalId');
    if (typeof externalId !== 'string' || externalId.length === 0) continue;
    const linkedAccountId = doc.get('linkedAccountId');
    rows.push(
      stubTransaction(doc.id, externalId, typeof linkedAccountId === 'string' ? linkedAccountId : null),
    );
  }
  return rows;
}

function stubTransaction(id: string, externalId: string, linkedAccountId: string | null) {
  return {
    id,
    externalId,
    type: 'expense' as const,
    amountCents: 0,
    currency: 'CAD' as const,
    date: '1970-01-01',
    categoryId: 'cat_unknown',
    merchant: '',
    fromWalletId: null,
    toWalletId: null,
    excludedFromBudget: false,
    recurrence: 'none' as const,
    needsReview: true,
    linkedAccountId,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function newTransactionDoc(tx: Transaction) {
  return {
    type: tx.type,
    amountCents: tx.amountCents,
    currency: tx.currency,
    date: tx.date,
    categoryId: tx.categoryId,
    merchant: tx.merchant,
    fromWalletId: tx.fromWalletId,
    toWalletId: tx.toWalletId,
    excludedFromBudget: tx.excludedFromBudget,
    recurrence: tx.recurrence,
    needsReview: tx.needsReview,
    linkedAccountId: tx.linkedAccountId,
    externalId: tx.externalId ?? null,
    splits: [],
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

async function setStatus(
  db: Firestore,
  uid: string,
  connectionId: string,
  status: string,
): Promise<void> {
  await db.doc(`users/${uid}/connections/${connectionId}`).set({ status }, { merge: true });
}

async function commitOps(db: Firestore, ops: Array<(batch: WriteBatch) => void>): Promise<void> {
  for (let index = 0; index < ops.length; index += 400) {
    const batch = db.batch();
    for (const op of ops.slice(index, index + 400)) op(batch);
    await batch.commit();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
