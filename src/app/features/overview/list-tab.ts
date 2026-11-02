import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { Icon } from '../../shared/ui/icon';
import { groupByDay } from '../../core/util/grouping.util';
import { budgetExpenseCents } from '../../core/util/transaction-split.util';
import { isFutureExpense } from '../../core/util/budget-calc.util';
import { relativeDayLabel } from '../../core/util/date.util';
import { searchTransactions } from '../../core/util/transaction-search.util';
import type { Transaction } from '../../core/models';

/**
 * List tab: the period's transactions grouped by day, with a floating add action.
 * Search looks across every month, not just the selected period.
 */
@Component({
  selector: 'app-list-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelector, TransactionRow, Icon, RouterLink],
  host: { class: 'flex flex-col gap-4 pt-1 pb-20' },
  template: `
    @if (searchOpen()) {
      <div class="flex items-center gap-2 rounded-[1.75rem] bg-raised px-4 py-2">
        <app-icon name="search" [size]="18" />
        <label class="sr-only" for="list-search">Search transactions by name or amount</label>
        <input
          #searchInput
          id="list-search"
          type="search"
          autocomplete="off"
          class="min-h-[2.75rem] min-w-0 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-ink-faint"
          placeholder="Search by name or amount"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown.escape)="closeSearch()"
        />
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
          aria-label="Close search"
          title="Close search"
          (click)="closeSearch()"
        >
          <app-icon name="x" [size]="18" />
        </button>
      </div>
    } @else {
      <div class="flex items-center gap-2">
        <app-period-selector
          class="min-w-0 flex-1"
          [label]="periodLabel()"
          [caption]="periodTx().length + ' transactions'"
          (step)="store.stepPeriod($event)"
        />
        <button
          type="button"
          class="flex size-14 shrink-0 items-center justify-center rounded-full bg-raised text-ink"
          aria-label="Search transactions"
          title="Search transactions"
          (click)="openSearch()"
        >
          <app-icon name="search" [size]="20" />
        </button>
      </div>
    }

    @if (searching()) {
      <section class="rounded-[1.5rem] bg-raised p-4" aria-label="Search results">
        <p class="text-[0.82rem] text-ink-muted" role="status">
          @if (results().length === 0) {
            No transactions found
          } @else {
            {{ results().length }} {{ results().length === 1 ? 'transaction' : 'transactions' }}
            found across all months
          }
        </p>
        @if (results().length > 0) {
          <div class="mt-4 flex flex-col gap-6">
            @for (day of resultDays(); track day.date) {
              <div>
                <h3 class="text-[1.05rem] font-semibold text-ink">{{ label(day.date) }}</h3>
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
    } @else {
    <section class="rounded-[1.5rem] bg-raised p-4">
      <div class="grid grid-cols-3 gap-2 rounded-[1.25rem] bg-sunken px-2 py-4 text-center">
        <div>
          <p
            class="text-[1.05rem] font-semibold [overflow-wrap:anywhere] text-ink"
            [attr.title]="money.summary(incomeCents())"
          >
            {{ money.headline(incomeCents()) }}
          </p>
          <p class="mt-0.5 text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Income</p>
        </div>
        <div>
          <p
            class="text-[1.05rem] font-semibold [overflow-wrap:anywhere] text-ink"
            [attr.title]="money.summary(expenseCents())"
          >
            {{ money.headline(expenseCents()) }}
          </p>
          <p class="mt-0.5 text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Expenses</p>
        </div>
        <div>
          <p
            class="text-[1.05rem] font-semibold [overflow-wrap:anywhere]"
            [style.color]="balanceCents() < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
            [attr.title]="money.summary(balanceCents())"
          >
            {{ money.headline(balanceCents()) }}
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
    }

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
  private readonly injector = inject(Injector);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly searchOpen = signal(false);
  protected readonly query = signal('');
  protected readonly searching = computed(() => this.searchOpen() && this.query().trim() !== '');

  protected readonly results = computed(() => {
    const categories = this.store.categoriesById();
    return searchTransactions(
      this.store.transactions(),
      this.query(),
      (id) => categories.get(id)?.name ?? '',
    );
  });

  protected readonly resultDays = computed(() => groupByDay(this.results()));

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
      .filter((t) => !isFutureExpense(t, this.store.today()))
      .reduce((sum, t) => sum + budgetExpenseCents(t), 0),
  );

  protected readonly balanceCents = computed(() => this.incomeCents() - this.expenseCents());

  protected openSearch(): void {
    this.searchOpen.set(true);
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.query.set('');
  }

  protected label(date: string): string {
    return relativeDayLabel(date, this.store.today());
  }

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }
}
