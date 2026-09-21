import type { Express, Response } from 'express';
import express from 'express';
import { plaidFailure } from './client';
import { HttpError } from './config';
import {
  createLinkToken,
  disconnectConnection,
  exchangePublicToken,
  syncConnection,
} from './handlers';

export function registerPlaidRoutes(app: Express): void {
  app.use('/api/plaid', express.json({ limit: '32kb' }));
  app.post('/api/plaid/link-token', (req, res) => {
    void respond(res, () => createLinkToken(req));
  });
  app.post('/api/plaid/exchange', (req, res) => {
    void respond(res, () => exchangePublicToken(req));
  });
  app.post('/api/plaid/sync', (req, res) => {
    void respond(res, () => syncConnection(req));
  });
  app.post('/api/plaid/disconnect', (req, res) => {
    void respond(res, () => disconnectConnection(req));
  });
}

async function respond(
  res: Response,
  action: () => Promise<{ body: unknown }>,
): Promise<void> {
  try {
    const result = await action();
    res.status(200).json(result.body);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
      return;
    }
    const failure = plaidFailure(error);
    if (failure.code) {
      res.status(502).json({ error: failure.message, code: failure.code });
      return;
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
}
