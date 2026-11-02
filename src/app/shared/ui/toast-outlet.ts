import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/** Renders the current toast above the bottom navigation. Mounted once at the root. */
@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-3',
    style: 'padding-bottom: calc(var(--safe-bottom) + 5.25rem)',
  },
  template: `
    <div role="status" aria-live="polite" aria-atomic="true">
      @if (toasts.current(); as toast) {
        <div
          class="pointer-events-auto flex min-h-[3rem] items-center gap-3 rounded-full border border-line-strong bg-raised-2 py-1.5 pr-1.5 pl-5 shadow-lg"
        >
          <span class="flex-1 text-[0.92rem] font-semibold text-ink">{{ toast.message }}</span>
          @if (toast.action; as action) {
            <button
              type="button"
              class="min-h-[2.5rem] rounded-full bg-white px-4 text-[0.9rem] font-semibold text-ink-inverse"
              (click)="toasts.runAction()"
            >
              {{ action.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
