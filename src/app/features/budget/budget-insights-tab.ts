import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { Icon } from '../../shared/ui/icon';

/**
 * Insights tab.
 *
 * Daily budget:  leftToSpend / max(1, remaining days in the period).
 * Breakdown:     actual against planned for each bucket.
 * Projection:    each bucket is carried at max(actual, planned); unplanned
 *                other expenses carry at actual, since they have no plan.
 */
@Component({
  selector: 'app-budget-insights-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'flex flex-col gap-4 pt-1' },
  template: `
    @if (summary(); as s) {
      @for (card of order(); track card) {
        @switch (card) {
          @case ('dailyBudget') {
            <section class="rounded-[1.5rem] bg-raised p-5">
              <h2 class="text-[1.2rem] font-semibold text-ink">Daily budget</h2>
              <p class="mt-1 text-[0.95rem] text-ink-muted">
                There
                {{ s.remainingDays === 1 ? 'is' : 'are' }}
                <span class="font-semibold text-ink">{{ s.remainingDays }}</span>
                {{ s.remainingDays === 1 ? 'day' : 'days' }} remaining in this period.
              </p>
              <div class="mt-4 flex items-center gap-4 rounded-[1.25rem] bg-sunken p-4">
                <span
                  class="flex size-12 flex-col items-center justify-center rounded-xl text-[1rem] font-bold"
                  style="background: color-mix(in srgb, var(--color-accent) 30%, transparent); color: var(--color-accent)"
                  aria-hidden="true"
                >
                  {{ s.remainingDays }}
                </span>
                <span>
                  <span
                    class="block text-[1.8rem] leading-none font-bold"
                    [style.color]="s.dailyBudgetCents < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
                  >
                    {{ money.summary(s.dailyBudgetCents) }}
                  </span>
                  <span class="mt-1 block text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">
                    {{ s.dailyBudgetCents < 0 ? 'Over per remaining day' : 'Left to spend per day' }}
                  </span>
                </span>
              </div>
            </section>
          }
          @case ('breakdown') {
            <section class="rounded-[1.5rem] bg-raised p-5">
              <h2 class="text-[1.2rem] font-semibold text-ink">Budget breakdown</h2>
              <p class="mt-1 text-[0.95rem] leading-relaxed text-ink-muted">
                A summary of your budget progress so far during this period.
              </p>
              <ul class="mt-4 flex flex-col">
                @for (row of breakdownRows(); track row.label) {
                  <li class="flex min-h-[3.5rem] items-center gap-3 border-t border-line">
                    <span
                      class="size-3 shrink-0 rounded-[0.3rem]"
                      [style.background]="row.color"
                    ></span>
                    <span class="flex-1 text-[1rem] text-ink">{{ row.label }}</span>
                    <span class="text-[1rem] text-ink-muted">
                      {{ money.summary(row.actual) }}
                      @if (row.planned !== null) {
                        <span class="text-ink-muted"> / </span>
                        <span class="font-semibold text-ink">{{ money.summary(row.planned) }}</span>
                      }
                    </span>
                  </li>
                }
              </ul>
            </section>
          }
          @case ('projection') {
            <section class="rounded-[1.5rem] bg-raised p-5">
              <h2 class="text-[1.2rem] font-semibold text-ink">Projection</h2>
              <p class="mt-1 text-[0.95rem] text-ink-muted">
                An estimated result for this budget period.
              </p>
              <div class="mt-4 rounded-[1.25rem] bg-sunken p-4">
                <button
                  type="button"
                  class="flex w-full items-center gap-3"
                  [attr.aria-expanded]="expanded()"
                  (click)="expanded.set(!expanded())"
                >
                  <span
                    class="flex size-12 items-center justify-center rounded-xl"
                    style="background: color-mix(in srgb, var(--color-accent) 30%, transparent); color: var(--color-accent)"
                    aria-hidden="true"
                  >
                    <app-icon name="clipboard" [size]="22" />
                  </span>
                  <span
                    class="flex-1 text-left text-[1.8rem] leading-none font-bold"
                    [style.color]="s.projection.projectedResult < 0 ? 'var(--color-negative)' : 'var(--color-ink)'"
                  >
                    {{ money.summary(s.projection.projectedResult) }}
                  </span>
                  <app-icon [name]="expanded() ? 'chevronUp' : 'chevronDown'" [size]="20" />
                </button>

                @if (expanded()) {
                  <ul class="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                    @for (row of projectionRows(); track row.label) {
                      <li class="flex items-baseline gap-2">
                        <span class="text-[0.95rem] text-ink">{{ row.label }}</span>
                        <span class="leader"></span>
                        <span
                          class="text-[0.98rem] font-semibold"
                          [style.color]="row.emphasis ? 'var(--color-ink)' : 'var(--color-ink-muted)'"
                        >
                          {{ row.text }}
                        </span>
                      </li>
                    }
                  </ul>
                  <p class="mt-4 text-[0.8rem] leading-relaxed text-ink-faint">
                    Each bucket is carried at whichever is larger, what you have already spent or
                    what you planned. Unplanned other expenses have no plan to fall back on, so they
                    carry at their actual value.
                  </p>
                }
              </div>
            </section>
          }
        }
      }
    } @else {
      <p class="py-16 text-center text-[0.98rem] text-ink-muted">No budget selected.</p>
    }
  `,
})
export class BudgetInsightsTab {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);

  protected readonly summary = this.store.summary;
  protected readonly expanded = signal(true);

  protected readonly order = computed(() => {
    const insights = this.store.activeBudget()?.insights;
    if (!insights) return [];
    return insights.order.filter((key) => insights[key]);
  });

  protected readonly breakdownRows = computed(() => {
    const b = this.summary()?.breakdown;
    if (!b) return [];
    return [
      { label: 'Income', actual: b.incomeActual, planned: b.incomePlanned, color: 'var(--color-positive)' },
      { label: 'Savings', actual: b.savingsActual, planned: b.savingsPlanned, color: 'var(--color-cat-savings)' },
      { label: 'Fixed expenses', actual: b.fixedActual, planned: b.fixedPlanned, color: 'var(--color-cat-housing)' },
      { label: 'Variable expenses', actual: b.variableActual, planned: b.variablePlanned, color: 'var(--color-cat-food)' },
      { label: 'Other expenses', actual: b.otherActual, planned: null, color: 'var(--color-cat-misc)' },
    ];
  });

  protected readonly projectionRows = computed(() => {
    const p = this.summary()?.projection;
    if (!p) return [];
    return [
      { label: 'Income', text: this.money.summary(p.projectedIncome, { signed: true }), emphasis: false },
      { label: 'Savings', text: this.money.summary(-p.projectedSavings), emphasis: false },
      { label: 'Fixed budget expenses', text: this.money.summary(-p.projectedFixed), emphasis: false },
      { label: 'Variable costs', text: this.money.summary(-p.projectedVariable), emphasis: false },
      { label: 'Other expenses', text: this.money.summary(-p.projectedOther), emphasis: false },
      { label: 'Projected result', text: this.money.summary(p.projectedResult), emphasis: true },
    ];
  });
}
