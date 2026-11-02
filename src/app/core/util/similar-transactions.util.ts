import { CATEGORY_IDS } from '../data/taxonomy';
import type { Transaction } from '../models/transaction.model';

const PROVINCE_CODES = new Set([
  'ab',
  'bc',
  'mb',
  'nb',
  'nl',
  'ns',
  'nt',
  'nu',
  'on',
  'pe',
  'qc',
  'sk',
  'yt',
]);

const E_TRANSFER =
  /\b(interac|e-?transfers?|etransfers?|e-?tfr|send|sent|received|request|autodeposit)\b/g;

/** Shortest merchant key that may match by prefix, so "a" can't match everything. */
const MIN_PREFIX_LENGTH = 4;

/**
 * Bank names carry store numbers and locations, such as "NO FRILLS #3512 TORONTO ON".
 * This lowercases the name and drops those parts, leaving "no frills toronto".
 */
export function merchantKey(merchant: string): string {
  const words = merchant
    .toLowerCase()
    .replace(/#\s*\d+/g, ' ')
    .replace(/[^a-z0-9&'-]+/g, ' ')
    .split(' ')
    .filter((word) => word && !/^\d{3,}$/.test(word) && !/^-+$/.test(word));
  while (words.length > 1 && PROVINCE_CODES.has(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

export function isETransfer(merchant: string): boolean {
  return /\b(interac|e-?transfer|etransfer)\b/i.test(merchant);
}

/** True when one key is the other, or starts with it as whole words. */
function keysMatch(a: string, b: string): boolean {
  if (a === b) return a.length > 0;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_PREFIX_LENGTH && longer.startsWith(`${shorter} `);
}

function isSimilar(source: Transaction, other: Transaction): boolean {
  if (!isETransfer(source.merchant)) {
    return keysMatch(merchantKey(source.merchant), merchantKey(other.merchant));
  }
  if (!isETransfer(other.merchant)) return false;
  // E-transfers go to many people, so match on the person's name when the bank
  // includes one, and on the exact amount when it doesn't.
  const person = (merchant: string) =>
    merchantKey(merchant).replace(E_TRANSFER, ' ').trim().replace(/\s+/g, ' ');
  const sourcePerson = person(source.merchant);
  if (sourcePerson) return sourcePerson === person(other.merchant);
  return !person(other.merchant) && other.amountCents === source.amountCents;
}

/**
 * Other transactions from the same merchant that still need a category, which
 * can take the category just chosen for `source`. Transactions already given a
 * category by hand, and split ones, are left alone.
 */
export function findSimilarUncategorized(
  source: Transaction,
  transactions: readonly Transaction[],
): Transaction[] {
  if (!source.merchant.trim() || (source.splits?.length ?? 0) >= 2) return [];
  if (source.categoryId === CATEGORY_IDS.unknown) return [];
  return transactions.filter(
    (other) =>
      other.id !== source.id &&
      other.type === source.type &&
      (other.splits?.length ?? 0) < 2 &&
      (other.needsReview || other.categoryId === CATEGORY_IDS.unknown) &&
      isSimilar(source, other),
  );
}
