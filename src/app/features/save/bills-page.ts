import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { MoneyFormat } from '../../shared/ui/money.service';
import { Icon } from '../../shared/ui/icon';
import { RecurringMark } from './recurring-mark';
import { dueInLabel } from '../../core/util/date.util';

/** Every recurring payment Budgee has detected, with the next expected date. */
@Component({
  selector: 'app-bills-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, RecurringMark],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <header
      class="relative overflow-hidden px-5 pb-10"
      style="background: linear-gradient(160deg, #fdf0d8 0%, #fbe4b8 100%); padding-top: calc(var(--safe-top) + 1rem)"
    >
      <div
        aria-hidden="true"
        class="absolute -top-12 -right-14 size-52 rounded-full"
        style="background: radial-gradient(circle at 35% 35%, #ffd34d, #f5b722 70%)"
      ></div>
      <a
        routerLink="/save"
        class="relative flex size-11 items-center justify-center rounded-full bg-black/10 text-[#1b1b1b]"
        aria-label="Back to Save"
      >
        <app-icon name="chevronLeft" [size]="22" />
      </a>
      <h1 class="relative mt-5 text-[2rem] leading-tight font-bold text-[#1b1b1b]">
        Recurring bills
      </h1>
      <p class="relative mt-2 max-w-[26ch] text-[0.95rem] text-[#1b1b1b]/75">
        Payments that repeat on a regular rhythm, with the date each is next expected.
      </p>
    </header>

    <main class="-mt-6 flex-1 px-4" style="padding-bottom: var(--nav-clearance)">
      @if (bills().length === 0) {
        <p class="rounded-[1.5rem] bg-raised p-6 text-center text-[0.95rem] text-ink-muted">
          No recurring payments detected yet.
        </p>
      } @else {
        <ul class="flex flex-col gap-3">
          @for (bill of bills(); track bill.id) {
            <li class="flex items-center gap-3 rounded-[1.25rem] bg-raised p-4">
              <app-recurring-mark [merchant]="bill.merchant" [color]="bill.color" [size]="52" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[1rem] font-semibold text-ink">
                  {{ bill.merchant }}
                </span>
                <span class="block text-[0.9rem] text-ink-muted">
                  <span class="font-semibold text-ink">
                    {{ money.fmt(bill.amountCents, { decimals: true }) }}
                  </span>
                  {{ bill.cadence }}
                </span>
                <span class="block text-[0.85rem] text-ink-faint">{{ bill.due }}</span>
              </span>
            </li>
          }
        </ul>
        <p class="mt-5 text-center text-[0.85rem] leading-relaxed text-ink-faint">
          Budgee reports recurring spending so you can review it. It does not judge whether a
          payment is needed or whether it can be cancelled.
        </p>
      }
    </main>
  `,
})
export class BillsPage {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);

  protected readonly bills = computed(() => {
    const categories = this.store.categoriesById();
    const today = this.store.today();
    return this.store
      .recurringPayments()
      .slice()
      .sort((a, b) => (a.nextDueOn < b.nextDueOn ? -1 : 1))
      .map((p) => ({
        ...p,
        color: categories.get(p.categoryId)?.color ?? 'var(--color-cat-housing)',
        due: dueInLabel(p.nextDueOn, today),
      }));
  });
}
