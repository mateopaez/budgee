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
import type { RecurrenceRule, TransactionDraft, TransactionType } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

type PickerKind = 'category' | 'fromWallet' | 'toWallet' | 'recurrence' | null;

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
 * mode needs.
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
            <label class="sr-only" for="merchant">Description</label>
            <input
              id="merchant"
              type="text"
              formControlName="merchant"
              class="min-h-[3.5rem] flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-faint"
              placeholder="Add a description"
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
  protected readonly errorMessage = signal<string | null>(null);

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

  protected readonly form = this.fb.nonNullable.group({
    amount: ['', [Validators.required, positiveAmount]],
    type: ['expense' as TransactionType, Validators.required],
    categoryId: ['', Validators.required],
    fromWalletId: [null as string | null],
    toWalletId: [null as string | null],
    merchant: [''],
    date: ['', Validators.required],
    recurrence: ['none' as RecurrenceRule],
    excludedFromBudget: [false],
  });

  private readonly typeSignal = signal<TransactionType>('expense');
  protected readonly type = this.typeSignal.asReadonly();

  private readonly formState = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => this.formState.update((v) => v + 1));
    const existing = this.transactionId() ? this.store.transactionById(this.transactionId()!) : null;
    const prefs = this.store.preferences();
    const wallets = this.store.wallets();

    if (existing) {
      this.typeSignal.set(existing.type);
      this.form.patchValue({
        amount: centsToInputString(existing.amountCents),
        type: existing.type,
        categoryId: existing.categoryId,
        fromWalletId: existing.fromWalletId,
        toWalletId: existing.toWalletId,
        merchant: existing.merchant,
        date: existing.date,
        recurrence: existing.recurrence,
        excludedFromBudget: existing.excludedFromBudget,
      });
    } else {
      this.form.patchValue({
        categoryId: prefs?.defaultExpenseCategoryId ?? this.store.categories()[0]?.id ?? '',
        fromWalletId: wallets[0]?.id ?? null,
        toWalletId: null,
        date: this.store.today(),
      });
    }
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

  protected walletName(control: 'fromWalletId' | 'toWalletId'): string {
    this.formState();
    const id = this.form.controls[control].value;
    return id ? (this.store.walletsById().get(id)?.name ?? 'Choose a wallet') : 'Choose a wallet';
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

  protected save(): void {
    const value = this.form.getRawValue();
    const amountCents = parseMoneyToCents(value.amount);

    if (!amountCents || amountCents <= 0) {
      this.errorMessage.set('Enter an amount greater than zero.');
      return;
    }
    if (!value.categoryId) {
      this.errorMessage.set('Choose a category.');
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

    const draft: TransactionDraft = {
      type: value.type,
      amountCents,
      date: value.date,
      categoryId: value.categoryId,
      merchant: value.merchant.trim(),
      fromWalletId: value.type === 'income' ? null : value.fromWalletId,
      toWalletId: value.type === 'expense' ? null : value.toWalletId,
      excludedFromBudget: value.excludedFromBudget,
      recurrence: value.recurrence,
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
