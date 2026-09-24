import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { SheetShell } from './sheet-shell';
import { Icon } from './icon';
import { BudgetStore } from '../../core/state/budget-store';
import { ConfirmService } from './confirm.service';
import { createId } from '../../core/util/id.util';
import { GROUP_IDS } from '../../core/data/taxonomy';
import type { Category, CategoryGroup, CategoryKind } from '../../core/models';
import { ICONS, type IconName } from './icon-set';

export const CATEGORY_PALETTE = [
  'var(--color-cat-housing)',
  'var(--color-cat-food)',
  'var(--color-cat-entertainment)',
  'var(--color-cat-transport)',
  'var(--color-cat-lifestyle)',
  'var(--color-cat-savings)',
  'var(--color-cat-income)',
  'var(--color-cat-misc)',
] as const;

/** A blank category ready for the editor. Callers pick the group and kind. */
export function blankCategory(groupId: string, kind: CategoryKind = 'expense'): Category {
  return {
    id: createId('cat'),
    name: '',
    groupId,
    kind,
    icon: 'box',
    color: CATEGORY_PALETTE[0],
  };
}

/**
 * Name, type, group, colour and icon for a category.
 * The host saves or deletes; this sheet only edits a draft.
 */
@Component({
  selector: 'app-category-editor-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Icon],
  template: `
    <app-sheet-shell [title]="isNew() ? 'New category' : 'Edit category'" (dismiss)="dismissed.emit()">
      <label class="mt-2 block rounded-[1.25rem] bg-raised px-4 py-3">
        <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Name
        </span>
        <input
          type="text"
          class="mt-1 min-h-[2.5rem] w-full bg-transparent text-[1.1rem] text-ink outline-none"
          [value]="draft().name"
          [attr.aria-invalid]="nameError() ? true : null"
          [attr.aria-describedby]="nameError() ? 'category-name-error' : null"
          (input)="onNameInput($event)"
        />
      </label>

      @if (nameError()) {
        <p id="category-name-error" role="alert" class="mt-2 text-[0.9rem] text-[color:var(--color-negative)]">
          {{ nameError() }}
        </p>
      }

      @if (!lockKind()) {
        <fieldset class="mt-4">
          <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Type
          </legend>
          <div class="mt-2 flex gap-2">
            @for (kind of kinds; track kind) {
              <button
                type="button"
                class="min-h-[2.75rem] flex-1 rounded-full text-[0.85rem] font-semibold"
                [style.background]="draft().kind === kind ? 'var(--color-accent)' : 'var(--color-raised)'"
                [style.color]="draft().kind === kind ? 'var(--color-accent-ink)' : 'var(--color-ink-muted)'"
                [attr.aria-pressed]="draft().kind === kind"
                (click)="patch({ kind })"
              >
                {{ kindLabel(kind) }}
              </button>
            }
          </div>
        </fieldset>
      }

      @if (lockGroup()) {
        <p class="mt-5">
          <span class="block text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            Group
          </span>
          <span class="mt-1 block text-[1.05rem] text-ink">{{ lockedGroupName() }}</span>
        </p>
      } @else {
      <fieldset class="mt-5">
        <legend class="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Group
        </legend>
        <div class="mt-2 flex flex-wrap gap-2">
          @for (group of store.groups(); track group.id) {
            <button
              type="button"
              class="min-h-[2.5rem] rounded-full px-4 text-[0.85rem]"
              [style.background]="draft().groupId === group.id ? 'var(--color-raised-2)' : 'var(--color-raised)'"
              [style.color]="draft().groupId === group.id ? 'var(--color-ink)' : 'var(--color-ink-muted)'"
              [attr.aria-pressed]="draft().groupId === group.id"
              (click)="patch({ groupId: group.id })"
            >
              {{ group.name }}
            </button>
          }
          @if (!addingGroup()) {
            <button
              type="button"
              class="min-h-[2.5rem] rounded-full border border-line-strong px-4 text-[0.85rem] text-ink"
              (click)="startAddGroup()"
            >
              New group
            </button>
          }
        </div>

        @if (addingGroup()) {
          <div class="mt-3 flex items-center gap-2">
            <label class="min-w-0 flex-1">
              <span class="sr-only">New group name</span>
              <input
                type="text"
                class="min-h-[2.75rem] w-full rounded-full bg-raised px-4 text-[0.95rem] text-ink outline-none"
                placeholder="Group name"
                [value]="groupName()"
                [attr.aria-invalid]="groupError() ? true : null"
                [attr.aria-describedby]="groupError() ? 'group-name-error' : null"
                (input)="onGroupName($event)"
                (keydown.enter)="createGroup()"
              />
            </label>
            <button
              type="button"
              class="min-h-[2.75rem] rounded-full bg-white px-4 text-[0.9rem] font-semibold text-ink-inverse"
              (click)="createGroup()"
            >
              Add
            </button>
            <button
              type="button"
              class="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
              aria-label="Cancel new group"
              (click)="cancelAddGroup()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
        }

        @if (groupError()) {
          <p id="group-name-error" role="alert" class="mt-2 text-[0.9rem] text-[color:var(--color-negative)]">
            {{ groupError() }}
          </p>
        }

        @if (removableGroup(); as group) {
          <button
            type="button"
            class="mt-3 min-h-[2.5rem] text-[0.9rem] font-semibold"
            style="color: #ffa9ac"
            (click)="removeGroup(group)"
          >
            Remove {{ group.name }} group
          </button>
        }
      </fieldset>
      }

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
              [style.border-color]="draft().color === color ? 'var(--color-ink)' : 'transparent'"
              [attr.aria-pressed]="draft().color === color"
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
              [style.background]="draft().icon === icon ? 'color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'var(--color-raised)'"
              [style.color]="draft().icon === icon ? 'var(--color-accent)' : 'var(--color-ink-muted)'"
              [attr.aria-pressed]="draft().icon === icon"
              [attr.aria-label]="'Icon ' + icon"
              (click)="patch({ icon })"
            >
              <app-icon [name]="icon" [size]="20" />
            </button>
          }
        </div>
      </fieldset>

      @if (!isNew() && !draft().system) {
        <button
          type="button"
          class="mt-6 min-h-[3.25rem] w-full rounded-full border border-line-strong text-[0.95rem] font-semibold"
          style="color: #ffa9ac"
          (click)="removed.emit(draft())"
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
  `,
})
export class CategoryEditorSheet {
  protected readonly store = inject(BudgetStore);
  private readonly confirm = inject(ConfirmService);

