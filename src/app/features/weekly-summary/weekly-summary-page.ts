import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { Icon } from '../../shared/ui/icon';
import { LineChart, type LinePoint } from '../../shared/charts/line-chart';
import { DonutChart, type DonutSegment } from '../../shared/charts/donut-chart';
import { CategoryMark } from '../../shared/ui/category-mark';
import { addDays, shortDateLabel, startOfWeek, weekdayShort } from '../../core/util/date.util';
import { cumulativeSpend, totalsByCategory } from '../../core/util/grouping.util';
import type { IconName } from '../../shared/ui/icon-set';

/**
 * Paginated weekly recap. Five panels, swipeable on touch and navigable with
 * the previous and next buttons or the arrow keys.
 *
 * The decoration is original CSS: soft gradient discs, no imported artwork.
 */
@Component({
  selector: 'app-weekly-summary-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, LineChart, DonutChart, CategoryMark],
  host: {
    class: 'fixed inset-0 z-50 flex justify-center',
    '(keydown.arrowRight)': 'next()',
    '(keydown.arrowLeft)': 'previous()',
    '(keydown.escape)': 'done()',
    tabindex: '-1',
  },
  template: `
    <section
      class="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.75rem]"
      style="background: linear-gradient(170deg, #d9a9c4 0%, #c9a5d8 45%, #98a6e0 100%); margin-top: calc(var(--safe-top) + 0.75rem)"
      role="region"
      aria-roledescription="carousel"
      aria-label="Weekly summary"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <header class="flex items-center justify-between px-4 pt-4">
        <div class="flex gap-1.5" role="tablist" aria-label="Weekly summary panels">
          @for (i of indices; track i) {
            <button
              type="button"
              role="tab"
              class="h-1.5 rounded-full transition-all"
              [style.width.px]="i === slide() ? 26 : 10"
              [style.background]="i === slide() ? '#151515' : 'rgba(21,21,21,0.35)'"
              [attr.aria-selected]="i === slide()"
              [attr.aria-label]="'Panel ' + (i + 1)"
              (click)="slide.set(i)"
            ></button>
          }
        </div>
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full bg-black/12 text-[#151515]"
          aria-label="Close weekly summary"
          (click)="done()"
        >
          <app-icon name="x" [size]="22" />
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
        @switch (slide()) {
          @case (0) {
            <div class="flex h-full flex-col items-center justify-center text-center">
              <div class="relative mb-8 h-40 w-full" aria-hidden="true">
                <span
                  class="absolute top-2 left-6 size-20 rounded-full opacity-90 blur-[1px]"
                  style="background: radial-gradient(circle at 35% 30%, #ffd9ec, #f27bb0)"
                ></span>
                <span
                  class="absolute top-16 right-8 size-24 rounded-full opacity-90"
                  style="background: conic-gradient(from 200deg, #7b5bff, #24d6c4, #ff6ea9, #7b5bff)"
                ></span>
                <span
                  class="absolute top-6 left-1/2 size-14 -translate-x-1/2 rounded-[1.5rem] opacity-90"
                  style="background: linear-gradient(140deg, #fff0a8, #f5b722)"
                ></span>
              </div>
              <h1 class="text-[2rem] leading-tight font-bold text-[#151515]">
                What was your money up to last week?
              </h1>
              <p class="mt-3 text-[1rem] text-[#151515]/70">{{ rangeLabel() }}</p>
            </div>
          }
          @case (1) {
            <h2 class="text-[1.7rem] leading-tight font-bold text-[#151515]">
              Your total spend last week
            </h2>
            <div class="mt-5 rounded-[1.5rem] bg-[#1c2426] p-5">
              <p class="text-[0.7rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
                Spent last week
              </p>
              <p class="mt-1 text-[2.4rem] leading-none font-bold text-ink">
                {{ money.summary(totalCents()) }}
              </p>
              <div class="mt-5">
                <app-line-chart
                  [points]="weekPoints()"
                  color="#b558ff"
                  ariaLabel="Running total spent through last week"
                />
              </div>
            </div>
          }
          @case (2) {
            <h2 class="text-[1.7rem] leading-tight font-bold text-[#151515]">
              The things you spent most money on
            </h2>
            <div class="mt-5 rounded-[1.5rem] bg-[#1c2426] p-5">
              @if (segments().length === 0) {
                <p class="py-8 text-center text-[0.95rem] text-ink-muted">
                  No spending recorded last week.
                </p>
              } @else {
                <app-donut-chart [segments]="segments()" [size]="200" [thickness]="18">
                  @if (topCategory(); as top) {
                    <app-category-mark [icon]="top.icon" [color]="top.color" [size]="52" [solid]="true" />
                    <span class="mt-3 text-[1.8rem] leading-none font-bold text-ink">
                      {{ money.summary(top.totalCents) }}
                    </span>
                    <span class="mt-1 text-[0.68rem] tracking-[0.14em] text-ink-muted uppercase">
                      {{ top.name }}
                    </span>
                  }
                </app-donut-chart>
                <ul class="mt-6 flex flex-col gap-2">
                  @for (row of topCategories(); track row.id) {
                    <li class="flex items-baseline gap-2">
                      <span
                        class="size-3 shrink-0 translate-y-0.5 rounded-[0.3rem]"
                        [style.background]="row.color"
                      ></span>
                      <span class="text-[0.95rem] text-ink">{{ row.name }}</span>
                      <span class="leader"></span>
                      <span class="text-[0.98rem] font-semibold text-ink">
                        {{ money.summary(row.totalCents) }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
          }
          @case (3) {
            <h2 class="text-[1.7rem] leading-tight font-bold text-[#151515]">
              Number of transactions
            </h2>
            <div class="mt-5 rounded-[1.5rem] bg-[#1c2426] p-6">
              <p class="text-center text-[3.4rem] leading-none font-bold text-ink">
                {{ weekTransactions().length }}
              </p>
              <p class="mt-2 text-center text-[0.95rem] text-ink-muted">
                across {{ distinctCategories() }}
                {{ distinctCategories() === 1 ? 'category' : 'categories' }}
              </p>
              <div class="mt-6 flex flex-wrap justify-center gap-3">
                @for (mark of categoryMarks(); track mark.id) {
                  <app-category-mark
                    [icon]="mark.icon"
                    [color]="mark.color"
                    [size]="mark.size"
                    [solid]="true"
                  />
                }
              </div>
            </div>
          }
          @case (4) {
            <h2 class="text-[1.7rem] leading-tight font-bold text-[#151515]">The big ones being</h2>
            <div class="mt-5 rounded-[1.5rem] bg-[#1c2426] p-5">
              <p class="text-[0.7rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
                Your largest transactions
              </p>
              @if (largest().length === 0) {
                <p class="py-8 text-center text-[0.95rem] text-ink-muted">
                  Nothing recorded last week.
                </p>
              } @else {
                <ul class="mt-4 flex flex-col gap-3">
                  @for (tx of largest(); track tx.id) {
                    <li class="flex items-center gap-3 rounded-[1.25rem] bg-black/25 p-3">
                      <app-category-mark [icon]="tx.icon" [color]="tx.color" [size]="44" [solid]="true" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[0.95rem] text-ink">{{ tx.merchant }}</span>
                        <span class="block text-[0.8rem] text-ink-muted">{{ tx.date }}</span>
                      </span>
                      <span class="text-[1.1rem] font-bold text-ink">
                        {{ money.summary(tx.amountCents) }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
            <p class="mt-6 text-center text-[1rem] font-semibold text-[#151515]">
              Nice work keeping an eye on it.
            </p>
          }
        }
      </div>

      <footer
        class="flex items-center gap-3 px-5"
        style="padding-bottom: calc(var(--safe-bottom) + 1rem)"
      >
        <button
          type="button"
          class="flex size-12 items-center justify-center rounded-full bg-black/12 text-[#151515] disabled:opacity-35"
          [disabled]="slide() === 0"
          aria-label="Previous panel"
          (click)="previous()"
        >
          <app-icon name="chevronLeft" [size]="22" />
        </button>
        @if (slide() < 4) {
          <button
            type="button"
            class="min-h-[3.25rem] flex-1 rounded-full bg-black text-[1rem] font-semibold text-white"
            (click)="next()"
          >
            See more
          </button>
        } @else {
          <button
            type="button"
            class="min-h-[3.25rem] flex-1 rounded-full bg-black text-[1rem] font-semibold text-white"
            (click)="done()"
          >
            Done
          </button>
        }
      </footer>
    </section>
  `,
})
export class WeeklySummaryPage {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  private readonly router = inject(Router);

