import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { CategoryMark } from '../../shared/ui/category-mark';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { BudgetDraftService } from './budget-draft.service';
import {
  PERIOD_TYPE_OPTIONS,
  monthOptions,
  monthlyStartOptions,
  periodTypeLabel,
  semiMonthlyOptions,
  startLabelFor,
  weekdayOptions,
} from './period-options';
import { createId } from '../../core/util/id.util';
import { parseMoneyToCents } from '../../core/util/currency.util';
import { startOfWeek } from '../../core/util/date.util';
import type { Budget, BudgetCategoryPlan, BudgetPeriodType } from '../../core/models';

type Picker = 'periodType' | 'periodStart' | 'income' | 'category' | null;

const ICON_CHOICES = ['home', 'heart', 'banknote', 'car', 'star', 'cart', 'piggy', 'gift'] as const;

/**
 * Three step budget creation. The draft is kept in a service so leaving the
 * flow and coming back does not lose what was entered.
 */
@Component({
  selector: 'app-budget-create-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon, CategoryMark, OptionPickerSheet],
  template: `
    <app-sheet-shell
      [title]="stepTitle()"
      [backVariant]="step() > 0"
      (dismiss)="back()"
    >
      @switch (step()) {
        @case (0) {
          <div class="flex flex-col items-center pt-2 text-center">
            <span
              class="flex size-24 items-center justify-center rounded-full"
              style="background: var(--accent-gradient); color: var(--color-accent-ink)"
              aria-hidden="true"
            >
              <app-icon name="pie" [size]="42" [strokeWidth]="1.7" />
            </span>
            <h2 class="mt-6 text-[1.7rem] leading-tight font-bold text-ink">
              Start with the basics
            </h2>
            <p class="mt-2 text-[0.98rem] leading-relaxed text-ink-muted">
              We recommend using the same budget period as your regular income.
            </p>
          </div>

          <div class="mt-7 flex flex-col gap-3">
            <label class="block rounded-[1.25rem] bg-sunken px-4 py-3">
              <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
                Name
              </span>
              <input
                type="text"
                class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
                [value]="draft().name"
                (input)="drafts.patch({ name: $any($event.target).value })"
              />
            </label>

            <button
              type="button"
              class="rounded-[1.25rem] bg-sunken px-4 py-3 text-left"
              (click)="picker.set('periodType')"
            >
              <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
                Budget period
              </span>
              <span class="mt-1 block text-[1.1rem] text-ink">{{ periodLabel() }}</span>
            </button>

            @if (startLabel(); as start) {
              <button
                type="button"
                class="rounded-[1.25rem] bg-sunken px-4 py-3 text-left"
                (click)="picker.set('periodStart')"
              >
                <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
                  {{ start.title }}
                </span>
                <span class="mt-1 block text-[1.1rem] text-ink">{{ start.value }}</span>
              </button>
            }

            <div class="rounded-[1.25rem] bg-sunken px-4 py-4">
              <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
                Icon
              </span>
              <div class="mt-3 flex flex-wrap gap-2">
                @for (icon of icons; track icon) {
                  <button
                    type="button"
                    class="flex size-12 items-center justify-center rounded-full border transition-colors"
                    [style.border-color]="draft().icon === icon ? 'var(--color-accent)' : 'transparent'"
                    [style.background]="draft().icon === icon ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'var(--color-raised)'"
                    [style.color]="draft().icon === icon ? 'var(--color-accent)' : 'var(--color-ink-muted)'"
                    [attr.aria-pressed]="draft().icon === icon"
                    [attr.aria-label]="'Icon ' + icon"
                    (click)="drafts.patch({ icon })"
                  >
                    <app-icon [name]="icon" [size]="22" />
                  </button>
                }
              </div>
            </div>
          </div>
        }

        @case (1) {
          <div class="pt-2 text-center">
            <h2 class="text-[1.7rem] font-bold text-ink">Income</h2>
            <p class="mt-2 text-[0.98rem] leading-relaxed text-ink-muted">
              Your regular income is the amount you have to budget for. An estimate is fine, you can
              update it later.
            </p>
          </div>

          <ul class="mt-6 flex flex-col">
            @for (income of draft().incomes; track income.categoryId) {
              <li class="flex min-h-[4rem] items-center gap-3 border-b border-line">
                <app-category-mark
                  [icon]="categoryIcon(income.categoryId)"
                  [color]="categoryColor(income.categoryId)"
                  [size]="40"
                  [solid]="true"
                />
                <span class="min-w-0 flex-1 truncate text-[1rem] text-ink">
                  {{ categoryName(income.categoryId) }}
                </span>
                <label class="sr-only" [attr.for]="'income-' + income.categoryId">
                  Planned amount for {{ categoryName(income.categoryId) }}
                </label>
                <input
                  [id]="'income-' + income.categoryId"
                  type="text"
                  inputmode="decimal"
                  class="min-h-[2.75rem] w-[6.5rem] rounded-xl bg-sunken px-3 text-right text-[1rem] font-semibold text-ink outline-none"
                  [value]="income.amount"
                  (change)="setIncome(income.categoryId, $any($event.target).value)"
                />
                <button
                  type="button"
                  class="flex size-10 items-center justify-center rounded-full text-ink-muted"
                  [attr.aria-label]="'Remove ' + categoryName(income.categoryId)"
                  (click)="removeIncome(income.categoryId)"
                >
                  <app-icon name="x" [size]="18" />
                </button>
              </li>
            }
            <li>
              <button
                type="button"
                class="flex min-h-[4rem] w-full items-center gap-3 text-left"
                (click)="picker.set('income')"
              >
                <span
                  class="flex size-10 items-center justify-center rounded-full bg-sunken text-ink"
                  aria-hidden="true"
                >
                  <app-icon name="plus" [size]="20" />
                </span>
                <span class="text-[1rem] text-ink">Add another income</span>
              </button>
            </li>
          </ul>

          <p class="mt-6 rounded-[1.25rem] bg-sunken px-4 py-4 text-[0.92rem] leading-relaxed text-ink-muted">
            If you want to budget using only expenses, go ahead and skip this step.
          </p>
        }

        @case (2) {
          <div class="pt-2 text-center">
            <h2 class="text-[1.7rem] font-bold text-ink">Choose categories</h2>
            <p class="mt-2 text-[0.98rem] leading-relaxed text-ink-muted">
              Pick the expenses you want to plan for. You can set the amounts right after.
            </p>
          </div>

          @for (group of categoryGroups(); track group.id) {
            <h3 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              {{ group.name }}
            </h3>
            <div class="grid grid-cols-4 gap-3">
              @for (category of group.categories; track category.id) {
                <button
                  type="button"
                  class="flex flex-col items-center gap-1.5 rounded-[1rem] px-1 py-2"
                  [class.bg-raised]="isChosen(category.id)"
                  [attr.aria-pressed]="isChosen(category.id)"
                  (click)="toggleCategory(category.id)"
                >
                  <app-category-mark
                    [icon]="category.icon"
                    [color]="category.color"
                    [size]="48"
                    [solid]="isChosen(category.id)"
                  />
                  <span class="text-center text-[0.7rem] leading-tight text-ink">
                    {{ category.name }}
                  </span>
                </button>
              }
            </div>
          }

          @if (error()) {
            <p role="alert" class="mt-6 text-center text-[0.9rem] text-[color:var(--color-negative)]">
              {{ error() }}
            </p>
          }
        }
      }

      <div sheetFooter class="pt-4">
        <button
          type="button"
          class="min-h-[3.4rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse"
          (click)="next()"
        >
          {{ step() === 2 ? 'Create budget' : 'Continue' }}
        </button>
      </div>
    </app-sheet-shell>

    @switch (picker()) {
      @case ('periodType') {
        <app-option-picker-sheet
          title="Budget period"
          [options]="periodTypes"
          [searchable]="false"
          [selected]="draft().periodType"
          (choose)="setPeriodType($event)"
          (cancel)="picker.set(null)"
        />
      }
      @case ('periodStart') {
        <app-option-picker-sheet
          [title]="startLabel()?.title ?? 'Start'"
          [options]="startOptions()"
          [searchable]="false"
          [selected]="startSelected()"
          (choose)="setStart($event)"
          (cancel)="picker.set(null)"
        />
      }
      @case ('income') {
        <app-option-picker-sheet
          title="Income categories"
          [options]="incomeOptions()"
          (choose)="addIncome($event)"
          (cancel)="picker.set(null)"
        />
      }
    }
  `,
})
export class BudgetCreatePage {
  private readonly store = inject(BudgetStore);
  protected readonly drafts = inject(BudgetDraftService);
  private readonly router = inject(Router);

