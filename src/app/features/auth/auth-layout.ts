import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Shared frame for the signed out screens. The decoration is an original
 * CSS gradient wash, not artwork lifted from anywhere.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex min-h-[100dvh] flex-col overflow-hidden bg-canvas' },
  template: `
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-[46vh]">
      <div
        class="absolute -top-32 -left-24 size-[22rem] rounded-full opacity-45 blur-3xl"
        style="background: radial-gradient(circle at 30% 30%, #b558ff, transparent 65%)"
      ></div>
      <div
        class="absolute -top-16 -right-20 size-[18rem] rounded-full opacity-40 blur-3xl"
        style="background: radial-gradient(circle at 60% 40%, #17b899, transparent 65%)"
      ></div>
    </div>

    <main
      class="relative flex min-h-[100dvh] flex-col px-5"
      style="padding-top: calc(var(--safe-top) + 2rem); padding-bottom: calc(var(--safe-bottom) + 1.5rem)"
    >
      <ng-content select="[authNav]" />
      <div class="flex flex-1 flex-col">
        <h1 class="mt-6 text-[2rem] leading-tight font-bold tracking-tight text-ink">
          {{ heading() }}
        </h1>
        @if (subheading()) {
          <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">{{ subheading() }}</p>
        }
        <ng-content />
      </div>
      <ng-content select="[authFooter]" />
    </main>
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly subheading = input('');
}