  protected readonly indices = [0, 1, 2, 3, 4];
  protected readonly slide = signal(0);
  private touchStartX = 0;

  /** The last completed week, Sunday through Saturday. */
  private readonly weekStart = computed(() => addDays(startOfWeek(this.store.today(), 0), -7));
  private readonly weekEnd = computed(() => addDays(this.weekStart(), 7));

  protected readonly rangeLabel = computed(
    () => `${shortDateLabel(this.weekStart())} to ${shortDateLabel(addDays(this.weekEnd(), -1))}`,
  );

  protected readonly weekTransactions = computed(() =>
    this.store
      .transactions()
      .filter((t) => t.date >= this.weekStart() && t.date < this.weekEnd() && !t.excludedFromBudget),
  );

  private readonly weekExpenses = computed(() =>
    this.weekTransactions().filter((t) => t.type === 'expense'),
  );

  protected readonly totalCents = computed(() =>
    this.weekExpenses().reduce((sum, t) => sum + t.amountCents, 0),
  );

  protected readonly weekPoints = computed<LinePoint[]>(() =>
    cumulativeSpend(this.weekStart(), this.weekEnd(), this.store.transactions()).map((p) => ({
      label: weekdayShort(p.date),
      value: p.cumulativeCents,
    })),
  );

  protected readonly topCategories = computed(() => {
    const categories = this.store.categoriesById();
    return totalsByCategory(this.weekExpenses(), 'expense')
      .slice(0, 5)
      .map((entry) => {
        const category = categories.get(entry.categoryId);
        return {
          id: entry.categoryId,
          name: category?.name ?? 'Uncategorised',
          color: category?.color ?? 'var(--color-cat-misc)',
          icon: (category?.icon ?? 'box') as IconName,
          totalCents: entry.totalCents,
        };
      });
  });

