'use strict';

/**
 * Real require() calls so Vercel’s file tracer ships these packages.
 * Kept as CommonJS: the TypeScript around it is compiled to CommonJS,
 * and a local binding named require breaks Node’s own require.
 */
function loadNative(id) {
  switch (id) {
    case 'firebase-admin/app':
      return require('firebase-admin/app');
    case 'firebase-admin/auth':
      return require('firebase-admin/auth');
    case 'firebase-admin/firestore':
      return require('firebase-admin/firestore');
    case 'plaid':
      return require('plaid');
    default:
      throw new Error(`Unsupported module ${id}`);
  }
}

module.exports = { loadNative };
