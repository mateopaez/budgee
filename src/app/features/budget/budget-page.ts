import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccentHeader } from '../../shared/ui/accent-header';
import { SegmentedTabs, type SegmentOption } from '../../shared/ui/segmented-tabs';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';
import { BudgetPlanTab } from './budget-plan-tab';
import { BudgetRemainingTab } from './budget-remaining-tab';
import { BudgetInsightsTab } from './budget-insights-tab';

type TabId = 'plan' | 'remaining' | 'insights';

/** Budget shell with the Plan, Remaining and Insights tabs. */
@Component({
  selector: 'app-budget-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccentHeader,
    SegmentedTabs,
    Icon,
    RouterLink,
    BudgetPlanTab,
    BudgetRemainingTab,
    BudgetInsightsTab,
  ],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    @if (!hasBudget()) {
      <section
        class="flex flex-1 flex-col px-5"
        style="padding-top: calc(var(--safe-top) + 2rem); padding-bottom: var(--nav-clearance)"
      >
        <div
          aria-hidden="true"
          class="flex h-56 items-center justify-center rounded-[1.75rem]"
          style="background: var(--accent-gradient)"
        >
          <span
            class="flex size-24 items-center justify-center rounded-full bg-white/20 text-white"
          >
            <app-icon name="pie" [size]="46" [strokeWidth]="1.6" />
          </span>
        </div>
        <h1 class="mt-8 text-center text-[2rem] leading-tight font-bold text-ink">
          Build your perfect budget
        </h1>
        <p class="mt-3 text-center text-[1rem] leading-relaxed text-ink-muted">
          Decide what each category gets this period, then let Budgee keep score.
        </p>

        <h2 class="mt-10 text-center text-[1.05rem] font-semibold text-ink">Choose setup</h2>
        <a
          routerLink="/budget/create"
          class="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-raised px-5 py-5"
        >
          <span class="flex-1">
            <span class="block text-[1.05rem] font-semibold text-ink">Guided setup</span>
            <span class="mt-0.5 block text-[0.9rem] text-ink-muted">
              Name, period, income, then categories
            </span>
          </span>
          <app-icon name="chevronRight" [size]="22" />
        </a>
      </section>
    } @else {
      <app-accent-header>
        <a
          headerLeading
          routerLink="/settings"
          class="flex size-11 items-center justify-center rounded-full bg-white/18 text-white"
          aria-label="Settings"
        >
          <app-icon name="gear" [size]="20" />
        </a>
        <p headerTitle class="truncate text-[1.05rem] text-white/85">
          Budget: <span class="font-semibold text-white">{{ budgetName() }}</span>
        </p>
        <a
          headerTrailing
          routerLink="/budget/edit"
          class="flex size-11 items-center justify-center rounded-full bg-white/18 text-white"
          aria-label="Edit budget"
        >
          <app-icon name="pencil" [size]="20" />
        </a>

        <app-segmented-tabs
          [options]="tabs"
          [selected]="tab()"
          ariaLabel="Budget sections"
          (select)="setTab($event)"
        />
      </app-accent-header>

      <div
        class="flex-1 px-4 pt-3"
        style="padding-bottom: var(--nav-clearance)"
        role="tabpanel"
        [attr.aria-labelledby]="'tab-' + tab()"
      >
        @switch (tab()) {
          @case ('plan') {
            <app-budget-plan-tab />
          }
          @case ('remaining') {
            <app-budget-remaining-tab />
          }
          @case ('insights') {
            <app-budget-insights-tab />
          }
        }
      </div>
    }
  `,
})
export class BudgetPage {
  private readonly store = inject(BudgetStore);

  protected readonly tabs: SegmentOption[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'remaining', label: 'Remaining' },
    { id: 'insights', label: 'Insights' },
  ];

  protected readonly tab = signal<TabId>('plan');
  protected readonly hasBudget = this.store.hasBudget;
  protected readonly budgetName = computed(() => this.store.activeBudget()?.name ?? '');

  protected setTab(id: string): void {
    this.tab.set(id as TabId);
  }
}
