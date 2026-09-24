import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { CategoryMark } from '../../shared/ui/category-mark';
import { blankCategory, CategoryEditorSheet } from '../../shared/ui/category-editor-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { CATEGORY_IDS } from '../../core/data/taxonomy';
import type { Category, CategoryKind } from '../../core/models';

/** Create, rename and remove categories. */
@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CategoryMark, CategoryEditorSheet],
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
      <app-category-editor-sheet
        [category]="draft"
        [isNew]="isNew()"
        (saved)="save($event)"
        (removed)="remove($event)"
        (dismissed)="editing.set(null)"
      />
    }
  `,
})
export class CategoriesPage {
  protected readonly store = inject(BudgetStore);
  private readonly confirm = inject(ConfirmService);

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
    this.editing.set(blankCategory(this.store.groups()[0]?.id ?? ''));
  }

  protected startEdit(category: Category): void {
    this.isNew.set(false);
    this.editing.set(category);
  }

  protected save(category: Category): void {
    this.store.upsertCategory(category);
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
