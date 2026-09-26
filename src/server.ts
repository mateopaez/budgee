import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { basename, join } from 'node:path';
import { loadLocalEnv } from '../server/plaid/config';
import { registerPlaidRoutes } from '../server/plaid/routes';

loadLocalEnv();

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

registerPlaidRoutes(app);

/**
 * Fingerprinted bundles can stay cached. The worker, its manifest, and HTML
 * must revalidate, or a previous visit keeps the old build for up to a year.
 */
function revalidatesOnEachLoad(filePath: string): boolean {
  const name = basename(filePath);
  return (
    name === 'ngsw.json' ||
    name === 'ngsw-worker.js' ||
    name === 'safety-worker.js' ||
    name === 'worker-basic.min.js' ||
    name === 'manifest.webmanifest' ||
    name === 'favicon.ico' ||
    filePath.endsWith('.html')
  );
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
    setHeaders(res, filePath) {
      if (revalidatesOnEachLoad(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 * Documents are not cached, so the next visit receives the latest shell.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) {
        next();
        return;
      }
      const headers = new Headers(response.headers);
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'no-cache');
      }
      return writeResponseToNodeResponse(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
        res,
      );
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
