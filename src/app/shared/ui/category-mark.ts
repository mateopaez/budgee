import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';
import type { IconName } from './icon-set';

/**
 * Generated category mark: a tinted disc with the category icon.
 * Replaces third party merchant logos everywhere in the app.
 */
@Component({
  selector: 'app-category-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'inline-flex' },
  template: `
    <span
      class="flex items-center justify-center rounded-full"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="solid() ? color() : 'color-mix(in srgb, ' + color() + ' 22%, transparent)'"
      [style.color]="solid() ? '#ffffff' : color()"
    >
      <app-icon [name]="icon()" [size]="size() * 0.5" [strokeWidth]="2" />
    </span>
  `,
})
export class CategoryMark {
  readonly icon = input.required<IconName>();
  readonly color = input('var(--color-cat-misc)');
  readonly size = input(40);
  readonly solid = input(false);
}
