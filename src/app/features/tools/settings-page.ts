import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { OptionPickerSheet, type PickerOption } from '../../shared/ui/option-picker-sheet';
import { BudgetStore } from '../../core/state/budget-store';
import { SessionService } from '../../core/state/session.service';
import { ConfirmService } from '../../shared/ui/confirm.service';

type Picker = 'expense' | 'income' | 'transfer' | null;

const ACCENTS = [
  { id: 'overview', label: 'Violet', color: '#b558ff' },
  { id: 'budget', label: 'Teal', color: '#17b899' },
  { id: 'save', label: 'Amber', color: '#f2c14e' },
  { id: 'budgee', label: 'Mint', color: '#34d399' },
  { id: 'tools', label: 'Rose', color: '#fb7185' },
] as const;

/** Settings essentials for the MVP. */
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ToggleSwitch, OptionPickerSheet],
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
        <h1 class="flex-1 text-center text-[1.15rem] font-semibold text-ink">Settings</h1>
        <span class="size-11"></span>
      </div>

      @if (preferences(); as prefs) {
        <h2 class="mt-6 mb-2 text-[1.1rem] font-semibold text-ink-muted">Appearance</h2>
        <section class="rounded-[1.5rem] bg-raised px-5">
          @for (area of areas; track area.key) {
            <div class="flex min-h-[3.75rem] items-center gap-3 not-first:border-t not-first:border-line">
              <span class="flex-1 text-[1rem] text-ink">{{ area.label }}</span>
              <div class="flex gap-2" role="group" [attr.aria-label]="area.label + ' accent'">
                @for (accent of accents; track accent.id) {
                  <button
                    type="button"
                    class="size-7 rounded-full border-2 transition-transform"
                    [style.background]="accent.color"
                    [style.border-color]="current(area.key) === accent.id ? 'var(--color-ink)' : 'transparent'"
                    [attr.aria-pressed]="current(area.key) === accent.id"
                    [attr.aria-label]="accent.label"
                    (click)="setAccent(area.key, accent.id)"
                  ></button>
                }
              </div>
            </div>
          }
        </section>

        <h2 class="mt-6 mb-2 text-[1.1rem] font-semibold text-ink-muted">Settings</h2>
        <section class="rounded-[1.5rem] bg-raised px-5">
          <div class="flex min-h-[3.75rem] items-center gap-3">
            <span class="flex-1 text-[1rem] text-ink">Currency</span>
            <span class="text-[1rem] text-ink-muted">Canadian Dollar (CAD)</span>
          </div>

          <div class="flex min-h-[3.75rem] items-center gap-3 border-t border-line">
            <span class="flex-1 text-[1rem] text-ink">Show double decimals</span>
            <app-toggle-switch
              label="Show double decimals"
              [checked]="prefs.showDoubleDecimals"
              (toggle)="store.updatePreferences({ showDoubleDecimals: $event })"
            />
          </div>

          <div class="flex min-h-[3.75rem] items-center gap-3 border-t border-line">
            <span class="flex-1 text-[1rem] text-ink">Round decimals in summaries</span>
            <app-toggle-switch
              label="Round decimals in summaries"
              [checked]="prefs.roundSummaryAmounts"
              (toggle)="store.updatePreferences({ roundSummaryAmounts: $event })"
            />
          </div>

          <div class="flex min-h-[3.75rem] items-center gap-3 border-t border-line">
            <span class="flex-1 text-[1rem] text-ink">Show Save in tab bar</span>
            <app-toggle-switch
              label="Show Save in tab bar"
              [checked]="prefs.showSaveInTabBar"
              (toggle)="store.updatePreferences({ showSaveInTabBar: $event })"
            />
          </div>

          <div class="flex min-h-[3.75rem] items-center gap-3 border-t border-line">
            <span class="flex-1 text-[1rem] text-ink">Demo mode</span>
            <app-toggle-switch
              label="Demo mode"
              [checked]="prefs.demoMode"
              (toggle)="store.setDemoMode($event)"
            />
          </div>
        </section>

        <h2 class="mt-6 mb-2 text-[1.1rem] font-semibold text-ink-muted">Create transactions</h2>
        <section class="rounded-[1.5rem] bg-raised px-5">
          @for (row of defaultRows(); track row.kind) {
            <button
              type="button"
              class="flex min-h-[3.75rem] w-full items-center gap-3 text-left not-first:border-t not-first:border-line"
              (click)="picker.set(row.kind)"
            >
              <span class="flex-1 text-[1rem] text-ink">{{ row.label }}</span>
              <span class="text-[1rem] text-ink-muted">{{ row.value }}</span>
              <app-icon name="chevronRight" [size]="18" />
            </button>
          }
        </section>

        <h2 class="mt-6 mb-2 text-[1.1rem] font-semibold text-ink-muted">Other</h2>
        <section class="rounded-[1.5rem] bg-raised px-5 pb-5">
          <p class="border-b border-line py-4 text-[0.9rem] leading-relaxed text-ink-muted">
            Budgee stores your data under your own account. Nothing is shared with other users, and
            there is no bank connection in this release.
          </p>
          <button
            type="button"
            class="mt-5 min-h-[3.25rem] w-full rounded-[1.25rem] text-[1rem] font-semibold"
            style="background: color-mix(in srgb, var(--color-negative) 20%, transparent); color: #ffa9ac"
            (click)="signOut()"
          >
            Log out
          </button>
        </section>
      }
    </main>

    @if (picker(); as kind) {
      <app-option-picker-sheet
        [title]="'Default ' + kind + ' category'"
        [options]="options(kind)"
        [selected]="selectedFor(kind)"
        (choose)="setDefault(kind, $event)"
        (cancel)="picker.set(null)"
      />
    }
  `,
})
export class SettingsPage {
  protected readonly store = inject(BudgetStore);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly picker = signal<Picker>(null);
  protected readonly accents = ACCENTS;
  protected readonly preferences = this.store.preferences;

  protected readonly areas = [
    { key: 'overviewAccent' as const, label: 'Overview' },
    { key: 'budgetAccent' as const, label: 'Budget' },
    { key: 'walletAccent' as const, label: 'Wallets' },
  ];

  protected readonly defaultRows = computed(() => {
    const prefs = this.preferences();
    const categories = this.store.categoriesById();
    return [
      {
        kind: 'expense' as const,
        label: 'Expense category',
        value: categories.get(prefs?.defaultExpenseCategoryId ?? '')?.name ?? 'Not set',
      },
      {
        kind: 'income' as const,
        label: 'Income category',
        value: categories.get(prefs?.defaultIncomeCategoryId ?? '')?.name ?? 'Not set',
      },
      {
        kind: 'transfer' as const,
        label: 'Transfer category',
        value: categories.get(prefs?.defaultTransferCategoryId ?? '')?.name ?? 'Not set',
      },
    ];
  });

  protected current(key: 'overviewAccent' | 'budgetAccent' | 'walletAccent'): string {
    return this.preferences()?.[key] ?? 'overview';
  }

  protected setAccent(key: 'overviewAccent' | 'budgetAccent' | 'walletAccent', id: string): void {
    this.store.updatePreferences({ [key]: id });
  }

  protected options(kind: 'expense' | 'income' | 'transfer'): PickerOption[] {
    const groups = this.store.groupsById();
    return this.store
      .categories()
      .filter((c) => c.kind === kind)
      .map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color,
        groupName: groups.get(c.groupId)?.name ?? 'Other',
      }));
  }

  protected selectedFor(kind: 'expense' | 'income' | 'transfer'): string {
    const prefs = this.preferences();
    if (!prefs) return '';
    if (kind === 'income') return prefs.defaultIncomeCategoryId;
    if (kind === 'transfer') return prefs.defaultTransferCategoryId;
    return prefs.defaultExpenseCategoryId;
  }

  protected setDefault(kind: 'expense' | 'income' | 'transfer', id: string): void {
    if (kind === 'income') this.store.updatePreferences({ defaultIncomeCategoryId: id });
    else if (kind === 'transfer') this.store.updatePreferences({ defaultTransferCategoryId: id });
    else this.store.updatePreferences({ defaultExpenseCategoryId: id });
    this.picker.set(null);
  }

  protected async signOut(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Log out of Budgee?',
      message: 'Your data stays saved and comes back the next time you sign in.',
      confirmLabel: 'Log out',
      destructive: false,
    });
    if (!confirmed) return;
    await this.session.signOut();
    await this.router.navigateByUrl('/welcome');
  }
}
