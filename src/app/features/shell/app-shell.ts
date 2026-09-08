import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { BottomNav } from '../../shared/ui/bottom-nav';
import { BudgetStore } from '../../core/state/budget-store';
import { SessionService } from '../../core/state/session.service';

/**
 * Authenticated application shell.
 *
 * Owns the phone sized column, the per area accent, the fixed bottom
 * navigation and the demo mode banner. Feature routes render inside it.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomNav],
  host: { class: 'flex min-h-[100dvh] flex-col bg-canvas text-ink' },
  template: `
    <div [attr.data-accent]="accent()" class="flex min-h-[100dvh] flex-col">
      <router-outlet />

      @if (showDemoBanner()) {
        <div
          class="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 px-3"
          style="padding-bottom: calc(var(--safe-bottom) + 5.25rem)"
        >
          <div
            class="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface/95 py-2 pr-2 pl-4 backdrop-blur"
          >
            <span class="flex-1 text-[0.85rem] text-ink-muted">Demo mode enabled</span>
            <button
              type="button"
              class="min-h-[2.25rem] rounded-full bg-raised px-4 text-[0.85rem] font-semibold text-ink"
              (click)="disableDemo()"
            >
              Disable
            </button>
            <button
              type="button"
              class="min-h-[2.25rem] rounded-full px-2 text-[0.85rem] text-ink-muted"
              aria-label="Hide demo mode banner"
              (click)="bannerDismissed.set(true)"
            >
              &#10005;
            </button>
          </div>
        </div>
      }

      <app-bottom-nav />
    </div>
  `,
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly store = inject(BudgetStore);
  private readonly session = inject(SessionService);

  protected readonly bannerDismissed = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The accent for the current area. Overview, Budget and the wallet flavoured
   * screens follow the user's colour preferences; the rest are fixed.
   */
  protected readonly accent = computed(() => {
    const prefs = this.store.preferences();
    const segment = this.url().split('?')[0].split('/')[1] ?? '';
    switch (segment) {
      case 'budgee':
        return 'budgee';
      case 'budget':
        return prefs?.budgetAccent ?? 'budget';
      case 'save':
        return 'save';
      case 'tools':
      case 'wallets':
      case 'categories':
      case 'settings':
      case 'bank-connections':
        return prefs?.walletAccent ?? 'tools';
      default:
        return prefs?.overviewAccent ?? 'overview';
    }
  });

  protected readonly showDemoBanner = computed(
    () => this.store.demoMode() && !this.bannerDismissed(),
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.session.rememberTab(event.urlAfterRedirects.split('?')[0]));
  }

  protected disableDemo(): void {
    this.store.setDemoMode(false);
  }
}
