import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Rounded connection status chip shown at the top of the Budgee tab. */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="mx-auto inline-flex flex-col items-center rounded-[1.5rem] border border-line bg-surface px-6 py-3 text-center"
    >
      <span class="text-[1rem] font-semibold text-ink">{{ title() }}</span>
      <span class="mt-0.5 flex items-center gap-1.5 text-[0.82rem] text-ink-muted">
        <span
          class="size-2 rounded-full"
          [style.background]="connected() ? 'var(--color-accent)' : 'var(--color-ink-faint)'"
        ></span>
        {{ caption() }}
      </span>
    </div>
  `,
})
export class StatusPill {
  readonly title = input.required<string>();
  readonly caption = input.required<string>();
  readonly connected = input(false);
}
