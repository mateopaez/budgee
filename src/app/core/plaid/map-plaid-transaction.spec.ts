import { CATEGORY_IDS } from '../data/taxonomy';
import { makeBudget, makeTransaction, makeWallet } from '../testing/factories';
import { isBudgetIncluded } from '../util/budget-calc.util';
import {
  applyPlaidSync,
  mapPlaidAccountKind,
  syncCursor,
  walletIdsForImport,
  type PlaidAccountLink,
  type PlaidTransactionInput,
} from './map-plaid-transaction';

const accounts = new Map<string, PlaidAccountLink>([
  ['acc_chequing', { linkedAccountId: 'acct_1', walletId: 'wal_spending' }],
]);

function row(patch: Partial<PlaidTransactionInput> = {}): PlaidTransactionInput {
  return {
    transactionId: 'plaid_1',
    accountId: 'acc_chequing',
    amount: 12.34,
    isoCurrencyCode: 'CAD',
    date: '2026-09-05',
    name: 'MAPLE GROCERS',
    merchantName: 'Maple Grocers',
    pending: false,
    ...patch,
  };
}

function apply(
  patch: Partial<Parameters<typeof applyPlaidSync>[0]> = {},
  ids: string[] = ['tx_new'],
) {
  let index = 0;
  return applyPlaidSync({
    added: [],
    modified: [],
    removedIds: [],
    existing: [],
    accountsByPlaidId: accounts,
    now: '2026-09-21T12:00:00.000Z',
    createId: () => ids[index++] ?? `tx_${index}`,
    ...patch,
  });
}

describe('mapPlaidAccountKind', () => {
  it('maps the four account kinds Budgee stores', () => {
    expect(mapPlaidAccountKind('depository', 'checking')).toBe('checking');
    expect(mapPlaidAccountKind('depository', 'savings')).toBe('savings');
    expect(mapPlaidAccountKind('credit', 'credit card')).toBe('credit');
    expect(mapPlaidAccountKind('loan', 'student')).toBe('loan');
  });

  it('skips kinds outside the union', () => {
    expect(mapPlaidAccountKind('investment', 'brokerage')).toBeNull();
    expect(mapPlaidAccountKind('depository', 'money market')).toBeNull();
  });
});

