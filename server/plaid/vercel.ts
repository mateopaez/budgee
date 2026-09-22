import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchPlaid } from './dispatch';
import type { PlaidRequest } from './handlers';

export const maxDuration = 60;

interface NodeRequest extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Vercel serves the Angular client as static files, so Express routes in
 * `src/server.ts` never run there. `/api` functions receive either a Web
 * `Request` or the older Node `(req, res)` pair.
 */
export async function handleWebPlaid(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const result = await dispatchPlaid(actionFromPath(requestPath(request.url)), {
      header(name: string) {
        return request.headers.get(name) ?? undefined;
      },
      body: await readJson(request),
    });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Plaid function failed', error instanceof Error ? error.name : 'Error');
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function handleNodePlaid(req: NodeRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }
  const result = await dispatchPlaid(actionName(req), toPlaidRequest(req));
  send(res, result.status, result.body);
}

export default function plaidEndpoint(
  input: Request | NodeRequest,
  res?: ServerResponse,
): Promise<Response | void> {
  if (isWebRequest(input)) return handleWebPlaid(input);
  if (!res) return Promise.resolve(Response.json({ error: 'Something went wrong' }, { status: 500 }));
  return handleNodePlaid(input, res);
}

export function POST(request: Request): Promise<Response> {
  return handleWebPlaid(request);
}

function isWebRequest(input: Request | NodeRequest): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return {};
  try {
    return (await request.json()) as unknown;
  } catch {
    return {};
  }
}

function requestPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0] ?? '';
  }
}

function actionFromPath(path: string): string {
  const match = /\/api\/plaid\/([^/]+)$/.exec(path);
  return match?.[1] ?? '';
}

function actionName(req: NodeRequest): string {
  const query = req.query?.['action'];
  if (typeof query === 'string' && query) return query;
  return actionFromPath((req.url ?? '').split('?')[0] ?? '');
}

function toPlaidRequest(req: NodeRequest): PlaidRequest {
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
