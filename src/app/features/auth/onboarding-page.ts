import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthLayout } from './auth-layout';
import { AuthService } from '../../core/auth/auth.service';
import { SessionService } from '../../core/state/session.service';
import { BudgetStore } from '../../core/state/budget-store';
import { Icon } from '../../shared/ui/icon';

/**
 * One decision: start from a seeded demo workspace, or start from nothing.
 * Either choice writes only into the signed in user's own Firestore documents.
 */
@Component({
  selector: 'app-onboarding-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, Icon],
  template: `
    <app-auth-layout
      [heading]="'Hi ' + firstName() + ', how do you want to start?'"
      subheading="You can switch later. Demo data is written to your account only, and you can reset it any time from Tools."
    >
      <div class="mt-8 flex flex-col gap-4">
        <button
          type="button"
          class="rounded-[1.5rem] border p-5 text-left transition-colors disabled:opacity-60"
          [class.border-line]="choice() !== 'demo'"
          [style.border-color]="choice() === 'demo' ? 'var(--color-accent)' : undefined"
          [style.background]="choice() === 'demo' ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))' : 'var(--color-surface)'"
          [disabled]="busy()"
          (click)="choice.set('demo')"
        >
          <span class="flex items-center gap-3">
            <span
              class="flex size-10 items-center justify-center rounded-full"
              style="background: color-mix(in srgb, var(--color-accent) 22%, transparent); color: var(--color-accent)"
            >
              <app-icon name="sparkle" [size]="20" />
            </span>
            <span class="text-[1.05rem] font-semibold text-ink">Start with demo data</span>
          </span>
          <span class="mt-3 block text-[0.9rem] leading-relaxed text-ink-muted">
            Three months of sample Canadian transactions, wallets, categories and a monthly budget,
            so every screen has something to show straight away.
          </span>
        </button>

        <button
          type="button"
          class="rounded-[1.5rem] border p-5 text-left transition-colors disabled:opacity-60"
          [class.border-line]="choice() !== 'manual'"
          [style.border-color]="choice() === 'manual' ? 'var(--color-accent)' : undefined"
          [style.background]="choice() === 'manual' ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))' : 'var(--color-surface)'"
          [disabled]="busy()"
          (click)="choice.set('manual')"
        >
          <span class="flex items-center gap-3">
            <span
              class="flex size-10 items-center justify-center rounded-full"
              style="background: color-mix(in srgb, var(--color-accent) 22%, transparent); color: var(--color-accent)"
            >
              <app-icon name="pencil" [size]="20" />
            </span>
            <span class="text-[1.05rem] font-semibold text-ink">Start manually</span>
          </span>
          <span class="mt-3 block text-[0.9rem] leading-relaxed text-ink-muted">
            An empty workspace with the default categories and two wallets. Add your own
            transactions and build a budget from scratch.
          </span>
        </button>

        <p class="rounded-2xl border border-line bg-surface px-4 py-3 text-[0.85rem] text-ink-muted">
          Bank sync is coming soon. For now you add transactions manually or use demo data.
        </p>

        @if (busy()) {
          <p class="text-center text-[0.9rem] text-ink-muted" role="status" aria-live="polite">
            {{ choice() === 'demo' ? 'Seeding your demo data into Firestore…' : 'Setting up your account…' }}
          </p>
        }

        @if (error(); as message) {
          <p
            class="rounded-2xl border px-4 py-3 text-[0.9rem]"
            style="border-color: color-mix(in srgb, var(--color-negative) 40%, transparent); color: #ffa9ac"
            role="alert"
          >
            {{ message }}
          </p>
        }
      </div>

      <div authFooter class="mt-8">
        <button
          type="button"
          class="min-h-[3.25rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-60"
          [disabled]="busy()"
          (click)="start()"
        >
          {{ busy() ? 'Setting things up...' : error() ? 'Try again' : 'Continue' }}
        </button>
      </div>
    </app-auth-layout>
  `,
})
export class OnboardingPage {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly store = inject(BudgetStore);
  private readonly router = inject(Router);

  protected readonly choice = signal<'demo' | 'manual'>('demo');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected firstName(): string {
    const name = this.auth.user()?.displayName?.trim();
    if (name) return name.split(' ')[0];
    const email = this.auth.user()?.email ?? '';
    return email ? email.split('@')[0] : 'there';
  }

  protected async start(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.session.startWorkspace(this.choice());
      await this.router.navigateByUrl(this.choice() === 'demo' ? '/overview' : '/budgee');
    } catch {
      this.error.set(
        this.store.error() ??
          'Could not save your workspace to Firestore. Check your connection and try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
