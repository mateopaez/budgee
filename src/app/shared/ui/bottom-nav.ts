import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from './icon';
import type { IconName } from './icon-set';
import { BudgetStore } from '../../core/state/budget-store';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
  readonly accent: string;
}

/**
 * Fixed primary navigation. The selected destination sits inside an elevated
 * pill and takes that area's accent colour.
 */
@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  host: {
    class:
      'fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-3 pointer-events-none',
    style: 'padding-bottom: calc(var(--safe-bottom) + 0.5rem)',
  },
  template: `
    <nav
      class="pointer-events-auto flex items-center justify-between gap-1 rounded-[2rem] border border-line bg-surface/95 p-1.5 shadow-[0_-6px_24px_rgba(0,0,0,0.45)] backdrop-blur"
      aria-label="Primary"
    >
      @for (item of items(); track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="is-active"
          #rla="routerLinkActive"
          [attr.aria-current]="rla.isActive ? 'page' : null"
          [attr.data-accent]="item.accent"
          class="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-[1.6rem] px-1 py-1.5 text-[0.7rem] font-medium transition-colors"
          [class.bg-raised]="rla.isActive"
          [class.text-ink]="rla.isActive"
          [class.text-ink-muted]="!rla.isActive"
        >
          <app-icon
            [name]="item.icon"
            [size]="22"
            [style.color]="rla.isActive ? 'var(--color-accent)' : undefined"
          />
          <span class="leading-none">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class BottomNav {
  private readonly store = inject(BudgetStore);

  protected readonly items = computed<NavItem[]>(() => {
    const showSave = this.store.preferences()?.showSaveInTabBar ?? true;
    const all: NavItem[] = [
      { path: '/budgee', label: 'Budgee', icon: 'jar', accent: 'budgee' },
      { path: '/overview', label: 'Overview', icon: 'eye', accent: 'overview' },
      { path: '/budget', label: 'Budget', icon: 'pie', accent: 'budget' },
      { path: '/save', label: 'Save', icon: 'heart', accent: 'save' },
      { path: '/tools', label: 'Tools', icon: 'briefcase', accent: 'tools' },
    ];
    return showSave ? all : all.filter((i) => i.path !== '/save');
  });
}
