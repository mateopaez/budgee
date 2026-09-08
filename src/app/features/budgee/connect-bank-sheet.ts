import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { Icon } from '../../shared/ui/icon';
import { BudgetStore } from '../../core/state/budget-store';

/**
 * Bank connection sheet.
 *
 * There is no live aggregation in this MVP, so the sheet is honest about it:
 * account linking is marked as coming soon and the only working path is the
 * demo dataset, which is clearly labelled as demo.
 */
@Component({
  selector: 'app-connect-bank-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon],
  template: `
    <app-sheet-shell title="Connect your accounts" (dismiss)="close.emit()">
      <div
        aria-hidden="true"
        class="mt-2 flex h-44 items-center justify-center rounded-[1.5rem]"
        style="background: radial-gradient(120% 100% at 30% 20%, color-mix(in srgb, var(--color-accent) 45%, transparent), transparent 70%), var(--color-raised)"
      >
        <span
          class="flex size-20 items-center justify-center rounded-[1.75rem]"
          style="background: var(--accent-gradient); color: var(--color-accent-ink)"
        >
          <app-icon name="bank" [size]="38" [strokeWidth]="1.8" />
        </span>
      </div>

      <h2 class="mt-6 text-[1.5rem] leading-tight font-bold text-ink">
        Bank sync is coming soon
      </h2>
      <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
        Budgee does not link to real banks yet. Nothing on this screen contacts a financial
        institution. Add transactions manually, or load the demo dataset to explore every screen.
      </p>

      <ul class="mt-6 flex flex-col gap-3">
        @for (row of accountTypes; track row.label) {
          <li
            class="flex items-center gap-3 rounded-[1.25rem] border border-line bg-raised px-4 py-4 opacity-60"
          >
            <span
              class="flex size-10 items-center justify-center rounded-xl"
              [style.background]="'color-mix(in srgb, ' + row.color + ' 22%, transparent)'"
              [style.color]="row.color"
            >
              <app-icon [name]="row.icon" [size]="20" />
            </span>
            <span class="flex-1 text-[0.98rem] font-semibold text-ink">{{ row.label }}</span>
            <span class="rounded-full border border-line px-3 py-1 text-[0.72rem] text-ink-muted">
              Soon
            </span>
          </li>
        }
      </ul>

      <p class="mt-6 text-center text-[0.78rem] text-ink-faint">
        When account linking arrives it will run through a secure server side integration. No
        provider keys or access tokens will ever live in this app.
      </p>

      <div sheetFooter class="flex flex-col gap-3 pt-4">
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full bg-white text-[1rem] font-semibold text-ink-inverse"
          (click)="loadDemo()"
        >
          Load the demo dataset
        </button>
        <button
          type="button"
          class="min-h-[3.25rem] rounded-full border border-line-strong text-[1rem] font-semibold text-ink"
          (click)="close.emit()"
        >
          I will add transactions myself
        </button>
      </div>
    </app-sheet-shell>
  `,
})
export class ConnectBankSheet {
  private readonly store = inject(BudgetStore);
  readonly close = output<void>();

  protected readonly accountTypes = [
    { label: 'Chequing account', icon: 'bank', color: 'var(--color-cat-transport)' },
    { label: 'Credit card', icon: 'card', color: 'var(--color-cat-entertainment)' },
    { label: 'Savings account', icon: 'piggy', color: 'var(--color-cat-savings)' },
  ] as const;

  protected async loadDemo(): Promise<void> {
    await this.store.resetToDemo();
    this.close.emit();
  }
}
