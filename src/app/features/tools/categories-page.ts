import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { CategoryMark } from '../../shared/ui/category-mark';
import { SheetShell } from '../../shared/ui/sheet-shell';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { createId } from '../../core/util/id.util';
import { CATEGORY_IDS } from '../../core/data/taxonomy';
import type { Category, CategoryKind } from '../../core/models';
import { ICONS, type IconName } from '../../shared/ui/icon-set';

const PALETTE = [
  'var(--color-cat-housing)',
  'var(--color-cat-food)',
  'var(--color-cat-entertainment)',
  'var(--color-cat-transport)',
  'var(--color-cat-lifestyle)',
  'var(--color-cat-savings)',
  'var(--color-cat-income)',
  'var(--color-cat-misc)',
];

/** Create, rename and remove categories. */
@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CategoryMark, SheetShell],
  host: { class: 'flex min-h-[100dvh] flex-col' },
  template: `
    <main
      class="flex-1 px-4"
      style="padding-top: calc(var(--safe-top) + 1rem); padding-bottom: var(--nav-clearance)"
    >
      <div class="flex min-h-[3rem] items-center gap-2">
        <a
          routerLink="/tools"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink"
          aria-label="Back to tools"
        >
          <app-icon name="chevronLeft" [size]="20" />
        </a>
        <h1 class="flex-1 text-center text-[1.15rem] font-semibold text-ink">Categories</h1>
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full border border-line text-ink"
          aria-label="Add a category"
          (click)="startCreate()"
        >
          <app-icon name="plus" [size]="20" />
        </button>
      </div>

      @for (group of grouped(); track group.id) {
        <h2 class="mt-6 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          {{ group.name }}
        </h2>
        <ul class="overflow-hidden rounded-[1.5rem] bg-raised">
          @for (category of group.categories; track category.id) {
            <li>
              <button
                type="button"
                class="flex min-h-[4rem] w-full items-center gap-3 px-4 text-left not-first:border-t not-first:border-line"
                (click)="startEdit(category)"
              >
                <app-category-mark [icon]="category.icon" [color]="category.color" [size]="40" [solid]="true" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[1rem] text-ink">{{ category.name }}</span>
                  <span class="block text-[0.8rem] text-ink-muted">{{ kindLabel(category.kind) }}</span>
                </span>
                <app-icon name="chevronRight" [size]="18" />
              </button>
            </li>
          }
        </ul>
      }
    </main>

    @if (editing(); as draft) {
      <app-sheet-shell
        [title]="isNew() ? 'New category' : 'Edit category'"
        (dismiss)="editing.set(null)"
      >
        <label class="mt-2 block rounded-[1.25rem] bg-raised px-4 py-3">
          <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Name
          </span>
          <input
            type="text"
            class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
            [value]="draft.name"
            (input)="patch({ name: $any($event.target).value })"
          />
        </label>

        <fieldset class="mt-4">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Type
          </legend>
          <div class="mt-2 flex gap-2">
            @for (kind of kinds; track kind) {
              <button
                type="button"
                class="min-h-[2.75rem] flex-1 rounded-full text-[0.85rem] font-semibold"
                [style.background]="draft.kind === kind ? 'var(--color-accent)' : 'var(--color-raised)'"
                [style.color]="draft.kind === kind ? 'var(--color-accent-ink)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft.kind === kind"
                (click)="patch({ kind })"
              >
                {{ kindLabel(kind) }}
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Group
          </legend>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (group of store.groups(); track group.id) {
              <button
                type="button"
                class="min-h-[2.5rem] rounded-full px-4 text-[0.85rem]"
                [style.background]="draft.groupId === group.id ? 'var(--color-raised-2)' : 'var(--color-raised)'"
                [style.color]="draft.groupId === group.id ? 'var(--color-ink)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft.groupId === group.id"
                (click)="patch({ groupId: group.id })"
              >
                {{ group.name }}
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Colour
          </legend>
          <div class="mt-2 flex flex-wrap gap-3">
            @for (color of palette; track color) {
              <button
                type="button"
                class="size-9 rounded-full border-2"
                [style.background]="color"
                [style.border-color]="draft.color === color ? 'var(--color-ink)' : 'transparent'"
                [attr.aria-pressed]="draft.color === color"
                [attr.aria-label]="'Colour ' + color"
                (click)="patch({ color })"
              ></button>
            }
          </div>
        </fieldset>

        <fieldset class="mt-5">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Icon
          </legend>
          <div class="mt-2 grid grid-cols-6 gap-2">
            @for (icon of iconNames; track icon) {
              <button
                type="button"
                class="flex size-12 items-center justify-center rounded-2xl"
                [style.background]="draft.icon === icon ? 'color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'var(--color-raised)'"
                [style.color]="draft.icon === icon ? 'var(--color-accent)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft.icon === icon"
                [attr.aria-label]="'Icon ' + icon"
                (click)="patch({ icon })"
              >
                <app-icon [name]="icon" [size]="20" />
              </button>
            }
          </div>
        </fieldset>

        @if (!isNew() && !draft.system) {
          <button
            type="button"
            class="mt-6 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[0.95rem] font-semibold"
            style="color: #ffa9ac"
            (click)="remove(draft)"
          >
            Delete category
          </button>
        }

        <div sheetFooter class="pt-4">
          <button
            type="button"
            class="min-h-[3.4rem] w-full rounded-full bg-white text-[1rem] font-semibold text-ink-inverse"
            (click)="save()"
          >
            Save
          </button>
        </div>
      </app-sheet-shell>
    }
  `,
})
export class CategoriesPage {
  protected readonly store = inject(BudgetStore);
  private readonly confirm = inject(ConfirmService);

  protected readonly palette = PALETTE;
  protected readonly kinds: CategoryKind[] = ['expense', 'income', 'transfer'];
  protected readonly iconNames = Object.keys(ICONS) as IconName[];

  protected readonly editing = signal<Category | null>(null);
  protected readonly isNew = signal(false);

  protected readonly grouped = computed(() => {
    const categories = this.store.categories();
    return this.store
      .groups()
      .map((group) => ({
        id: group.id,
        name: group.name,
        categories: categories.filter((c) => c.groupId === group.id),
      }))
      .filter((g) => g.categories.length > 0);
  });

  protected kindLabel(kind: CategoryKind): string {
    return kind === 'income' ? 'Income' : kind === 'transfer' ? 'Transfer' : 'Expense';
  }

  protected startCreate(): void {
    this.isNew.set(true);
    this.editing.set({
      id: createId('cat'),
      name: '',
      groupId: this.store.groups()[0]?.id ?? '',
      kind: 'expense',
      icon: 'box',
      color: PALETTE[0],
    });
  }

  protected startEdit(category: Category): void {
    this.isNew.set(false);
    this.editing.set(category);
  }

  protected patch(patch: Partial<Category>): void {
    this.editing.update((current) => (current ? { ...current, ...patch } : current));
  }

  protected save(): void {
    const draft = this.editing();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    this.store.upsertCategory({ ...draft, name });
    this.editing.set(null);
  }

  protected async remove(category: Category): Promise<void> {
    const used = this.store.transactions().filter((t) => t.categoryId === category.id).length;
    const confirmed = await this.confirm.ask({
      title: `Delete ${category.name}?`,
      message:
        used > 0
          ? `${used} ${used === 1 ? 'transaction moves' : 'transactions move'} to Miscellaneous, and the category is removed from every budget plan.`
          : 'The category is removed from every budget plan.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.store.deleteCategory(category.id, CATEGORY_IDS.misc);
    this.editing.set(null);
  }
}
