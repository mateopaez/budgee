import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { CategoryMark } from '../../shared/ui/category-mark';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { centsToInputString, parseMoneyToCents } from '../../core/util/currency.util';
import { addDays, relativeDayLabel, shortDateLabel } from '../../core/util/date.util';
import { createId } from '../../core/util/id.util';
import { CATEGORY_IDS } from '../../core/data/taxonomy';
import { splitsSumCents } from '../../core/util/transaction-split.util';
import type { RecurrenceRule, TransactionDraft, TransactionSplit, TransactionType } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

type PickerKind = 'category' | 'splitCategory' | 'fromWallet' | 'toWallet' | 'recurrence' | null;

interface SplitDraft {
  readonly id: string;
  categoryId: string;
  amount: string;
  settled: boolean;
}

const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: 'Never repeat',
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
  quarterly: 'Every three months',
  yearly: 'Every year',
};

/**
 * Create and edit transactions.
 *
 * One reusable sheet drives all three modes. Switching mode keeps the amount,
 * description and date, and moves the wallet fields into the arrangement that
 * mode needs. Expenses can optionally be split across categories, with a
 * per-line Settled switch for reimbursed shares.
 */
@Component({
  selector: 'app-transaction-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SheetShell,
    Icon,
    CategoryMark,
    ToggleSwitch,
    OptionPickerSheet,
    ReactiveFormsModule,
  ],
  template: `
    @if (loadState() === 'missing') {
      <app-sheet-shell title="Transaction not found" (dismiss)="close()">
        <p class="mt-4 text-[0.95rem] leading-relaxed text-ink-muted">
          This transaction is not in your account. It may have been deleted, or the link is no longer valid.
        </p>
        <div sheetFooter class="pt-4">
          <button
            type="button"
            class="min-h-[3.25rem] w-full rounded-full border border-line-strong text-[1rem] font-semibold text-ink"
            (click)="close()"
          >
            Go back
          </button>
        </div>
      </app-sheet-shell>
    } @else if (loadState() === 'loading') {
      <app-sheet-shell title="Edit transaction" (dismiss)="close()">
        <p class="mt-4 text-[0.95rem] text-ink-muted" role="status">Loading transaction…</p>
      </app-sheet-shell>
    } @else {
    <app-sheet-shell [title]="isEditing() ? 'Edit transaction' : 'New transaction'" (dismiss)="close()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="flex flex-col items-center pt-2">
          <label class="sr-only" for="amount">Amount in Canadian dollars</label>
          <div class="flex items-baseline gap-1">
            <span class="text-[1.6rem] font-semibold text-ink-muted">$</span>
            <input
              id="amount"
              type="text"
              inputmode="decimal"
              formControlName="amount"
              class="w-[7.5ch] bg-transparent text-center text-[3rem] leading-none font-semibold text-ink outline-none"
              placeholder="0.00"
              (blur)="onTotalAmountBlur()"
            />
          </div>

          <div role="tablist" aria-label="Transaction type" class="mt-5 flex items-center gap-1">
            @for (option of typeOptions; track option.id) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="type() === option.id"
                class="min-h-[2.8rem] rounded-full px-5 text-[0.78rem] font-semibold tracking-[0.1em] uppercase"
                [class.bg-sunken]="type() === option.id"
                [class.text-ink]="type() === option.id"
                [class.text-ink-muted]="type() !== option.id"
                (click)="switchType(option.id)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>

        <div class="mt-6 border-t border-line">
          @if (!(type() === 'expense' && splitting())) {
            <button
              type="button"
              class="flex min-h-[3.75rem] w-full items-center gap-3 border-b border-line text-left"
              (click)="picker.set('category')"
            >
              <app-category-mark [icon]="categoryIcon()" [color]="categoryColor()" [size]="38" />
              <span class="flex-1 text-[1rem] text-ink-muted">
                Category: <span class="font-semibold text-ink">{{ categoryName() }}</span>
              </span>
              <app-icon name="chevronRight" [size]="18" />
            </button>
          }

          @if (type() !== 'income') {
            <button
              type="button"
              class="flex min-h-[3.75rem] w-full items-center gap-3 border-b border-line text-left"
              (click)="picker.set('fromWallet')"
            >
              <app-category-mark icon="wallet" color="var(--color-cat-food)" [size]="38" />
              <span class="flex-1 text-[1rem] text-ink-muted">
                From: <span class="font-semibold text-ink">{{ walletName('fromWalletId') }}</span>
              </span>
              @if (type() === 'transfer') {
                <span
                  class="flex size-10 items-center justify-center rounded-full bg-sunken text-ink"
                  role="presentation"
                >
                  <app-icon name="swap" [size]="18" />
                </span>
              } @else {
                <app-icon name="chevronRight" [size]="18" />
              }
            </button>
          }

          @if (type() === 'expense' && splitting()) {
            <div class="border-b border-line py-3">
              <div class="flex items-center justify-between gap-3 px-0.5">
                <div>
                  <p class="text-[1rem] font-semibold text-ink">Split</p>
                  <p class="mt-0.5 text-[0.82rem] text-ink-muted">
                    Lines must add up to {{ totalAmountLabel() }}. Settled lines skip the budget.
                  </p>
                </div>
                <button
                  type="button"
                  class="min-h-[2.5rem] rounded-full px-3 text-[0.82rem] font-semibold text-ink-muted"
                  (click)="clearSplits()"
                >
                  Remove
                </button>
              </div>

              <ul class="mt-3 flex flex-col gap-2" aria-label="Expense splits">
                @for (split of splits(); track split.id; let i = $index) {
                  <li
                    class="rounded-[1.15rem] bg-sunken/70 px-3 py-2.5"
                    [class.opacity-55]="split.settled"
                  >
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2.5 text-left"
                        (click)="openSplitCategory(i)"
                      >
                        <app-category-mark
                          [icon]="splitIcon(split.categoryId)"
                          [color]="splitColor(split.categoryId)"
                          [size]="34"
                        />
                        <span class="min-w-0 flex-1 truncate text-[0.95rem] font-semibold text-ink">
                          {{ splitName(split.categoryId) }}
                        </span>
                        <span class="text-ink-muted" aria-hidden="true">
                          <app-icon name="chevronRight" [size]="16" />
                        </span>
                      </button>
                      <div
                        class="flex min-h-[2.75rem] items-center gap-0.5 rounded-[0.85rem] border border-line-strong bg-raised px-2.5"
                      >
                        <span class="text-[0.9rem] text-ink-muted">$</span>
                        <label class="sr-only" [attr.for]="'split-amount-' + split.id">Split amount</label>
                        <input
                          [id]="'split-amount-' + split.id"
                          type="text"
                          inputmode="decimal"
                          placeholder="0.00"
                          class="w-[5.5ch] bg-transparent text-right text-[1.05rem] font-semibold text-ink outline-none placeholder:text-ink-faint"
                          [value]="split.amount"
                          [class.line-through]="split.settled"
                          (input)="onSplitAmountInput(i, $event)"
                          (blur)="onSplitAmountBlur(i)"
                        />
                      </div>
                      @if (splits().length > 2) {
                        <button
                          type="button"
                          class="flex size-9 items-center justify-center rounded-full text-ink-muted"
                          [attr.aria-label]="'Remove split ' + (i + 1)"
                          (click)="removeSplit(i)"
                        >
                          <app-icon name="x" [size]="16" />
                        </button>
                      }
                    </div>
                    <div class="mt-2 flex min-h-[2.4rem] items-center justify-between gap-3 border-t border-line/70 pt-2">
                      <span class="text-[0.88rem] text-ink">Settled</span>
                      <app-toggle-switch
                        [label]="'Mark split ' + (i + 1) + ' as settled'"
                        [checked]="split.settled"
                        (toggle)="setSplitSettled(i, $event)"
                      />
                    </div>
                  </li>
                }
              </ul>

              @if (splitRemainderCents() !== 0) {
                <p
                  class="mt-2 text-[0.82rem]"
                  [style.color]="'var(--color-negative)'"
                  role="status"
                >
                  @if (splitRemainderCents() > 0) {
                    {{ moneyLabel(splitRemainderCents()) }} still to assign
                  } @else {
                    {{ moneyLabel(-splitRemainderCents()) }} over the total
                  }
                </p>
              }

              <button
                type="button"
                class="mt-3 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-full border border-dashed border-line-strong text-[0.9rem] font-semibold text-ink"
                (click)="addSplitLine()"
              >
                <app-icon name="plus" [size]="16" />
                Add another split
              </button>
            </div>
          } @else if (type() === 'expense') {
            <button
              type="button"
              class="flex min-h-[3.75rem] w-full items-center gap-3 border-b border-line text-left"
              (click)="enableSplits()"
            >
              <span class="flex size-9 items-center justify-center text-ink-muted" aria-hidden="true">
                <app-icon name="scissors" [size]="22" />
              </span>
              <span class="flex-1">
                <span class="block text-[1rem] text-ink">Split expense</span>
                <span class="mt-0.5 block text-[0.82rem] text-ink-muted">
                  Share categories or track money you’re owed
                </span>
              </span>
              <app-icon name="chevronRight" [size]="18" />
            </button>
          }

          @if (type() !== 'expense') {
            <button
              type="button"
              class="flex min-h-[3.75rem] w-full items-center gap-3 border-b border-line text-left"
              (click)="picker.set('toWallet')"
            >
              <app-category-mark icon="wallet" color="var(--color-cat-savings)" [size]="38" />
              <span class="flex-1 text-[1rem] text-ink-muted">
                To: <span class="font-semibold text-ink">{{ walletName('toWalletId') }}</span>
              </span>
              <app-icon name="chevronRight" [size]="18" />
            </button>
          }

          <div class="flex min-h-[3.75rem] items-center gap-3 border-b border-line">
            <span class="flex size-9 items-center justify-center text-ink-muted" aria-hidden="true">
              <app-icon name="pencil" [size]="22" />
            </span>
            <label class="sr-only" for="merchant">Title</label>
            <input
              id="merchant"
              type="text"
              formControlName="merchant"
              class="min-h-[3.5rem] flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-faint"
              placeholder="Add a title"
            />
          </div>

          <div class="flex min-h-[3.75rem] items-center gap-3 border-b border-line">
            <span class="flex size-9 items-center justify-center text-ink-muted" aria-hidden="true">
              <app-icon name="calendar" [size]="22" />
            </span>
            <span class="flex-1 text-[1rem] text-ink">{{ dateLabel() }}</span>
            <button
              type="button"
              class="flex size-11 items-center justify-center rounded-full text-ink-muted"
              aria-label="Previous day"
              (click)="shiftDate(-1)"
            >
              <app-icon name="chevronLeft" [size]="20" />
            </button>
            <button
              type="button"
              class="flex size-11 items-center justify-center rounded-full text-ink-muted"
              aria-label="Next day"
              (click)="shiftDate(1)"
            >
              <app-icon name="chevronRight" [size]="20" />
            </button>
          </div>

          <button
            type="button"
            class="flex min-h-[3.75rem] w-full items-center gap-3 border-b border-line text-left"
            (click)="picker.set('recurrence')"
          >
            <span class="flex size-9 items-center justify-center text-ink-muted" aria-hidden="true">
              <app-icon name="repeat" [size]="22" />
            </span>
            <span class="flex-1 text-[1rem] text-ink">{{ recurrenceLabel() }}</span>
            <app-icon name="chevronRight" [size]="18" />
          </button>

          <div class="flex min-h-[3.75rem] items-center gap-3">
            <span class="flex size-9 items-center justify-center text-ink-muted" aria-hidden="true">
              <app-icon name="eyeOff" [size]="22" />
            </span>
            <span class="flex-1 text-[1rem] text-ink" id="exclude-label">Exclude from budget</span>
            <app-toggle-switch
              label="Exclude from budget"
              [checked]="form.controls.excludedFromBudget.value"
              (toggle)="form.controls.excludedFromBudget.setValue($event)"
            />
          </div>
        </div>

        <div class="mt-5">
          <label class="mb-2 block text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase" for="note">
            Description
          </label>
          <textarea
            id="note"
            formControlName="note"
            rows="3"
            class="min-h-[5.5rem] w-full resize-y rounded-[1.15rem] border border-line bg-sunken/70 px-4 py-3 text-[1rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
            placeholder="Optional notes about this transaction"
          ></textarea>
        </div>

        @if (errorMessage()) {
          <p role="alert" class="mt-4 text-[0.88rem] text-[color:var(--color-negative)]">
            {{ errorMessage() }}
          </p>
        }
      </form>

      <div sheetFooter class="flex items-center gap-3 pt-4">
        @if (isEditing()) {
          <button
            type="button"
            class="flex size-14 items-center justify-center rounded-full bg-raised-2 text-ink"
            aria-label="Delete transaction"
            (click)="remove()"
          >
            <app-icon name="trash" [size]="22" />
          </button>
        }
        <button
          type="button"
          class="min-h-[3.5rem] flex-1 rounded-full bg-white text-[1rem] font-semibold tracking-[0.08em] text-ink-inverse uppercase"
          (click)="save()"
        >
          Save
        </button>
      </div>
    </app-sheet-shell>

    @switch (picker()) {
      @case ('category') {
        <app-option-picker-sheet
          title="Categories"
          [options]="categoryOptions()"
          [selected]="form.controls.categoryId.value"
          (choose)="pickCategory($event)"
          (cancel)="picker.set(null)"
        />
      }
      @case ('splitCategory') {
        <app-option-picker-sheet
          title="Categories"
          [options]="categoryOptions()"
          [selected]="splitCategorySelected()"
          (choose)="pickSplitCategory($event)"
          (cancel)="closeSplitPicker()"
        />
      }
      @case ('fromWallet') {
        <app-option-picker-sheet
          title="From wallet"
          [options]="walletOptions()"
          [searchable]="false"
          [selected]="form.controls.fromWalletId.value"
          (choose)="pickWallet('fromWalletId', $event)"
          (cancel)="picker.set(null)"
        />
      }
      @case ('toWallet') {
        <app-option-picker-sheet
          title="To wallet"
          [options]="walletOptions()"
          [searchable]="false"
          [selected]="form.controls.toWalletId.value"
          (choose)="pickWallet('toWalletId', $event)"
          (cancel)="picker.set(null)"
        />
      }
      @case ('recurrence') {
        <app-option-picker-sheet
          title="Repeat"
          [options]="recurrenceOptions"
          [searchable]="false"
          [selected]="form.controls.recurrence.value"
          (choose)="pickRecurrence($event)"
          (cancel)="picker.set(null)"
        />
      }
    }
    }
  `,
})
export class TransactionEditorPage {
  private readonly store = inject(BudgetStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly canGoBack =
    this.router.getCurrentNavigation()?.previousNavigation != null;

  protected readonly picker = signal<PickerKind>(null);
  protected readonly splitPickerIndex = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loadState = signal<'ready' | 'loading' | 'missing'>('ready');
  protected readonly splits = signal<SplitDraft[]>([]);

  protected readonly typeOptions: { id: TransactionType; label: string }[] = [
    { id: 'expense', label: 'Expense' },
    { id: 'income', label: 'Income' },
    { id: 'transfer', label: 'Transfer' },
  ];

  protected readonly recurrenceOptions: PickerOption[] = (
    Object.keys(RECURRENCE_LABELS) as RecurrenceRule[]
  ).map((id) => ({ id, label: RECURRENCE_LABELS[id] }));

  private readonly transactionId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null },
  );

  protected readonly isEditing = computed(() => this.transactionId() !== null);
  protected readonly splitting = computed(() => this.splits().length >= 2);

  protected readonly form = this.fb.nonNullable.group({
    amount: ['', [Validators.required, positiveAmount]],
    type: ['expense' as TransactionType, Validators.required],
    categoryId: ['', Validators.required],
    fromWalletId: [null as string | null],
    toWalletId: [null as string | null],
    merchant: [''],
    note: [''],
    date: ['', Validators.required],
    recurrence: ['none' as RecurrenceRule],
    excludedFromBudget: [false],
  });

  private readonly typeSignal = signal<TransactionType>('expense');
  protected readonly type = this.typeSignal.asReadonly();

  private readonly formState = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => this.formState.update((v) => v + 1));
    void this.hydrate();
  }

  private async hydrate(): Promise<void> {
    const id = this.transactionId();
    const prefs = this.store.preferences();
    const wallets = this.store.wallets();

    if (!id) {
      this.loadState.set('ready');
      this.form.patchValue({
        categoryId: prefs?.defaultExpenseCategoryId ?? this.store.categories()[0]?.id ?? '',
        fromWalletId: wallets[0]?.id ?? null,
        toWalletId: null,
        date: this.store.today(),
      });
      return;
    }

    this.loadState.set('loading');
    const existing = await this.store.fetchTransaction(id);
    if (!existing) {
      this.loadState.set('missing');
      return;
    }

    this.typeSignal.set(existing.type);
    this.form.patchValue({
      amount: centsToInputString(existing.amountCents),
      type: existing.type,
      categoryId: existing.categoryId,
      fromWalletId: existing.fromWalletId,
      toWalletId: existing.toWalletId,
      merchant: existing.merchant,
      note: existing.note ?? '',
      date: existing.date,
      recurrence: existing.recurrence,
      excludedFromBudget: existing.excludedFromBudget,
    });
    if (existing.type === 'expense' && existing.splits && existing.splits.length >= 2) {
      this.splits.set(
        existing.splits.map((split) => ({
          id: split.id,
          categoryId: split.categoryId,
          amount: centsToInputString(split.amountCents),
          settled: split.settled,
        })),
      );
    }
    this.loadState.set('ready');
  }

  protected readonly categoryOptions = computed<PickerOption[]>(() => {
    const groups = this.store.groupsById();
    const type = this.type();
    return this.store
      .categories()
      .filter((c) => !c.archived)
      .filter((c) =>
        type === 'income'
          ? c.kind === 'income'
          : type === 'transfer'
            ? c.kind === 'transfer'
            : c.kind === 'expense',
      )
      .map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color,
        groupName: groups.get(c.groupId)?.name ?? 'Other',
      }));
  });

  protected readonly walletOptions = computed<PickerOption[]>(() =>
    this.store.wallets().map((w) => ({
      id: w.id,
      label: w.name,
      caption: walletKindLabel(w.kind),
      icon: w.icon,
      color: w.color,
    })),
  );

  protected readonly categoryName = computed(() => {
    this.formState();
    const id = this.form.controls.categoryId.value;
    return this.store.categoriesById().get(id)?.name ?? 'Choose a category';
  });

  protected readonly categoryIcon = computed<IconName>(() => {
    this.formState();
    const id = this.form.controls.categoryId.value;
    return this.store.categoriesById().get(id)?.icon ?? 'box';
  });

  protected readonly categoryColor = computed(() => {
    this.formState();
    const id = this.form.controls.categoryId.value;
    return this.store.categoriesById().get(id)?.color ?? 'var(--color-cat-misc)';
  });

  protected readonly dateLabel = computed(() => {
    this.formState();
    const date = this.form.controls.date.value;
    if (!date) return 'Pick a date';
    const relative = relativeDayLabel(date, this.store.today());
    return relative === 'Today' || relative === 'Yesterday' ? relative : shortDateLabel(date);
  });

  protected readonly recurrenceLabel = computed(() => {
    this.formState();
    return RECURRENCE_LABELS[this.form.controls.recurrence.value];
  });

  protected readonly totalAmountLabel = computed(() => {
    this.formState();
    const cents = parseMoneyToCents(this.form.controls.amount.value);
    return cents ? centsToInputString(cents) : '0.00';
  });

  protected readonly splitRemainderCents = computed(() => {
    this.formState();
    this.splits();
    const total = parseMoneyToCents(this.form.controls.amount.value) ?? 0;
    const assigned = this.splits().reduce((sum, split) => {
      const cents = parseMoneyToCents(split.amount) ?? 0;
      return sum + Math.max(0, cents);
    }, 0);
    return total - assigned;
  });

  protected readonly splitCategorySelected = computed(() => {
    const index = this.splitPickerIndex();
    if (index === null) return null;
    return this.splits()[index]?.categoryId ?? null;
  });

  protected walletName(control: 'fromWalletId' | 'toWalletId'): string {
    this.formState();
    const id = this.form.controls[control].value;
    return id ? (this.store.walletsById().get(id)?.name ?? 'Choose a wallet') : 'Choose a wallet';
  }

  protected splitName(categoryId: string): string {
    return this.store.categoriesById().get(categoryId)?.name ?? 'Choose a category';
  }

  protected splitIcon(categoryId: string): IconName {
    return this.store.categoriesById().get(categoryId)?.icon ?? 'box';
  }

  protected splitColor(categoryId: string): string {
    return this.store.categoriesById().get(categoryId)?.color ?? 'var(--color-cat-misc)';
  }

  protected moneyLabel(cents: number): string {
    return `$${centsToInputString(cents)}`;
  }

  /** Switching mode keeps shared values and repairs the mode specific ones. */
  protected switchType(next: TransactionType): void {
    if (next === this.type()) return;
    const previous = this.type();
    const prefs = this.store.preferences();
    const wallets = this.store.wallets();
    const from = this.form.controls.fromWalletId.value;
    const to = this.form.controls.toWalletId.value;

    this.typeSignal.set(next);
    this.form.controls.type.setValue(next);
    if (next !== 'expense') this.splits.set([]);

    const defaultCategory =
      next === 'income'
        ? (prefs?.defaultIncomeCategoryId ?? '')
        : next === 'transfer'
          ? (prefs?.defaultTransferCategoryId ?? '')
          : (prefs?.defaultExpenseCategoryId ?? '');
    const stillValid = this.categoryOptions().some(
      (o) => o.id === this.form.controls.categoryId.value,
    );
    if (!stillValid) this.form.controls.categoryId.setValue(defaultCategory);

    if (next === 'expense') {
      this.form.controls.fromWalletId.setValue(from ?? to ?? wallets[0]?.id ?? null);
      this.form.controls.toWalletId.setValue(null);
    } else if (next === 'income') {
      this.form.controls.toWalletId.setValue(to ?? from ?? wallets[0]?.id ?? null);
      this.form.controls.fromWalletId.setValue(null);
    } else {
      const source = from ?? wallets[0]?.id ?? null;
      const destination =
        to && to !== source ? to : (wallets.find((w) => w.id !== source)?.id ?? null);
      this.form.controls.fromWalletId.setValue(source);
      this.form.controls.toWalletId.setValue(destination);
      if (previous !== 'transfer') this.form.controls.excludedFromBudget.setValue(false);
    }
    this.errorMessage.set(null);
  }

  protected shiftDate(delta: number): void {
    const current = this.form.controls.date.value || this.store.today();
    this.form.controls.date.setValue(addDays(current, delta));
  }

  protected pickCategory(id: string): void {
    this.form.controls.categoryId.setValue(id);
    this.picker.set(null);
  }

  protected openSplitCategory(index: number): void {
    this.splitPickerIndex.set(index);
    this.picker.set('splitCategory');
  }

  protected closeSplitPicker(): void {
    this.splitPickerIndex.set(null);
    this.picker.set(null);
  }

  protected pickSplitCategory(id: string): void {
    const index = this.splitPickerIndex();
    if (index === null) return;
    this.splits.update((list) =>
      list.map((split, i) => (i === index ? { ...split, categoryId: id } : split)),
    );
    this.closeSplitPicker();
  }

  protected pickWallet(control: 'fromWalletId' | 'toWalletId', id: string): void {
    this.form.controls[control].setValue(id);
    if (this.type() === 'transfer') {
      const other = control === 'fromWalletId' ? 'toWalletId' : 'fromWalletId';
      if (this.form.controls[other].value === id) {
        const alternative = this.store.wallets().find((w) => w.id !== id)?.id ?? null;
        this.form.controls[other].setValue(alternative);
      }
    }
    this.picker.set(null);
  }

  protected pickRecurrence(id: string): void {
    this.form.controls.recurrence.setValue(id as RecurrenceRule);
    this.picker.set(null);
  }

  protected enableSplits(): void {
    const total = parseMoneyToCents(this.form.controls.amount.value);
    if (!total || total <= 0) {
      this.errorMessage.set('Enter an amount before splitting.');
      return;
    }
    const primaryCategory =
      this.form.controls.categoryId.value ||
      this.store.preferences()?.defaultExpenseCategoryId ||
      CATEGORY_IDS.misc;
    const owedCategory = this.store.categoriesById().has(CATEGORY_IDS.expectedReimbursement)
      ? CATEGORY_IDS.expectedReimbursement
      : primaryCategory;

    // Keep the original category at the full amount; the owed line starts empty
    // so typing a reimbursement amount rebalances your share automatically.
    this.splits.set([
      {
        id: createId('spl'),
        categoryId: primaryCategory,
        amount: centsToInputString(total),
        settled: false,
      },
      {
        id: createId('spl'),
        categoryId: owedCategory,
        amount: '',
        settled: false,
      },
    ]);
    this.errorMessage.set(null);
  }

  protected clearSplits(): void {
    const first = this.splits()[0];
    if (first?.categoryId) this.form.controls.categoryId.setValue(first.categoryId);
    this.splits.set([]);
  }

  protected addSplitLine(): void {
    const remainder = Math.max(0, this.splitRemainderCents());
    this.splits.update((list) => [
      ...list,
      {
        id: createId('spl'),
        categoryId: CATEGORY_IDS.expectedReimbursement,
        amount: remainder > 0 ? centsToInputString(remainder) : '',
        settled: false,
      },
    ]);
  }

  protected removeSplit(index: number): void {
    const next = this.splits().filter((_, i) => i !== index);
    if (next.length < 2) {
      this.clearSplits();
      return;
    }
    this.splits.set(next);
    this.rebalancePrimarySplit();
  }

  protected setSplitSettled(index: number, settled: boolean): void {
    this.splits.update((list) =>
      list.map((split, i) => (i === index ? { ...split, settled } : split)),
    );
  }

  protected onSplitAmountInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.splits.update((list) =>
      list.map((split, i) => (i === index ? { ...split, amount: value } : split)),
    );
    if (index !== 0) this.rebalancePrimarySplit();
  }

  protected onSplitAmountBlur(index: number): void {
    const split = this.splits()[index];
    if (!split) return;
    const cents = parseMoneyToCents(split.amount);
    this.splits.update((list) =>
      list.map((row, i) =>
        i === index
          ? { ...row, amount: cents && cents > 0 ? centsToInputString(cents) : row.amount }
          : row,
      ),
    );
    if (index !== 0) this.rebalancePrimarySplit();
  }

  protected onTotalAmountBlur(): void {
    if (!this.splitting()) return;
    this.rebalancePrimarySplit();
  }

  /** Keep the first line absorbing leftover so the split always matches the total. */
  private rebalancePrimarySplit(): void {
    const total = parseMoneyToCents(this.form.controls.amount.value);
    if (!total || total <= 0 || this.splits().length < 2) return;
    const others = this.splits()
      .slice(1)
      .reduce((sum, split) => sum + Math.max(0, parseMoneyToCents(split.amount) ?? 0), 0);
    const primary = Math.max(0, total - others);
    this.splits.update((list) =>
      list.map((split, i) =>
        i === 0 ? { ...split, amount: centsToInputString(primary) } : split,
      ),
    );
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const amountCents = parseMoneyToCents(value.amount);

    if (!amountCents || amountCents <= 0) {
      this.errorMessage.set('Enter an amount greater than zero.');
      return;
    }
    if (!value.date) {
      this.errorMessage.set('Choose a date.');
      return;
    }
    if (value.type !== 'income' && !value.fromWalletId) {
      this.errorMessage.set('Choose the wallet the money comes from.');
      return;
    }
    if (value.type !== 'expense' && !value.toWalletId) {
      this.errorMessage.set('Choose the wallet the money goes to.');
      return;
    }
    if (value.type === 'transfer' && value.fromWalletId === value.toWalletId) {
      this.errorMessage.set('A transfer needs two different wallets.');
      return;
    }

    let categoryId = value.categoryId;
    let splits: readonly TransactionSplit[] | undefined;

    if (value.type === 'expense' && this.splitting()) {
      const draftSplits = this.splits()
        .map((split) => ({
          id: split.id,
          categoryId: split.categoryId,
          amountCents: parseMoneyToCents(split.amount) ?? 0,
          settled: split.settled,
        }))
        .filter((split) => split.amountCents > 0 && split.categoryId);

      if (draftSplits.length < 2) {
        this.errorMessage.set('A split needs at least two category lines.');
        return;
      }
      if (draftSplits.some((split) => !split.categoryId)) {
        this.errorMessage.set('Choose a category for every split.');
        return;
      }
      if (splitsSumCents(draftSplits) !== amountCents) {
        this.errorMessage.set('Split amounts must add up to the total.');
        return;
      }
      splits = draftSplits;
      categoryId = draftSplits[0]!.categoryId;
    } else if (!categoryId) {
      this.errorMessage.set('Choose a category.');
      return;
    }

    const note = value.note.trim();
    const draft: TransactionDraft = {
      type: value.type,
      amountCents,
      date: value.date,
      categoryId,
      merchant: value.merchant.trim(),
      ...(note ? { note } : { note: undefined }),
      fromWalletId: value.type === 'income' ? null : value.fromWalletId,
      toWalletId: value.type === 'expense' ? null : value.toWalletId,
      excludedFromBudget: value.excludedFromBudget,
      recurrence: value.recurrence,
      ...(splits ? { splits } : { splits: undefined }),
    };

    const id = this.transactionId();
    if (id) this.store.updateTransaction(id, draft);
    else this.store.addTransaction(draft);
    this.close();
  }

  protected async remove(): Promise<void> {
    const id = this.transactionId();
    if (!id) return;
    const confirmed = await this.confirm.ask({
      title: 'Delete this transaction?',
      message: 'It will be removed from every total, chart and budget figure.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.store.deleteTransaction(id);
    this.close();
  }

  protected close(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigateByUrl('/overview');
  }
}

function positiveAmount(control: AbstractControl): { amount: true } | null {
  const cents = parseMoneyToCents(String(control.value ?? ''));
  return cents !== null && cents > 0 ? null : { amount: true };
}

function walletKindLabel(kind: string): string {
  switch (kind) {
    case 'savings':
      return 'Savings wallet';
    case 'debt':
      return 'Debt wallet';
    case 'cash':
      return 'Cash';
    default:
      return 'Spending wallet';
  }
}
