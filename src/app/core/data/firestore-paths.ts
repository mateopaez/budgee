/** Stable Firestore paths for a signed-in user's documents. */

export function userDocPath(uid: string): string {
  return `users/${uid}`;
}

export function userCollectionPath(
  uid: string,
  collection:
    | 'transactions'
    | 'wallets'
    | 'categories'
    | 'categoryGroups'
    | 'budgets'
    | 'recurringPayments'
    | 'connections'
    | 'linkedAccounts',
): string {
  return `users/${uid}/${collection}`;
}

export function userDocInCollection(
  uid: string,
  collection:
    | 'transactions'
    | 'wallets'
    | 'categories'
    | 'categoryGroups'
    | 'budgets'
    | 'recurringPayments'
    | 'connections'
    | 'linkedAccounts',
  documentId: string,
): string {
  return `${userCollectionPath(uid, collection)}/${documentId}`;
}
