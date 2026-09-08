# Firestore persistence

Budgee stores every authenticated user's application data in Cloud Firestore
under `users/{uid}`. Firebase Auth handles session persistence; Angular Signals
hold in-memory state only after the signed-in user is known.

## Document layout

```
users/{uid}                                    profile + preferences + flags
users/{uid}/transactions/{transactionId}
users/{uid}/wallets/{walletId}
users/{uid}/categories/{categoryId}
users/{uid}/categoryGroups/{groupId}
users/{uid}/budgets/{budgetId}
users/{uid}/connections/{connectionId}
users/{uid}/linkedAccounts/{accountId}
users/{uid}/recurringPayments/{recurringPaymentId}
```

Recurring payments are currently derived from transaction history in the client.
The `recurringPayments` collection is reserved and owner-scoped in security rules.

## Profile shape (`users/{uid}`)

```ts
{
  displayName: string | null;
  email: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  onboardingCompleted: boolean;
  activeBudgetId: string | null;
  dataMode: 'demo' | 'manual';
  demoSeededAt?: Timestamp | null;
  preferences: UserPreferences;
}
```

## Security rules

`firestore.rules` allows read/write only when `request.auth.uid` matches the
`{uid}` path segment. Deploy with:

```bash
npx firebase deploy --only firestore:rules
```

## Hosting (SPA deep links)

`firebase.json` rewrites all non-file routes to `index.html` so Angular routes
such as `/transactions/:id/edit` work on refresh and direct open. Deploy with:

```bash
npx firebase deploy --only hosting
```

Public output directory: `dist/budgee/browser` (Angular production build).

## Console setup still required

1. Enable **Cloud Firestore** for project `budgee-43d31` (Native mode).
2. Deploy `firestore.rules` (command above).
3. Ensure Auth providers (Google, Email/Password) remain enabled.
4. No composite indexes are required for the current queries (collection reads
   under `users/{uid}/...` without compound `where`/`orderBy` combinations).

## Wallet balances

Wallets store `openingBalanceCents` only. Current balances are always derived
from the transaction ledger via `computeWalletBalances` and are never written
back to Firestore as a second source of truth.

## What is deliberately not done

- No offline sync or conflict resolution.
- No shared / household budgets.
- No Plaid, CSV import, Cloud Functions, or server endpoints.
- No one-time localStorage → Firestore migration (local app data storage was
  removed; users re-onboard against Firestore).
