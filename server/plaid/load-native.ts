import { createRequire } from 'node:module';

/**
 * Loads firebase-admin and plaid from node_modules at call time.
 * The specifiers stay literal so Vercel’s file tracer ships those packages.
 * Bundling them into the function crashes the process.
 */
const require = createRequire(import.meta.url);

export function loadNative<T>(id: string): T {
  switch (id) {
    case 'firebase-admin/app':
      return require('firebase-admin/app') as T;
    case 'firebase-admin/auth':
      return require('firebase-admin/auth') as T;
    case 'firebase-admin/firestore':
      return require('firebase-admin/firestore') as T;
    case 'plaid':
      return require('plaid') as T;
    default:
      throw new Error(`Unsupported module ${id}`);
  }
}
