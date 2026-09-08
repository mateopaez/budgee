import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { CategoryMark } from '../../shared/ui/category-mark';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { MoneyFormat } from '../../shared/ui/money.service';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { createId } from '../../core/util/id.util';
import { centsToInputString, parseMoneyToCents } from '../../core/util/currency.util';
import type { Wallet, WalletKind } from '../../core/models';
import type { IconName } from '../../shared/ui/icon-set';

const WALLET_ICONS: readonly IconName[] = ['wallet', 'piggy', 'card', 'banknote', 'bank', 'lock'];
const WALLET_COLORS = [
  'var(--color-cat-food)',
  'var(--color-cat-savings)',
  'var(--color-cat-entertainment)',
  'var(--color-cat-income)',
  'var(--color-cat-housing)',
  'var(--color-cat-transport)',
];

/** Wallet management, including the opening balance each wallet starts from. */
@Component({
  selector: 'app-wallets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CategoryMark, SheetShell],
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
        <h1 class="flex-1 text-center text-[1.15rem] font-semibold text-ink">Wallets</h1>
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink"
          aria-label="Add a wallet"
          (click)="startCreate()"
        >
          <app-icon name="plus" [size]="20" />
        </button>
      </div>

      <section class="mt-4 rounded-[1.5rem] bg-raised p-5">
        <p class="text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Total balance
        </p>
        <p class="mt-1 text-[2.2rem] leading-none font-bold text-ink">
          {{ money.summary(totalCents()) }}
        </p>
        <p class="mt-2 text-[0.85rem] text-ink-muted">
          Opening balances plus every transaction you have recorded.
        </p>
      </section>

      <ul class="mt-4 overflow-hidden rounded-[1.5rem] bg-raised">
        @for (wallet of wallets(); track wallet.id) {
          <li>
            <button
              type="button"
              class="flex min-h-[4.25rem] w-full items-center gap-3 px-4 text-left not-first:border-t not-first:border-line"
              (click)="startEdit(wallet)"
            >
              <app-category-mark [icon]="wallet.icon" [color]="wallet.color" [size]="42" [solid]="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[1rem] text-ink">{{ wallet.name }}</span>
                <span class="block text-[0.8rem] text-ink-muted">{{ kindLabel(wallet.kind) }}</span>
              </span>
              <span class="text-[1rem] font-semibold text-ink">
                {{ money.summary(balanceOf(wallet.id)) }}
              </span>
            </button>
          </li>
        }
      </ul>
    </main>

    @if (editing(); as draft) {
      <app-sheet-shell
        [title]="isNew() ? 'New wallet' : 'Edit wallet'"
        (dismiss)="editing.set(null)"
      >
        <label class="mt-2 block rounded-[1.25rem] bg-raised px-4 py-3">
          <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Name
          </span>
          <input
            type="text"
            class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
            [value]="draft.name"
            (input)="patch({ name: $any($event.target).value })"
          />
        </label>

        <label class="mt-3 block rounded-[1.25rem] bg-raised px-4 py-3">
          <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Opening balance
          </span>
          <input
            type="text"
            inputmode="decimal"
            class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
            [value]="openingInput()"
            (change)="setOpening($any($event.target).value)"
          />
        </label>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Kind
          </legend>
          <div class="mt-2 grid grid-cols-2 gap-2">
            @for (kind of kinds; track kind) {
              <button
                type="button"
                class="min-h-[2.75rem] rounded-full text-[0.85rem] font-semibold"
                [style.background]="draft.kind === kind ? 'var(--color-accent)' : 'var(--color-raised)'"
                [style.color]="draft.kind === kind ? 'var(--color-accent-ink)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft.kind === kind"
                (click)="patch({ kind })"
              >
                {{ kindLabel(kind) }}
              </button>
            }
          </div>
          <p class="mt-2 text-[0.82rem] leading-relaxed text-ink-muted">
            The kind matters for budgets: transfers into savings or debt wallets are only counted
            when the budget opts in.
          </p>
        </fieldset>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Colour
          </legend>
          <div class="mt-2 flex flex-wrap gap-3">
            @for (color of colors; track color) {
              <button
                type="button"
                class="size-9 rounded-full border-2"
                [style.background]="color"
                [style.border-color]="draft.color === color ? 'var(--color-ink)' : 'transparent'"
                [attr.aria-pressed]="draft.color === color"
                [attr.aria-label]="'Colour ' + color"
                (click)="patch({ color })"
              ></button>
            }
          </div>
        </fieldset>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Icon
          </legend>
          <div class="mt-2 flex gap-2">
            @for (icon of icons; track icon) {
              <button
                type="button"
                class="flex size-12 items-center justify-center rounded-2xl"
                [style.background]="draft.icon === icon ? 'color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'var(--color-raised)'"
                [style.color]="draft.icon === icon ? 'var(--color-accent)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft.icon === icon"
                [attr.aria-label]="'Icon ' + icon"
                (click)="patch({ icon })"
              >
                <app-icon [name]="icon" [size]="20" />
              </button>
            }
          </div>
        </fieldset>

        @if (!isNew()) {
          <button
            type="button"
            class="mt-6 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[0.95rem] font-semibold"
            style="color: #ffa9ac"
            (click)="remove(draft)"
          >
            Delete wallet
          </button>
        }

        <div sheetFooter class="pt-4">
          <button
            type="button"
            class="min-h-[3.4rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse"
            (click)="save()"
          >
            Save
          </button>
        </div>
      </app-sheet-shell>
    }
  `,
})
export class WalletsPage {
  private readonly store = inject(BudgetStore);
  protected readonly money = inject(MoneyFormat);
  private readonly confirm = inject(ConfirmService);

  protected readonly icons = WALLET_ICONS;
  protected readonly colors = WALLET_COLORS;
  protected readonly kinds: WalletKind[] = ['spending', 'savings', 'debt', 'cash'];

  protected readonly wallets = this.store.wallets;
  protected readonly editing = signal<Wallet | null>(null);
  protected readonly isNew = signal(false);

  protected readonly totalCents = computed(() =>
    [...this.store.walletBalances().values()].reduce((sum, value) => sum + value, 0),
  );

  protected readonly openingInput = computed(() => {
    const draft = this.editing();
    return draft ? centsToInputString(draft.openingBalanceCents) : '0.00';
  });

  protected balanceOf(id: string): number {
    return this.store.walletBalances().get(id) ?? 0;
  }

  protected kindLabel(kind: WalletKind): string {
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

  protected startCreate(): void {
    this.isNew.set(true);
    this.editing.set({
      id: createId('wal'),
      name: '',
      kind: 'spending',
      openingBalanceCents: 0,
      color: WALLET_COLORS[0],
      icon: 'wallet',
    });
  }

  protected startEdit(wallet: Wallet): void {
    this.isNew.set(false);
    this.editing.set(wallet);
  }

  protected patch(patch: Partial<Wallet>): void {
    this.editing.update((current) => (current ? { ...current, ...patch } : current));
  }

  protected setOpening(raw: string): void {
    this.patch({ openingBalanceCents: parseMoneyToCents(raw) ?? 0 });
  }

  protected save(): void {
    const draft = this.editing();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    this.store.upsertWallet({ ...draft, name });
    this.editing.set(null);
  }

  protected async remove(wallet: Wallet): Promise<void> {
    const used = this.store
      .transactions()
      .filter((t) => t.fromWalletId === wallet.id || t.toWalletId === wallet.id).length;
    const confirmed = await this.confirm.ask({
      title: `Delete ${wallet.name}?`,
      message:
        used > 0
          ? `${used} ${used === 1 ? 'transaction keeps' : 'transactions keep'} their amounts but lose this wallet.`
          : 'This wallet is not used by any transaction.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.store.deleteWallet(wallet.id);
    this.editing.set(null);
  }
}
