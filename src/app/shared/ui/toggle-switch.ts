import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Accessible switch styled to match the rest of the system. */
@Component({
  selector: 'app-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      class="relative inline-flex h-8 w-[3.4rem] shrink-0 items-center rounded-full border border-line transition-colors disabled:opacity-45"
      [style.background]="checked() ? 'var(--color-accent)' : 'var(--color-sunken)'"
      (click)="toggle.emit(!checked())"
    >
      <span
        class="ml-1 block size-6 rounded-full bg-white transition-transform"
        [style.transform]="checked() ? 'translateX(1.4rem)' : 'translateX(0)'"
      ></span>
    </button>
  `,
})
export class ToggleSwitch {
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly toggle = output<boolean>();
}
