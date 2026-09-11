import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccentHeader } from '../../shared/ui/accent-header';
import { SegmentedTabs, type SegmentOption } from '../../shared/ui/segmented-tabs';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';
import { OverviewTab } from './overview-tab';
import { SpendingTab } from './spending-tab';
import { ListTab } from './list-tab';

type TabId = 'overview' | 'spending' | 'list';

/**
 * Overview shell. All three tabs read the same store signals, so a transaction
 * edit updates every one of them at once.
 */
@Component({
  selector: 'app-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccentHeader, SegmentedTabs, Icon, RouterLink, OverviewTab, SpendingTab, ListTab],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
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
        Overview: <span class="font-semibold text-white">{{ budgetName() }}</span>
      </p>
      <a
        headerTrailing
        routerLink="/budget"
        class="flex size-11 items-center justify-center rounded-full bg-white/18 text-white"
        aria-label="Open budget"
      >
        <app-icon name="pie" [size]="20" />
      </a>

      <app-segmented-tabs
        [options]="tabs"
        [selected]="tab()"
        ariaLabel="Overview sections"
        (select)="setTab($event)"
      />
    </app-accent-header>

    <div
      class="flex-1 px-4 pt-3"
      style="padding-bottom: var(--nav-clearance)"
      [attr.role]="'tabpanel'"
      [attr.aria-labelledby]="'tab-' + tab()"
    >
      @switch (tab()) {
        @case ('overview') {
          <app-overview-tab />
        }
        @case ('spending') {
          <app-spending-tab />
        }
        @case ('list') {
          <app-list-tab />
        }
      }
    </div>
  `,
})
export class OverviewPage {
  private readonly store = inject(BudgetStore);

  protected readonly tabs: SegmentOption[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'spending', label: 'Spending' },
    { id: 'list', label: 'List' },
  ];

  protected readonly tab = signal<TabId>('overview');
  protected readonly budgetName = computed(() => this.store.activeBudget()?.name ?? 'No budget');

  protected setTab(id: string): void {
    this.tab.set(id as TabId);
  }
}
