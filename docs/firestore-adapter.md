# Firestore adapter (pending)

Budgee's MVP persists each signed in user's workspace in browser local storage,
namespaced by Firebase Auth uid
(`budgee:v1:workspace:{uid}` in `LocalWorkspaceRepository`). Authentication is
already live against the existing Firebase project; only the data adapter is
still local.

## Why local first

The application never talks to storage directly. It talks to the ports in
`src/app/core/data/repository.ts`:

- `WorkspaceRepository` - load, save and clear one user's whole workspace
- `TransactionRepository`, `WalletRepository` - narrow ports for a future
  per document adapter
- `FinancialDataProvider` - read side port for a future aggregation provider

Swapping storage means providing a different implementation of
`WorkspaceRepository` (or the narrow ports) at the injector. No component,
computation or template changes.

## Target document layout

All records are scoped by uid. The shape mirrors the local namespacing, so the
migration is mechanical:

```
users/{uid}                                    profile + preferences + activeBudgetId
users/{uid}/transactions/{transactionId}
users/{uid}/wallets/{walletId}
users/{uid}/categories/{categoryId}
users/{uid}/categoryGroups/{groupId}
users/{uid}/budgets/{budgetId}
users/{uid}/recurringPayments/{recurringPaymentId}
```

`firestore.rules` in the repository root already enforces this: a request is
allowed only when `request.auth.uid` matches the `{uid}` segment, and everything
outside a user subtree is denied.

Deploy the rules with:

```bash
npx firebase deploy --only firestore:rules
```

## Migration steps when Firestore is enabled

1. Enable Cloud Firestore in the Firebase console for `budgee-43d31`.
2. Deploy `firestore.rules`.
3. Add `FirestoreWorkspaceRepository implements WorkspaceRepository` that reads
   the documents above with the modular `firebase/firestore` SDK, mapping each
   collection into the existing `Workspace` shape.
4. Provide it in `app.config.ts` in place of `LocalWorkspaceRepository`.
5. On first sign in after the switch, read the local workspace once and write it
   up as a one time migration, then clear the local copy.

## What is deliberately not done yet

- No offline sync or conflict resolution. The store is the single writer.
- No shared or household budgets. `Budget` has no members collection.
- No server side rendering of user data; every screen renders on the client.
