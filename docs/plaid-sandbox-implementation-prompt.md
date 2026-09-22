# Implement Plaid (Sandbox only)

This task is finished. Budgee calls Plaid Production only. Do not follow the
Sandbox steps below, including First Platypus Bank. See
`docs/future-plaid-integration.md`. Sandbox tokens were not migrated.

You are implementing bank linking for Budgee, an Angular 21 personal budgeting app. This task is the Sandbox milestone only. Production / live bank access is a later switch of environment variables plus a webhook, and you must not build that now.

The project owner already has a Plaid **Sandbox** `client_id` and `secret`. They will paste those values into a gitignored env file and into Vercel. Do not ask them to paste either value into the chat. Do not print the values in logs, responses, or commits.

## Outcome

A signed-in user can connect a Plaid Sandbox institution, and Budgee imports that institution's posted transactions into their existing workspace. Re-syncing updates and removes rows in place. Disconnecting revokes the Item. Budget math, categories, and manual entry keep working.

## Hard rules

Follow `AGENTS.md`. In particular: standalone components (do not set `standalone: true`), signals, `input()` / `output()`, `inject()`, `ChangeDetectionStrategy.OnPush`, native control flow (`@if`, `@for`, `@switch`), class and style bindings (no `ngClass` / `ngStyle`), and WCAG AA (labels, focus, contrast, button names, status text that is not colour-only).

**Plaid secrets and access tokens never reach the browser.** The only Plaid value the Angular app may hold is a short-lived `link_token`, and after Link succeeds, a one-time `public_token` which it immediately posts to the server. `PLAID_SECRET`, `access_token`, `item_id`, and the transactions sync cursor stay on the server.

Read `docs/future-plaid-integration.md` and implement that design. Do not invent a second architecture.

## Where secrets live

Plaid does not use a private key for this API. The credentials are two strings.

Create `.env.example` at the repo root with empty values and comments:

```
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
# Firebase Admin service account JSON, one line. Same project as
# src/app/core/firebase/firebase.config.ts (projectId budgee-43d31).
FIREBASE_SERVICE_ACCOUNT_JSON=
```

Add `.env`, `.env.local`, and `.env.*.local` to `.gitignore`. Commit `.env.example` only.

Load `.env` from the server entry only, with `process.loadEnvFile`, when `PLAID_CLIENT_ID` is not already set. Never import that loader from anything under `src/app`. Vercel injects the same variables into the server function at runtime; do not use Angular `fileReplacements` or a `environment.ts` file for them.

`PLAID_ENV` must be `sandbox` for this task. Refuse to call Plaid if it is anything else.

The Firebase web config in `firebase.config.ts` is public and is not an admin credential. Server writes need a service account. If `FIREBASE_SERVICE_ACCOUNT_JSON` is missing, fail the Plaid endpoints with a clear 500 and tell the user, in your final summary, to create an Admin SDK service account in the Firebase console for project `budgee-43d31`, minify the JSON onto one line, and put it in `.env` and in Vercel → Project → Settings → Environment Variables. Do not ask them to paste that JSON into chat.

When you finish, tell the user to put their existing Sandbox client id and secret in `.env` as `PLAID_CLIENT_ID` and `PLAID_SECRET`, and to set the same three Plaid variables plus the service account on the Vercel project. You do not set those values yourself.

## Server

The app is Angular SSR. `src/server.ts` is an Express app, and `createNodeRequestHandler` is what the CLI dev server and the production server both use. Add the Plaid routes on that Express app **before** the static-file middleware and the Angular catch-all.

Put the Plaid and Firebase Admin code in server-only modules (for example `server/plaid/`). `src/app` may call your HTTP endpoints. It must not import the Plaid Node SDK, `firebase-admin`, or the env loader.

Use the official `plaid` Node SDK on the server. Products: `transactions` only. Country codes: `['CA', 'US']` so Sandbox's US test institutions work and a later Canadian Production switch does not need a rewrite. Language: `en`. Client name: `Budgee`.

Every user-facing endpoint:

1. Requires `Authorization: Bearer <Firebase ID token>`.
2. Verifies the token with Firebase Admin and uses that uid. Ignore any uid in the body.
3. Reads and writes only that uid's documents.
4. Never returns `access_token`, `item_id`, or the cursor.

