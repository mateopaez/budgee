import { Injectable, computed, inject } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { formatMoney, type MoneyFormatOptions } from '../../core/util/currency.util';

const HEADLINE_COMPACT_FROM_CENTS = 10_000_000;

/**
 * Currency formatting that respects the user's display preferences.
 *
 * Templates call `money.fmt(cents)`; because the method reads a signal it stays
 * reactive, so flipping a display setting updates every amount at once.
 *
 * "Show cents" drives `fmt`, used for single amounts such as a recurring bill.
 * "Round totals to whole dollars" drives `summary` on its own: when it is off,
 * totals show cents. Transaction rows and the editor always show cents.
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

  /** Totals, which are rounded to whole dollars unless that setting is off. */
  summary(cents: number, overrides: MoneyFormatOptions = {}): string {
    return formatMoney(cents, {
      ...this.options(),
      decimals: !this.roundSummaries(),
      ...overrides,
    });
  }

  /**
   * Summary figures in tight spots, such as the List header columns. From
   * $100,000 the value is compacted to $120K or $1.2M so it cannot overflow.
   */
  headline(cents: number): string {
    if (Math.abs(cents) >= HEADLINE_COMPACT_FROM_CENTS) return this.compact(cents);
    return this.summary(cents);
  }

  compact(cents: number): string {
    return formatMoney(cents, { ...this.options(), decimals: false, compact: true });
  }

  /** Amount with the sign convention used by transaction rows: −$61 and +$50. */
  signed(
    cents: number,
    type: 'expense' | 'income' | 'transfer',
    overrides: MoneyFormatOptions = {},
  ): string {
    if (type === 'income') return this.fmt(cents, { signed: true, ...overrides });
    if (type === 'expense') return this.fmt(-Math.abs(cents), overrides);
    return this.fmt(cents, overrides);
  }
}
