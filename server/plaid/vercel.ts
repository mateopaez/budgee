import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchPlaid } from './dispatch';
import type { PlaidRequest } from './handlers';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Vercel serves the Angular client as static files, so Express routes in
 * `src/server.ts` never run there. This function is the production path for
 * `/api/plaid/:action`.
 */
export async function handleVercelPlaid(req: VercelRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }
  const result = await dispatchPlaid(actionName(req), toPlaidRequest(req));
  send(res, result.status, result.body);
}

function actionName(req: VercelRequest): string {
  const query = req.query?.['action'];
  if (typeof query === 'string' && query) return query;
  const path = (req.url ?? '').split('?')[0] ?? '';
  const match = /\/api\/plaid\/([^/]+)$/.exec(path);
  return match?.[1] ?? '';
}

function toPlaidRequest(req: VercelRequest): PlaidRequest {
  return {
    header(name: string): string | string[] | undefined {
      return req.headers[name.toLowerCase()];
    },
    body: parseBody(req.body),
  };
}

function parseBody(body: unknown): unknown {
  if (body == null || body === '') return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8')) as unknown;
    } catch {
      return {};
    }
  }
  return body;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}
