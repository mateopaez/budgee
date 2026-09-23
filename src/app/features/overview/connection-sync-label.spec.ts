import { connectionForAccounts, connectionSyncLabel } from './overview-tab';
import type { ProviderConnection } from '../../core/models';

function connection(partial: Partial<ProviderConnection> & Pick<ProviderConnection, 'id'>): ProviderConnection {
  return {
    provider: 'plaid',
    institutionName: 'TD',
    status: 'connected',
    lastSyncAt: null,
    ...partial,
  };
}

describe('connection sync label', () => {
  it('labels a demo connection as local demo data', () => {
    expect(
      connectionSyncLabel(
        connection({
          id: 'con_demo',
          provider: 'demo',
          lastSyncAt: '2026-09-26T09:12:00.000Z',
        }),
      ),
    ).toBe('just now (demo data)');
  });

  it('formats a Plaid sync time and ignores a missing timestamp', () => {
    expect(connectionSyncLabel(null)).toBe('never');
    expect(connectionSyncLabel(connection({ id: 'con_plaid', lastSyncAt: null }))).toBe('never');
    expect(connectionSyncLabel(connection({ id: 'con_plaid', lastSyncAt: 'not-a-date' }))).toBe(
      'never',
    );

    const label = connectionSyncLabel(
      connection({ id: 'con_plaid', lastSyncAt: '2026-09-22T16:30:00.000Z' }),
    );
    expect(label).not.toContain('demo data');
    expect(label).toContain('Sep');
    expect(label).toContain('22');
  });

  it('uses the connection that owns the accounts on screen', () => {
    const demo = connection({
      id: 'con_demo',
      provider: 'demo',
      lastSyncAt: '2026-09-26T09:12:00.000Z',
    });
    const plaid = connection({
      id: 'con_plaid',
      lastSyncAt: '2026-09-22T16:30:00.000Z',
    });
    const chosen = connectionForAccounts([demo, plaid], [{ connectionId: 'con_plaid' }]);
    expect(chosen?.id).toBe('con_plaid');
    expect(connectionSyncLabel(chosen)).not.toContain('demo data');
  });
});
