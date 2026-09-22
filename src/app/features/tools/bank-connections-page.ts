import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { PlaidApi } from '../../core/data/plaid-api';
import { ConnectBankSheet } from '../budgee/connect-bank-sheet';
import type {
  ConnectionStatus,
  LinkedAccount,
  LinkedAccountType,
  ProviderConnection,
  WalletKind,
} from '../../core/models';

const NO_WALLET = '__none__';

/**
 * Bank connections.
 *
 * Plaid linking runs through the server. Demo connections stay labelled as local data.
 */
@Component({
  selector: 'app-bank-connections-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ConnectBankSheet, OptionPickerSheet],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <main
      class="flex-1 px-4"
      style="padding-top: calc(var(--safe-top) + 1rem); padding-bottom: var(--nav-clearance)"
    >
      <div class="flex min-h-[3rem] items-center gap-2">
        <a
          routerLink="/tools"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink"
          aria-label="Back to tools"
        >
          <app-icon name="chevronLeft" [size]="20" />
        </a>
        <h1 class="flex-1 text-center text-[1.15rem] font-semibold text-ink">Bank Connections</h1>
        <span class="size-11"></span>
      </div>

      <section class="mt-5 rounded-[1.5rem] bg-raised p-6 text-center">
        <span
          class="mx-auto flex size-16 items-center justify-center rounded-2xl"
          style="background: var(--accent-gradient); color: var(--color-accent-ink)"
          aria-hidden="true"
        >
          <app-icon name="bank" [size]="30" />
        </span>
        <h2 class="mt-4 text-[1.25rem] font-semibold text-ink">Connect a bank</h2>
        <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
          Connecting a bank uses Plaid. Budgee never sees your bank password. A bank that needs
          attention has to be connected again.
        </p>
        <button
          type="button"
          class="mt-5 min-h-[3.25rem] rounded-full bg-white px-6 text-[1rem] font-semibold text-ink-inverse"
          (click)="sheetOpen.set(true)"
        >
          Connect a bank
        </button>
      </section>

      @if (notice(); as text) {
        <p class="mt-4 rounded-2xl bg-raised px-4 py-3 text-[0.9rem] text-ink" role="status">
          {{ text }}
        </p>
      }
      @if (error(); as text) {
        <p
          class="mt-4 rounded-2xl border px-4 py-3 text-[0.9rem]"
          style="border-color: color-mix(in srgb, var(--color-negative) 40%, transparent); color: #ffa9ac"
          role="alert"
        >
          {{ text }}
        </p>
      }

      @if (plaidConnections().length > 0) {
        <h2 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Plaid
        </h2>
        <ul class="overflow-hidden rounded-[1.5rem] bg-raised">
          @for (connection of plaidConnections(); track connection.id) {
            <li class="px-4 py-4 not-first:border-t not-first:border-line">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-muted"
                  aria-hidden="true"
                >
                  <app-icon name="link" [size]="20" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[1rem] text-ink">
                    {{ connection.institutionName }}
                  </span>
                  <span class="block text-[0.82rem] text-ink-muted">
                    {{ statusLabel(connection.status) }} · {{ syncLabel(connection.lastSyncAt) }}
                  </span>
                  @if (connection.status === 'needs_attention') {
                    <span class="mt-1 block text-[0.82rem] text-ink">
                      This bank needs to be connected again.
                    </span>
                  }
                </span>
              </div>
              @if (connection.status !== 'disconnected') {
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="min-h-11 flex-1 rounded-full border border-line text-[0.95rem] font-semibold text-ink disabled:opacity-60"
                    [disabled]="busyId() === connection.id"
                    [attr.aria-label]="'Sync ' + connection.institutionName"
                    (click)="sync(connection)"
                  >
                    {{ busyId() === connection.id ? 'Syncing…' : 'Sync' }}
                  </button>
                  <button
                    type="button"
                    class="min-h-11 flex-1 rounded-full border border-line text-[0.95rem] font-semibold text-ink disabled:opacity-60"
                    [disabled]="busyId() === connection.id"
                    [attr.aria-label]="'Disconnect ' + connection.institutionName"
                    (click)="disconnect(connection)"
                  >
                    Disconnect
                  </button>
                </div>
              }
              @if (accountsFor(connection.id); as accounts) {
                @if (accounts.length > 0) {
                  <p class="mt-4 text-[0.82rem] leading-relaxed text-ink-muted">
                    Choose a wallet for each account. Transactions from that account use the wallet
                    you pick.
                  </p>
                  <a
                    routerLink="/wallets"
                    class="inline-flex min-h-11 items-center text-[0.9rem] font-semibold text-ink underline"
                  >
                    {{ store.wallets().length === 0 ? 'Create a wallet' : 'Manage wallets' }}
                  </a>
                  <ul class="mt-2">
                    @for (account of accounts; track account.id) {
                      <li class="not-first:border-t not-first:border-line">
                        <button
                          type="button"
                          class="flex min-h-11 w-full items-center gap-3 py-2 text-left"
                          [attr.aria-label]="mapLabel(account)"
                          (click)="mappingAccount.set(account)"
                        >
                          <span class="min-w-0 flex-1">
                            <span class="block truncate text-[0.95rem] text-ink">{{ account.name }}</span>
                            <span class="block text-[0.82rem] text-ink-muted">
                              {{ typeLabel(account.type) }}
                              @if (account.mask) {
                                · ending {{ account.mask }}
                              }
                            </span>
                          </span>
                          <span class="max-w-[42%] truncate text-right text-[0.85rem] text-ink">
                            {{ walletName(account.walletId) }}
                          </span>
                          <app-icon name="chevronRight" [size]="16" />
                        </button>
                      </li>
                    }
                  </ul>
                }
              }
            </li>
          }
        </ul>
      }

      @if (demoConnections().length > 0) {
        <h2 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Demo connection
        </h2>
        <ul class="overflow-hidden rounded-[1.5rem] bg-raised">
          @for (connection of demoConnections(); track connection.id) {
            <li class="flex items-center gap-3 px-4 py-4 not-first:border-t not-first:border-line">
              <span
                class="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-muted"
                aria-hidden="true"
              >
                <app-icon name="link" [size]="20" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[1rem] text-ink">
                  {{ connection.institutionName }}
                </span>
                <span class="block text-[0.82rem] text-ink-muted">
                  Local demo data, not a real institution
                </span>
              </span>
            </li>
          }
        </ul>
      }
    </main>

    @if (sheetOpen()) {
      <app-connect-bank-sheet (close)="sheetOpen.set(false)" />
    }
    @if (mappingAccount(); as account) {
      <app-option-picker-sheet
        [title]="'Wallet for ' + account.name"
        [options]="walletOptions()"
        [selected]="account.walletId ?? noWallet"
        [searchable]="walletOptions().length > 8"
        (choose)="assignWallet(account, $event)"
        (cancel)="mappingAccount.set(null)"
      />
    }
  `,
})
export class BankConnectionsPage {
  protected readonly store = inject(BudgetStore);
  private readonly plaid = inject(PlaidApi);
  private readonly confirm = inject(ConfirmService);

  protected readonly sheetOpen = signal(false);
  protected readonly mappingAccount = signal<LinkedAccount | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly noWallet = NO_WALLET;

  protected readonly walletOptions = computed<PickerOption[]>(() => {
    const wallets = this.store.wallets().filter((wallet) => !wallet.archived);
    return [
      {
        id: NO_WALLET,
        label: 'No wallet',
        caption: 'Transactions stay unassigned',
        icon: 'link',
        color: 'var(--color-cat-misc)',
      },
      ...wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
        caption: walletKindLabel(wallet.kind),
        icon: wallet.icon,
        color: wallet.color,
        groupName: 'Wallets',
      })),
    ];
  });

  protected readonly plaidConnections = computed(() =>
    this.store.connections().filter((connection) => connection.provider === 'plaid'),
  );
  protected readonly demoConnections = computed(() =>
    this.store.connections().filter((connection) => connection.provider !== 'plaid'),
  );
  private readonly accountsByConnection = computed(() => {
    const map = new Map<string, LinkedAccount[]>();
    for (const account of this.store.linkedAccounts()) {
      const list = map.get(account.connectionId) ?? [];
      list.push(account);
      map.set(account.connectionId, list);
    }
    return map;
  });

  protected accountsFor(connectionId: string) {
    const order: Record<LinkedAccountType, number> = {
      checking: 0,
      savings: 1,
      credit: 2,
      loan: 3,
    };
    return [...(this.accountsByConnection().get(connectionId) ?? [])].sort((a, b) => {
      const byType = order[a.type] - order[b.type];
      return byType !== 0 ? byType : a.name.localeCompare(b.name);
    });
  }

  protected typeLabel(type: LinkedAccountType): string {
    switch (type) {
      case 'checking':
        return 'Checking';
      case 'savings':
        return 'Savings';
      case 'credit':
        return 'Credit';
      case 'loan':
        return 'Loan';
    }
  }

  protected walletName(walletId: string | null): string {
    if (!walletId) return 'Choose wallet';
    return this.store.walletsById().get(walletId)?.name ?? 'Choose wallet';
  }

  protected mapLabel(account: LinkedAccount): string {
    const mask = account.mask ? `, ending ${account.mask}` : '';
    return `Choose a wallet for ${account.name}, ${this.typeLabel(account.type)}${mask}. Current wallet: ${this.walletName(account.walletId)}`;
  }

  protected assignWallet(account: LinkedAccount, optionId: string): void {
    this.mappingAccount.set(null);
    this.store.assignLinkedAccountWallet(account.id, optionId === NO_WALLET ? null : optionId);
  }

  protected statusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'syncing':
        return 'Syncing';
      case 'needs_attention':
        return 'Needs attention';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Not connected';
    }
  }

  protected syncLabel(iso: string | null): string {
    if (!iso) return 'Not synced yet';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Not synced yet';
    const formatted = new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    return `Last synced ${formatted}`;
  }

  protected async sync(connection: ProviderConnection): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(connection.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      const result = await this.plaid.sync(connection.id);
      this.notice.set(
        `Added ${result.added}, updated ${result.modified}, removed ${result.removed}.`,
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      this.busyId.set(null);
    }
  }

  protected async disconnect(connection: ProviderConnection): Promise<void> {
    if (this.busyId()) return;
    const confirmed = await this.confirm.ask({
      title: `Disconnect ${connection.institutionName}?`,
      message: 'Imported transactions stay in Budgee. The bank link is removed.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    this.busyId.set(connection.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.plaid.disconnect(connection.id);
      this.notice.set(`${connection.institutionName} disconnected.`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not disconnect');
    } finally {
      this.busyId.set(null);
    }
  }
}

function walletKindLabel(kind: WalletKind): string {
  switch (kind) {
    case 'savings':
      return 'Savings';
    case 'debt':
      return 'Debt';
    case 'cash':
      return 'Cash';
    default:
      return 'Spending';
  }
}
