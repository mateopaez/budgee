import type { Express, Request } from 'express';
import express from 'express';
import { dispatchPlaid } from './dispatch';

export function registerPlaidRoutes(app: Express): void {
  app.use(
    '/api/plaid',
    express.json({
      limit: '32kb',
      verify(req, _res, buf) {
        (req as Request & { rawBody?: Uint8Array }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.post('/api/plaid/:action', (req, res) => {
    const action = req.params['action'];
    const name = typeof action === 'string' ? action : '';
    const rawBody = (req as Request & { rawBody?: Uint8Array }).rawBody ?? null;
    void dispatchPlaid(name, {
      header: (headerName) => req.header(headerName),
      body: req.body,
      rawBody,
    }).then((result) => {
      res.status(result.status).json(result.body);
    });
  });
}
