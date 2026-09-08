import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';
import { Icon } from './icon';

/**
 * Full height sheet used for modal routes such as the transaction editor.
 * Focus moves into the sheet on open and Escape asks the host to dismiss.
 */
@Component({
  selector: 'app-sheet-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    class: 'fixed inset-0 z-50 flex justify-center bg-black/55 backdrop-blur-[2px]',
    '(keydown.escape)': 'dismiss.emit()',
  },
  template: `
    <section
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      tabindex="-1"
      class="flex h-full w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.75rem] bg-surface outline-none"
      style="margin-top: calc(var(--safe-top) + 0.75rem)"
    >
      <header class="flex shrink-0 items-center gap-3 px-4 pt-4 pb-3">
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:text-ink"
          [attr.aria-label]="closeLabel()"
          (click)="dismiss.emit()"
        >
          <app-icon [name]="backVariant() ? 'chevronLeft' : 'x'" [size]="22" />
        </button>
        <h1 class="flex-1 text-center text-[1.05rem] font-semibold text-ink">{{ title() }}</h1>
        <div class="flex size-11 items-center justify-center">
          <ng-content select="[sheetAction]" />
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <ng-content />
      </div>
      <footer class="shrink-0 px-4" style="padding-bottom: calc(var(--safe-bottom) + 0.75rem)">
        <ng-content select="[sheetFooter]" />
      </footer>
    </section>
  `,
})
export class SheetShell {
  readonly title = input.required<string>();
  readonly closeLabel = input('Close');
  readonly backVariant = input(false);
  readonly dismiss = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    });
  }
}
