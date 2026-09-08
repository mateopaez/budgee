import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { Icon } from '../../shared/ui/icon';
import { LineChart, type LinePoint } from '../../shared/charts/line-chart';
import { MonthCalendar } from '../../shared/charts/month-calendar';
import { ProgressRing } from '../../shared/charts/progress-ring';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { CategoryMark } from '../../shared/ui/category-mark';
import { cumulativeSpend } from '../../core/util/grouping.util';
import { addDays, addMonths, diffDays, dueInLabel, startOfMonth } from '../../core/util/date.util';
import type { Transaction } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

/** The default Overview tab: a scrolling stack of data driven cards. */
@Component({
  selector: 'app-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    LineChart,
    MonthCalendar,
    ProgressRing,
    TransactionRow,
    CategoryMark,
    RouterLink,
  ],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    <!-- Spend so far, with the running total drawn from transactions. -->
    <section class="rounded-[1.5rem] bg-raised p-5">
      <h2 class="text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
        Spent this {{ periodWord() }}
      </h2>
      <p class="mt-1 text-[2.4rem] leading-none font-bold text-ink">
        {{ money.summary(spentCents()) }}
      </p>
      <div class="mt-5">
        <app-line-chart
          [points]="spendPoints()"
          [comparison]="averageLine()"
          [ariaLabel]="'Running total spent during ' + periodLabel()"
        />
      </div>
      <div class="mt-3 flex items-center gap-4 text-[0.8rem] text-ink-muted">
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full" style="background: var(--color-accent)"></span>
          This period
        </span>
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full bg-ink-faint"></span>
          Even pace
        </span>
      </div>
    </section>

    <!-- Accounts -->
    <section class="rounded-[1.5rem] bg-raised p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-[1.15rem] font-semibold text-ink">Connected accounts</h2>
        <a
          routerLink="/bank-connections"
          class="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-muted"
          aria-label="Manage bank connections"
        >
          <app-icon name="gear" [size]="18" />
        </a>
      </div>

      @if (accounts().length === 0) {
        <p class="mt-3 text-[0.9rem] text-ink-muted">
          No accounts connected. Wallet balances below are built from the transactions you record.
        </p>
        <ul class="mt-3 flex flex-col gap-2">
          @for (wallet of wallets(); track wallet.id) {
            <li class="flex items-baseline gap-2">
              <span class="text-[0.95rem] text-ink">{{ wallet.name }}</span>
              <span class="leader"></span>
              <span class="text-[1rem] font-semibold text-ink">
                {{ money.summary(balanceOf(wallet.id)) }}
              </span>
            </li>
          }
        </ul>
      } @else {
        <ul class="mt-4 flex flex-col gap-3">
          @for (account of accounts(); track account.id) {
            <li class="flex items-baseline gap-2">
              <span class="truncate text-[0.95rem] text-ink">{{ account.name }}</span>
              <span class="leader"></span>
              <span class="text-[1rem] font-semibold text-ink">
                {{ money.summary(account.balanceCents) }}
              </span>
            </li>
          }
        </ul>
        <p class="mt-4 text-center text-[0.85rem] text-ink-muted">
          Last synced: {{ lastSynced() }}
        </p>
      }
    </section>

    <!-- Calendar -->
    <app-month-calendar
      [monthAnchor]="calendarMonth()"
      [transactions]="store.transactions()"
      [today]="store.today()"
      (step)="calendarOffset.set(calendarOffset() + $event)"
    />

    <!-- Weekly summary promo -->
    <section
      class="relative overflow-hidden rounded-[1.5rem] p-5"
      style="background: linear-gradient(155deg, #f0b6d4 0%, #d9a7e6 45%, #9aa8e6 100%)"
    >
      <div
        aria-hidden="true"
        class="absolute -top-8 -right-8 size-36 rounded-full opacity-70 blur-[2px]"
        style="background: conic-gradient(from 140deg, #ff6ea9, #7b5bff, #24d6c4, #ff6ea9)"
      ></div>
      <h2 class="relative max-w-[15ch] text-[1.6rem] leading-tight font-bold text-[#151515]">
        See what your money was up to last week
      </h2>
      <p class="relative mt-2 text-[0.95rem] text-[#151515]/80">Here is your breakdown</p>
      <a
        routerLink="/weekly-summary"
        class="relative mt-5 flex min-h-[3.25rem] items-center justify-center rounded-full bg-black text-[1rem] font-semibold text-white"
      >
        Open weekly summary
      </a>
    </section>

    <!-- Budget -->
    @if (summary(); as s) {
      <section class="rounded-[1.5rem] bg-raised p-5">
        <h2 class="text-[1.15rem] font-semibold text-ink">Budget</h2>
        <p class="mt-4 text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
          Left to spend
        </p>
        <p
          class="mt-1 text-[2.4rem] leading-none font-bold"
          [style.color]="s.leftToSpendCents < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
        >
          {{ money.summary(s.leftToSpendCents) }}
        </p>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
          <div
            class="h-full rounded-full"
            [style.width.%]="usedPercent()"
            [style.background]="s.leftToSpendCents < 0 ? 'var(--color-negative)' : 'var(--color-accent)'"
          ></div>
        </div>

        @if (popularCategories().length > 0) {
          <h3 class="mt-6 text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
            Popular categories
          </h3>
          <ul class="mt-4 grid grid-cols-3 gap-3">
            @for (item of popularCategories(); track item.categoryId) {
              <li class="flex flex-col items-center text-center">
                <app-progress-ring
                  [icon]="item.icon"
                  [progress]="item.progress"
                  [color]="item.color"
                  [over]="item.remainingCents < 0"
                  [size]="78"
                />
                <span class="mt-2 text-[0.68rem] tracking-wider text-ink-muted uppercase">
                  {{ item.name }}
                </span>
                <span
                  class="mt-0.5 text-[0.9rem] font-semibold"
                  [style.color]="item.remainingCents < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
                >
                  {{ money.summary(Math.abs(item.remainingCents)) }}
                  {{ item.remainingCents < 0 ? 'over' : 'left' }}
                </span>
              </li>
            }
          </ul>
        }
      </section>
    } @else {
      <section class="rounded-[1.5rem] bg-raised p-5 text-center">
        <h2 class="text-[1.15rem] font-semibold text-ink">No budget yet</h2>
        <p class="mt-2 text-[0.9rem] text-ink-muted">
          Plan what each category gets and Budgee will track what is left.
        </p>
        <a
          routerLink="/budget/create"
          class="mt-4 inline-flex min-h-[3rem] items-center rounded-full bg-white px-6 text-[0.95rem] font-semibold text-ink-inverse"
        >
          Create a budget
        </a>
      </section>
    }

    <!-- Latest transactions -->
    <section class="rounded-[1.5rem] bg-raised p-5">
      <h2 class="text-[1.15rem] font-semibold text-ink">Latest transactions</h2>
      @if (latest().length === 0) {
        <p class="mt-3 text-[0.9rem] text-ink-muted">Nothing recorded yet.</p>
      } @else {
        <div class="mt-3 flex flex-col">
          @for (tx of latest(); track tx.id) {
            <app-transaction-row [transaction]="tx" (activate)="edit(tx)" />
          }
        </div>
        <p class="mt-4 text-center text-[0.9rem] text-ink-muted">
          You have <span class="font-semibold text-ink">{{ pastWeekCount() }} transactions</span> in
          the past week.
        </p>
      }
      <a
        routerLink="/transactions/review"
        class="mt-4 flex min-h-[3.25rem] items-center justify-center rounded-[1.25rem] bg-sunken text-[1rem] font-semibold text-ink"
      >
        Review transactions
      </a>
    </section>

    <!-- Recurring preview -->
    @if (upcoming().length > 0) {
      <section class="rounded-[1.5rem] bg-raised p-5">
        <h2 class="text-[1.15rem] font-semibold text-ink">Upcoming payments</h2>
        <p class="mt-1 text-[0.88rem] text-ink-muted">
          Recurring spending Budgee found in your history.
        </p>
        <ul class="mt-4 flex flex-col gap-3">
          @for (item of upcoming(); track item.id) {
            <li class="flex items-center gap-3">
              <app-category-mark [icon]="item.icon" [color]="item.color" [size]="42" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[0.95rem] font-semibold text-ink">
                  {{ item.merchant }}
                </span>
                <span class="block text-[0.82rem] text-ink-muted">{{ item.due }}</span>
              </span>
              <span class="text-[0.98rem] font-semibold text-ink">
                {{ money.fmt(item.amountCents, { decimals: true }) }}
              </span>
            </li>
          }
        </ul>
        <a
          routerLink="/save/bills"
          class="mt-4 flex min-h-[3rem] items-center justify-center rounded-full border border-line text-[0.95rem] font-semibold text-ink"
        >
          See all recurring bills
        </a>
      </section>
    }
  `,
})
export class OverviewTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  private readonly router = inject(Router);
  protected readonly Math = Math;

  protected readonly calendarOffset = signal(0);

  protected readonly summary = this.store.summary;
  protected readonly wallets = this.store.wallets;
  protected readonly accounts = this.store.linkedAccounts;

  protected readonly periodLabel = computed(() => this.store.activePeriod()?.label ?? 'this month');
  protected readonly periodWord = computed(() => {
    const type = this.store.activeBudget()?.periodType ?? 'monthly';
    return type === 'monthly' ? 'month' : 'period';
  });

  private readonly windowRange = computed(() => {
    const period = this.store.activePeriod();
    if (period) return { start: period.start, end: period.end };
    const start = startOfMonth(this.store.today());
    return { start, end: addMonths(start, 1) };
  });

  protected readonly spentCents = computed(() => {
    const summary = this.summary();
    if (summary) return summary.expensesCents;
    const { start, end } = this.windowRange();
    return this.store
      .transactions()
      .filter((t) => t.type === 'expense' && !t.excludedFromBudget && t.date >= start && t.date < end)
      .reduce((sum, t) => sum + t.amountCents, 0);
  });

  protected readonly spendPoints = computed<LinePoint[]>(() => {
    const { start, end } = this.windowRange();
    const today = this.store.today();
    // Stop the line at today so the rest of the period is not implied to be flat.
    const cutoff = today < end ? addDays(today, 1) : end;
    const points = cumulativeSpend(start, cutoff, this.store.transactions());
    return points.map((p) => ({ label: `${p.dayOfMonth}`, value: p.cumulativeCents }));
  });

  /** Dashed reference line: what an even pace through the period would look like. */
  protected readonly averageLine = computed<number[]>(() => {
    const { start, end } = this.windowRange();
    const planned = this.summary()?.plannedExpenseCents ?? this.spentCents();
    const days = Math.max(1, diffDays(start, end));
    return Array.from({ length: days }, (_, i) => (planned * (i + 1)) / days);
  });

  protected readonly calendarMonth = computed(() =>
    addMonths(startOfMonth(this.store.today()), this.calendarOffset()),
  );

  protected readonly lastSynced = computed(() => {
    const connection = this.store.connections()[0];
    if (!connection?.lastSyncAt) return 'never';
    return 'just now (demo data)';
  });

  protected readonly usedPercent = computed(() => {
    const s = this.summary();
    if (!s || s.plannedExpenseCents <= 0) return 0;
    return Math.min(100, Math.round((s.spentOnPlannedCents / s.plannedExpenseCents) * 100));
  });

  protected readonly popularCategories = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const categories = this.store.categoriesById();
    return s.groups
      .flatMap((g) => g.categories)
      .filter((c) => c.plannedCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents)
      .slice(0, 3)
      .map((c) => {
        const category = categories.get(c.categoryId);
        return {
          categoryId: c.categoryId,
          name: category?.name ?? 'Category',
          icon: (category?.icon ?? 'box') as IconName,
          color: category?.color ?? 'var(--color-cat-misc)',
          progress: c.progress,
          remainingCents: c.remainingCents,
        };
      });
  });

  protected readonly latest = computed(() => this.store.transactions().slice(0, 4));

  protected readonly pastWeekCount = computed(() => {
    const from = addDays(this.store.today(), -6);
    return this.store.transactions().filter((t) => t.date >= from).length;
  });

  protected readonly upcoming = computed(() => {
    const categories = this.store.categoriesById();
    const today = this.store.today();
    return this.store
      .recurringPayments()
      .slice()
      .sort((a, b) => (a.nextDueOn < b.nextDueOn ? -1 : 1))
      .slice(0, 3)
      .map((p) => {
        const category = categories.get(p.categoryId);
        return {
          id: p.id,
          merchant: p.merchant,
          amountCents: p.amountCents,
          icon: (category?.icon ?? 'repeat') as IconName,
          color: category?.color ?? 'var(--color-cat-misc)',
          due: dueInLabel(p.nextDueOn, today),
        };
      });
  });

  protected balanceOf(walletId: string): number {
    return this.store.walletBalances().get(walletId) ?? 0;
  }

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }
}
