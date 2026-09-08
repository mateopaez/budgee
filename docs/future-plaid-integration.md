# Future Plaid integration

Budgee's MVP has no bank aggregation. This note records what a secure Plaid
integration would require, so the architecture stays ready without carrying any
of the risk today.

## What ships today

- No Plaid packages, keys, secrets or environment variables.
- No link flow that pretends to reach a real institution. The Bank Connections
  screen states plainly that bank sync is coming soon.
- A deterministic Canadian dollar demo dataset plus full manual entry.
- Provider agnostic domain models: `Transaction`, `Wallet`, `LinkedAccount` and
  `ProviderConnection` carry no vendor specific fields, and
  `ProviderConnection.provider` is a union that already allows `'plaid'`.
- A read side port, `FinancialDataProvider` in
  `src/app/core/data/repository.ts`, with no implementation.

## The one hard rule

**Plaid client secrets and access tokens must never be exposed in the Angular
browser app.** The browser is a public client: anything shipped to it, including
environment variables inlined at build time, is readable by anyone using the
app. Only the `link_token` (short lived, single use, scoped to one Link session)
may reach the browser.

## Required server side layer

A serverless function layer, preferably Vercel Functions alongside the existing
Angular SSR deployment, would own four endpoints:

| Endpoint | Purpose | Secrets used |
| --- | --- | --- |
| `POST /api/plaid/link-token` | Create a `link_token` for the signed in user | `PLAID_CLIENT_ID`, `PLAID_SECRET` |
| `POST /api/plaid/exchange` | Exchange the Link `public_token` for an `access_token`, store it server side keyed by uid | `PLAID_CLIENT_ID`, `PLAID_SECRET` |
| `POST /api/plaid/sync` | Call `/transactions/sync` with the stored cursor and write normalised transactions into `users/{uid}` | `PLAID_CLIENT_ID`, `PLAID_SECRET` |
| `POST /api/plaid/disconnect` | Call `/item/remove` and delete the stored item and cursor | `PLAID_CLIENT_ID`, `PLAID_SECRET` |

Every endpoint must:

1. Verify the caller's Firebase ID token and derive the uid from it, never from
   the request body.
2. Read and write only under that uid's own documents.
3. Store `access_token`, `item_id` and the sync `cursor` in a server only
   collection that the client security rules deny outright, for example
   `private/{uid}/plaidItems/{itemId}`, encrypted at rest.
4. Never return the `access_token` in a response.

Plaid webhooks (`SYNC_UPDATES_AVAILABLE`, `ITEM_ERROR`, `PENDING_EXPIRATION`)
should hit a fifth endpoint that verifies the Plaid webhook JWT before acting.

## Client side changes when it lands

1. Implement `PlaidFinancialDataProvider implements FinancialDataProvider` that
   calls the endpoints above with the user's Firebase ID token.
2. Replace the placeholder body of the Bank Connections screen and the connect
   sheet with a real Plaid Link launch, driven by a `link_token` fetched from
   `/api/plaid/link-token`.
3. Map Plaid accounts onto `LinkedAccount` and, where the user chooses, onto a
   `Wallet`. Keep imported transactions flagged `needsReview` until a category
   is confident, which the existing review queue already handles.
4. Set `ProviderConnection.status` from the item state so the Budgee tab's status
   pill reflects reality, including `needs_attention` for re-authentication.

Nothing in the UI layer, the store or the budget mathematics needs to change:
imported transactions are ordinary `Transaction` records.

## Canadian specifics worth planning for

- Plaid coverage in Canada runs largely through institution specific flows; test
  with the Canadian sandbox institutions before shipping.
- Amounts arrive as decimal numbers. Convert to integer cents at the boundary,
  since the rest of Budgee stores money as cents.
- Currency codes must be checked; anything that is not CAD needs an explicit
  decision rather than a silent conversion.
