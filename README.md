# Budgee

Budgee is a mobile first personal budgeting web app for Canadian dollars, built
with Angular 21, standalone components, Angular Signals and Tailwind CSS. It is
designed for iPhone sized screens and home screen use, and degrades to a
centred phone shaped column on larger displays.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer

## Getting started

```bash
npm install
npm start
```

Then open `http://localhost:4200/`.

## Firebase setup

The app uses the Firebase project already configured in
`src/app/core/firebase/firebase.config.ts`. The values there are the standard
public web app identifiers; no secrets belong in this repository.

Two sign in providers must be enabled in the Firebase console under
**Authentication -> Sign-in method**:

- **Google**
- **Email/Password**

Also add the domains you serve from to **Authentication -> Settings ->
Authorized domains** (`localhost` is authorised by default).

Firestore security rules live in `firestore.rules` and scope every record to the
signed in user. Deploy them with:

```bash
npx firebase deploy --only firestore:rules
```

Data persistence in this MVP is browser local storage, namespaced per Firebase
Auth uid. See `docs/firestore-adapter.md` for the pending Firestore adapter and
the target document layout.

## Scripts

```bash
npm start        # development server
npm run build    # production build
npm test         # Vitest unit tests
```

## Architecture

```
src/app/
  core/
    auth/        Firebase Auth service, friendly error mapping, route guards
    data/        category taxonomy, demo dataset, repository ports, local adapter
    firebase/    Firebase app initialisation
    models/      domain models (Transaction, Budget, Wallet, Category, ...)
    state/       the signal store and the auth/workspace session bridge
    util/        pure functions: dates, currency, budget periods, budget maths,
                 grouping and recurring payment detection
  features/      one folder per area: auth, shell, buddy, overview, budget,
                 save, tools, transactions, weekly-summary
  shared/
    charts/      line chart, donut, progress ring, month calendar
    ui/          icon set, navigation, sheets, pickers, formatting
```

Nothing in `features/` performs calculations of its own. Every total, chart,
calendar value and budget figure is derived from `BudgetStore`, which in turn
uses the pure functions in `core/util`, so a single transaction edit updates the
whole app at once.

## Budget calculations

The rules are implemented once, in `core/util/budget-calc.util.ts`:

- Expense transactions reduce the availability of their category.
- Income transactions increase income totals only.
- Transfers are ignored unless the budget opts into savings or debt transfers,
  and even then they never become income or an expense.
- Transactions excluded from the budget never affect any total.
- `categoryRemaining = plannedAmount - includedExpenseSpend`
- `leftToSpend = sum(planned expense) - sum(included expenses in planned expense categories)`
- `dailyBudget = leftToSpend / max(1, remainingDaysInBudgetPeriod)`
- Included expenses in categories with no plan are reported separately as
  **Other expenses** and never fold into `leftToSpend`.
- The projection assumes each bucket ends at `max(actual so far, planned)`;
  unplanned other expenses carry at their actual value.

Budget periods can be monthly, weekly, biweekly, semi-monthly or yearly. Each
period is a half open interval `[start, end)` and periods tile the calendar with
no gaps, so a transaction belongs to exactly one period.

## Demo mode

Demo mode pins "today" to a fixed date so the seeded dataset always tells the
same story. Outside demo mode the real calendar date is used. Demo data is
generated on the client and written only into the signed in user's own
workspace, after they choose it during onboarding or from Tools.

## Bank connections

There is no bank aggregation in this release. The Bank Connections screen states
this plainly and offers manual entry or the demo dataset. See
`docs/future-plaid-integration.md` for what a secure integration would require.

## Progressive web app

The existing `@angular/service-worker` setup and `ngsw-config.json` are intact.
Full offline support is not a goal of this release.

## Testing

```bash
npm test
```

Unit tests focus on the budgeting mathematics: totals by type, budget period
boundaries, category remaining, excluded transactions, transfer handling, daily
budget, calendar grouping and the recurring payment heuristic.