Endpoints:

| Method and path | Behaviour |
| --- | --- |
| `POST /api/plaid/link-token` | `linkTokenCreate` for the verified uid. Return `{ linkToken }`. |
| `POST /api/plaid/exchange` | Body: `{ publicToken }`. `itemPublicTokenExchange`. Fetch institution and accounts. Persist the secret Item, then write provider-agnostic connection and account docs the client is allowed to read. Return the public connection and accounts only. |
| `POST /api/plaid/sync` | Body: `{ connectionId }`. Run `/transactions/sync` from the stored cursor until `has_more` is false. Upsert added and modified, delete removed. Update `lastSyncAt`. Return counts `{ added, modified, removed }`. |
| `POST /api/plaid/disconnect` | Body: `{ connectionId }`. `itemRemove`, delete the secret Item, set the public connection to `disconnected`. Keep already imported transactions. |

Store the secret Item in `private/{uid}/plaidItems/{itemId}`:

- `accessToken`
- `itemId`
- `cursor` (string, empty before the first sync)
- `connectionId` (Budgee's id)
- `accountMap`: Plaid `account_id` → Budgee linked-account id

`firestore.rules` already denies every path outside `users/{uid}`. Keep it that way. Do not store the access token, item id, cursor, or Plaid account ids under `users/{uid}`. The owner-wide match on `users/{uid}/{path=**}` would make those fields readable by the browser.

Public documents, which the existing client adapters already load, stay where they are:

- `users/{uid}/connections/{connectionId}` as `ProviderConnection` with `provider: 'plaid'`
- `users/{uid}/linkedAccounts/{linkedAccountId}` as `LinkedAccount`

The Admin SDK writes those public docs too, so the client never handles the exchange response as the source of truth. After exchange or sync, the existing Firestore listeners in `FirestoreWorkspaceRepository` should pick the new docs up. If they do not, reload the workspace through the existing repository. Do not add a second client store.

Map Plaid account types onto `LinkedAccountType`: depository checking → `checking`, depository savings → `savings`, credit → `credit`, loan → `loan`. Anything else: skip the account and mention it in the function result, do not invent a new union member. `walletId` stays `null` until the user maps one. `mask` is Plaid's mask only, never a full account number. `balanceCents` is the current balance converted to integer cents.

## Transaction mapping

Budgee stores money as positive integer cents. `type` carries the direction. Plaid's `amount` is a decimal, positive when money leaves the account and negative when money enters.

Convert with `Math.round(Math.abs(amount) * 100)`.

- Plaid amount `> 0` → `type: 'expense'`, `fromWalletId` from the linked account's `walletId` (or `null`), `toWalletId: null`.
- Plaid amount `< 0` → `type: 'income'`, `toWalletId` from that wallet (or `null`), `fromWalletId: null`.
- Plaid amount `0` → skip.
- Skip `pending: true`. Posted transactions are the source of truth, which avoids a duplicate when a pending row posts.
- `date` is Plaid's `date` (`yyyy-mm-dd`), not `datetime`.
- `merchant` is `merchant_name`, then `name`.
- `categoryId` is `cat_unknown` from `src/app/core/data/taxonomy.ts`.
- `needsReview: true`.
- `excludedFromBudget: false` only when `iso_currency_code === 'CAD'`.
- `recurrence: 'none'`. No splits.
- `linkedAccountId` is the Budgee id from `accountMap`.

Sandbox institutions such as First Platypus Bank return **USD**. Do not store those cents as CAD and do not convert currencies. Extend `CurrencyCode` in `src/app/core/models/money.model.ts` from `'CAD'` to `'CAD' | 'USD'`. Persist `iso_currency_code` when it is `CAD` or `USD`. Skip any other currency and count it as skipped.

Budget totals must keep treating the workspace as Canadian dollars. In `src/app/core/util/budget-calc.util.ts`, ignore transactions whose `currency` is not `'CAD'` the same way excluded transactions are ignored. Display the currency code on imported non-CAD rows so a Sandbox USD purchase is obviously not a Canadian dollar. `MoneyFormat` already accepts a currency override; use it.

Idempotency: add an optional `externalId: string | null` on `Transaction` (Plaid's `transaction_id`). On sync, update the existing transaction with that `externalId` instead of inserting another. Apply `modified` the same way. `removed` deletes that transaction. Thread `externalId` through `firestore-mappers.ts`. Absence means a manual transaction.

Do not let a re-sync clobber a category, note, split, or `excludedFromBudget` flag the user has already edited. On `modified`, update amount, type, date, merchant, currency, and wallet links. Leave `categoryId`, `needsReview`, `note`, `splits`, `recurrence`, and `excludedFromBudget` alone if the row already exists. A first insert uses the defaults above. CAD rows start with `excludedFromBudget: false`. Non-CAD rows start with `excludedFromBudget: true` and stay that way unless the user edits them. Never flip a user-excluded CAD row back to included.

## Client

Add `getIdToken(): Promise<string | null>` to `AuthService`, using the current Firebase user. The Plaid client sends it as `Authorization: Bearer`.

Replace the placeholder copy in:

- `src/app/features/budgee/connect-bank-sheet.ts`
- `src/app/features/tools/bank-connections-page.ts`

The sheet launches Plaid Link. Load `https://cdn.plaid.com/link/v2/stable/link-initialize.js` once. Do not add `react-plaid-link`. Flow:

1. Fetch a link token.
2. Open Link with `Plaid.create({ token, onSuccess, onExit })`.
3. `onSuccess` receives `public_token`. Post it to `/api/plaid/exchange`, then call `/api/plaid/sync` for the new connection.
4. Close the sheet. The workspace listeners should show the institution and its transactions.
5. `onExit` with an error shows a short message and leaves existing data alone.

Bank Connections lists real `provider: 'plaid'` connections separately from demo connections. Demo connections keep the current "Local demo data, not a real institution" subtitle. Plaid rows show institution name, status, and last sync time. Each Plaid row has **Sync** and **Disconnect** buttons with accessible names. Status uses text (`connected`, `syncing`, `needs_attention`, `disconnected`), not colour alone.

Show a busy state and an error message on the sheet and the page. Failures from Plaid or the server must not wipe the workspace.

`FinancialDataProvider` in `src/app/core/data/repository.ts` can be the client facade that calls these endpoints. The server still derives uid from the ID token, so the facade must not send uid.

Wire the Budgee tab status from `ProviderConnection.status`, which the model already supports. `needs_attention` is reserved for a later Production webhook; Sandbox sync failures can set it when `/transactions/sync` returns an Item login error.

## Tests

Add unit tests for the pure mapper: sign to expense/income, decimal to cents, pending skipped, USD marked and excluded from budget math, CAD included, modified rows keep a user-chosen category, removed ids are detected. No network, no Plaid SDK, no secrets.

Run `npm test`. Fix failures you cause. Do not weaken existing budget tests.

## Sandbox check

After the user has filled in `.env`, verify in the browser with `npm start`:

1. Sign in.
2. Open the connect sheet and launch Link.
3. Institution: First Platypus Bank (`ins_109508`). Username: `user_transactions_dynamic`. Password: any non-blank password. MFA when asked: `1234`.
4. Confirm accounts appear on Bank Connections and posted transactions appear in the app, USD ones excluded from CAD budget totals, `needsReview` true, category Uncategorized (`cat_unknown`).
5. Sync again and confirm counts do not duplicate rows.
6. Disconnect and confirm the secret Item is gone and old transactions remain.

If you cannot complete Link because credentials are empty, stop and tell the user which variables are missing. Do not substitute a fake success.

## Leave for later

Do not implement Production. Do not add a webhook receiver or a Vercel Cron in this task. Do not request Production access. A later change sets `PLAID_ENV=production`, uses the Production secret, and adds a webhook endpoint that verifies Plaid's webhook JWT before syncing.

Update `docs/future-plaid-integration.md` only to say Sandbox link, exchange, sync, and disconnect now exist, and that Production and webhooks are still outstanding. Update the Bank Connections sentence in `README.md` so it no longer says there is no bank aggregation.
