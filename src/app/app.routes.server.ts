import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Budgee renders on the client. Every screen depends on the signed in user's
 * own data, so there is nothing meaningful to prerender or stream from the
 * server, and client rendering keeps auth and storage in one place.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
