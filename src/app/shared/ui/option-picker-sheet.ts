import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SheetShell } from './sheet-shell';
import { CategoryMark } from './category-mark';
import { Icon } from './icon';
import type { IconName } from './icon-set';

export interface PickerOption {
  readonly id: string;
  readonly label: string;
  readonly caption?: string;
  readonly icon?: IconName;
  readonly color?: string;
  readonly groupName?: string;
}

/** Reusable searchable chooser used for categories, wallets and recurrence. */
@Component({
  selector: 'app-option-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, CategoryMark, Icon],
  template: `
    <app-sheet-shell [title]="title()" (dismiss)="cancel.emit()">
      @if (searchable()) {
        <label class="sr-only" [attr.for]="'picker-search'">Search {{ title() }}</label>
        <div class="sticky top-0 z-10 -mx-4 bg-surface px-4 pt-1 pb-3">
          <div class="flex items-center gap-2 rounded-full bg-raised px-4">
            <app-icon name="search" [size]="18" />
            <input
              id="picker-search"
              type="search"
              class="min-h-[3rem] flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-faint"
              placeholder="Search"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </div>
        </div>
      }

      @for (group of grouped(); track group.name) {
        @if (group.name) {
          <h2 class="mt-4 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            {{ group.name }}
          </h2>
        }
        <ul class="flex flex-col">
          @for (option of group.options; track option.id) {
            <li>
              <button
                type="button"
                class="flex min-h-[3.5rem] w-full items-center gap-3 rounded-[1rem] px-2 text-left"
                [class.bg-raised]="option.id === selected()"
                (click)="choose.emit(option.id)"
              >
                @if (option.icon) {
                  <app-category-mark
                    [icon]="option.icon"
                    [color]="option.color ?? 'var(--color-cat-misc)'"
                    [size]="38"
                  />
                }
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[0.98rem] text-ink">{{ option.label }}</span>
                  @if (option.caption) {
                    <span class="block truncate text-[0.82rem] text-ink-muted">
                      {{ option.caption }}
                    </span>
                  }
                </span>
                @if (option.id === selected()) {
                  <app-icon name="check" [size]="20" />
                }
              </button>
            </li>
          }
        </ul>
      }

      @if (grouped().length === 0) {
        <p class="py-10 text-center text-[0.95rem] text-ink-muted">Nothing matches that search.</p>
      }
    </app-sheet-shell>
  `,
})
export class OptionPickerSheet {
  readonly title = input.required<string>();
  readonly options = input.required<readonly PickerOption[]>();
  readonly selected = input<string | null>(null);
  readonly searchable = input(true);
  readonly choose = output<string>();
  readonly cancel = output<void>();

  protected readonly query = signal('');

  protected readonly grouped = computed(() => {
    const q = this.query().trim().toLowerCase();
    const filtered = q
      ? this.options().filter((o) => o.label.toLowerCase().includes(q))
      : this.options();
    const map = new Map<string, PickerOption[]>();
    for (const option of filtered) {
      const key = option.groupName ?? '';
      const list = map.get(key) ?? [];
      list.push(option);
      map.set(key, list);
    }
    return [...map.entries()].map(([name, options]) => ({ name, options }));
  });
}
