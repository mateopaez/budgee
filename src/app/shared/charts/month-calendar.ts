import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../ui/icon';
import { MoneyFormat } from '../ui/money.service';
import { buildMonthCalendar } from '../../core/util/grouping.util';
import { monthLabel, weekdayNames } from '../../core/util/date.util';
import type { Transaction } from '../../core/models';

/**
 * Month grid whose daily values come straight from the transaction list.
 * Cell tint scales with that day's spend relative to the busiest day.
 */
@Component({
  selector: 'app-month-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <div class="rounded-[1.5rem] bg-raised p-4">
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="flex size-10 items-center justify-center rounded-full text-ink-muted"
          aria-label="Previous month"
          (click)="step.emit(-1)"
        >
          <app-icon name="chevronLeft" [size]="20" />
        </button>
        <h3 class="text-[1.05rem] font-semibold text-ink">{{ title() }}</h3>
        <button
          type="button"
          class="flex size-10 items-center justify-center rounded-full text-ink-muted"
          aria-label="Next month"
          (click)="step.emit(1)"
        >
          <app-icon name="chevronRight" [size]="20" />
        </button>
      </div>

      <div class="mt-3 grid grid-cols-7 gap-1 text-center">
        @for (name of weekdays; track name) {
          <span class="pb-1 text-[0.66rem] tracking-wider text-ink-faint uppercase">{{ name }}</span>
        }
        @for (cell of cells(); track $index) {
          @if (cell.date === null) {
            <span></span>
          } @else {
            <span
              class="flex min-h-[3.1rem] flex-col items-center justify-center rounded-xl px-0.5 py-1"
              [style.background]="background(cell.spentCents)"
            >
              <span
                class="text-[0.78rem] font-semibold"
                [style.color]="cell.inFuture ? 'var(--color-ink-muted)' : 'var(--color-ink)'"
              >
                {{ cell.dayOfMonth }}
              </span>
              @if (cell.incomeCents > 0) {
                <span class="text-[0.6rem] font-semibold text-[color:var(--color-positive)]">
                  +{{ money.compact(cell.incomeCents) }}
                </span>
              }
              <span
                class="text-[0.66rem]"
                [style.color]="cell.spentCents > 0 ? 'var(--color-ink)' : 'var(--color-ink-muted)'"
              >
                {{ money.compact(cell.spentCents) }}
              </span>
            </span>
          }
        }
      </div>
    </div>
  `,
})
export class MonthCalendar {
  protected readonly money = inject(MoneyFormat);

  readonly monthAnchor = input.required<string>();
  readonly transactions = input.required<readonly Transaction[]>();
  readonly today = input.required<string>();
  readonly step = output<number>();

  protected readonly weekdays = weekdayNames(0);
  protected readonly title = computed(() => monthLabel(this.monthAnchor()));

  protected readonly cells = computed(() =>
    buildMonthCalendar(this.monthAnchor(), this.transactions(), this.today()),
  );

  private readonly peak = computed(() =>
    Math.max(1, ...this.cells().map((c) => c.spentCents)),
  );

  protected background(spentCents: number): string {
    if (spentCents <= 0) return 'var(--color-sunken)';
    const ratio = Math.min(1, spentCents / this.peak());
    const strength = 16 + Math.round(ratio * 30);
    return `color-mix(in srgb, var(--color-accent) ${strength}%, var(--color-sunken))`;
  }
}