  protected readonly picker = signal<Picker>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly icons = ICON_CHOICES;
  protected readonly periodTypes = PERIOD_TYPE_OPTIONS;

  protected readonly draft = this.drafts.draft;
  protected readonly step = this.drafts.step;

  protected readonly stepTitle = computed(
    () => ['Create a budget', 'Income', 'Categories'][this.step()] ?? 'Create a budget',
  );

  protected readonly periodLabel = computed(() => periodTypeLabel(this.draft().periodType));

  protected readonly startLabel = computed(() =>
    startLabelFor(this.draft().periodType, {
      monthlyStartDay: this.draft().monthlyStartDay,
      weekStartsOn: this.draft().weekStartsOn,
      semiMonthlyDays: this.draft().semiMonthlyDays,
      yearlyStartMonth: this.draft().yearlyStartMonth,
    }),
  );

  protected readonly startOptions = computed<PickerOption[]>(() => {
    switch (this.draft().periodType) {
      case 'monthly':
        return monthlyStartOptions();
      case 'weekly':
        return weekdayOptions('Every ');
      case 'biweekly':
        return weekdayOptions('Every other ');
      case 'semiMonthly':
        return semiMonthlyOptions();
      case 'yearly':
        return monthOptions();
    }
  });

  protected readonly startSelected = computed(() => {
    const d = this.draft();
    switch (d.periodType) {
      case 'monthly':
        return `${d.monthlyStartDay}`;
      case 'weekly':
      case 'biweekly':
        return `${d.weekStartsOn}`;
      case 'semiMonthly':
        return d.semiMonthlyDays.join(',');
      case 'yearly':
        return `${d.yearlyStartMonth}`;
    }
  });

