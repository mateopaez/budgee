'use strict';

/**
 * jose 6 is ESM-only. Vercel disables require() of ES modules, and TypeScript's
 * CommonJS emit rewrites import() into require(). This file is already
 * CommonJS, so the import() call stays and Node can load jose.
 */
async function loadJose() {
  return import('jose');
}

module.exports = { loadJose };
