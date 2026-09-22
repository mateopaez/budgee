import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchPlaid } from './dispatch';

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
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength > BODY_LIMIT) {
      return Response.json({ error: 'Body too large' }, { status: 413 });
    }
    const result = await dispatchPlaid(actionFromPath(requestPath(request.url)), {
      header(name: string) {
        return request.headers.get(name) ?? undefined;
      },
      body: parseJsonBytes(raw),
      rawBody: raw,
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
  const payload = await readNodePayload(req);
  if (payload.tooLarge) {
    send(res, 413, { error: 'Body too large' });
    return;
  }
  const result = await dispatchPlaid(actionName(req), {
    header(name: string): string | string[] | undefined {
      return req.headers[name.toLowerCase()];
    },
    body: payload.json,
    rawBody: payload.raw,
  });
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

const BODY_LIMIT = 32 * 1024;

async function readNodePayload(
  req: NodeRequest,
): Promise<{ raw: Uint8Array | null; json: unknown; tooLarge?: boolean }> {
  const body = req.body;
  if (Buffer.isBuffer(body)) {
    if (body.byteLength > BODY_LIMIT) return { raw: null, json: {}, tooLarge: true };
    return { raw: body, json: parseJsonBytes(body) };
  }
  if (typeof body === 'string') {
    const raw = Buffer.from(body, 'utf8');
    if (raw.byteLength > BODY_LIMIT) return { raw: null, json: {}, tooLarge: true };
    return { raw, json: parseJsonBytes(raw) };
  }
  if (body == null || body === '') {
    try {
      const raw = await readRequestStream(req);
      return { raw, json: parseJsonBytes(raw) };
    } catch (error) {
      if (error instanceof Error && error.message === 'Body too large') {
        return { raw: null, json: {}, tooLarge: true };
      }
      return { raw: null, json: {} };
    }
  }
  return { raw: null, json: body };
}

function readRequestStream(req: IncomingMessage): Promise<Uint8Array> {
  if (req.readableEnded) return Promise.resolve(new Uint8Array());
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > BODY_LIMIT) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJsonBytes(raw: Uint8Array): unknown {
  if (raw.byteLength === 0) return {};
  try {
    return JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
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

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}
