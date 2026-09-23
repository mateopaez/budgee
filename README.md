# Budgee

Budgee is a mobile-first personal budgeting web app for Canadian dollars. It is
built with Angular 21, standalone components, Angular Signals, and Tailwind CSS.
Screens are designed for iPhone-sized use and home-screen install, and they
degrade to a centred phone-shaped column on larger displays.

Sign in with email and password. Data for each account lives in that user's
own Cloud Firestore workspace. Banks connect through Plaid Production; the
Angular app never sees the Plaid secret or an access token.

## Requirements

- Node.js 22
- npm 10.9 or newer

## Getting started

```bash
npm install
cp .env.example .env
npm start
```

Then open `http://localhost:4200/`.

The dev server is the Angular SSR app, so `/api/plaid/*` is available locally
once `.env` is filled in. Bank linking is optional: you can add transactions
by hand without Plaid credentials.

## Environment

Copy `.env.example` to `.env`. These values stay on the server. Do not commit
`.env`.

| Variable | Purpose |
| --- | --- |
| `PLAID_CLIENT_ID` | Plaid client id |
| `PLAID_SECRET` | Plaid secret. Production only. |
| `PLAID_ENV` | Must be `production`. Sandbox is refused. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account used by the Plaid server to write the signed-in user's workspace |
| `PLAID_WEBHOOK_URL` | Optional https webhook URL. Defaults to `https://budgee0.vercel.app/api/plaid/webhook` |

Firebase web config in `src/app/core/firebase/firebase.config.ts` is the public
client config for project `budgee-43d31`. It is not a secret.

## Firebase

Enable **Email/Password** under **Authentication → Sign-in method**. Add every
domain you serve from under **Authentication → Settings → Authorized domains**
(`localhost` is authorised by default).

Firestore security rules live in `firestore.rules`. Every record is scoped to
`users/{uid}`. Deploy them with:

```bash
npx firebase deploy --only firestore:rules
```

Collections under that user document:

`transactions`, `wallets`, `categories`, `categoryGroups`, `budgets`,
`recurringPayments`, `connections`, `linkedAccounts`.

Plaid access tokens are written by the server with the Firebase Admin SDK.
The browser only receives connection metadata.

## Plaid

The browser asks for a short-lived link token, then posts the one-time public
token to the server. Endpoints, all `POST`:

- `/api/plaid/link-token`
- `/api/plaid/exchange`
- `/api/plaid/sync`
- `/api/plaid/disconnect`
- `/api/plaid/webhook`

The webhook verifies the Plaid JWT before syncing. Locally these routes are
registered by `server/plaid/routes.ts` on the Express SSR server. On Vercel the
same handlers run from `api/plaid/[action].js`.

A bank that was linked in Sandbox has to be connected again. Imported
transactions stay.

## Scripts

```bash
npm start                 # dev server on http://localhost:4200
npm run build             # production build
npm run serve:ssr:budgee  # serve the production build (port 4000, or PORT)
npm test                  # Vitest unit tests
```

## App

After sign-up, onboarding writes either a seeded demo workspace or an empty
one with default categories and two wallets. Either choice is stored only on
that account.

The tab bar is Budgee, Overview, Budget, Save, and Tools. Save can be hidden
from Settings.

- **Budgee** is the home feed: connection status, a greeting, and transactions grouped by day. Connect a bank or add a transaction from here.
- **Overview** has three views of the active budget period: summary, spending, and a list. It also opens the weekly summary.
- **Budget** plans categories for a monthly, weekly, biweekly, semi-monthly, or yearly period, then shows remaining amounts and insights (daily budget, breakdown, projection).
- **Save** lists recurring bills detected from transactions. It does not tell the user a bill is unnecessary.
- **Tools** covers bank connections, wallets, categories, CSV export, demo restore, clearing data, and disconnecting Plaid. Reminders are not built yet.

Settings cover accent colours, decimal display, the Save tab, and default
categories. Currency is fixed to CAD.

Wallets are spending, savings, debt, or cash. Transactions are expenses,
income, or transfers. An expense can be split across categories; a settled
split line is left out of budget and spend totals.

Imported rows that arrive without a confident category wait on
**Review transactions** until one is set.

## Architecture

```
src/app/
  core/
    auth/        Firebase Auth, error mapping, route guards
    data/        taxonomy, demo seed, repository port, Firestore adapter, Plaid client
    firebase/    Firebase app and Firestore initialisation
    models/      Transaction, Budget, Wallet, Category, Connection, ...
    plaid/       map Plaid transactions and verify webhook payloads
    state/       signal store and the auth/workspace session bridge
    util/        dates, currency, periods, budget maths, grouping, splits,
                 wallet balances, recurring detection
  features/      auth, shell, budgee, overview, budget, save, tools,
                 transactions, weekly-summary
  shared/
    charts/      line chart, donut, progress ring, month calendar
    ui/          icons, navigation, sheets, pickers, money formatting
server/plaid/    link, exchange, sync, disconnect, webhook
api/plaid/       Vercel function entry for the same handlers
```

Feature screens do not calculate totals themselves. Charts, calendars, and
budget figures come from `BudgetStore`, which uses the pure functions in
`core/util`. Editing one transaction updates the rest of the app.

## Budget calculations

The rules live in `core/util/budget-calc.util.ts`, with split allocation in
`core/util/transaction-split.util.ts`:

- Expense transactions reduce the availability of their category. A split expense counts each unsettled line; settled lines are ignored.
- Income transactions increase income totals only.
- Transfers are ignored unless the budget opts into savings or debt transfers, and even then they never become income or an expense.
- Transactions excluded from the budget never affect any total.
- `categoryRemaining = plannedAmount - includedExpenseSpend`
- `leftToSpend = sum(planned expense) - sum(included expenses in planned expense categories)`
- `dailyBudget = leftToSpend / max(1, remainingDaysInBudgetPeriod)`
- Included expenses in categories with no plan are reported separately as **Other expenses** and never fold into `leftToSpend`.
- The projection assumes each bucket ends at `max(actual so far, planned)`; unplanned other expenses carry at their actual value.

Each period is a half-open interval `[start, end)` and periods tile the
calendar with no gaps, so a transaction belongs to exactly one period.

## Demo mode

Demo mode pins "today" to a fixed date so the seeded dataset always tells the
same story. Outside demo mode the real calendar date is used. Demo data is
generated on the client and written only into the signed-in user's workspace,
from onboarding or from Tools. Restoring the demo set leaves an existing Plaid
connection in place.

## Progressive web app

`@angular/service-worker` and `ngsw-config.json` are enabled for production
builds. The service worker is off in development. Full offline support is not
a goal of this release.

## Testing

```bash
npm test
```

Unit tests cover budgeting mathematics: totals by type, period boundaries,
category remaining, excluded transactions, transfers, splits, daily budget,
calendar grouping, wallet balances, and the recurring payment heuristic.
