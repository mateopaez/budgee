import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { RecurringMark } from './recurring-mark';
import { yearlyBillsTotal } from '../../core/util/recurring.util';

/**
 * Save tab. Recurring spending is surfaced for review; Budgee never claims a
 * payment is unnecessary or that it can be cancelled.
 */
@Component({
  selector: 'app-save-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RecurringMark],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <header
      class="relative overflow-hidden px-5 pb-8"
      style="background: linear-gradient(160deg, #fdf0d8 0%, #fbe4b8 100%); padding-top: calc(var(--safe-top) + 2rem)"
    >
      <div
        aria-hidden="true"
        class="absolute -top-10 -right-16 size-56 rounded-full"
        style="background: radial-gradient(circle at 35% 35%, #ffd34d, #f5b722 70%)"
      ></div>
      <div
        aria-hidden="true"
        class="absolute top-16 right-6 size-16 rounded-full"
        style="background: radial-gradient(circle at 35% 30%, #fff3c4, #f0c65a)"
      ></div>
      <h1 class="relative max-w-[11ch] text-[2.1rem] leading-tight font-bold text-[#1b1b1b]">
        Start saving money now
      </h1>
    </header>

    <main class="mt-4 flex-1 px-4" style="padding-bottom: var(--nav-clearance)">
      <section class="rounded-[1.5rem] bg-raised p-5">
        <h2 class="text-[1.35rem] font-semibold text-ink">Lower your bills</h2>
        <p class="mt-1 text-[0.95rem] leading-relaxed text-ink-muted">
          These payments come back on a regular rhythm. Worth a look now and then.
        </p>

        @if (featured().length === 0) {
          <p class="mt-6 text-[0.95rem] text-ink-muted">
            Budgee has not spotted any recurring payments yet. Once the same merchant appears at a
            regular interval it will show up here.
          </p>
        } @else {
          <ul class="mt-5 flex flex-col gap-4">
            @for (item of featured(); track item.id) {
              <li class="flex items-center gap-3">
                <app-recurring-mark [merchant]="item.merchant" [color]="item.color" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[1rem] font-semibold text-ink">
                    {{ item.merchant }}
                  </span>
                  <span class="block text-[0.9rem] text-ink-muted">
                    <span class="font-semibold text-ink">
                      {{ money.fmt(item.amountCents, { decimals: true }) }}
                    </span>
                    {{ item.cadence }}
                  </span>
                </span>
              </li>
            }
          </ul>

          <p
            class="mt-6 rounded-full bg-sunken px-5 py-3 text-center text-[0.95rem] text-ink-muted"
          >
            You pay
            <span class="font-semibold text-ink">{{ money.summary(yearlyCents()) }}</span>
            in recurring bills yearly.
          </p>

          <a
            routerLink="/save/bills"
            class="mt-4 flex min-h-[3rem] items-center justify-center text-[1rem] font-semibold text-ink"
          >
            See all bills
          </a>
        }
      </section>
    </main>
  `,
})
export class SavePage {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);

  private readonly payments = computed(() =>
    this.store.recurringPayments().map((p) => ({
      ...p,
      color: this.store.categoriesById().get(p.categoryId)?.color ?? 'var(--color-cat-housing)',
    })),
  );

  protected readonly featured = computed(() => this.payments().slice(0, 3));
  protected readonly yearlyCents = computed(() => yearlyBillsTotal(this.store.recurringPayments()));
}
