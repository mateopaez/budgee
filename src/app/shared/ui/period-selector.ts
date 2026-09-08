import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

/** Rounded "previous / label / next" strip used above period scoped content. */
@Component({
  selector: 'app-period-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="flex items-center justify-between rounded-[1.75rem] bg-raised px-2 py-3">
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
        [attr.aria-label]="previousLabel()"
        (click)="step.emit(-1)"
      >
        <app-icon name="chevronLeft" [size]="22" />
      </button>
      <div class="min-w-0 text-center">
        <p class="truncate text-[1.05rem] font-semibold text-ink">{{ label() }}</p>
        @if (caption()) {
          <p class="mt-0.5 text-[0.7rem] tracking-[0.12em] text-ink-muted uppercase">
            {{ caption() }}
          </p>
        }
      </div>
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
        [attr.aria-label]="nextLabel()"
        (click)="step.emit(1)"
      >
        <app-icon name="chevronRight" [size]="22" />
      </button>
    </div>
  `,
})
export class PeriodSelector {
  readonly label = input.required<string>();
  readonly caption = input('');
  readonly previousLabel = input('Previous period');
  readonly nextLabel = input('Next period');
  readonly step = output<number>();
}
