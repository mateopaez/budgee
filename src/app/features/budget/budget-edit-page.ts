import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import {
  PERIOD_TYPE_OPTIONS,
  monthOptions,
  monthlyStartOptions,
  periodTypeLabel,
  semiMonthlyOptions,
  startLabelFor,
  weekdayOptions,
} from './period-options';
import type { Budget, BudgetPeriodType } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

type Picker = 'periodType' | 'periodStart' | null;
type InsightKey = 'dailyBudget' | 'breakdown' | 'projection';

const ICON_CHOICES: readonly IconName[] = [
  'home',
  'heart',
  'banknote',
  'car',
  'star',
  'cart',
  'piggy',
  'gift',
];

const INSIGHT_LABELS: Record<InsightKey, string> = {
  dailyBudget: 'Daily budget',
  breakdown: 'Budget breakdown',
  projection: 'Projection',
};

/** Editing an existing budget: appearance, period, inclusion rules and insights. */
@Component({
  selector: 'app-budget-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon, ToggleSwitch, OptionPickerSheet],
  template: `
    <app-sheet-shell title="Editing budget" (dismiss)="close()">
      @if (working(); as budget) {
        <section class="rounded-[1.5rem] bg-raised p-5">
          <h2 class="text-[1.2rem] font-semibold text-ink">Appearance</h2>
          <label class="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-sunken px-4">
            <span class="text-ink-muted" aria-hidden="true">
              <app-icon name="pencil" [size]="20" />
            </span>
            <span class="sr-only">Budget name</span>
            <input
              type="text"
              class="min-h-[3.25rem] flex-1 bg-transparent text-[1.05rem] text-ink outline-none"
              [value]="budget.name"
              (input)="patch({ name: $any($event.target).value })"
            />
          </label>

          <div class="mt-4 flex flex-wrap gap-2">
            @for (icon of icons; track icon) {
              <button
                type="button"
                class="flex size-12 items-center justify-center rounded-full"
                [style.background]="budget.icon === icon ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'var(--color-sunken)'"
                [style.color]="budget.icon === icon ? 'var(--color-accent)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="budget.icon === icon"
                [attr.aria-label]="'Icon ' + icon"
                (click)="patch({ icon })"
              >
                <app-icon [name]="icon" [size]="22" />
              </button>
            }
          </div>
        </section>

        <section class="mt-4 rounded-[1.5rem] bg-raised p-5">
          <h2 class="text-[1.2rem] font-semibold text-ink">Settings</h2>

          <button
            type="button"
            class="mt-3 flex min-h-[3.5rem] w-full items-center gap-3 text-left"
            (click)="picker.set('periodType')"
          >
            <span class="flex-1 text-[1rem] text-ink">{{ periodLabel() }}</span>
            <app-icon name="chevronRight" [size]="20" />
          </button>

          @if (startLabel(); as start) {
            <button
              type="button"
              class="flex min-h-[3.5rem] w-full items-center gap-3 border-t border-line text-left"
              (click)="picker.set('periodStart')"
            >
              <span class="flex-1 text-[1rem] text-ink">
                Starting on: <span class="text-ink-muted">{{ start.value }}</span>
              </span>
              <app-icon name="chevronRight" [size]="20" />
            </button>
          }

          <div class="flex items-start gap-4 border-t border-line py-4">
            <span class="flex-1">
              <span class="block text-[1rem] text-ink">Include all transactions</span>
              <span class="mt-1 block text-[0.85rem] leading-relaxed text-ink-muted">
                Count spending in unplanned categories as "Other expenses".
              </span>
            </span>
            <app-toggle-switch
              label="Include all transactions"
              [checked]="budget.includeAllTransactions"
              (toggle)="patch({ includeAllTransactions: $event })"
            />
          </div>

          <div class="flex items-start gap-4 border-t border-line py-4">
            <span class="flex-1">
              <span class="block text-[1rem] text-ink">Include savings transfers</span>
              <span class="mt-1 block text-[0.85rem] leading-relaxed text-ink-muted">
                Count transfers to and from savings wallets.
              </span>
            </span>
            <app-toggle-switch
              label="Include savings transfers"
              [checked]="budget.includeSavingsTransfers"
              (toggle)="patch({ includeSavingsTransfers: $event })"
            />
          </div>

          <div class="flex items-start gap-4 border-t border-line py-4">
            <span class="flex-1">
              <span class="block text-[1rem] text-ink">Include debt transfers</span>
              <span class="mt-1 block text-[0.85rem] leading-relaxed text-ink-muted">
                Count transfers to and from debt wallets.
              </span>
            </span>
            <app-toggle-switch
              label="Include debt transfers"
              [checked]="budget.includeDebtTransfers"
              (toggle)="patch({ includeDebtTransfers: $event })"
            />
          </div>
        </section>

        <section class="mt-4 rounded-[1.5rem] bg-raised p-5">
          <h2 class="text-[1.2rem] font-semibold text-ink">Members</h2>
          <p class="mt-3 flex items-center gap-3 border-b border-line pb-4 text-[1rem] text-ink">
            <span class="text-ink-muted" aria-hidden="true">
              <app-icon name="user" [size]="20" />
            </span>
            {{ ownerName() }}
          </p>
          <p class="mt-4 text-[0.88rem] leading-relaxed text-ink-muted">
            Shared budgets are not part of this release. A future version will let you invite people
            so transactions and plans stay in sync between members.
          </p>
        </section>

        <section class="mt-4 rounded-[1.5rem] bg-raised p-5">
          <h2 class="text-[1.2rem] font-semibold text-ink">Insights</h2>
          <ul class="mt-3 flex flex-col">
            @for (key of budget.insights.order; track key) {
              <li class="flex min-h-[3.5rem] items-center gap-3 border-t border-line">
                <span class="flex-1 text-[1rem] text-ink">{{ label(key) }}</span>
                <button
                  type="button"
                  class="flex size-11 items-center justify-center rounded-xl bg-sunken"
                  [style.color]="budget.insights[key] ? 'var(--color-ink)' : 'var(--color-ink-faint)'"
                  [attr.aria-pressed]="budget.insights[key]"
                  [attr.aria-label]="(budget.insights[key] ? 'Hide ' : 'Show ') + label(key)"
                  (click)="toggleInsight(key)"
                >
                  <app-icon [name]="budget.insights[key] ? 'eye' : 'eyeOff'" [size]="20" />
                </button>
                <span class="flex flex-col">
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center text-ink-muted disabled:opacity-30"
                    [disabled]="$index === 0"
                    [attr.aria-label]="'Move ' + label(key) + ' up'"
                    (click)="move(key, -1)"
                  >
                    <app-icon name="chevronUp" [size]="16" />
                  </button>
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center text-ink-muted disabled:opacity-30"
                    [disabled]="$index === budget.insights.order.length - 1"
                    [attr.aria-label]="'Move ' + label(key) + ' down'"
                    (click)="move(key, 1)"
                  >
                    <app-icon name="chevronDown" [size]="16" />
                  </button>
                </span>
              </li>
            }
          </ul>
        </section>

        <button
          type="button"
          class="mt-5 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[0.9rem] font-semibold tracking-[0.1em] text-ink uppercase"
          (click)="remove()"
        >
          Remove budget
        </button>
      }

      <div sheetFooter class="pt-4">
        <button
          type="button"
          class="min-h-[3.4rem] w-full rounded-full bg-white text-[0.95rem] font-semibold tracking-[0.1em] text-ink-inverse uppercase"
          (click)="save()"
        >
          Save
        </button>
      </div>
    </app-sheet-shell>

    @switch (picker()) {
      @case ('periodType') {
        <app-option-picker-sheet
          title="Budget period"
          [options]="periodTypes"
          [searchable]="false"
          [selected]="working()?.periodType ?? 'monthly'"
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
    }
  `,
})
export class BudgetEditPage {
  private readonly store = inject(BudgetStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);

