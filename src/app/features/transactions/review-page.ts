import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { TransactionRow } from '../../shared/ui/transaction-row';
import { BudgetStore } from '../../core/state/budget-store';
import type { Transaction } from '../../core/models';

/** Queue of imported rows that still need a category. */
@Component({
  selector: 'app-review-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, TransactionRow],
  template: `
    <app-sheet-shell title="Review transactions" (dismiss)="close()">
      @if (pending().length === 0) {
        <p class="py-14 text-center text-[0.98rem] text-ink-muted">
          Nothing to review. Every transaction has a category.
        </p>
      } @else {
        <p class="mt-1 text-[0.92rem] leading-relaxed text-ink-muted">
          These came in without a confident category. Open one to set it, and it will start counting
          towards your budget.
        </p>
        <div class="mt-4 flex flex-col gap-2">
          @for (tx of pending(); track tx.id) {
            <app-transaction-row
              [transaction]="tx"
              [card]="true"
              [showChip]="true"
              [compactDate]="true"
              (activate)="edit(tx)"
            />
          }
        </div>
      }
    </app-sheet-shell>
  `,
})
export class ReviewPage {
  private readonly store = inject(BudgetStore);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly canGoBack = this.router.getCurrentNavigation()?.previousNavigation != null;

  protected readonly pending = computed(() =>
    this.store.transactions().filter((t) => t.needsReview),
  );

  protected edit(tx: Transaction): void {
    void this.router.navigate(['/transactions', tx.id, 'edit']);
  }

  protected close(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigateByUrl('/budgee');
  }
}
