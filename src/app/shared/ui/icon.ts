import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName, type IconShape } from './icon-set';

/**
 * Renders one icon from the Budgee icon set as inline SVG.
 * Decorative by default; pass a `label` to expose it to assistive technology.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      focusable="false"
    >
      @for (d of shape().d ?? []; track d) {
        <path [attr.d]="d" />
      }
      @for (c of shape().c ?? []; track c[0] + ':' + c[1] + ':' + c[2]) {
        <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2]" />
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.9);
  readonly label = input('');

  protected readonly shape = computed<IconShape>(() => ICONS[this.name()]);
}
