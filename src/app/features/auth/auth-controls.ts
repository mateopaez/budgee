import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inline error banner shared by the auth screens. */
@Component({
  selector: 'app-auth-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <p
        role="alert"
        class="mt-4 rounded-2xl border border-[color:var(--color-negative)]/40 bg-[color:var(--color-negative)]/12 px-4 py-3 text-[0.88rem] text-[color:var(--color-negative)]"
      >
        {{ error() }}
      </p>
    }
    @if (notice()) {
      <p
        role="status"
        class="mt-4 rounded-2xl border border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/12 px-4 py-3 text-[0.88rem] text-[color:var(--color-positive)]"
      >
        {{ notice() }}
      </p>
    }
  `,
})
export class AuthMessage {
  readonly error = input<string | null>(null);
  readonly notice = input<string | null>(null);
}
