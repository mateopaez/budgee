# Plaid integration

Production link, public-token exchange, transaction sync, disconnect, and
verified webhooks are implemented. Locally the routes live on the Express app
in `src/server.ts`. Vercel serves the Angular client as static files and does
not run that Express app, so hosted calls go through the CommonJS function
`api/plaid/[action].js`. Both paths call Plaid Production only. `PLAID_ENV`
must be the exact string `production`.

Access tokens created in Sandbox were not migrated. Disconnect removes those
connections locally, because Production cannot revoke a Sandbox token.
Imported transactions are kept.

## What ships

- Production link, exchange, sync, disconnect, and `POST /api/plaid/webhook`.
- Secrets stay in server environment variables (`PLAID_CLIENT_ID`,
  `PLAID_SECRET`, `PLAID_ENV=production`, `FIREBASE_SERVICE_ACCOUNT_JSON`).
  Optional `PLAID_WEBHOOK_URL` overrides the webhook URL sent on link-token
  create. The default is `https://budgee0.vercel.app/api/plaid/webhook`.
  Register that same URL in the Plaid dashboard for Production.
  See `.env.example`. Nothing under `src/app` imports these variables.
- Access tokens, item ids, and sync cursors are stored in
  `private/{uid}/plaidItems/{itemId}`, which the client security rules deny.
- Webhooks are verified (ES256 JWT, then SHA-256 of the raw body) before any
  write. There is no Firebase user on that request.
  `TRANSACTIONS` / `SYNC_UPDATES_AVAILABLE` runs the same sync as the button.
  `ITEM` / `ERROR` (including `ITEM_LOGIN_REQUIRED`), `PENDING_EXPIRATION`, and
  `PENDING_DISCONNECT` set the connection to `needs_attention`.
  `USER_PERMISSION_REVOKED` disconnects the Item locally and keeps transactions.
  Unknown items and unknown webhook types respond 200 and do nothing.
- A deterministic Canadian dollar demo dataset, plus full manual entry.
- Provider-agnostic domain models. `ProviderConnection.provider` includes `'plaid'`.

## The one hard rule

**Plaid client secrets and access tokens must never be exposed in the Angular
browser app.** The browser is a public client: anything shipped to it, including
environment variables inlined at build time, is readable by anyone using the
app. The browser may hold a short-lived `link_token` and, after Link, a one-time
`public_token`. It must not see `PLAID_SECRET`, `access_token`, `item_id`, or
the sync cursor.

## Endpoints

| Endpoint | Purpose | Auth |
| --- | --- | --- |
| `POST /api/plaid/link-token` | Create a `link_token` for the signed-in user. Subscribes the Item to the webhook URL. | Firebase ID token |
| `POST /api/plaid/exchange` | Exchange the Link `public_token`, store the access token, write the public connection and accounts | Firebase ID token |
| `POST /api/plaid/sync` | Call `/transactions/sync` with the stored cursor and write normalised transactions | Firebase ID token |
| `POST /api/plaid/disconnect` | Call `/item/remove` for a Production Item. Sandbox tokens are dropped locally. Delete the secret Item, the connection, and its linked accounts. Keep imported transactions. | Firebase ID token |
| `POST /api/plaid/webhook` | Verify Plaid's webhook JWT, then sync or update status for that Item | Plaid JWT only |

Every user-facing endpoint verifies the Firebase ID token and derives the uid
from it. The webhook does not. None of them return the access token.

Products are `transactions` only. Country codes are `CA` and `US`. Language is
`en`. Client name is `Budgee`.

## Money

Amounts are integer cents: `Math.round(Math.abs(amount) * 100)`. A positive
Plaid amount is an expense and a negative amount is income. Pending
transactions are skipped. Currencies other than `CAD` and `USD` are skipped.
USD rows stay out of the Canadian dollar budget. `externalId` is the
idempotency key. A later sync does not overwrite a category, note, split, or
budget-exclusion flag the user already set.

Account kinds are checking, savings, credit, and loan. Anything else is
skipped. `walletId` stays empty until the user maps one on Bank Connections.

## Hosting constraints

`api/plaid/[action].js` stays CommonJS. `server/plaid` compiles as CommonJS.
`firebase-admin` and `plaid` load through `require()` in
`server/plaid/native-modules.cjs`. Webhook signature checks call `import('jose')`
from `server/plaid/load-jose.cjs`, because `jose` 6 is ESM-only and TypeScript's
CommonJS emit would rewrite an `import()` in a `.ts` file into `require()`.
Do not put `includeFiles` in `vercel.json`.
`scripts/patch-jwks-rsa.mjs` must keep running after install so Firebase token
checks can load `jose`.
