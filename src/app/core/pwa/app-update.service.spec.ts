import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { APP_UPDATE_RELOAD, AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  function setup(options?: { enabled?: boolean; browser?: boolean }) {
    const versionUpdates = new Subject<VersionEvent>();
    const unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
    const checkForUpdate = vi.fn(async () => false);
    const activateUpdate = vi.fn(async () => true);
    const reload = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: options?.enabled ?? true,
            versionUpdates,
            unrecoverable,
            checkForUpdate,
            activateUpdate,
          },
        },
        { provide: APP_UPDATE_RELOAD, useValue: reload },
        { provide: PLATFORM_ID, useValue: options?.browser === false ? 'server' : 'browser' },
      ],
    });

    const service = TestBed.inject(AppUpdateService);
    return { service, versionUpdates, unrecoverable, checkForUpdate, activateUpdate, reload };
  }

  it('does nothing when the service worker is disabled', () => {
    const { versionUpdates, checkForUpdate, reload } = setup({ enabled: false });
    expect(checkForUpdate).not.toHaveBeenCalled();

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing while rendering on the server', () => {
    const { checkForUpdate } = setup({ browser: false });
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('activates a ready build and reloads once for that version', async () => {
    const { versionUpdates, checkForUpdate, activateUpdate, reload } = setup();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    const ready: VersionEvent = {
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    };
    versionUpdates.next(ready);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(activateUpdate).toHaveBeenCalledTimes(1);

    versionUpdates.next(ready);
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(activateUpdate).toHaveBeenCalledTimes(1);
  });

  it('reloads even when activating the update never finishes', async () => {
    vi.useFakeTimers();
    const versionUpdates = new Subject<VersionEvent>();
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            unrecoverable: new Subject(),
            checkForUpdate: vi.fn(async () => false),
            activateUpdate: vi.fn(() => new Promise(() => undefined)),
          },
        },
        { provide: APP_UPDATE_RELOAD, useValue: reload },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(AppUpdateService);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'stalled' },
    });
    await vi.advanceTimersByTimeAsync(3_000);

    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('checks again when the tab becomes visible', () => {
    const { checkForUpdate } = setup();
    checkForUpdate.mockClear();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('drops a broken worker and reloads once', async () => {
    const unregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    vi.stubGlobal('caches', {
      keys: async () => ['ngsw:/:app:cache'],
      delete: deleteCache,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => ({ unregister }) },
    });

    const { unrecoverable, reload } = setup();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('ngsw:/:app:cache');

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