describe('applyPlaidSync', () => {
  const wallets = new Map([['wal_spending', makeWallet({ id: 'wal_spending' })]]);
  const budget = makeBudget();

  it('turns a positive decimal into an expense in cents', () => {
    const result = apply({ added: [row({ amount: 12.34 })] });
    const tx = result.upserts[0]?.transaction;
    expect(result.added).toBe(1);
    expect(tx?.type).toBe('expense');
    expect(tx?.amountCents).toBe(1234);
    expect(tx?.fromWalletId).toBe('wal_spending');
    expect(tx?.toWalletId).toBeNull();
    expect(tx?.categoryId).toBe(CATEGORY_IDS.unknown);
    expect(tx?.needsReview).toBe(true);
    expect(tx?.currency).toBe('CAD');
    expect(tx?.excludedFromBudget).toBe(false);
    expect(tx && isBudgetIncluded(tx, budget, wallets)).toBe(true);
  });

  it('turns a negative amount into income', () => {
    const result = apply({ added: [row({ amount: -50.2, merchantName: null, name: 'PAYROLL' })] });
    const tx = result.upserts[0]?.transaction;
    expect(tx?.type).toBe('income');
    expect(tx?.amountCents).toBe(5020);
    expect(tx?.merchant).toBe('PAYROLL');
    expect(tx?.toWalletId).toBe('wal_spending');
    expect(tx?.fromWalletId).toBeNull();
  });

  it('skips pending, zero, unknown currency and unmapped accounts', () => {
    const result = apply({
      added: [
        row({ transactionId: 'p1', pending: true }),
        row({ transactionId: 'p2', amount: 0 }),
        row({ transactionId: 'p3', isoCurrencyCode: 'EUR' }),
        row({ transactionId: 'p4', accountId: 'acc_missing' }),
      ],
    });
    expect(result.upserts).toHaveLength(0);
    expect(result.skipped).toBe(4);
    expect(result.added).toBe(0);
  });

  it('marks USD rows and keeps them out of CAD budget totals', () => {
    const result = apply({ added: [row({ isoCurrencyCode: 'USD', amount: 8.1 })] });
    const tx = result.upserts[0]?.transaction;
    expect(tx?.currency).toBe('USD');
    expect(tx?.excludedFromBudget).toBe(true);
    expect(tx?.amountCents).toBe(810);
    expect(tx && isBudgetIncluded(tx, budget, wallets)).toBe(false);
  });

  it('keeps a chosen category when a row is modified', () => {
    const existing = makeTransaction({
      id: 'tx_saved',
      externalId: 'plaid_1',
      categoryId: 'cat_groceries',
      needsReview: false,
      note: 'weekly shop',
      excludedFromBudget: true,
      recurrence: 'monthly',
      splits: [
        { id: 'spl_1', categoryId: 'cat_groceries', amountCents: 400, settled: false },
        { id: 'spl_2', categoryId: 'cat_household', amountCents: 600, settled: true },
      ],
    });
    const result = apply({
      modified: [row({ amount: -20, isoCurrencyCode: 'USD', date: '2026-09-08', merchantName: 'Refund' })],
      existing: [existing],
    });
    const tx = result.upserts[0]?.transaction;
    expect(result.modified).toBe(1);
    expect(result.added).toBe(0);
    expect(result.upserts[0]?.isNew).toBe(false);
    expect(tx?.id).toBe('tx_saved');
    expect(tx?.categoryId).toBe('cat_groceries');
    expect(tx?.needsReview).toBe(false);
    expect(tx?.note).toBe('weekly shop');
    expect(tx?.excludedFromBudget).toBe(true);
    expect(tx?.recurrence).toBe('monthly');
    expect(tx?.splits).toEqual(existing.splits);
    expect(tx?.type).toBe('income');
    expect(tx?.amountCents).toBe(2000);
    expect(tx?.currency).toBe('USD');
    expect(tx?.date).toBe('2026-09-08');
    expect(tx?.merchant).toBe('Refund');
    expect(tx && isBudgetIncluded(tx, budget, wallets)).toBe(false);
  });

  it('does not insert a second row when an added id already exists', () => {
    const existing = makeTransaction({ id: 'tx_saved', externalId: 'plaid_1' });
    const result = apply({ added: [row({ amount: 3 })], existing: [existing] });
    expect(result.added).toBe(0);
    expect(result.modified).toBe(1);
    expect(result.upserts).toHaveLength(1);
    expect(result.upserts[0]?.transaction.id).toBe('tx_saved');
    expect(result.upserts[0]?.transaction.amountCents).toBe(300);
  });

  it('puts expenses on the source wallet and income on the destination', () => {
    expect(walletIdsForImport('expense', 'wal_spending')).toEqual({
      fromWalletId: 'wal_spending',
      toWalletId: null,
    });
    expect(walletIdsForImport('income', 'wal_spending')).toEqual({
      fromWalletId: null,
      toWalletId: 'wal_spending',
    });
    expect(walletIdsForImport('expense', null)).toEqual({ fromWalletId: null, toWalletId: null });
  });

  it('restarts the cursor when imported rows were deleted', () => {
    expect(syncCursor('cursor_after_history', 0)).toBe('');
    expect(syncCursor('cursor_after_history', 12)).toBe('cursor_after_history');
    expect(syncCursor('', 0)).toBe('');
  });

  it('detects removed provider ids', () => {
    const existing = makeTransaction({ id: 'tx_saved', externalId: 'plaid_1' });
    const result = apply({
      removedIds: ['plaid_1', 'plaid_missing'],
      existing: [existing],
    });
    expect(result.deleteIds).toEqual(['tx_saved']);
    expect(result.removed).toBe(1);
    expect(result.upserts).toHaveLength(0);
  });
});
