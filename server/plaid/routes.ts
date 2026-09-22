import type { Express } from 'express';
import express from 'express';
import { dispatchPlaid } from './dispatch';

export function registerPlaidRoutes(app: Express): void {
  app.use('/api/plaid', express.json({ limit: '32kb' }));
  app.post('/api/plaid/:action', (req, res) => {
    const action = req.params['action'];
    const name = typeof action === 'string' ? action : '';
    void dispatchPlaid(name, req).then((result) => {
      res.status(result.status).json(result.body);
    });
  });
}
