import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AccentHeader } from '../../shared/ui/accent-header';
import { SegmentedTabs, type SegmentOption } from '../../shared/ui/segmented-tabs';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';
import { OverviewTab } from './overview-tab';
import { SpendingTab } from './spending-tab';
import { ListTab } from './list-tab';

type TabId = 'overview' | 'spending' | 'list';

const TAB_IDS: readonly TabId[] = ['overview', 'spending', 'list'];

/**
 * Overview shell. All three tabs read the same store signals, so a transaction
 * edit updates every one of them at once.
 *
 * The open tab lives in the `tab` query parameter, so returning from the
 * transaction editor lands back on the tab the user started from.
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
        title="Settings"
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
        aria-label="Switch to Budget"
        title="Switch to Budget"
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs: SegmentOption[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'spending', label: 'Spending' },
    { id: 'list', label: 'List' },
  ];

  protected readonly tab = toSignal(
    this.route.queryParamMap.pipe(map((params) => toTabId(params.get('tab')))),
    { initialValue: toTabId(this.route.snapshot.queryParamMap.get('tab')) },
  );
  protected readonly budgetName = computed(() => this.store.activeBudget()?.name ?? 'No budget');

  protected setTab(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'overview' ? null : id },
      replaceUrl: true,
    });
  }
}

function toTabId(value: string | null): TabId {
  return TAB_IDS.find((id) => id === value) ?? 'overview';
}
