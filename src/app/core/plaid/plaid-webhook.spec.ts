import { checkBodyHash, checkVerificationJwt, planWebhookAction } from './plaid-webhook';

describe('plaid webhook checks', () => {
  it('rejects a missing JWT', () => {
    expect(checkVerificationJwt(undefined)).toEqual({ ok: false, reason: 'missing_jwt' });
    expect(checkVerificationJwt('')).toEqual({ ok: false, reason: 'missing_jwt' });
    expect(checkVerificationJwt('   ')).toEqual({ ok: false, reason: 'missing_jwt' });
    expect(checkVerificationJwt([])).toEqual({ ok: false, reason: 'missing_jwt' });
  });

  it('rejects a body hash mismatch', async () => {
    const body = new TextEncoder().encode('{"webhook_type":"TRANSACTIONS"}');
    const mismatch = await checkBodyHash(body, 'ab'.repeat(32));
    expect(mismatch).toEqual({ ok: false, reason: 'body_hash_mismatch' });

    const empty = new Uint8Array();
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(await checkBodyHash(empty, emptyHash)).toEqual({ ok: true });
    expect(await checkBodyHash(empty, 'f'.repeat(64))).toEqual({
      ok: false,
      reason: 'body_hash_mismatch',
    });
  });

  it('ignores an unknown item id without throwing', () => {
    const plan = () =>
      planWebhookAction({
        itemFound: false,
        webhookType: 'TRANSACTIONS',
        webhookCode: 'SYNC_UPDATES_AVAILABLE',
        errorCode: null,
      });
    expect(plan).not.toThrow();
    expect(plan()).toBe('ignore');
  });

  it('maps ITEM_LOGIN_REQUIRED to needs_attention', () => {
    expect(
      planWebhookAction({
        itemFound: true,
        webhookType: 'ITEM',
        webhookCode: 'ERROR',
        errorCode: 'ITEM_LOGIN_REQUIRED',
      }),
    ).toBe('needs_attention');
  });
});
