import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { SessionService } from '../../core/state/session.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { exportTransactionsCsv } from './csv-export';
import type { IconName } from '../../shared/ui/icon-set';

interface ToolCard {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly icon: IconName;
  readonly color: string;
  readonly link?: string;
  readonly action?: 'export' | 'reset';
  readonly soon?: boolean;
}

/** Tools hub. */
@Component({
  selector: 'app-tools-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, OptionPickerSheet],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <main
      class="flex-1 px-4"
      style="padding-top: calc(var(--safe-top) + 1rem); padding-bottom: var(--nav-clearance)"
    >
      <div class="flex min-h-[3rem] items-center gap-2">
        <a
          routerLink="/settings"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink"
          aria-label="Settings"
        >
          <app-icon name="gear" [size]="20" />
        </a>
        <h1 class="flex-1 text-center text-[1.15rem] font-semibold text-ink">Tools</h1>
        <span class="size-11"></span>
      </div>

      <section class="mt-4 flex items-center gap-4 rounded-[1.5rem] bg-raised p-4">
        <span
          class="flex size-16 items-center justify-center rounded-full text-[1.4rem] font-bold"
          style="background: var(--accent-gradient); color: var(--color-accent-ink)"
          aria-hidden="true"
        >
          {{ initial() }}
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[1.5rem] font-bold text-ink">{{ name() }}</span>
          <span class="block truncate text-[0.8rem] tracking-[0.12em] text-ink-muted uppercase">
            {{ email() }}
          </span>
        </span>
      </section>

      <div class="mt-4 grid grid-cols-2 gap-3">
        @for (card of cards; track card.id) {
          @if (card.link) {
            <a
              [routerLink]="card.link"
              class="flex flex-col items-center rounded-[1.5rem] bg-raised p-5 text-center"
            >
              <span
                class="flex size-14 items-center justify-center rounded-2xl"
                [style.background]="card.color"
                [style.box-shadow]="'0 0 22px color-mix(in srgb, ' + card.color + ' 40%, transparent)'"
                style="color: #12181a"
                aria-hidden="true"
              >
                <app-icon [name]="card.icon" [size]="26" [strokeWidth]="2" />
              </span>
              <span class="mt-3 text-[1.05rem] font-semibold text-ink">{{ card.title }}</span>
              <span class="mt-1 text-[0.85rem] leading-snug text-ink-muted">{{ card.body }}</span>
            </a>
          } @else {
            <button
              type="button"
              class="flex flex-col items-center rounded-[1.5rem] bg-raised p-5 text-center disabled:opacity-55"
              [disabled]="card.soon"
              (click)="run(card)"
            >
              <span
                class="flex size-14 items-center justify-center rounded-2xl"
                [style.background]="card.color"
                [style.box-shadow]="card.soon ? 'none' : '0 0 22px color-mix(in srgb, ' + card.color + ' 40%, transparent)'"
                style="color: #12181a"
                aria-hidden="true"
              >
                <app-icon [name]="card.icon" [size]="26" [strokeWidth]="2" />
              </span>
              <span class="mt-3 text-[1.05rem] font-semibold text-ink">{{ card.title }}</span>
              <span class="mt-1 text-[0.85rem] leading-snug text-ink-muted">{{ card.body }}</span>
              @if (card.soon) {
                <span class="mt-2 rounded-full border border-line px-3 py-0.5 text-[0.7rem] text-ink-muted">
                  Coming soon
                </span>
              }
            </button>
          }
        }
      </div>

      <button
        type="button"
        class="mt-5 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[1rem] font-semibold text-ink"
        (click)="signOut()"
      >
        Sign out
      </button>

      <p class="mt-5 text-center text-[0.82rem] text-ink-faint">Budgee MVP 0.1</p>

      @if (store.status() === 'seeding') {
        <p class="mt-3 text-center text-[0.9rem] text-ink-muted" role="status" aria-live="polite">
          Updating your Firestore data…
        </p>
      }
      @if (store.error(); as message) {
        <p
          class="mt-3 rounded-2xl border px-4 py-3 text-center text-[0.9rem]"
          style="border-color: color-mix(in srgb, var(--color-negative) 40%, transparent); color: #ffa9ac"
          role="alert"
        >
          {{ message }}
        </p>
      }
    </main>

    @if (resetOpen()) {
      <app-option-picker-sheet
        title="Reset data"
        [options]="resetOptions"
        [searchable]="false"
        (choose)="reset($event)"
        (cancel)="resetOpen.set(false)"
      />
    }
  `,
})
export class ToolsPage {
  protected readonly store = inject(BudgetStore);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly resetOpen = signal(false);

  protected readonly name = computed(() => this.store.workspace()?.displayName || 'You');
  protected readonly email = computed(() => this.store.workspace()?.email || '');
  protected readonly initial = computed(() => (this.name()[0] ?? 'B').toUpperCase());

  protected readonly cards: ToolCard[] = [
    {
      id: 'bank',
      title: 'Bank Connections',
      body: 'Handle your connected bank accounts',
      icon: 'bank',
      color: 'var(--color-cat-transport)',
      link: '/bank-connections',
    },
    {
      id: 'wallets',
      title: 'Wallets',
      body: 'Keep track of your balances',
      icon: 'wallet',
      color: 'var(--color-cat-entertainment)',
      link: '/wallets',
    },
    {
      id: 'categories',
      title: 'Categories',
      body: 'Create, edit or remove categories',
      icon: 'folder',
      color: 'var(--color-cat-housing)',
      link: '/categories',
    },
    {
      id: 'reminders',
      title: 'Reminders',
      body: 'Get notified when a bill is due',
      icon: 'bell',
      color: 'var(--color-cat-misc)',
      soon: true,
    },
    {
      id: 'export',
      title: 'Export Data',
      body: 'Download your transactions as CSV',
      icon: 'fileDown',
      color: 'var(--color-cat-food)',
      action: 'export',
    },
    {
      id: 'reset',
      title: 'Reset Data',
      body: 'Start fresh, or restore the demo dataset',
      icon: 'refresh',
      color: 'var(--color-cat-savings)',
      action: 'reset',
    },
    {
      id: 'faq',
      title: 'FAQ',
      body: 'Frequently asked questions',
      icon: 'help',
      color: 'var(--color-cat-misc)',
      link: '/settings',
    },
    {
      id: 'contact',
      title: 'Contact',
      body: 'Tell us what is on your mind',
      icon: 'message',
      color: 'var(--color-cat-income)',
      link: '/settings',
    },
  ];

  protected readonly resetOptions: PickerOption[] = [
    {
      id: 'demo',
      label: 'Restore the demo dataset',
      caption: 'Replaces your data with the seeded demo workspace',
      icon: 'sparkle',
      color: 'var(--color-cat-savings)',
    },
    {
      id: 'empty',
      label: 'Clear all my data',
      caption: 'Removes transactions, wallets and budgets, keeps your account',
      icon: 'trash',
      color: 'var(--color-negative)',
    },
  ];

  protected run(card: ToolCard): void {
    if (card.action === 'export') {
      exportTransactionsCsv(
        this.store.transactions(),
        this.store.categoriesById(),
        this.store.walletsById(),
      );
      return;
    }
    if (card.action === 'reset') this.resetOpen.set(true);
  }

  protected async reset(mode: string): Promise<void> {
    this.resetOpen.set(false);
    const demo = mode === 'demo';
    const confirmed = await this.confirm.ask({
      title: demo ? 'Restore the demo dataset?' : 'Clear all your data?',
      message: demo
        ? 'Your current transactions, wallets and budgets in Firestore are replaced by the seeded demo workspace. This only affects your own account.'
        : 'Every transaction, wallet and budget in your Firestore account is removed. Your sign in details are untouched. This cannot be undone.',
      confirmLabel: demo ? 'Restore demo data' : 'Clear everything',
    });
    if (!confirmed) return;
    try {
      if (demo) await this.store.resetToDemo();
      else await this.store.resetToEmpty();
    } catch {
      // BudgetStore surfaces the error for the tools page alert.
    }
  }

  protected async signOut(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Sign out of Budgee?',
      message: 'Your data stays saved and comes back the next time you sign in.',
      confirmLabel: 'Sign out',
      destructive: false,
    });
    if (!confirmed) return;
    await this.session.signOut();
    await this.router.navigateByUrl('/welcome');
  }
}
