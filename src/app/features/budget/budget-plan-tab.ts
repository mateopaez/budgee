import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { DonutChart, type DonutSegment } from '../../shared/charts/donut-chart';
import { CategoryMark } from '../../shared/ui/category-mark';
import { Icon } from '../../shared/ui/icon';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { parseMoneyToCents } from '../../core/util/currency.util';
import type { BudgetCategoryPlan, PlanKind } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

interface PlanRow {
  readonly categoryId: string;
  readonly name: string;
  readonly icon: IconName;
  readonly color: string;
  readonly plannedCents: number;
}

interface PlanGroup {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly rows: readonly PlanRow[];
  readonly totalCents: number;
}

/** Plan tab: what each category is allowed this period, and the shape of the plan. */
@Component({
  selector: 'app-budget-plan-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelector, DonutChart, CategoryMark, Icon, OptionPickerSheet],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    <app-period-selector [label]="periodLabel()" (step)="store.stepPeriod($event)" />

    @if (plannedTotalCents() === 0) {
      <section class="rounded-[1.5rem] bg-raised p-6 text-center">
        <h2 class="text-[1.15rem] font-semibold text-ink">Nothing planned yet</h2>
        <p class="mt-2 text-[0.92rem] leading-relaxed text-ink-muted">
          Add a category below and give it an amount. Budgee will track what is left as you spend.
        </p>
      </section>
    } @else {
      <section class="rounded-[1.5rem] bg-raised p-5">
        <div class="flex items-center gap-5">
          <app-donut-chart
            [segments]="segments()"
            [size]="118"
            [thickness]="16"
            [rounded]="false"
            ariaLabel="Planned spending by group"
          />
          <div class="min-w-0 flex-1">
            <h2 class="text-[0.68rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Total planned expenses
            </h2>
            <p class="mt-1 text-[2rem] leading-none font-bold text-ink">
              {{ money.summary(plannedTotalCents()) }}
            </p>
            <p class="mt-2 text-[0.9rem] text-ink-muted">
              <span class="font-semibold text-ink">
                {{ money.summary(Math.abs(vsIncomeCents())) }}
              </span>
              {{ vsIncomeCents() > 0 ? 'over income' : 'under income' }}
            </p>
          </div>
        </div>

        <ul class="mt-5 flex flex-col gap-2">
          @for (group of outflowGroups(); track group.id) {
            <li class="flex items-baseline gap-2">
              <span
                class="size-3 shrink-0 translate-y-0.5 rounded-[0.3rem]"
                [style.background]="group.color"
              ></span>
              <span class="text-[0.95rem] text-ink">{{ group.name }}</span>
              <span class="text-[0.85rem] text-ink-muted">{{ share(group.totalCents) }}%</span>
              <span class="leader"></span>
              <span class="text-[0.98rem] font-semibold text-ink">
                {{ money.summary(group.totalCents) }}
              </span>
            </li>
          }
        </ul>
      </section>
    }

    @for (group of allGroups(); track group.id) {
      <section class="rounded-[1.5rem] bg-raised p-5">
        <h2 class="text-[1.2rem] font-semibold text-ink">{{ group.name }}</h2>
        <ul class="mt-1 flex flex-col">
          @for (row of group.rows; track row.categoryId) {
            <li class="flex min-h-[4rem] items-center gap-3 border-t border-line">
              <app-category-mark [icon]="row.icon" [color]="row.color" [size]="40" [solid]="true" />
              <span class="min-w-0 flex-1 truncate text-[1rem] text-ink">{{ row.name }}</span>
              <label class="sr-only" [attr.for]="'plan-' + row.categoryId">
                Planned amount for {{ row.name }}
              </label>
              <input
                [id]="'plan-' + row.categoryId"
                type="text"
                inputmode="decimal"
                class="min-h-[2.75rem] w-[6.5rem] rounded-xl bg-sunken px-3 text-right text-[1rem] font-semibold text-ink outline-none"
                [value]="display(row.plannedCents)"
                (change)="updatePlan(row.categoryId, $any($event.target).value)"
                (focus)="$any($event.target).select()"
              />
            </li>
          }
          <li class="border-t border-line">
            <button
              type="button"
              class="flex min-h-[4rem] w-full items-center gap-3 text-left"
              (click)="openPicker(group.kind)"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full bg-sunken text-ink"
                aria-hidden="true"
              >
                <app-icon name="plus" [size]="20" />
              </span>
              <span class="text-[1rem] text-ink">Add category</span>
            </button>
          </li>
        </ul>
      </section>
    }

    @if (allGroups().length === 0) {
      <button
        type="button"
        class="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-[1.5rem] bg-raised text-[1rem] font-semibold text-ink"
        (click)="openPicker('expense')"
      >
        <app-icon name="plus" [size]="20" />
        Add your first category
      </button>
    }

    @if (pickerKind(); as kind) {
      <app-option-picker-sheet
        [title]="kind === 'income' ? 'Income categories' : 'Categories'"
        [options]="pickerOptions()"
        (choose)="addPlan($event)"
        (cancel)="pickerKind.set(null)"
      />
    }
  `,
})
export class BudgetPlanTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  protected readonly Math = Math;

  protected readonly pickerKind = signal<PlanKind | null>(null);

  protected readonly periodLabel = computed(() => this.store.activePeriod()?.label ?? '');

  private readonly plans = computed(() => this.store.activeBudget()?.plans ?? []);

  protected readonly plannedTotalCents = computed(() =>
    this.plans()
      .filter((p) => p.kind !== 'income')
      .reduce((sum, p) => sum + p.plannedCents, 0),
  );

  private readonly plannedIncomeCents = computed(() =>
    this.plans()
      .filter((p) => p.kind === 'income')
      .reduce((sum, p) => sum + p.plannedCents, 0),
  );

  protected readonly vsIncomeCents = computed(
    () => this.plannedTotalCents() - this.plannedIncomeCents(),
  );

  /** Groups holding planned outflows, used by the donut and its legend. */
  protected readonly outflowGroups = computed<PlanGroup[]>(() =>
    this.buildGroups((p) => p.kind !== 'income'),
  );

  /** Every group that has a plan, expense and income alike. */
  protected readonly allGroups = computed(() => {
    const groups = this.buildGroups(() => true);
    return groups.map((group) => ({
      ...group,
      kind: group.rows.every((row) => this.planKind(row.categoryId) === 'income')
        ? ('income' as PlanKind)
        : ('expense' as PlanKind),
    }));
  });

  protected readonly segments = computed<DonutSegment[]>(() =>
    this.outflowGroups().map((g) => ({
      id: g.id,
      label: g.name,
      value: g.totalCents,
      color: g.color,
    })),
  );

  protected readonly pickerOptions = computed<PickerOption[]>(() => {
    const kind = this.pickerKind();
    const planned = new Set(this.plans().map((p) => p.categoryId));
    const groups = this.store.groupsById();
    return this.store
      .categories()
      .filter((c) => !planned.has(c.id) && !c.archived)
      .filter((c) => (kind === 'income' ? c.kind !== 'expense' : c.kind === 'expense'))
      .map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color,
        groupName: groups.get(c.groupId)?.name ?? 'Other',
      }));
  });

  private buildGroups(filter: (plan: BudgetCategoryPlan) => boolean): PlanGroup[] {
    const categories = this.store.categoriesById();
    const groups = this.store.groupsById();
    const byGroup = new Map<string, PlanRow[]>();

    for (const plan of this.plans()) {
      if (!filter(plan)) continue;
      const category = categories.get(plan.categoryId);
      if (!category) continue;
      const rows = byGroup.get(category.groupId) ?? [];
      rows.push({
        categoryId: plan.categoryId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        plannedCents: plan.plannedCents,
      });
      byGroup.set(category.groupId, rows);
    }

    return [...byGroup.entries()]
      .map(([groupId, rows]) => {
        const group = groups.get(groupId);
        return {
          id: groupId,
          name: group?.name ?? 'Other',
          color: group?.color ?? 'var(--color-cat-misc)',
          rows,
          totalCents: rows.reduce((sum, r) => sum + r.plannedCents, 0),
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  private planKind(categoryId: string): PlanKind {
    return this.plans().find((p) => p.categoryId === categoryId)?.kind ?? 'expense';
  }

  protected share(cents: number): number {
    const total = this.plannedTotalCents();
    return total > 0 ? Math.round((cents / total) * 100) : 0;
  }

  protected display(cents: number): string {
    return this.money.fmt(cents, { decimals: cents % 100 !== 0 });
  }

  protected updatePlan(categoryId: string, raw: string): void {
    const budget = this.store.activeBudget();
    if (!budget) return;
    const cents = parseMoneyToCents(raw) ?? 0;
    this.store.saveBudget({
      ...budget,
      plans: budget.plans.map((p) =>
        p.categoryId === categoryId ? { ...p, plannedCents: Math.max(0, cents) } : p,
      ),
    });
  }

  protected openPicker(kind: PlanKind): void {
    this.pickerKind.set(kind);
  }

  protected addPlan(categoryId: string): void {
    const budget = this.store.activeBudget();
    const category = this.store.categoriesById().get(categoryId);
    if (!budget || !category) return;
    const kind: PlanKind =
      category.kind === 'income' ? 'income' : category.kind === 'transfer' ? 'savings' : 'expense';
    this.store.saveBudget({
      ...budget,
      plans: [
        ...budget.plans,
        { categoryId, plannedCents: 0, kind, expenseKind: 'variable' },
      ],
    });
    this.pickerKind.set(null);
  }
}
