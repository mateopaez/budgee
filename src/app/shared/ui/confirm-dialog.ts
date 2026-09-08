import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Renders the pending confirmation request, if any. Mounted once in the shell. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.pending(); as request) {
      <div
        class="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px]"
        (keydown.escape)="confirm.answer(false)"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="request.title"
          class="w-full max-w-[400px] rounded-[1.5rem] border border-line bg-raised p-5"
          style="margin-bottom: calc(var(--safe-bottom) + 1rem)"
        >
          <h2 class="text-[1.1rem] font-semibold text-ink">{{ request.title }}</h2>
          <p class="mt-2 text-[0.9rem] leading-relaxed text-ink-muted">{{ request.message }}</p>
          <div class="mt-5 flex gap-3">
            <button
              type="button"
              class="min-h-[3rem] flex-1 rounded-full border border-line text-[0.95rem] font-semibold text-ink"
              (click)="confirm.answer(false)"
            >
              {{ request.cancelLabel }}
            </button>
            <button
              type="button"
              class="min-h-[3rem] flex-1 rounded-full text-[0.95rem] font-semibold"
              [style.background]="request.destructive ? 'var(--color-negative)' : 'var(--color-accent)'"
              [style.color]="request.destructive ? '#fff' : 'var(--color-accent-ink)'"
              cdkFocusInitial
              autofocus
              (click)="confirm.answer(true)"
            >
              {{ request.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
}
