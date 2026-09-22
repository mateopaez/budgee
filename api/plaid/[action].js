'use strict';

/**
 * CommonJS on purpose. Vercel loads this file with require().
 * The TypeScript route emitted `export`, which crashes the process
 * before the handler runs (FUNCTION_INVOCATION_FAILED).
 */
async function plaidAction(req, res) {
  try {
    const { handleNodePlaid, handleWebPlaid } = require('../../server/plaid/vercel');
    if (isWebRequest(req)) return await handleWebPlaid(req);
    await handleNodePlaid(req, res);
  } catch (error) {
    const message = safeMessage(error);
    if (res && typeof res.end === 'function' && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: message }));
      return;
    }
    return responseJson(message);
  }
}

function isWebRequest(req) {
  return typeof Request !== 'undefined' && req instanceof Request;
}

function safeMessage(error) {
  if (!(error instanceof Error) || error.message.length === 0) return 'Function failed';
  return error.message.replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, '').slice(0, 300) || 'Function failed';
}

function responseJson(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

plaidAction.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = plaidAction;
