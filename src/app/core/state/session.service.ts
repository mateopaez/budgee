import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { BudgetStore } from './budget-store';
import type { WorkspaceIdentity } from '../data/workspace';

const LAST_TAB_KEY = 'budgee:last-tab';
const MAIN_TABS = ['/budgee', '/overview', '/budget', '/save', '/tools'];

/**
 * Bridges Firebase Auth and the workspace store.
 *
 * When a user signs in their own Firestore workspace is loaded (scoped by uid);
 * when they sign out the in memory workspace is dropped immediately so nothing
 * leaks into the next session. Application data never uses browser storage.
 *
 * The last-tab preference is UI chrome only (which bottom tab to reopen) and is
 * not Budgee financial data.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);
  private readonly store = inject(BudgetStore);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly loadingSignal = signal(false);
  private readonly loadedUidSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();

  /** True once auth has settled and, when signed in, the workspace load finished. */
  readonly ready = computed(() => {
    const status = this.auth.status();
    if (status === 'initialising') return false;
    if (status === 'anonymous') return true;
    return this.loadedUidSignal() === this.auth.user()?.uid && !this.loadingSignal();
  });

  readonly identity = computed<WorkspaceIdentity | null>(() => {
    const user = this.auth.user();
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: user.displayName || user.email.split('@')[0] || 'You',
      email: user.email,
    };
  });

  /** A signed in user with no workspace, or one that never finished onboarding. */
  readonly needsOnboarding = computed(() => {
    if (!this.auth.isAuthenticated()) return false;
    if (!this.ready()) return false;
    if (this.store.status() === 'error') return false;
    const workspace = this.store.workspace();
    return workspace === null || !workspace.onboardingCompleted;
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.loadedUidSignal.set(null);
        this.store.unload();
        return;
      }
      if (this.loadedUidSignal() === user.uid || this.loadingSignal()) return;
      void this.loadWorkspace();
    });
  }

  private async loadWorkspace(): Promise<void> {
    const identity = this.identity();
    if (!identity) return;
    this.loadingSignal.set(true);
    try {
      await this.store.loadFor(identity);
    } catch {
      // BudgetStore already records the error; mark the uid loaded so guards settle.
    } finally {
      this.loadedUidSignal.set(identity.uid);
      this.loadingSignal.set(false);
    }
  }

  async retryWorkspace(): Promise<void> {
    const identity = this.identity();
    if (!identity) return;
    this.loadingSignal.set(true);
    try {
      await this.store.retryLoad(identity);
    } finally {
      this.loadedUidSignal.set(identity.uid);
      this.loadingSignal.set(false);
    }
  }

  /** Called by onboarding once the user picks demo or manual. */
  async startWorkspace(mode: 'demo' | 'manual'): Promise<void> {
    const identity = this.identity();
    if (!identity) return;
    await this.store.initialise(identity, mode);
    this.loadedUidSignal.set(identity.uid);
  }

  rememberTab(path: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!MAIN_TABS.includes(path)) return;
    try {
      localStorage.setItem(LAST_TAB_KEY, path);
    } catch {
      // Storage may be unavailable; falling back to the default tab is fine.
    }
  }

  lastTab(): string {
    if (!isPlatformBrowser(this.platformId)) return '/budgee';
    try {
      const stored = localStorage.getItem(LAST_TAB_KEY);
      return stored && MAIN_TABS.includes(stored) ? stored : '/budgee';
    } catch {
      return '/budgee';
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.loadedUidSignal.set(null);
  }
}
