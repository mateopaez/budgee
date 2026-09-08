import { Injectable, computed, inject } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { formatMoney, type MoneyFormatOptions } from '../../core/util/currency.util';

/**
 * Currency formatting that respects the user's display preferences.
 *
 * Templates call `money.fmt(cents)`; because the method reads a signal it stays
 * reactive, so flipping "show double decimals" updates every amount at once.
 */
@Injectable({ providedIn: 'root' })
export class MoneyFormat {
  private readonly store = inject(BudgetStore);

  private readonly options = computed<MoneyFormatOptions>(() => {
    const prefs = this.store.preferences();
    return {
      decimals: prefs?.showDoubleDecimals ?? false,
      locale: prefs?.locale ?? 'en-CA',
      currency: prefs?.currency ?? 'CAD',
    };
  });

  private readonly roundSummaries = computed(
    () => this.store.preferences()?.roundSummaryAmounts ?? true,
  );

  /** Standard amount, for example a transaction row. */
  fmt(cents: number, overrides: MoneyFormatOptions = {}): string {
    return formatMoney(cents, { ...this.options(), ...overrides });
  }

  /** Large headline totals, which can be rounded to whole dollars. */
  summary(cents: number, overrides: MoneyFormatOptions = {}): string {
    const base = this.options();
    return formatMoney(cents, {
      ...base,
      decimals: this.roundSummaries() ? false : base.decimals,
      ...overrides,
    });
  }

  compact(cents: number): string {
    return formatMoney(cents, { ...this.options(), decimals: false, compact: true });
  }

  /** Amount with the sign convention used by transaction rows. */
  signed(cents: number, type: 'expense' | 'income' | 'transfer'): string {
    if (type === 'income') return this.fmt(cents, { signed: true });
    return this.fmt(cents);
  }
}