  protected readonly icons = ICON_CHOICES;
  protected readonly periodTypes = PERIOD_TYPE_OPTIONS;
  protected readonly picker = signal<Picker>(null);

  /** Local working copy so Save is a real commit rather than a live write. */
  protected readonly working = signal<Budget | null>(this.store.activeBudget());

  protected readonly periodLabel = computed(() =>
    periodTypeLabel(this.working()?.periodType ?? 'monthly'),
  );

  protected readonly ownerName = computed(
    () => this.store.workspace()?.displayName || 'You',
  );

  protected readonly startLabel = computed(() => {
    const budget = this.working();
    if (!budget) return null;
    return startLabelFor(budget.periodType, budget);
  });

  protected readonly startOptions = computed<PickerOption[]>(() => {
    switch (this.working()?.periodType) {
      case 'weekly':
        return weekdayOptions('Every ');
      case 'biweekly':
        return weekdayOptions('Every other ');
      case 'semiMonthly':
        return semiMonthlyOptions();
      case 'yearly':
        return monthOptions();
      default:
        return monthlyStartOptions();
    }
  });

  protected readonly startSelected = computed(() => {
    const b = this.working();
    if (!b) return '';
    switch (b.periodType) {
      case 'weekly':
      case 'biweekly':
        return `${b.weekStartsOn}`;
      case 'semiMonthly':
        return b.semiMonthlyDays.join(',');
      case 'yearly':
        return `${b.yearlyStartMonth}`;
      default:
        return `${b.monthlyStartDay}`;
    }
  });

  protected label(key: InsightKey): string {
    return INSIGHT_LABELS[key];
  }

  protected patch(patch: Partial<Budget>): void {
    this.working.update((budget) => (budget ? { ...budget, ...patch } : budget));
  }

  protected setPeriodType(id: string): void {
    this.patch({ periodType: id as BudgetPeriodType });
    this.picker.set(null);
  }

  protected setStart(id: string): void {
    const type = this.working()?.periodType;
    if (type === 'weekly' || type === 'biweekly') this.patch({ weekStartsOn: Number(id) });
    else if (type === 'semiMonthly') {
      const [a, b] = id.split(',').map(Number);
      this.patch({ semiMonthlyDays: [a, b] });
    } else if (type === 'yearly') this.patch({ yearlyStartMonth: Number(id) });
    else this.patch({ monthlyStartDay: Number(id) });
    this.picker.set(null);
  }

  protected toggleInsight(key: InsightKey): void {
    const budget = this.working();
    if (!budget) return;
    this.patch({ insights: { ...budget.insights, [key]: !budget.insights[key] } });
  }

  protected move(key: InsightKey, delta: number): void {
    const budget = this.working();
    if (!budget) return;
    const order = [...budget.insights.order];
    const index = order.indexOf(key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.patch({ insights: { ...budget.insights, order } });
  }

  protected save(): void {
    const budget = this.working();
    if (!budget) return;
    this.store.saveBudget(budget);
    this.close();
  }

  protected async remove(): Promise<void> {
    const budget = this.working();
    if (!budget) return;
    const confirmed = await this.confirm.ask({
      title: `Remove ${budget.name}?`,
      message:
        'The plan and its category amounts are deleted. Your transactions stay exactly where they are.',
      confirmLabel: 'Remove budget',
    });
    if (!confirmed) return;
    this.store.deleteBudget(budget.id);
    void this.router.navigateByUrl('/budget');
  }

  protected close(): void {
    void this.router.navigateByUrl('/budget');
  }
}
