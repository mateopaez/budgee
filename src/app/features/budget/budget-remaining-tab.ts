import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { PeriodSelector } from '../../shared/ui/period-selector';
import { DonutChart, type DonutSegment } from '../../shared/charts/donut-chart';
import { ProgressRing } from '../../shared/charts/progress-ring';
import type { IconName } from '../../shared/ui/icon-set';

/** Remaining tab: how much of each plan is still available in this period. */
@Component({
  selector: 'app-budget-remaining-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelector, DonutChart, ProgressRing],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    @if (summary(); as s) {
      <section class="rounded-[1.5rem] bg-raised p-5">
        <app-donut-chart
          [segments]="segments()"
          [size]="220"
          [thickness]="18"
          ariaLabel="Spending so far by group"
        >
          <span
            class="text-[2.2rem] leading-none font-bold"
            [style.color]="s.leftToSpendCents < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
          >
            {{ money.summary(Math.abs(s.leftToSpendCents)) }}
          </span>
          <span class="mt-1 text-[0.68rem] tracking-[0.16em] text-ink-muted uppercase">
            {{ s.leftToSpendCents < 0 ? 'Over budget' : 'Left to spend' }}
          </span>
        </app-donut-chart>

        <ul class="mt-5 flex flex-col gap-2">
          @for (segment of segments(); track segment.id) {
            <li class="flex items-baseline gap-2">
              <span
                class="size-3 shrink-0 translate-y-0.5 rounded-[0.3rem]"
                [style.background]="segment.color"
              ></span>
              <span class="text-[0.95rem] text-ink">{{ segment.label }}</span>
              <span class="leader"></span>
              <span class="text-[0.98rem] font-semibold text-ink">
                {{ money.summary(segment.value) }}
              </span>
            </li>
          }
        </ul>
      </section>

      <app-period-selector [label]="s.period.label" (step)="store.stepPeriod($event)" />

      @for (group of groups(); track group.groupId) {
        <section class="rounded-[1.5rem] bg-raised p-5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-[1.2rem] font-semibold text-ink">{{ group.name }}</h2>
            <p
              class="text-[1rem] font-semibold"
              [style.color]="stateColor(group.state)"
            >
              {{ money.summary(Math.abs(group.remainingCents)) }} {{ stateWord(group.state) }}
            </p>
          </div>

          <ul class="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 border-t border-line pt-5">
            @for (item of group.items; track item.categoryId) {
              <li class="flex flex-col items-center text-center">
                <app-progress-ring
                  [icon]="item.icon"
                  [progress]="item.progress"
                  [color]="item.color"
                  [over]="item.state === 'over'"
                  [size]="80"
                />
                <span class="mt-2 text-[0.66rem] tracking-wider text-ink-muted uppercase">
                  {{ item.name }}
                </span>
                <span
                  class="mt-0.5 text-[0.9rem] font-semibold"
                  [style.color]="stateColor(item.state)"
                >
                  {{ money.summary(Math.abs(item.remainingCents)) }} {{ stateWord(item.state) }}
                </span>
              </li>
            }
          </ul>
        </section>
      }

      @if (s.otherExpensesCents > 0) {
        <section class="rounded-[1.5rem] bg-raised p-5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-[1.2rem] font-semibold text-ink">Other expenses</h2>
            <p class="text-[1rem] font-semibold text-ink">
              {{ money.summary(s.otherExpensesCents) }}
            </p>
          </div>
          <p class="mt-3 border-t border-line pt-4 text-[0.9rem] leading-relaxed text-ink-muted">
            Spending in categories with no plan this period. It does not change what is left to
            spend, but it does affect the projection.
          </p>
        </section>
      }
    } @else {
      <p class="py-16 text-center text-[0.98rem] text-ink-muted">No budget selected.</p>
    }
  `,
})
export class BudgetRemainingTab {
  protected readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  protected readonly Math = Math;

  protected readonly summary = this.store.summary;

  protected readonly segments = computed<DonutSegment[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const list: DonutSegment[] = s.groups
      .filter((g) => g.spentCents > 0)
      .map((g) => ({ id: g.groupId, label: g.name, value: g.spentCents, color: g.color }));
    if (s.otherExpensesCents > 0) {
      list.push({
        id: 'other',
        label: 'Other expenses',
        value: s.otherExpensesCents,
        color: 'var(--color-cat-misc)',
      });
    }
    return list;
  });

  protected readonly groups = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const categories = this.store.categoriesById();
    return s.groups.map((group) => ({
      ...group,
      items: group.categories.map((c) => {
        const category = categories.get(c.categoryId);
        return {
          categoryId: c.categoryId,
          name: category?.name ?? 'Category',
          icon: (category?.icon ?? 'box') as IconName,
          color: category?.color ?? 'var(--color-cat-misc)',
          progress: c.progress,
          remainingCents: c.remainingCents,
          state: c.state,
        };
      }),
    }));
  });

  protected stateWord(state: 'under' | 'exact' | 'over'): string {
    if (state === 'over') return 'over';
    if (state === 'exact') return 'on budget';
    return 'left';
  }

  protected stateColor(state: 'under' | 'exact' | 'over'): string {
    if (state === 'over') return 'var(--color-negative)';
    if (state === 'exact') return 'var(--color-accent)';
    return 'var(--color-ink)';
  }
}
