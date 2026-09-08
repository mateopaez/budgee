import type { CurrencyCode } from './money.model';

export type AccentArea = 'overview' | 'budget' | 'wallets';

export interface UserPreferences {
  /** Fixed to CAD for the MVP but kept as a typed preference. */
  readonly currency: CurrencyCode;
  readonly locale: string;
  readonly showDoubleDecimals: boolean;
  readonly roundSummaryAmounts: boolean;
  readonly showSaveInTabBar: boolean;
  readonly defaultExpenseCategoryId: string;
  readonly defaultIncomeCategoryId: string;
  readonly defaultTransferCategoryId: string;
  readonly overviewAccent: string;
  readonly budgetAccent: string;
  readonly walletAccent: string;
  /** Demo mode pins "today" so the seeded dataset stays coherent. */
  readonly demoMode: boolean;
}