  protected readonly incomeOptions = computed<PickerOption[]>(() => {
    const chosen = new Set(this.draft().incomes.map((i) => i.categoryId));
    return this.store
      .categories()
      .filter((c) => c.kind !== 'expense' && !chosen.has(c.id))
      .map((c) => ({ id: c.id, label: c.name, icon: c.icon, color: c.color }));
  });

  protected readonly categoryGroups = computed(() => {
    const categories = this.store.categories().filter((c) => c.kind === 'expense' && !c.archived);
    return this.store
      .groups()
      .map((group) => ({
        id: group.id,
        name: group.name,
        categories: categories.filter((c) => c.groupId === group.id),
      }))
      .filter((g) => g.categories.length > 0);
  });

  protected categoryName(id: string): string {
    return this.store.categoriesById().get(id)?.name ?? 'Category';
  }

  protected categoryIcon(id: string) {
    return this.store.categoriesById().get(id)?.icon ?? 'banknote';
  }

  protected categoryColor(id: string): string {
    return this.store.categoriesById().get(id)?.color ?? 'var(--color-cat-income)';
  }

  protected isChosen(id: string): boolean {
    return this.draft().categoryIds.includes(id);
  }

  protected setPeriodType(id: string): void {
    this.drafts.patch({ periodType: id as BudgetPeriodType });
    this.picker.set(null);
  }

