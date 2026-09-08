import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { Icon } from '../../shared/ui/icon';
import { groupByDay } from '../../core/util/grouping.util';
import { relativeDayLabel } from '../../core/util/date.util';
import type { Transaction } from '../../core/models';

/** List tab: the period's transactions grouped by day, with a floating add action. */
@Component({
  selector: 'app-list-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelector, TransactionRow, Icon, RouterLink],
  host: { class: 'flex flex-col gap-4 pt-1 pb-20' },
  template: `
    <app-period-selector
      [label]="periodLabel()"
      [caption]="periodTx().length + ' transactions'"
      (step)="store.stepPeriod($event)"
    />

    <section class="rounded-[1.5rem] bg-raised p-4">
      <div class="grid grid-cols-3 gap-2 rounded-[1.25rem] bg-sunken px-2 py-4 text-center">
        <div>
          <p class="text-[1.05rem] font-semibold text-ink">{{ money.summary(incomeCents()) }}</p>
          <p class="mt-0.5 text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Income</p>
        </div>
        <div>
          <p class="text-[1.05rem] font-semibold text-ink">{{ money.summary(expenseCents()) }}</p>
          <p class="mt-0.5 text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Expenses</p>
        </div>
        <div>
          <p
            class="text-[1.05rem] font-semibold"
            [style.color]="balanceCents() < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
          >
            {{ money.summary(balanceCents()) }}
          </p>
          <p class="mt-0.5 text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Balance</p>
        </div>
      </div>

      @if (days().length === 0) {
        <p class="py-10 text-center text-[0.95rem] text-ink-muted">
          No transactions in this period yet.
        </p>
      } @else {
        <div class="mt-5 flex flex-col gap-6">
          @for (day of days(); track day.date) {
            <div>
              <div class="flex items-baseline gap-2">
                <h3 class="text-[1.05rem] font-semibold text-ink">{{ label(day.date) }}</h3>
                <span class="leader"></span>
                <span class="text-[0.95rem] font-semibold text-ink-muted">
                  {{ money.summary(day.netCents) }}
                </span>
              </div>
              <div class="mt-1 flex flex-col">
                @for (tx of day.transactions; track tx.id) {
                  <app-transaction-row [transaction]="tx" (activate)="edit(tx)" />
                }
              </div>
            </div>
          }
        </div>
      }
    </section>

    <a
      routerLink="/transactions/new"
      class="fixed right-4 z-30 flex size-16 items-center justify-center rounded-full bg-white text-ink-inverse shadow-lg"
      style="bottom: calc(var(--safe-bottom) + 9rem)"
      aria-label="Add a transaction"
    >
      <app-icon name="plus" [size]="26" [strokeWidth]="2.4" />
    </a>
  `,
})
export class ListTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  private readonly router = inject(Router);

  protected readonly periodLabel = computed(() => this.store.activePeriod()?.label ?? 'All time');

  protected readonly periodTx = computed(() => {
    const period = this.store.activePeriod();
    const all = this.store.transactions();
    if (!period) return all;
    return all.filter((t) => t.date >= period.start && t.date < period.end);
  });

  protected readonly days = computed(() => groupByDay(this.periodTx()));

  protected readonly incomeCents = computed(() =>
    this.periodTx()
      .filter((t) => t.type === 'income' && !t.excludedFromBudget)
      .reduce((sum, t) => sum + t.amountCents, 0),
  );

  protected readonly expenseCents = computed(() =>
    this.periodTx()
      .filter((t) => t.type === 'expense' && !t.excludedFromBudget)
      .reduce((sum, t) => sum + t.amountCents, 0),
  );

  protected readonly balanceCents = computed(() => this.incomeCents() - this.expenseCents());

  protected label(date: string): string {
    return relativeDayLabel(date, this.store.today());
  }

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }
}
