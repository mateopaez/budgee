import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { interval } from 'rxjs';
import { filter } from 'rxjs/operators';

/** How often an open tab asks the service worker whether a deploy is waiting. */
const UPDATE_CHECK_INTERVAL_MS = 60_000;

const APPLIED_UPDATE_KEY = 'budgee:applied-sw-update';
const RECOVERY_KEY = 'budgee:sw-recovery';

/** Reloads the page after a service worker update. Tests replace this. */
export const APP_UPDATE_RELOAD = new InjectionToken<() => void>('APP_UPDATE_RELOAD', {
  factory: () => () => globalThis.location.reload(),
});

/**
 * Returning visitors keep the previous production build until the service
 * worker installs a new one and this client reloads onto it. This service
 * checks for that build and reloads once it is ready, so a deploy shows up
 * without clearing site data.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadPage = inject(APP_UPDATE_RELOAD);

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.updates.isEnabled) return;

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        void this.applyUpdate(event.latestVersion.hash);
      });

    this.updates.unrecoverable.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.recoverFromBrokenWorker();
    });

    this.requestUpdateCheck();
    this.checkWhenVisible();
    interval(UPDATE_CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible') this.requestUpdateCheck();
      });
  }

  private requestUpdateCheck(): void {
    void this.updates.checkForUpdate().catch(() => undefined);
  }

  private checkWhenVisible(): void {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') this.requestUpdateCheck();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  private async applyUpdate(hash: string): Promise<void> {
    if (sessionStorage.getItem(APPLIED_UPDATE_KEY) === hash) return;
    await Promise.race([
      this.updates.activateUpdate().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
    if (sessionStorage.getItem(APPLIED_UPDATE_KEY) === hash) return;
    sessionStorage.setItem(APPLIED_UPDATE_KEY, hash);
    this.reloadPage();
  }

  private async recoverFromBrokenWorker(): Promise<void> {
    if (sessionStorage.getItem(RECOVERY_KEY) === '1') return;
    sessionStorage.setItem(RECOVERY_KEY, '1');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.unregister();
      if ('caches' in globalThis) {
        const keys = await caches.keys();
        await Promise.all(keys.map((name) => caches.delete(name)));
      }
    } catch {
      // Reload anyway so the next request is not served from the broken worker.
    }
    this.reloadPage();
  }
}
