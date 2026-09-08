import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard, onboardedGuard, onboardingGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'welcome',
    canActivate: [guestOnlyGuard],
    title: 'Welcome to Budgee',
    loadComponent: () => import('./features/auth/welcome-page').then((m) => m.WelcomePage),
  },
  {
    path: 'sign-in',
    canActivate: [guestOnlyGuard],
    title: 'Sign in to Budgee',
    loadComponent: () => import('./features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'sign-up',
    canActivate: [guestOnlyGuard],
    title: 'Create your Budgee account',
    loadComponent: () => import('./features/auth/sign-up-page').then((m) => m.SignUpPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestOnlyGuard],
    title: 'Reset your password',
    loadComponent: () =>
      import('./features/auth/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    title: 'Set up Budgee',
    loadComponent: () => import('./features/auth/onboarding-page').then((m) => m.OnboardingPage),
  },
  {
    path: '',
    canActivate: [authGuard, onboardedGuard],
    loadComponent: () => import('./features/shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'budgee' },
      {
        path: 'budgee',
        title: 'Budgee',
        loadComponent: () => import('./features/budgee/budgee-page').then((m) => m.BudgeePage),
      },
      {
        path: 'overview',
        title: 'Overview',
        loadComponent: () => import('./features/overview/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'budget',
        title: 'Budget',
        loadComponent: () => import('./features/budget/budget-page').then((m) => m.BudgetPage),
      },
      {
        path: 'budget/create',
        title: 'Create a budget',
        loadComponent: () =>
          import('./features/budget/budget-create-page').then((m) => m.BudgetCreatePage),
      },
      {
        path: 'budget/edit',
        title: 'Edit budget',
        loadComponent: () =>
          import('./features/budget/budget-edit-page').then((m) => m.BudgetEditPage),
      },
      {
        path: 'save',
        title: 'Save',
        loadComponent: () => import('./features/save/save-page').then((m) => m.SavePage),
      },
      {
        path: 'save/bills',
        title: 'Recurring bills',
        loadComponent: () => import('./features/save/bills-page').then((m) => m.BillsPage),
      },
      {
        path: 'tools',
        title: 'Tools',
        loadComponent: () => import('./features/tools/tools-page').then((m) => m.ToolsPage),
      },
      {
        path: 'settings',
        title: 'Settings',
        loadComponent: () => import('./features/tools/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'categories',
        title: 'Categories',
        loadComponent: () => import('./features/tools/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: 'wallets',
        title: 'Wallets',
        loadComponent: () => import('./features/tools/wallets-page').then((m) => m.WalletsPage),
      },
      {
        path: 'bank-connections',
        title: 'Bank connections',
        loadComponent: () =>
          import('./features/tools/bank-connections-page').then((m) => m.BankConnectionsPage),
      },
      {
        path: 'transactions/new',
        title: 'New transaction',
        loadComponent: () =>
          import('./features/transactions/transaction-editor-page').then(
            (m) => m.TransactionEditorPage,
          ),
      },
      {
        path: 'transactions/:id/edit',
        title: 'Edit transaction',
        loadComponent: () =>
          import('./features/transactions/transaction-editor-page').then(
            (m) => m.TransactionEditorPage,
          ),
      },
      {
        path: 'transactions/review',
        title: 'Review transactions',
        loadComponent: () =>
          import('./features/transactions/review-page').then((m) => m.ReviewPage),
      },
      {
        path: 'weekly-summary',
        title: 'Weekly summary',
        loadComponent: () =>
          import('./features/weekly-summary/weekly-summary-page').then((m) => m.WeeklySummaryPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
