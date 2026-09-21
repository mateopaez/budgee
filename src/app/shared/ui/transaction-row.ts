import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CategoryMark } from './category-mark';
import { Icon } from './icon';
import { MoneyFormat } from './money.service';
import { BudgetStore } from '../../core/state/budget-store';
import type { Transaction } from '../../core/models';
import { longDateLabel, shortDateLabel } from '../../core/util/date.util';
import { displayCategoryId, hasSplits } from '../../core/util/transaction-split.util';
import type { IconName } from './icon-set';

/**
 * One transaction. Expense, income and transfer are visually distinct:
 * income is positive and tinted, transfers are muted, expenses are plain.
 */
@Component({
  selector: 'app-transaction-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryMark, Icon],
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="flex min-h-[3.75rem] w-full items-center gap-3 rounded-[1.25rem] px-1 py-2 text-left transition-colors hover:bg-raised-2/40"
      [class.bg-raised]="card()"
      [class.px-3]="card()"
      (click)="activate.emit()"
    >
      <app-category-mark [icon]="icon()" [color]="color()" [size]="card() ? 46 : 40" />
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-[0.98rem] font-semibold text-ink">
            {{ transaction().merchant || categoryName() }}
          </span>
          @if (split()) {
            <span
              class="inline-flex shrink-0 items-center text-ink-muted"
              aria-label="Split expense"
              title="Split expense"
            >
              <app-icon name="scissors" [size]="14" />
            </span>
          }
        </span>
        @if (showChip()) {
          <span
            class="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.78rem]"
            [style.background]="'color-mix(in srgb, ' + color() + ' 18%, transparent)'"
            [style.color]="chipText()"
          >
            <span class="size-1.5 rounded-full" [style.background]="color()"></span>
            {{ categoryName() }}
          </span>
        } @else {
          <span class="mt-0.5 block truncate text-[0.85rem] text-ink-muted">
            {{ categoryName() }}
          </span>
        }
      </span>
      <span class="shrink-0 text-right">
        <span
          class="block text-[1rem] font-semibold"
          [style.color]="amountColor()"
          [class.line-through]="transaction().excludedFromBudget"
        >
          {{ amount() }}
        </span>
        <span class="mt-0.5 block text-[0.75rem] tracking-wide text-ink-muted">
          @if (transaction().currency !== 'CAD') {
            {{ transaction().currency }} ·
          }
          {{ dateLabel() }}
        </span>
      </span>
    </button>
  `,
})
export class TransactionRow {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);

  readonly transaction = input.required<Transaction>();
  readonly card = input(false);
  readonly showChip = input(false);
  readonly compactDate = input(false);
  readonly activate = output<void>();

  protected readonly category = computed(() =>
    this.store.categoriesById().get(displayCategoryId(this.transaction())),
  );
  protected readonly categoryName = computed(() => this.category()?.name ?? 'Uncategorised');
  protected readonly split = computed(() => hasSplits(this.transaction()));
  protected readonly icon = computed<IconName>(() => this.category()?.icon ?? 'box');
  protected readonly color = computed(() => this.category()?.color ?? 'var(--color-cat-misc)');

  /** Chip labels are lightened so coloured text keeps AA contrast on dark. */
  protected readonly chipText = computed(
    () => `color-mix(in srgb, ${this.color()} 55%, white)`,
  );

  protected readonly amount = computed(() => {
    const tx = this.transaction();
    const currency = tx.currency === 'CAD' ? undefined : tx.currency;
    return this.money.signed(tx.amountCents, tx.type, currency);
  });

  protected readonly amountColor = computed(() => {
    const type = this.transaction().type;
    if (type === 'income') return 'var(--color-positive)';
    if (type === 'transfer') return 'var(--color-ink-muted)';
    return 'var(--color-ink)';
  });

  protected readonly dateLabel = computed(() =>
    this.compactDate()
      ? shortDateLabel(this.transaction().date)
      : longDateLabel(this.transaction().date),
  );
}
