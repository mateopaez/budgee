import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from './auth-layout';
import { AuthMessage } from './auth-controls';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-welcome-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, AuthMessage, RouterLink, Icon],
  template: `
    <app-auth-layout
      heading="Money, minus the guesswork."
      subheading="Budgee keeps your Canadian dollars organised: plan a budget, track what you spend and see where it went."
    >
      <div class="mt-8 flex flex-col gap-3" aria-hidden="true">
        @for (point of points; track point.title) {
          <div class="flex items-start gap-3 rounded-[1.25rem] border border-line bg-surface p-4">
            <span
              class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
              style="background: color-mix(in srgb, var(--color-accent) 20%, transparent); color: var(--color-accent)"
            >
              <app-icon [name]="point.icon" [size]="18" />
            </span>
            <span>
              <span class="block text-[0.95rem] font-semibold text-ink">{{ point.title }}</span>
              <span class="mt-0.5 block text-[0.85rem] text-ink-muted">{{ point.body }}</span>
            </span>
          </div>
        }
      </div>

      <app-auth-message [error]="auth.error()" />

      <div authFooter class="mt-8 flex flex-col gap-3">
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-60"
          [disabled]="auth.busy()"
          (click)="continueWithGoogle()"
        >
          {{ auth.busy() ? 'Opening Google...' : 'Continue with Google' }}
        </button>
        <a
          routerLink="/sign-up"
          class="flex min-h-[3.25rem] items-center justify-center rounded-full border border-line-strong text-[1rem] font-semibold text-ink"
        >
          Sign up with email
        </a>
        <p class="pt-1 text-center text-[0.9rem] text-ink-muted">
          Already have an account?
          <a routerLink="/sign-in" class="font-semibold text-ink underline underline-offset-4">
            Sign in
          </a>
        </p>
      </div>
    </app-auth-layout>
  `,
})
export class WelcomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly points = [
    { icon: 'pie', title: 'Plan a real budget', body: 'Set what each category gets, then watch what is left.' },
    { icon: 'eye', title: 'See every dollar', body: 'Charts, a spend calendar and a clear monthly list.' },
    { icon: 'repeat', title: 'Spot recurring bills', body: 'Budgee finds the payments that come back each month.' },
  ] as const;

  protected async continueWithGoogle(): Promise<void> {
    if (await this.auth.signInWithGoogle()) {
      await this.router.navigateByUrl('/onboarding');
    }
  }
}
