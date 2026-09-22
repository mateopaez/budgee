# Switch Budgee from Plaid Sandbox to Production

Sandbox link, exchange, sync, disconnect, wallet mapping, and the Vercel function already work in production hosting at `https://budgee0.vercel.app`. This task replaces Sandbox with live Plaid and adds webhooks. Do not rebuild the Sandbox flow.

The owner has, or will create, a Plaid **Production** secret. They put it in `.env` and in Vercel themselves. Do not ask them to paste `PLAID_SECRET`, `PLAID_CLIENT_ID`, or `FIREBASE_SERVICE_ACCOUNT_JSON` into chat. Do not print those values, access tokens, item ids, cursors, or webhook JWTs in logs, responses, or commits.

## Outcome

A signed-in user connects a real bank through Plaid Link. Posted transactions import into their workspace. Plaid webhooks refresh that Item without a button press. Sandbox is no longer a supported mode: the server calls Plaid Production only, and the UI no longer says Sandbox.

## Hard rules

Follow `AGENTS.md`: standalone components (do not set `standalone: true`), signals, `input()` / `output()`, `inject()`, `ChangeDetectionStrategy.OnPush`, native control flow, class and style bindings, WCAG AA.

**Secrets stay on the server.** The browser may hold a short-lived `link_token` and, after Link, a one-time `public_token`. It must not see `PLAID_SECRET`, `access_token`, `item_id`, or the sync cursor.

Read `docs/future-plaid-integration.md`. Extend the current server; do not add a second architecture.

## Do not undo the Vercel function

Production hosting does not run `src/server.ts`. `POST /api/plaid/:action` is the CommonJS file `api/plaid/[action].js`. Local `ng serve` still uses Express in `src/server.ts`. Both must keep working.

These constraints are load-bearing. Breaking them brings back `FUNCTION_INVOCATION_FAILED`:

- `api/plaid/[action].js` stays CommonJS (`module.exports = async function`). Do not replace it with a TypeScript file that emits `export`.
- `server/plaid/tsconfig.json` stays `"module": "commonjs"`. Vercel compiles the `server/plaid` TypeScript with that config.
- `firebase-admin` and `plaid` load through `require()` in `server/plaid/native-modules.cjs`. Do not `import` those packages, and do not use `import.meta` anywhere in the function graph. A local binding named `require` breaks Node's own `require`.
- Do not put `includeFiles` back in `vercel.json`. Vercel rejects an array, and rejects a string longer than 256 characters. The file tracer already follows the literal `require()` calls. `vercel.json` only sets `maxDuration` 60 for `api/plaid/[action].js`.
- `package.json` `postinstall` runs `scripts/patch-jwks-rsa.mjs`. `jwks-rsa` 4 calls `require('jose')`, and `jose` 6 is ESM-only. Vercel disables `require()` of ES modules, so that line crashes token verification. The patch switches those calls to `import('jose')`. Keep the patch, and keep it idempotent. If you upgrade `jwks-rsa` or `jose`, re-check `node -e "require('firebase-admin/auth')"` still loads.
- `engines.node` stays `22.x`. `firebase-admin` and `plaid` stay external in `angular.json` `externalDependencies`.
- Never log a Plaid request or a Firebase credential object. Log error names and Plaid `error_code` only.

`PLAID_ENV` on Vercel and in `.env` must be the exact string `production`. Remove the check that refuses anything except `sandbox`. Refuse any other value, including `sandbox`, with a 500 whose message names the required value and does not echo the secret. `plaidClient()` must use `PlaidEnvironments['production']`. One client per process; do not cache a Sandbox client across a config change in tests by leaking module state into the app.

Update `.env.example` so `PLAID_ENV=production`. When you finish, tell the owner to set `PLAID_ENV=production` and the **Production** secret (not the Sandbox secret) as `PLAID_SECRET` in `.env` and in Vercel → Project → Settings → Environment Variables, then redeploy. You do not set those values.

## Existing Sandbox Items

Access tokens created against Sandbox do not work on Production. Do not migrate them and do not delete the owner's imported transactions. On the next sync or webhook, if Plaid rejects the token, set that connection's `status` to `needs_attention` and return a clear message that the bank must be connected again. Disconnect still revokes the Item when Plaid accepts `itemRemove`; if Plaid says the Item is already invalid, still mark the local connection `disconnected` and delete the secret doc.

## Keep the current mapping

Do not redesign money, categories, or wallets.

