import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { MoneyFormat } from '../../shared/ui/money.service';
import { ToastService } from '../../shared/ui/toast.service';
import { BudgetStore } from '../../core/state/budget-store';
import { shortDateLabel } from '../../core/util/date.util';
import {
  findDuplicates,
  isCardPayment,
  parseStatement,
  swapDirections,
  type StatementRow,
} from '../../core/util/statement-import.util';

/** Largest file read, so a wrong pick (a photo, say) fails fast instead of freezing the tab. */
const MAX_FILE_BYTES = 2_000_000;

type RowFlag = 'duplicate' | 'payment' | null;

interface PreviewRow {
  readonly row: StatementRow;
  readonly flag: RowFlag;
  readonly included: boolean;
}

/**
 * Imports a CSV bank or card statement into one wallet. The file is read on
 * the device; only the rows the user keeps are saved, as transactions waiting
 * for review in the Unknown category.
 */
@Component({
  selector: 'app-statement-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon, ToggleSwitch, OptionPickerSheet],
  template: `
    <app-sheet-shell title="Import statement" (dismiss)="close()">
      <p class="mt-1 text-[0.92rem] leading-relaxed text-ink-muted">
        Download your statement from online banking as a CSV file. It is read on this device, and
        only the rows you import are saved.
      </p>

      <button
        type="button"
        class="mt-4 flex min-h-[3.5rem] w-full items-center gap-3 rounded-[1.25rem] bg-raised px-4 text-left"
        (click)="walletPickerOpen.set(true)"
      >
        <app-icon name="card" [size]="20" />
        <span class="flex-1 text-[1rem] text-ink">
          Wallet: <span class="font-semibold">{{ walletName() }}</span>
        </span>
        <app-icon name="chevronRight" [size]="18" />
      </button>

      <label
        class="mt-3 flex min-h-[3.5rem] cursor-pointer items-center gap-3 rounded-[1.25rem] bg-raised px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--color-accent)]"
      >
        <app-icon name="fileDown" [size]="20" />
        <span class="min-w-0 flex-1 truncate text-[1rem] text-ink">
          {{ fileName() ?? 'Choose a CSV file' }}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          class="sr-only"
          aria-describedby="import-status"
          (change)="onFile($event)"
        />
      </label>

      <p
        id="import-status"
        class="mt-3 text-[0.92rem] text-ink-muted"
        role="status"
        aria-live="polite"
      >
        {{ status() }}
      </p>

      @if (preview().length > 0) {
        @if (singleAmountColumn()) {
          <button
            type="button"
            class="mt-2 min-h-11 text-[0.92rem] font-semibold text-ink underline underline-offset-4"
            (click)="swap()"
          >
            Charges and credits the wrong way round? Swap them
          </button>
        }

        <div class="mt-3 flex items-center gap-3 rounded-[1.25rem] bg-raised px-4 py-3">
          <span class="flex-1">
            <span class="block text-[1rem] text-ink"
              >Keep {{ walletName() }} balance at {{ currentBalance() }}</span
            >
            <span class="block text-[0.85rem] leading-snug text-ink-muted">
              Turn off if this balance doesn't include these transactions yet.
            </span>
          </span>
          <app-toggle-switch
            label="Keep the wallet balance the same"
            [checked]="keepBalance()"
            (toggle)="keepBalance.set($event)"
          />
        </div>

        <ul class="mt-4 flex flex-col gap-2">
          @for (item of preview(); track item.row.line) {
            <li>
              <label
                class="flex min-h-[4rem] cursor-pointer items-center gap-3 rounded-[1rem] bg-raised px-3 py-2"
              >
                <input
                  type="checkbox"
                  class="size-5 shrink-0 accent-[color:var(--color-accent)]"
                  [checked]="item.included"
                  (change)="setIncluded(item.row.line, $any($event.target).checked)"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[0.98rem] text-ink">{{
                    item.row.description
                  }}</span>
                  <span class="block text-[0.82rem] text-ink-muted">
                    {{ dateLabel(item.row.date) }}
                    @if (item.flag === 'duplicate') {
                      · Already in Budgee
                    } @else if (item.flag === 'payment') {
                      · Card payment
                    }
                  </span>
                </span>
                <span
                  class="shrink-0 text-[0.98rem] font-semibold"
                  [style.color]="
                    item.row.direction === 'credit' ? 'var(--color-positive)' : 'var(--color-ink)'
                  "
                >
                  {{ amountLabel(item.row) }}
                </span>
              </label>
            </li>
          }
        </ul>
      }

      <div sheetFooter class="pt-4">
        <button
          type="button"
          class="min-h-[3.4rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-45"
          [disabled]="includedRows().length === 0 || !walletId()"
          (click)="importRows()"
        >
          {{ importLabel() }}
        </button>
      </div>
    </app-sheet-shell>

    @if (walletPickerOpen()) {
      <app-option-picker-sheet
        title="Import into"
        [options]="walletOptions()"
        [selected]="walletId()"
        [searchable]="false"
        (choose)="chooseWallet($event)"
        (cancel)="walletPickerOpen.set(false)"
      />
    }
  `,
})
export class StatementImportPage {
  private readonly store = inject(BudgetStore);
  private readonly money = inject(MoneyFormat);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly canGoBack = this.router.getCurrentNavigation()?.previousNavigation != null;

