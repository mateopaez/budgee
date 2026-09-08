import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthLayout } from './auth-layout';
import { AuthMessage } from './auth-controls';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLayout, AuthMessage, ReactiveFormsModule, RouterLink, Icon],
  template: `
    <app-auth-layout
      heading="Reset your password"
      subheading="Tell us the email on your account and we will send a link to choose a new password."
    >
      <a
        authNav
        routerLink="/sign-in"
        class="flex size-11 items-center justify-center rounded-full border border-line text-ink-muted"
        aria-label="Back to sign in"
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

        @if (submitted && form.invalid) {
          <p role="alert" class="text-[0.85rem] text-[color:var(--color-negative)]">
            Enter a valid email address.
          </p>
        }

        <app-auth-message [error]="auth.error()" [notice]="auth.notice()" />

        <button
          type="submit"
          class="mt-2 min-h-[3.25rem] rounded-full bg-white text-[1rem] font-semibold text-ink-inverse disabled:opacity-60"
          [disabled]="auth.busy()"
        >
          {{ auth.busy() ? 'Sending...' : 'Send reset link' }}
        </button>
      </form>
    </app-auth-layout>
  `,
})
export class ForgotPasswordPage {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected submitted = false;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid) return;
    await this.auth.sendPasswordReset(this.form.getRawValue().email);
  }
}
