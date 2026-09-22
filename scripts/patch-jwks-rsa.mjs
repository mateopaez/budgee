import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * jwks-rsa 4 calls require('jose'), but jose 6 is ESM-only.
 * Vercel disables require() of ES modules, so token checks crash.
 * import() from CommonJS works. Re-applied after every install.
 */
const root = join(import.meta.dirname, '..', 'node_modules', 'jwks-rsa', 'src');

patch(join(root, 'utils.js'), (source) =>
  source
    .replace("const jose = require('jose');\n", '')
    .replace(
      'async function retrieveSigningKeys(jwks) {\n  const results = [];\n',
      "async function retrieveSigningKeys(jwks) {\n  const jose = await import('jose');\n  const results = [];\n",
    ),
);

patch(join(root, 'integrations', 'passport.js'), (source) =>
  source.replace("const jose = require('jose');\n", '').replace(
    `  return function secretProvider(req, rawJwtToken, cb) {
    let decoded;
    try {
      decoded = {
        payload: jose.decodeJwt(rawJwtToken),
        header: jose.decodeProtectedHeader(rawJwtToken)
      };
    } catch (err) {
      decoded = null;
    }

    if (!decoded || !supportedAlg.includes(decoded.header.alg)) {
      return cb(null, null);
    }

    client.getSigningKey(decoded.header.kid)
      .then(key => {
        cb(null, key.publicKey || key.rsaPublicKey);
      }).catch(err => {
        onError(err, (newError) => cb(newError, null));
      });
  };`,
    `  return function secretProvider(req, rawJwtToken, cb) {
    import('jose').then((jose) => {
      let decoded;
      try {
        decoded = {
          payload: jose.decodeJwt(rawJwtToken),
          header: jose.decodeProtectedHeader(rawJwtToken)
        };
      } catch (err) {
        decoded = null;
      }

      if (!decoded || !supportedAlg.includes(decoded.header.alg)) {
        cb(null, null);
        return;
      }

      client.getSigningKey(decoded.header.kid)
        .then(key => {
          cb(null, key.publicKey || key.rsaPublicKey);
        }).catch(err => {
          onError(err, (newError) => cb(newError, null));
        });
    }).catch((err) => cb(err));
  };`,
  ),
);

function patch(file, transform) {
  if (!existsSync(file)) {
    throw new Error(`Cannot patch jwks-rsa; missing ${file}`);
  }
  const source = readFileSync(file, 'utf8');
  if (!source.includes("require('jose')")) return;
  const next = transform(source);
  if (next === source || next.includes("require('jose')")) {
    throw new Error(`jwks-rsa changed shape; update scripts/patch-jwks-rsa.mjs for ${file}`);
  }
  writeFileSync(file, next);
}