  protected readonly walletPickerOpen = signal(false);
  protected readonly fileName = signal<string | null>(null);
  protected readonly readError = signal<string | null>(null);
  protected readonly keepBalance = signal(true);
  private readonly rows = signal<readonly StatementRow[]>([]);
  private readonly skippedCount = signal(0);
  protected readonly singleAmountColumn = signal(false);
  /** Rows the user ticked or unticked by hand, by line, over the defaults. */
  private readonly choices = signal<ReadonlyMap<number, boolean>>(new Map());

  private readonly activeWallets = computed(() => this.store.wallets().filter((w) => !w.archived));

  /** Card statements are the common case, so a credit card wallet is picked first. */
  private readonly chosenWalletId = signal<string | null>(null);
  protected readonly walletId = computed(
    () =>
      this.chosenWalletId() ??
      this.activeWallets().find((w) => w.kind === 'debt')?.id ??
      this.activeWallets()[0]?.id ??
      null,
  );

  protected readonly walletName = computed(
    () => this.store.walletsById().get(this.walletId() ?? '')?.name ?? 'Choose a wallet',
  );

  protected readonly currentBalance = computed(() =>
    this.money.fmt(this.store.walletBalances().get(this.walletId() ?? '') ?? 0, { decimals: true }),
  );

  protected readonly walletOptions = computed<PickerOption[]>(() =>
    this.activeWallets().map((w) => ({ id: w.id, label: w.name, icon: w.icon, color: w.color })),
  );

  private readonly duplicates = computed(() => {
    const walletId = this.walletId();
    return walletId
      ? findDuplicates(this.rows(), this.store.transactions(), walletId)
      : new Set<number>();
  });

  protected readonly preview = computed<PreviewRow[]>(() => {
    const duplicates = this.duplicates();
    const choices = this.choices();
    return this.rows().map((row) => {
      const flag: RowFlag = duplicates.has(row.line)
        ? 'duplicate'
        : isCardPayment(row)
          ? 'payment'
          : null;
      return { row, flag, included: choices.get(row.line) ?? flag === null };
    });
  });

  protected readonly includedRows = computed(() =>
    this.preview()
      .filter((item) => item.included)
      .map((item) => item.row),
  );

  protected readonly status = computed(() => {
    const error = this.readError();
    if (error) return error;
    if (!this.fileName()) return '';
    const preview = this.preview();
    if (preview.length === 0) {
      return 'No transactions found. Check that the file has a date, a description and an amount on each line.';
    }
    const duplicates = preview.filter((item) => item.flag === 'duplicate').length;
    const payments = preview.filter((item) => item.flag === 'payment').length;
    const parts = [`${preview.length} transactions found`];
    if (duplicates) parts.push(`${duplicates} already in Budgee`);
    if (payments) parts.push(`${payments} card ${payments === 1 ? 'payment' : 'payments'}`);
    if (this.skippedCount()) parts.push(`${this.skippedCount()} lines skipped`);
    const unticked = duplicates + payments > 0 ? ' Those are unticked; tick any you want.' : '';
    return `${parts.join(', ')}.${unticked}`;
  });

  protected readonly importLabel = computed(() => {
    const count = this.includedRows().length;
    return count === 1 ? 'Import 1 transaction' : `Import ${count} transactions`;
  });

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.readError.set(null);
    this.choices.set(new Map());
    this.rows.set([]);
    this.skippedCount.set(0);
    if (file.size > MAX_FILE_BYTES) {
      this.readError.set('That file is too large for a statement. Choose the CSV download.');
      return;
    }
    try {
      const parsed = parseStatement(await file.text());
      this.rows.set(parsed.rows);
      this.skippedCount.set(parsed.skippedLines.length);
      this.singleAmountColumn.set(parsed.singleAmountColumn);
    } catch {
      this.readError.set('That file could not be read. Choose the CSV download from your bank.');
    }
  }

  protected chooseWallet(id: string): void {
    this.chosenWalletId.set(id);
    this.walletPickerOpen.set(false);
    this.choices.set(new Map());
  }

  protected swap(): void {
    this.rows.update((rows) => swapDirections(rows));
    this.choices.set(new Map());
  }

  protected setIncluded(line: number, included: boolean): void {
    this.choices.update((choices) => new Map(choices).set(line, included));
  }

  protected dateLabel(date: string): string {
    return `${shortDateLabel(date)}, ${date.slice(0, 4)}`;
  }

  protected amountLabel(row: StatementRow): string {
    return this.money.signed(row.amountCents, row.direction === 'charge' ? 'expense' : 'income', {
      decimals: true,
    });
  }

  protected importRows(): void {
    const walletId = this.walletId();
    const rows = this.includedRows();
    if (!walletId || rows.length === 0) return;
    const result = this.store.importStatementRows(rows, walletId, this.keepBalance());
    const count = rows.length === 1 ? '1 transaction' : `${rows.length} transactions`;
    this.toasts.show(`Imported ${count}. They're waiting in Review.`, {
      action: { label: 'Undo', run: () => this.store.undoStatementImport(result) },
      durationMs: 8000,
    });
    void this.router.navigateByUrl('/transactions/review', { replaceUrl: true });
  }

  protected close(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigateByUrl('/tools');
  }
}
