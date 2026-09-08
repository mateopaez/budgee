import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BudgetStore } from '../../core/state/budget-store';
import { SessionService } from '../../core/state/session.service';
import { StatusPill } from '../../shared/ui/status-pill';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { Icon } from '../../shared/ui/icon';
import { ConnectBankSheet } from './connect-bank-sheet';
import { groupByDay } from '../../core/util/grouping.util';
import { relativeDayLabel } from '../../core/util/date.util';
import type { Transaction } from '../../core/models';

/**
 * The Budgee tab: connection status, a friendly greeting and the chronological
 * transaction feed. Handles both the empty and the populated state.
 */
@Component({
  selector: 'app-budgee-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusPill, TransactionRow, Icon, ConnectBankSheet, RouterLink],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <main
      class="flex-1 px-4"
      [style.padding-top]="'calc(var(--safe-top) + 1rem)'"
      [style.padding-bottom]="'var(--nav-clearance)'"
    >
      <div class="flex justify-center">
        <app-status-pill
          [title]="connection()?.institutionName ?? 'No banks connected'"
          [caption]="syncCaption()"
          [connected]="connection() !== undefined"
        />
      </div>

      @if (transactions().length === 0) {
        <section class="mt-8">
          <h1 class="text-[1.35rem] font-semibold text-ink">Hey, I am Budgee.</h1>
          <p class="mt-2 text-[1.05rem] leading-relaxed text-ink-muted">
            Add your first transactions and I will show you where your money goes, and help you keep
            more of it.
          </p>

          <button
            type="button"
            class="mt-6 flex min-h-[3.25rem] items-center gap-3 rounded-full bg-white px-6 text-[1rem] font-semibold text-ink-inverse"
            (click)="sheetOpen.set(true)"
          >
            <app-icon name="bank" [size]="20" />
            Connect your bank
          </button>

          <div class="mt-8 flex flex-col gap-3">
            <a
              routerLink="/transactions/new"
              class="flex items-center gap-3 rounded-[1.25rem] border border-line bg-surface px-4 py-4"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full"
                style="background: color-mix(in srgb, var(--color-accent) 22%, transparent); color: var(--color-accent)"
              >
                <app-icon name="plus" [size]="20" />
              </span>
              <span class="flex-1">
                <span class="block text-[0.98rem] font-semibold text-ink">Add a transaction</span>
                <span class="mt-0.5 block text-[0.85rem] text-ink-muted">
                  Record an expense, income or transfer by hand.
                </span>
              </span>
              <app-icon name="chevronRight" [size]="20" />
            </a>
            <a
              routerLink="/wallets"
              class="flex items-center gap-3 rounded-[1.25rem] border border-line bg-surface px-4 py-4"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full"
                style="background: color-mix(in srgb, var(--color-cat-savings) 22%, transparent); color: var(--color-cat-savings)"
              >
                <app-icon name="wallet" [size]="20" />
              </span>
              <span class="flex-1">
                <span class="block text-[0.98rem] font-semibold text-ink">Set up your wallets</span>
                <span class="mt-0.5 block text-[0.85rem] text-ink-muted">
                  Name the accounts your money moves between.
                </span>
              </span>
              <app-icon name="chevronRight" [size]="20" />
            </a>
            <a
              routerLink="/budget"
              class="flex items-center gap-3 rounded-[1.25rem] border border-line bg-surface px-4 py-4"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full"
                style="background: color-mix(in srgb, var(--color-cat-housing) 22%, transparent); color: var(--color-cat-housing)"
              >
                <app-icon name="pie" [size]="20" />
              </span>
              <span class="flex-1">
                <span class="block text-[0.98rem] font-semibold text-ink">Build a budget</span>
                <span class="mt-0.5 block text-[0.85rem] text-ink-muted">
                  Plan what each category gets this period.
                </span>
              </span>
              <app-icon name="chevronRight" [size]="20" />
            </a>
          </div>
        </section>
      } @else {
        <section class="mt-6">
          <h1 class="text-[1.25rem] leading-snug font-semibold text-ink">
            Here is what has been happening with your money.
          </h1>

          @if (reviewCount() > 0) {
            <a
              routerLink="/transactions/review"
              class="mt-4 flex min-h-[3rem] items-center gap-3 rounded-full border border-line bg-surface px-4"
            >
              <span class="flex-1 truncate text-[0.9rem] text-ink-muted">
                You have {{ reviewCount() }}
                {{ reviewCount() === 1 ? 'transaction' : 'transactions' }} in need of a category
              </span>
              <span class="rounded-full bg-raised px-4 py-1.5 text-[0.85rem] font-semibold text-ink">
                Review
              </span>
            </a>
          }

          <div class="mt-5 flex flex-col gap-5">
            @for (group of feed(); track group.date) {
              <div>
                <h2 class="mb-2 text-[0.85rem] text-ink-muted">
                  {{ label(group.date) }}
                </h2>
                <div class="flex flex-col gap-2">
                  @for (tx of group.transactions; track tx.id) {
                    <app-transaction-row
                      [transaction]="tx"
                      [card]="true"
                      [showChip]="true"
                      [compactDate]="true"
                      (activate)="edit(tx)"
                    />
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }
    </main>

    @if (sheetOpen()) {
      <app-connect-bank-sheet (close)="sheetOpen.set(false)" />
    }
  `,
})
export class BudgeePage {
  private readonly store = inject(BudgetStore);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly sheetOpen = signal(false);

  protected readonly transactions = this.store.transactions;
  protected readonly reviewCount = this.store.needsReviewCount;

  protected readonly connection = computed(() =>
    this.store.connections().find((c) => c.status === 'connected'),
  );

  protected readonly syncCaption = computed(() => {
    const connection = this.connection();
    if (!connection) return 'Never synced';
    if (!connection.lastSyncAt) return 'Not synced yet';
    return 'Demo data, synced locally';
  });

  /** Most recent 40 transactions, grouped by day. */
  protected readonly feed = computed(() => groupByDay(this.transactions().slice(0, 40)));

  protected label(date: string): string {
    return relativeDayLabel(date, this.store.today());
  }

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }
}
