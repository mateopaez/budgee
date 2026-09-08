import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';

/**
 * Bank connections.
 *
 * Deliberately a placeholder: there is no aggregation provider in this release
 * and the screen says so rather than showing a flow that pretends to link a
 * real institution.
 */
@Component({
  selector: 'app-bank-connections-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
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
        <h2 class="mt-4 text-[1.25rem] font-semibold text-ink">Bank sync is coming soon</h2>
        <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
          Add transactions manually or use demo data for now. When account linking arrives it will
          run through a secure server side integration, and no provider keys will ever live in this
          app.
        </p>
      </section>

      @if (connections().length > 0) {
        <h2 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Demo connection
        </h2>
        <ul class="overflow-hidden rounded-[1.5rem] bg-raised">
          @for (connection of connections(); track connection.id) {
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

      @if (accounts().length > 0) {
        <h2 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Demo accounts
        </h2>
        <ul class="overflow-hidden rounded-[1.5rem] bg-raised">
          @for (account of accounts(); track account.id) {
            <li class="flex items-center gap-3 px-4 py-4 not-first:border-t not-first:border-line">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[1rem] text-ink">{{ account.name }}</span>
                <span class="block text-[0.82rem] text-ink-muted">
                  {{ account.type }} &middot; ending {{ account.mask }}
                </span>
              </span>
            </li>
          }
        </ul>
      }
    </main>
  `,
})
export class BankConnectionsPage {
  private readonly store = inject(BudgetStore);
  protected readonly connections = computed(() => this.store.connections());
  protected readonly accounts = computed(() => this.store.linkedAccounts());
}