  readonly category = input.required<Category>();
  readonly isNew = input(false);
  /** Hides the type control. Used when the caller already decided the kind. */
  readonly lockKind = input(false);
  /** Hides group editing. Used when the caller already decided the group. */
  readonly lockGroup = input(false);

  readonly saved = output<Category>();
  readonly removed = output<Category>();
  readonly dismissed = output<void>();

  protected readonly palette = CATEGORY_PALETTE;
  protected readonly kinds: CategoryKind[] = ['expense', 'income', 'transfer'];
  protected readonly iconNames = Object.keys(ICONS) as IconName[];
  protected readonly draft = linkedSignal(() => this.category());
  protected readonly nameError = signal<string | null>(null);
  protected readonly addingGroup = signal(false);
  protected readonly groupName = signal('');
  protected readonly groupError = signal<string | null>(null);

  protected readonly lockedGroupName = computed(
    () => this.store.groupsById().get(this.draft().groupId)?.name ?? 'This group',
  );

  /** The selected group can be removed while another group remains to receive its categories. */
  protected readonly removableGroup = computed(() => {
    const groups = this.store.groups();
    if (groups.length < 2) return null;
    return groups.find((group) => group.id === this.draft().groupId) ?? null;
  });

  protected kindLabel(kind: CategoryKind): string {
    return kind === 'income' ? 'Income' : kind === 'transfer' ? 'Transfer' : 'Expense';
  }

  protected onNameInput(event: Event): void {
    const name = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.nameError.set(null);
    this.patch({ name });
  }

  protected patch(patch: Partial<Category>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
  }

  protected startAddGroup(): void {
    this.groupName.set('');
    this.groupError.set(null);
    this.addingGroup.set(true);
  }

  protected cancelAddGroup(): void {
    this.addingGroup.set(false);
    this.groupName.set('');
    this.groupError.set(null);
  }

  protected onGroupName(event: Event): void {
    const name = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.groupError.set(null);
    this.groupName.set(name);
  }

  protected createGroup(): void {
    const name = this.groupName().trim();
    if (!name) {
      this.groupError.set('Give the group a name.');
      return;
    }
    const groups = this.store.groups();
    const duplicate = groups.some(
      (group) => group.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
    );
    if (duplicate) {
      this.groupError.set('A group with that name already exists.');
      return;
    }
    const order = groups.reduce((max, group) => Math.max(max, group.order), 0) + 1;
    const group: CategoryGroup = {
      id: createId('grp'),
      name,
      color: CATEGORY_PALETTE[groups.length % CATEGORY_PALETTE.length],
      order,
    };
    this.store.upsertGroup(group);
    this.patch({ groupId: group.id });
    this.cancelAddGroup();
  }

  protected async removeGroup(group: CategoryGroup): Promise<void> {
    const remaining = this.store.groups().filter((item) => item.id !== group.id);
    const replacement = remaining.find((item) => item.id === GROUP_IDS.misc) ?? remaining[0];
    if (!replacement) return;
    const count = this.store.categories().filter((category) => category.groupId === group.id).length;
    const confirmed = await this.confirm.ask({
      title: `Remove ${group.name}?`,
      message:
        count > 0
          ? `${count} ${count === 1 ? 'category moves' : 'categories move'} to ${replacement.name}.`
          : 'This group will be deleted.',
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;
    this.store.deleteGroup(group.id, replacement.id);
    if (this.draft().groupId === group.id) this.patch({ groupId: replacement.id });
  }

  protected save(): void {
    const draft = this.draft();
    const name = draft.name.trim();
    if (!name) {
      this.nameError.set('Give the category a name.');
      return;
    }
    this.saved.emit({ ...draft, name });
  }
}
