import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';
import { PlaidApi, PlaidClientError, loadPlaidLink } from '../../core/data/plaid-api';

/**
 * Launches Plaid Link. The sheet only ever holds a short-lived link token and
 * the one-time public token, which it posts to the server immediately.
 */
@Component({
  selector: 'app-connect-bank-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon],
  template: `
    <app-sheet-shell title="Connect your accounts" (dismiss)="close.emit()">
      <div
        aria-hidden="true"
        class="mt-2 flex h-44 items-center justify-center rounded-[1.5rem]"
        style="background: radial-gradient(120% 100% at 30% 20%, color-mix(in srgb, var(--color-accent) 45%, transparent), transparent 70%), var(--color-raised)"
      >
        <span
          class="flex size-20 items-center justify-center rounded-[1.75rem]"
          style="background: var(--accent-gradient); color: var(--color-accent-ink)"
        >
          <app-icon name="bank" [size]="38" [strokeWidth]="1.8" />
        </span>
      </div>

      <h2 class="mt-6 text-[1.5rem] leading-tight font-bold text-ink">Connect a bank</h2>
      <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
        Plaid Sandbox opens in a secure window. Budgee never sees your bank password, and the
        access token stays on the server.
      </p>
      <p class="mt-4 text-[0.9rem] leading-relaxed text-ink-muted">
        Continue without a phone number, then choose First Platypus Bank. Sign in as
        user_transactions_dynamic with any password. If it asks for a code, enter 1234.
      </p>

      @if (message(); as text) {
        <p
          class="mt-4 rounded-2xl border px-4 py-3 text-[0.9rem]"
          style="border-color: color-mix(in srgb, var(--color-negative) 40%, transparent); color: #ffa9ac"
          role="alert"
        >
          {{ text }}
        </p>
      }

      <div sheetFooter class="flex flex-col gap-3 pt-4">
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-60"
          [disabled]="busy()"
          (click)="connect()"
        >
          {{ busy() ? 'Connecting…' : 'Connect a bank' }}
        </button>
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full border border-line-strong text-[1rem] font-semibold text-ink disabled:opacity-60"
          [disabled]="busy()"
          (click)="loadDemo()"
        >
          Load the demo dataset
        </button>
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full border border-line text-[1rem] font-semibold text-ink"
          (click)="close.emit()"
        >
          I will add transactions myself
        </button>
      </div>
    </app-sheet-shell>
  `,
})
export class ConnectBankSheet {
  private readonly store = inject(BudgetStore);
  private readonly plaid = inject(PlaidApi);
  private readonly destroyRef = inject(DestroyRef);
  private link: { open(): void; destroy(): void } | null = null;
  private finishing = false;

  readonly close = output<void>();

  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.link?.destroy());
  }

  protected async loadDemo(): Promise<void> {
    await this.store.resetToDemo();
    this.close.emit();
  }

  protected async connect(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const linkToken = await this.plaid.linkToken();
      await loadPlaidLink();
      const plaid = window.Plaid;
      if (!plaid) throw new PlaidClientError('Could not load Plaid Link');
      this.link?.destroy();
      this.link = plaid.create({
        token: linkToken,
        onSuccess: (publicToken) => {
          this.finishing = true;
          void this.finish(publicToken);
        },
        onExit: (error) => {
          if (this.finishing) return;
          this.busy.set(false);
          if (!error) return;
          this.message.set(error.display_message || error.error_message || 'Plaid Link closed');
        },
      });
      this.link.open();
    } catch (error) {
      this.busy.set(false);
      this.message.set(error instanceof Error ? error.message : 'Could not start Plaid Link');
    }
  }

  private async finish(publicToken: string): Promise<void> {
    try {
      const exchanged = await this.plaid.exchange(publicToken);
      await this.plaid.sync(exchanged.connection.id);
      if (exchanged.skippedAccounts.length > 0) {
        this.message.set(
          `Connected. Skipped unsupported accounts: ${exchanged.skippedAccounts.join(', ')}`,
        );
        return;
      }
      this.close.emit();
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Could not finish connecting');
    } finally {
      this.finishing = false;
      this.busy.set(false);
    }
  }
}
