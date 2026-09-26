import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { DonutChart, type DonutSegment } from '../../shared/charts/donut-chart';
import { CategoryMark } from '../../shared/ui/category-mark';
import { Icon } from '../../shared/ui/icon';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import {
  blankCategory,
  CATEGORY_PALETTE,
  CategoryEditorSheet,
} from '../../shared/ui/category-editor-sheet';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { parseMoneyToCents } from '../../core/util/currency.util';
import { createId } from '../../core/util/id.util';
import type {
  BudgetCategoryPlan,
  Category,
  CategoryGroup,
  CategoryKind,
  PlanKind,
} from '../../core/models';
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

type PlanPicker =
  | { readonly mode: 'category'; readonly kind: PlanKind; readonly groupId: string | null }
  | { readonly mode: 'group' };

/** Plan tab: what each category is allowed this period, and the shape of the plan. */
@Component({
  selector: 'app-budget-plan-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PeriodSelector,
    DonutChart,
    CategoryMark,
    Icon,
    SheetShell,
    OptionPickerSheet,
    CategoryEditorSheet,
  ],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    <app-period-selector [label]="periodLabel()" (step)="store.stepPeriod($event)" />

    @if (allGroups().length === 0) {
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
        <div class="flex items-center gap-2">
          <h2 class="min-w-0 flex-1 truncate text-[1.2rem] font-semibold text-ink">{{ group.name }}</h2>
          <button
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
            [attr.aria-label]="'Edit ' + group.name"
            (click)="startEditGroup(group.id)"
          >
            <app-icon name="pencil" [size]="18" />
          </button>
        </div>
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
    } @else {
      <button
        type="button"
        class="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-[1.5rem] bg-raised text-[1rem] font-semibold text-ink"
        (click)="openGroupPicker()"
      >
        <app-icon name="plus" [size]="20" />
        Add a group
      </button>
    }

    @if (groupDraft(); as group) {
      <app-sheet-shell
        [title]="groupIsNew() ? 'New group' : 'Edit group'"
        (dismiss)="dismissGroup()"
      >
        @if (!groupIsNew()) {
          <section class="rounded-[1.25rem] bg-raised">
            <h2 class="px-4 pt-4 text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Categories
            </h2>
            <button
              type="button"
              class="mt-1 flex min-h-[3.5rem] w-full items-center gap-3 border-b border-line px-4 text-left"
              (click)="addCategoryToGroup()"
            >
              <span
                class="flex size-9 items-center justify-center rounded-full bg-sunken text-ink"
                aria-hidden="true"
              >
                <app-icon name="plus" [size]="18" />
              </span>
              <span class="text-[1rem] text-ink">Add category</span>
            </button>
            <ul>
              @for (row of draftCategories(); track row.categoryId) {
                <li class="flex min-h-[3.5rem] items-center gap-3 border-b border-line px-4 last:border-b-0">
                  <app-category-mark [icon]="row.icon" [color]="row.color" [size]="36" [solid]="true" />
                  <span class="min-w-0 flex-1 truncate text-[1rem] text-ink">{{ row.name }}</span>
                  <button
                    type="button"
                    class="min-h-11 shrink-0 px-2 text-[0.9rem] font-semibold"
                    style="color: #ffa9ac"
                    (click)="removePlan(row.categoryId, row.name)"
                  >
                    Remove
                  </button>
                </li>
              } @empty {
                <li class="px-4 pt-3 text-[0.95rem] text-ink-muted">
                  Nothing in this group is on the plan.
                </li>
              }
            </ul>
          </section>
        }

        <label class="mt-4 block rounded-[1.25rem] bg-raised px-4 py-3">
          <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Name
          </span>
          <input
            type="text"
            class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
            [value]="group.name"
            [attr.aria-invalid]="groupError() ? true : null"
            [attr.aria-describedby]="groupError() ? 'plan-group-name-error' : null"
            (input)="onGroupName($event)"
          />
        </label>

        @if (groupError()) {
          <p
            id="plan-group-name-error"
            role="alert"
            class="mt-2 text-[0.9rem] text-[color:var(--color-negative)]"
          >
            {{ groupError() }}
          </p>
        }

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Colour
          </legend>
          <div class="mt-2 flex flex-wrap gap-3">
            @for (color of palette; track color) {
              <button
                type="button"
                class="size-11 rounded-full border-2"
                [style.background]="color"
                [style.border-color]="group.color === color ? 'var(--color-ink)' : 'transparent'"
                [attr.aria-pressed]="group.color === color"
                [attr.aria-label]="'Colour ' + ($index + 1)"
                (click)="patchGroup({ color })"
              ></button>
            }
          </div>
        </fieldset>

        @if (!groupIsNew()) {
          <button
            type="button"
            class="mt-6 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[0.95rem] font-semibold"
            style="color: #ffa9ac"
            (click)="removeGroupFromPlan(group.id)"
          >
            Remove from plan
          </button>
        }

        <div sheetFooter class="pt-4">
          <button
            type="button"
            class="min-h-[3.4rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse"
            (click)="saveGroup()"
          >
            Save
          </button>
        </div>
      </app-sheet-shell>
    }

    @if (picker()) {
      <app-option-picker-sheet
        [title]="pickerTitle()"
        [options]="pickerOptions()"
        [emptyLabel]="pickerEmptyLabel()"
        [actionLabel]="pickerActionLabel()"
        (choose)="onPickerChoose($event)"
        (action)="onPickerAction()"
        (cancel)="picker.set(null)"
      />
    }

    @if (newCategory(); as category) {
      <app-category-editor-sheet
        [category]="category"
        [isNew]="true"
        [lockKind]="true"
        [lockGroup]="true"
        (saved)="saveNewCategory($event)"
        (dismissed)="newCategory.set(null)"
      />
    }
  `,
})
export class BudgetPlanTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  private readonly confirm = inject(ConfirmService);
  protected readonly Math = Math;
  protected readonly palette = CATEGORY_PALETTE;

  /** Category picker is scoped to one group. Group picker adds a group that is not on the plan yet. */
  protected readonly picker = signal<PlanPicker | null>(null);
  protected readonly newCategory = signal<Category | null>(null);
  protected readonly groupDraft = signal<CategoryGroup | null>(null);
  protected readonly groupIsNew = signal(false);
  protected readonly groupError = signal<string | null>(null);

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
  protected readonly allGroups = computed(() => this.buildGroups(() => true));

  /** Categories currently planned in the group open for editing. */
  protected readonly draftCategories = computed(() => {
    const draft = this.groupDraft();
    if (!draft) return [];
    return this.allGroups().find((group) => group.id === draft.id)?.rows ?? [];
  });

  protected readonly segments = computed<DonutSegment[]>(() =>
    this.outflowGroups().map((g) => ({
      id: g.id,
      label: g.name,
      value: g.totalCents,
      color: g.color,
    })),
  );

  protected readonly pickerTitle = computed(() => {
    const target = this.picker();
    if (!target) return 'Categories';
    if (target.mode === 'group') return 'Add a group';
    if (target.groupId) return this.store.groupsById().get(target.groupId)?.name ?? 'Categories';
    return target.kind === 'income' ? 'Income categories' : 'Categories';
  });

  protected readonly pickerEmptyLabel = computed(() => {
    const target = this.picker();
    if (target?.mode === 'group') return 'Every group is already on this plan.';
    if (target?.mode === 'category' && target.groupId) {
      return 'Every category in this group is already on the plan.';
    }
    return 'Nothing to choose.';
  });

  protected readonly pickerActionLabel = computed(() => {
    const target = this.picker();
    if (!target) return null;
    if (target.mode === 'group') return 'New group';
    return target.groupId ? 'Create a category' : null;
  });

  protected readonly pickerOptions = computed<PickerOption[]>(() => {
    const target = this.picker();
    if (!target) return [];
    if (target.mode === 'group') {
      const onPlan = new Set(this.allGroups().map((group) => group.id));
      return this.store
        .groups()
        .filter((group) => !onPlan.has(group.id))
        .map((group) => ({
          id: group.id,
          label: group.name,
          icon: 'folder' as const,
          color: group.color,
        }));
    }
    const planned = new Set(this.plans().map((p) => p.categoryId));
    const groups = this.store.groupsById();
    return this.store
      .categories()
      .filter((c) => !planned.has(c.id) && !c.archived)
      .filter((c) => (target.groupId ? c.groupId === target.groupId : this.matchesKind(c.kind, target.kind)))
      .map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color,
        groupName: target.groupId ? undefined : (groups.get(c.groupId)?.name ?? 'Other'),
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

  protected async removePlan(categoryId: string, name: string): Promise<void> {
    const budget = this.store.activeBudget();
    if (!budget) return;
    const confirmed = await this.confirm.ask({
      title: `Remove ${name}?`,
      message: 'It leaves this plan. The category stays available for transactions.',
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;
    this.store.saveBudget({
      ...budget,
      plans: budget.plans.filter((plan) => plan.categoryId !== categoryId),
    });
  }

  protected openPicker(kind: PlanKind, groupId: string | null = null): void {
    this.picker.set({ mode: 'category', kind, groupId });
  }

  protected openGroupPicker(): void {
    this.picker.set({ mode: 'group' });
  }

  /** Opens the category chooser for the group currently being edited. */
  protected addCategoryToGroup(): void {
    const draft = this.groupDraft();
    if (!draft || this.groupIsNew()) return;
    this.openPicker(this.sectionKindFor(draft.id), draft.id);
  }

  protected onPickerChoose(id: string): void {
    const target = this.picker();
    if (!target) return;
    if (target.mode === 'group') {
      this.openPicker(this.sectionKindFor(id), id);
      return;
    }
    this.addPlan(id);
  }

  protected onPickerAction(): void {
    const target = this.picker();
    if (!target) return;
    if (target.mode === 'group') {
      this.startNewGroup();
      return;
    }
    this.startCreateCategory();
  }

  protected startEditGroup(groupId: string): void {
    const group = this.store.groupsById().get(groupId);
    if (!group) return;
    this.groupError.set(null);
    this.groupIsNew.set(false);
    this.groupDraft.set(group);
  }

  protected startNewGroup(): void {
    const groups = this.store.groups();
    this.picker.set(null);
    this.groupError.set(null);
    this.groupIsNew.set(true);
    this.groupDraft.set({
      id: createId('grp'),
      name: '',
      color: CATEGORY_PALETTE[groups.length % CATEGORY_PALETTE.length],
      order: groups.reduce((max, group) => Math.max(max, group.order), 0) + 1,
    });
  }

  protected dismissGroup(): void {
    this.groupDraft.set(null);
    this.groupError.set(null);
  }

  protected onGroupName(event: Event): void {
    const name = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.groupError.set(null);
    this.patchGroup({ name });
  }

  protected patchGroup(patch: Partial<CategoryGroup>): void {
    this.groupDraft.update((group) => (group ? { ...group, ...patch } : group));
  }

  protected saveGroup(): void {
    const draft = this.groupDraft();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      this.groupError.set('Give the group a name.');
      return;
    }
    const duplicate = this.store.groups().some(
      (group) =>
        group.id !== draft.id &&
        group.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
    );
    if (duplicate) {
      this.groupError.set('A group with that name already exists.');
      return;
    }
    const group = { ...draft, name };
    const isNew = this.groupIsNew();
    this.store.upsertGroup(group);
    this.dismissGroup();
    if (isNew) this.openPicker(this.sectionKindFor(group.id), group.id);
  }

  protected async removeGroupFromPlan(groupId: string): Promise<void> {
    const budget = this.store.activeBudget();
    const name = this.store.groupsById().get(groupId)?.name ?? 'This group';
    if (!budget) return;
    const categoryIds = new Set(
      this.store.categories().filter((category) => category.groupId === groupId).map((category) => category.id),
    );
    const confirmed = await this.confirm.ask({
      title: `Remove ${name}?`,
      message: 'Its categories leave this plan. They stay available for transactions.',
      confirmLabel: 'Remove from plan',
    });
    if (!confirmed) return;
    this.store.saveBudget({
      ...budget,
      plans: budget.plans.filter((plan) => !categoryIds.has(plan.categoryId)),
    });
    this.dismissGroup();
  }

  protected startCreateCategory(): void {
    const target = this.picker();
    if (!target || target.mode !== 'category' || !target.groupId) return;
    const group = this.store.groupsById().get(target.groupId);
    this.newCategory.set({
      ...blankCategory(target.groupId, this.categoryKindFor(target.groupId, target.kind)),
      color: group?.color ?? 'var(--color-cat-misc)',
    });
  }

  protected saveNewCategory(category: Category): void {
    this.store.upsertCategory(category);
    this.newCategory.set(null);
    this.addPlan(category.id);
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
    this.picker.set(null);
  }

  /** Income sections are groups whose categories are not expenses. A new empty group is an expense group. */
  private sectionKindFor(groupId: string): PlanKind {
    const inGroup = this.store.categories().filter((category) => category.groupId === groupId && !category.archived);
    if (inGroup.length > 0 && inGroup.every((category) => category.kind !== 'expense')) return 'income';
    return 'expense';
  }

  /** Categories already in the group decide the kind of a category created from that section. */
  private categoryKindFor(groupId: string, sectionKind: PlanKind): CategoryKind {
    if (sectionKind === 'income') return 'income';
    const inGroup = this.store.categories().filter((c) => c.groupId === groupId && !c.archived);
    if (inGroup.length > 0 && inGroup.every((c) => c.kind !== 'expense')) return 'income';
    return 'expense';
  }

  private matchesKind(categoryKind: CategoryKind, sectionKind: PlanKind): boolean {
    return sectionKind === 'income' ? categoryKind !== 'expense' : categoryKind === 'expense';
  }
}
