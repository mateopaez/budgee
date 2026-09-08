import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Pill segmented control used in the Overview and Budget headers.
 * Implemented as an ARIA tablist so arrow keys move between segments.
 */
@Component({
  selector: 'app-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="tablist"
      [attr.aria-label]="ariaLabel()"
      class="no-scrollbar flex items-center justify-center gap-1 overflow-x-auto"
      (keydown)="onKeydown($event)"
    >
      @for (option of options(); track option.id) {
        <button
          type="button"
          role="tab"
          [id]="'tab-' + option.id"
          [attr.aria-selected]="option.id === selected()"
          [attr.tabindex]="option.id === selected() ? 0 : -1"
          class="min-h-[2.75rem] shrink-0 rounded-full px-4 text-[0.78rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors"
          [class.bg-white/22]="option.id === selected()"
          [class.text-white]="option.id === selected()"
          [class.text-white/70]="option.id !== selected()"
          (click)="select.emit(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedTabs {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly selected = input.required<string>();
  readonly ariaLabel = input('Sections');
  readonly select = output<string>();

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const list = this.options();
    const index = list.findIndex((o) => o.id === this.selected());
    if (index < 0) return;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = list[(index + delta + list.length) % list.length];
    this.select.emit(next.id);
    event.preventDefault();
  }
}