  protected readonly topCategory = computed(() => this.topCategories()[0] ?? null);

  protected readonly segments = computed<DonutSegment[]>(() =>
    this.topCategories().map((row) => ({
      id: row.id,
      label: row.name,
      value: row.totalCents,
      color: row.color,
    })),
  );

  protected readonly distinctCategories = computed(
    () => new Set(this.weekTransactions().map((t) => t.categoryId)).size,
  );

  /** Bubbles sized by how many transactions fell into each category. */
  protected readonly categoryMarks = computed(() => {
    const categories = this.store.categoriesById();
    const counts = new Map<string, number>();
    for (const tx of this.weekTransactions()) {
      counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    return [...counts.entries()].slice(0, 10).map(([id, count]) => {
      const category = categories.get(id);
      return {
        id,
        icon: (category?.icon ?? 'box') as IconName,
        color: category?.color ?? 'var(--color-cat-misc)',
        size: 34 + Math.round((count / peak) * 30),
      };
    });
  });

  protected readonly largest = computed(() => {
    const categories = this.store.categoriesById();
    return [...this.weekExpenses()]
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 3)
      .map((tx) => {
        const category = categories.get(tx.categoryId);
        return {
          id: tx.id,
          merchant: tx.merchant || (category?.name ?? 'Transaction'),
          amountCents: tx.amountCents,
          date: shortDateLabel(tx.date),
          icon: (category?.icon ?? 'box') as IconName,
          color: category?.color ?? 'var(--color-cat-misc)',
        };
      });
  });

  protected next(): void {
    this.slide.update((v) => Math.min(4, v + 1));
  }

  protected previous(): void {
    this.slide.update((v) => Math.max(0, v - 1));
  }

  protected done(): void {
    void this.router.navigateByUrl('/overview');
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const delta = (event.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    if (Math.abs(delta) < 45) return;
    if (delta < 0) this.next();
    else this.previous();
  }
}
