import { inject, Injector, runInInjectionContext } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionService } from '../state/session.service';

async function waitForSession(injector: Injector): Promise<void> {
  const session = injector.get(SessionService);
  await runInInjectionContext(injector, () =>
    firstValueFrom(toObservable(session.ready).pipe(filter(Boolean))),
  );
}

/** Blocks every application route until a user is signed in. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const injector = inject(Injector);
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForSession(injector);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/welcome'], { queryParams: { redirectTo: state.url } });
};

/** Sends a signed in user who has not finished onboarding to the onboarding flow. */
export const onboardedGuard: CanActivateFn = async () => {
  const injector = inject(Injector);
  const session = inject(SessionService);
  const router = inject(Router);

  await waitForSession(injector);
  if (!session.needsOnboarding()) return true;
  return router.createUrlTree(['/onboarding']);
};

/** Keeps a fully set up user out of the welcome and sign in screens. */
export const guestOnlyGuard: CanActivateFn = async () => {
  const injector = inject(Injector);
  const auth = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  await waitForSession(injector);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree([session.needsOnboarding() ? '/onboarding' : session.lastTab()]);
};

/** Onboarding itself requires a signed in user who still needs it. */
export const onboardingGuard: CanActivateFn = async () => {
  const injector = inject(Injector);
  const auth = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  await waitForSession(injector);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/welcome']);
  if (!session.needsOnboarding()) return router.createUrlTree([session.lastTab()]);
  return true;
};
