import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../ui/icon';
import type { IconName } from '../ui/icon-set';

/**
 * Category progress ring. The disc is filled with the category colour and the
 * ring around it shows how much of the plan has been used.
 */
@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'inline-block' },
  template: `
    <div class="relative" [style.width.px]="size()" [style.height.px]="size()">
      <svg
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        class="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          stroke="var(--color-sunken)"
          [attr.stroke-width]="stroke()"
        />
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="over() ? 'var(--color-negative)' : color()"
          [attr.stroke-width]="stroke()"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
          stroke-linecap="butt"
        />
      </svg>
      <span
        class="absolute inset-0 m-auto flex items-center justify-center rounded-full"
        [style.width.px]="innerSize()"
        [style.height.px]="innerSize()"
        [style.background]="color()"
        [style.box-shadow]="'0 0 18px color-mix(in srgb, ' + color() + ' 45%, transparent)'"
        [style.color]="'#0b1113'"
      >
        <app-icon [name]="icon()" [size]="innerSize() * 0.48" [strokeWidth]="2.1" />
      </span>
    </div>
  `,
})
export class ProgressRing {
  readonly icon = input.required<IconName>();
  readonly progress = input.required<number>();
  readonly color = input('var(--color-accent)');
  readonly size = input(84);
  readonly stroke = input(7);
  readonly over = input(false);

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.size() / 2 - this.stroke() / 2);
  protected readonly innerSize = computed(() => this.size() - this.stroke() * 2 - 8);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly dashOffset = computed(() => {
    const clamped = Math.min(1, Math.max(0, this.progress()));
    return this.circumference() * (1 - clamped);
  });
}