- Money is integer cents. Plaid decimal `amount` becomes `Math.round(Math.abs(amount) * 100)`. Amount `> 0` is expense, `< 0` is income.
- Skip pending transactions.
- Skip currencies other than `CAD` and `USD`. Do not convert. USD rows stay `excludedFromBudget: true`. CAD rows are included. `isBudgetIncluded` is false when currency is not `CAD`.
- `externalId` is the idempotency key. New rows `set()`. Existing rows `update()` amount, type, date, merchant, currency, and wallet links only. Do not clobber `categoryId`, `needsReview`, note, splits, recurrence, or `excludedFromBudget` on modify.
- New imports: `categoryId` `cat_unknown`, `needsReview` true.
- Account kinds: depository+checking → checking, depository+savings → savings, credit → credit, loan → loan. Anything else is skipped. `walletId` stays null until the user maps one on Bank Connections. Later syncs read `walletId` from the linked account.
- Page `/transactions/sync` until `has_more` is false, max 20 pages. Do not save the cursor until writes succeed. `syncCursor` returns `''` when that connection's imported rows are gone, so a reset re-downloads history.
- Reset (`seed` force) keeps Plaid connection docs and their linked accounts. It still deletes transactions. Secret docs under `private/` are not writable by the client.
- Products: `transactions` only. Country codes: `CA` and `US`. Language `en`. Client name `Budgee`.

## Webhooks

Add `POST /api/plaid/webhook`. Plaid calls it with no Firebase user. Do not require `Authorization` on this action. Every other action still verifies the Firebase ID token and ignores any uid in the body.

Verify the webhook before doing anything else, using [Plaid's webhook verification](https://plaid.com/docs/api/webhooks/webhook-verification/):

1. Read the raw body bytes first. The SHA-256 check is over those exact bytes, not a re-serialized object.
2. Read the `Plaid-Verification` JWT. Decode the header, take `kid`, and fetch the JWK with `/webhook_verification_key/get`.
3. Verify the JWT (ES256) with `jose` via `import('jose')`, not `require('jose')`. Reject a bad signature, a token older than 5 minutes, and a body hash that does not match `request_body_sha256`.
4. Only then parse JSON and handle the event.

Handle:

| Webhook | Action |
| --- | --- |
| `TRANSACTIONS` / `SYNC_UPDATES_AVAILABLE` | Sync that Item from its stored cursor. Same write rules as `POST /api/plaid/sync`. |
| `ITEM` / `ERROR`, including `ITEM_LOGIN_REQUIRED` | Set the public connection to `needs_attention`. Do not delete transactions. |
| `ITEM` / `PENDING_EXPIRATION` and `PENDING_DISCONNECT` | Set `needs_attention`. |
| `ITEM` / `USER_PERMISSION_REVOKED` | Same local result as disconnect: delete the secret Item, set the connection to `disconnected`, keep transactions. |

Look up the Item with the Admin SDK, which bypasses client rules. Docs live at `private/{uid}/plaidItems/{itemId}` and already store `itemId`. A collection group query on `plaidItems` where `itemId` equals the webhook value is the lookup. If nothing matches, respond 200 and do nothing. Unknown webhook types respond 200. Never return the access token. Respond quickly; do the sync in the same invocation only if it finishes inside the 60 second limit. On failure, log the error name and Plaid `error_code` only.

Pass the webhook URL on `linkTokenCreate` so new Items subscribe: `https://budgee0.vercel.app/api/plaid/webhook`. Put that URL in server config (constant or `PLAID_WEBHOOK_URL`), not in an Angular environment file. Tell the owner to register the same URL in the Plaid dashboard for Production. Do not add a Vercel Cron.

Wire the new action through both entry points: the CommonJS Vercel handler and `registerPlaidRoutes` in `src/server.ts`. Local Express will not receive Plaid's webhooks; that is fine. Production must.

## UI copy

Remove Sandbox wording from the connect sheet, Bank Connections, onboarding, and settings. Say that connecting a bank uses Plaid, that Budgee never sees the bank password, and that a bank which needs attention has to be connected again. Status text stays `connected`, `syncing`, `needs_attention`, `disconnected`, not colour alone.

`needs_attention` from a webhook or a sync `ITEM_LOGIN_REQUIRED` should show on Bank Connections. Sync and Disconnect stay. Wallet mapping stays.

## Docs

Update `docs/future-plaid-integration.md` and the Plaid sentences in `README.md` so they describe Production link, exchange, sync, disconnect, and verified webhooks. Delete the "Sandbox only" instructions that would send the next reader to First Platypus Bank. Leave a short note that Sandbox tokens were not migrated.

## Tests

Extend the mapper tests only if you change mapping. Add tests for the pure webhook checks you can run without network: reject a missing JWT, reject a body hash mismatch, ignore an unknown item id without throwing, map `ITEM_LOGIN_REQUIRED` to `needs_attention`. Do not call live Plaid from tests. Do not put secrets in fixtures.

Run `npm test`. Fix failures you cause.

## Done when

- `PLAID_ENV=production` is required, and the Plaid client uses the Production base path.
- Sandbox copy is gone from the UI.
- `POST /api/plaid/webhook` rejects a bad JWT and, given a verified `SYNC_UPDATES_AVAILABLE`, runs the existing sync for that Item.
- `node -e "require('firebase-admin/auth')"` still loads after install.
- The Vercel route is still the CommonJS file, with no `includeFiles` and no `import.meta` in the server function.

You cannot complete a live bank Link yourself unless the owner has already set the Production secret. If the variables are still Sandbox or missing, stop and tell them exactly which names to set. Do not fake a successful Production connection.
