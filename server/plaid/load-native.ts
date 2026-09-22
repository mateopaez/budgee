import { createRequire } from 'node:module';

/**
 * Loads firebase-admin and plaid from node_modules at call time.
 * Bundling those packages into the Vercel function crashes the process
 * (`FUNCTION_INVOCATION_FAILED`) because they use CommonJS require().
 */
const require = createRequire(import.meta.url);

export function loadNative<T>(id: string): T {
  return require(id) as T;
}
