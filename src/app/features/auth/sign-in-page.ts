import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from './auth-layout';
import { AuthMessage } from './auth-controls';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, AuthMessage, ReactiveFormsModule, RouterLink, Icon],
  template: `
    <app-auth-layout heading="Welcome back" subheading="Sign in to pick up where you left off.">
      <a
        authNav
        routerLink="/welcome"
        class="flex size-11 items-center justify-center rounded-full border border-line text-ink-muted"
        aria-label="Back to welcome"
      >
        <app-icon name="chevronLeft" [size]="22" />
      </a>

      <form class="mt-7 flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <label class="flex flex-col gap-2">
          <span class="text-[0.75rem] font-semibold tracking-[0.12em] text-ink-muted uppercase">
            Email
          </span>
          <input
            type="email"
            inputmode="email"
            autocomplete="email"
            formControlName="email"
            class="min-h-[3.25rem] rounded-2xl border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-ink-faint"
            placeholder="you@example.com"
          />
        </label>

        <label class="flex flex-col gap-2">
          <span class="text-[0.75rem] font-semibold tracking-[0.12em] text-ink-muted uppercase">
            Password
          </span>
          <input
            type="password"
            autocomplete="current-password"
            formControlName="password"
            class="min-h-[3.25rem] rounded-2xl border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-ink-faint"
            placeholder="Your password"
          />
        </label>

        @if (submitted && form.invalid) {
          <p role="alert" class="text-[0.85rem] text-[color:var(--color-negative)]">
            Enter a valid email address and your password.
          </p>
        }

        <app-auth-message [error]="auth.error()" />

        <button
          type="submit"
          class="mt-2 min-h-[3.25rem] rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-60"
          [disabled]="auth.busy()"
        >
          {{ auth.busy() ? 'Signing in...' : 'Sign in' }}
        </button>

        <a
          routerLink="/forgot-password"
          class="text-center text-[0.9rem] text-ink-muted underline underline-offset-4"
        >
          Forgot your password?
        </a>
      </form>

      <div authFooter class="mt-8 flex flex-col gap-3">
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full border border-line-strong text-[1rem] font-semibold text-ink disabled:opacity-60"
          [disabled]="auth.busy()"
          (click)="google()"
        >
          Continue with Google
        </button>
        <p class="text-center text-[0.9rem] text-ink-muted">
          New here?
          <a routerLink="/sign-up" class="font-semibold text-ink underline underline-offset-4">
            Create an account
          </a>
        </p>
      </div>
    </app-auth-layout>
  `,
})
export class SignInPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected submitted = false;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async submit(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    if (await this.auth.signInWithEmail(email, password)) {
      await this.router.navigateByUrl('/');
    }
  }

  protected async google(): Promise<void> {
    if (await this.auth.signInWithGoogle()) {
      await this.router.navigateByUrl('/');
    }
  }
}