  protected setStart(id: string): void {
    const type = this.draft().periodType;
    if (type === 'monthly') this.drafts.patch({ monthlyStartDay: Number(id) });
    else if (type === 'weekly' || type === 'biweekly') this.drafts.patch({ weekStartsOn: Number(id) });
    else if (type === 'semiMonthly') {
      const [a, b] = id.split(',').map(Number);
      this.drafts.patch({ semiMonthlyDays: [a, b] });
    } else this.drafts.patch({ yearlyStartMonth: Number(id) });
    this.picker.set(null);
  }

  protected addIncome(categoryId: string): void {
    this.drafts.patch({
      incomes: [...this.draft().incomes, { categoryId, amount: '0' }],
    });
    this.picker.set(null);
  }

  protected setIncome(categoryId: string, amount: string): void {
    this.drafts.patch({
      incomes: this.draft().incomes.map((i) => (i.categoryId === categoryId ? { ...i, amount } : i)),
    });
  }

  protected removeIncome(categoryId: string): void {
    this.drafts.patch({
      incomes: this.draft().incomes.filter((i) => i.categoryId !== categoryId),
    });
  }

  protected toggleCategory(id: string): void {
    const current = this.draft().categoryIds;
    this.drafts.patch({
      categoryIds: current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    });
  }

  protected next(): void {
    const step = this.step();
    if (step === 0) {
      if (!this.draft().name.trim()) {
        this.drafts.patch({ name: 'My budget' });
      }
      this.drafts.patch({ step: 1 });
      return;
    }
    if (step === 1) {
      this.drafts.patch({ step: 2 });
      return;
    }
    this.create();
  }

  protected back(): void {
    if (this.step() > 0) {
      this.drafts.patch({ step: this.step() - 1 });
      return;
    }
    void this.router.navigateByUrl('/budget');
  }

  private create(): void {
    const d = this.draft();
    if (d.categoryIds.length === 0 && d.incomes.length === 0) {
      this.error.set('Choose at least one category or income before creating the budget.');
      return;
    }

    const categories = this.store.categoriesById();
    const plans: BudgetCategoryPlan[] = [
      ...d.incomes.map((income) => {
        const category = categories.get(income.categoryId);
        const kind = category?.kind === 'transfer' ? 'savings' : 'income';
        return {
          categoryId: income.categoryId,
          plannedCents: Math.max(0, parseMoneyToCents(income.amount) ?? 0),
          kind,
          expenseKind: 'variable',
        } satisfies BudgetCategoryPlan;
      }),
      ...d.categoryIds.map(
        (categoryId) =>
          ({
            categoryId,
            plannedCents: 0,
            kind: 'expense',
            expenseKind: 'variable',
          }) satisfies BudgetCategoryPlan,
      ),
    ];

    const budget: Budget = {
      id: createId('bud'),
      name: d.name.trim() || 'My budget',
      icon: d.icon,
      periodType: d.periodType,
      monthlyStartDay: d.monthlyStartDay,
      weekStartsOn: d.weekStartsOn,
      biweeklyAnchor: startOfWeek(this.store.today(), d.weekStartsOn),
      semiMonthlyDays: d.semiMonthlyDays,
      yearlyStartMonth: d.yearlyStartMonth,
      yearlyStartDay: 1,
      includeAllTransactions: true,
      includeSavingsTransfers: true,
      includeDebtTransfers: false,
      insights: {
        dailyBudget: true,
        breakdown: true,
        projection: true,
        order: ['dailyBudget', 'breakdown', 'projection'],
      },
      plans,
      createdAt: new Date().toISOString(),
    };

    this.store.saveBudget(budget);
    this.store.setActiveBudget(budget.id);
    this.drafts.reset();
    void this.router.navigateByUrl('/budget');
  }
}
