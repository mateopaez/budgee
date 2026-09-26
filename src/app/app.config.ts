import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { WORKSPACE_REPOSITORY } from './core/data/repository';
import { FirestoreWorkspaceRepository } from './core/data/firestore-workspace.repository';
import { AppUpdateService } from './core/pwa/app-update.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    { provide: WORKSPACE_REPOSITORY, useExisting: FirestoreWorkspaceRepository },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register on startup and ignore any cached copy of the worker script,
      // so a deploy is not pinned to the worker from a previous visit.
      registrationStrategy: 'registerImmediately',
      updateViaCache: 'none',
    }),
    provideAppInitializer(() => {
      inject(AppUpdateService);
    }),
  ],
};
