import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Text based merchant mark. Budgee never renders a third party logo, so a
 * merchant is represented by its initial on a tinted tile.
 */
@Component({
  selector: 'app-recurring-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span
      class="flex items-center justify-center rounded-2xl font-bold"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="color()"
      [style.font-size.px]="size() * 0.42"
      style="color: #14181a"
      aria-hidden="true"
    >
      {{ initial() }}
    </span>
  `,
})
export class RecurringMark {
  readonly merchant = input.required<string>();
  readonly color = input('var(--color-cat-housing)');
  readonly size = input(48);

  protected readonly initial = computed(() => {
    const trimmed = this.merchant().trim();
    return trimmed ? trimmed[0].toUpperCase() : '?';
  });
}
