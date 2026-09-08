import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { DonutChart, type DonutSegment } from '../../shared/charts/donut-chart';
import { CategoryMark } from '../../shared/ui/category-mark';
import { Icon } from '../../shared/ui/icon';
import { totalsByCategory, totalsByGroup } from '../../core/util/grouping.util';
import type { IconName } from '../../shared/ui/icon-set';

type Lens = 'expense' | 'income';
type Grain = 'groups' | 'categories';

interface SpendRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: IconName;
  readonly totalCents: number;
}

/** Spending tab: period totals plus a dynamic ring built from the data. */
@Component({
  selector: 'app-spending-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelector, DonutChart, CategoryMark, Icon],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    <app-period-selector
      [label]="periodLabel()"
      [caption]="transactionCount() + ' transactions'"
      (step)="store.stepPeriod($event)"
    />

    <section class="rounded-[1.5rem] bg-raised p-5">
      <div class="flex h-40 items-end justify-around gap-4">
        @for (bar of bars(); track bar.label) {
          <div class="flex h-full flex-1 flex-col items-center justify-end">
            <div
              class="w-full max-w-[4.5rem] rounded-t-full rounded-b-md"
              [style.height.%]="bar.heightPercent"
              [style.background]="bar.color"
              [style.box-shadow]="'0 0 22px color-mix(in srgb, ' + bar.color + ' 40%, transparent)'"
              role="img"
              [attr.aria-label]="bar.label + ' ' + money.summary(bar.valueCents)"
            ></div>
          </div>
        }
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2 text-center">
        @for (bar of bars(); track bar.label) {
          <div>
            <p class="text-[1.05rem] font-semibold text-ink">{{ money.summary(bar.valueCents) }}</p>
            <p class="mt-0.5 text-[0.68rem] tracking-[0.14em] text-ink-muted uppercase">
              {{ bar.label }}
            </p>
          </div>
        }
      </div>
    </section>

    <section class="rounded-[1.5rem] bg-raised p-5">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex min-h-[2.5rem] items-center gap-2 rounded-full bg-sunken px-4 text-[0.75rem] font-semibold tracking-[0.12em] text-ink uppercase"
          (click)="toggleLens()"
          [attr.aria-label]="'Showing ' + lens() + '. Switch view.'"
        >
          {{ lens() === 'expense' ? 'Expenses' : 'Income' }}
          <app-icon name="chevronDown" [size]="14" />
        </button>
      </div>

      @if (segments().length === 0) {
        <p class="mt-8 mb-4 text-center text-[0.95rem] text-ink-muted">
          Nothing recorded for this period yet.
        </p>
      } @else {
        <div class="mt-5">
          <app-donut-chart
            [segments]="segments()"
            [size]="216"
            [thickness]="20"
            [ariaLabel]="'Share of ' + lens() + ' by category'"
          >
            @if (focus(); as f) {
              <app-category-mark [icon]="f.icon" [color]="f.color" [size]="56" [solid]="true" />
              <span class="mt-3 text-[1.9rem] leading-none font-bold text-ink">
                {{ money.summary(f.totalCents) }}
              </span>
              <span class="mt-1 text-[0.7rem] tracking-[0.14em] text-ink-muted uppercase">
                {{ f.name }}
              </span>
            }
          </app-donut-chart>
        </div>

        <div class="mt-6 flex justify-center gap-2">
          <button
            type="button"
            class="min-h-[2.6rem] rounded-full px-4 text-[0.72rem] font-semibold tracking-[0.12em] uppercase"
            [class.bg-sunken]="grain() === 'groups'"
            [class.text-ink]="grain() === 'groups'"
            [class.text-ink-muted]="grain() !== 'groups'"
            (click)="grain.set('groups')"
          >
            Head categories
          </button>
          <button
            type="button"
            class="min-h-[2.6rem] rounded-full px-4 text-[0.72rem] font-semibold tracking-[0.12em] uppercase"
            [class.bg-sunken]="grain() === 'categories'"
            [class.text-ink]="grain() === 'categories'"
            [class.text-ink-muted]="grain() !== 'categories'"
            (click)="grain.set('categories')"
          >
            Categories
          </button>
        </div>

        <ul class="mt-4 flex flex-col">
          @for (row of rows(); track row.id) {
            <li>
              <button
                type="button"
                class="flex min-h-[3rem] w-full items-baseline gap-2 py-2 text-left"
                (click)="focusId.set(row.id)"
                [attr.aria-pressed]="focusId() === row.id"
              >
                <span
                  class="size-3 shrink-0 translate-y-0.5 rounded-[0.3rem]"
                  [style.background]="row.color"
                ></span>
                <span class="truncate text-[0.98rem] text-ink">{{ row.name }}</span>
                <span class="leader"></span>
                <span class="text-[1rem] font-semibold text-ink">
                  {{ money.summary(row.totalCents) }}
                </span>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class SpendingTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);

  protected readonly lens = signal<Lens>('expense');
  protected readonly grain = signal<Grain>('groups');
  protected readonly focusId = signal<string | null>(null);

  protected readonly periodLabel = computed(() => this.store.activePeriod()?.label ?? 'All time');
  protected readonly transactionCount = computed(() => this.periodTx().length);

  private readonly periodTx = computed(() => {
    const period = this.store.activePeriod();
    const all = this.store.transactions();
    if (!period) return all;
    return all.filter((t) => t.date >= period.start && t.date < period.end);
  });

  private readonly incomeCents = computed(() =>
    this.periodTx()
      .filter((t) => t.type === 'income' && !t.excludedFromBudget)
      .reduce((sum, t) => sum + t.amountCents, 0),
  );

  private readonly expenseCents = computed(() =>
    this.periodTx()
      .filter((t) => t.type === 'expense' && !t.excludedFromBudget)
      .reduce((sum, t) => sum + t.amountCents, 0),
  );

  protected readonly bars = computed(() => {
    const income = this.incomeCents();
    const expenses = this.expenseCents();
    const left = income - expenses;
    const peak = Math.max(1, income, expenses, Math.abs(left));
    const scale = (value: number) => Math.max(4, Math.round((Math.abs(value) / peak) * 100));
    return [
      { label: 'Income', valueCents: income, color: 'var(--color-positive)', heightPercent: scale(income) },
      { label: 'Expenses', valueCents: expenses, color: 'var(--color-cat-entertainment)', heightPercent: scale(expenses) },
      {
        label: 'Left',
        valueCents: left,
        color: left < 0 ? 'var(--color-negative)' : 'var(--color-accent)',
        heightPercent: scale(left),
      },
    ];
  });

  protected readonly rows = computed<SpendRow[]>(() => {
    const categories = this.store.categoriesById();
    const groups = this.store.groupsById();
    const type = this.lens();
    if (this.grain() === 'groups') {
      return totalsByGroup(this.periodTx(), type, (id) => categories.get(id)?.groupId).map(
        (entry) => {
          const group = groups.get(entry.categoryId);
          return {
            id: entry.categoryId,
            name: group?.name ?? 'Other',
            color: group?.color ?? 'var(--color-cat-misc)',
            icon: 'box' as IconName,
            totalCents: entry.totalCents,
          };
        },
      );
    }
    return totalsByCategory(this.periodTx(), type).map((entry) => {
      const category = categories.get(entry.categoryId);
      return {
        id: entry.categoryId,
        name: category?.name ?? 'Uncategorised',
        color: category?.color ?? 'var(--color-cat-misc)',
        icon: (category?.icon ?? 'box') as IconName,
        totalCents: entry.totalCents,
      };
    });
  });

  protected readonly segments = computed<DonutSegment[]>(() =>
    this.rows().map((row) => ({
      id: row.id,
      label: row.name,
      value: row.totalCents,
      color: row.color,
    })),
  );

  /** Centre of the ring: the selected row, or the largest one. */
  protected readonly focus = computed<SpendRow | null>(() => {
    const rows = this.rows();
    if (rows.length === 0) return null;
    const selected = rows.find((r) => r.id === this.focusId());
    const row = selected ?? rows[0];
    if (this.grain() === 'groups') {
      const first = this.store.categories().find((c) => c.groupId === row.id);
      return { ...row, icon: (first?.icon ?? 'box') as IconName };
    }
    return row;
  });

  protected toggleLens(): void {
    this.focusId.set(null);
    this.lens.update((v) => (v === 'expense' ? 'income' : 'expense'));
  }
}
