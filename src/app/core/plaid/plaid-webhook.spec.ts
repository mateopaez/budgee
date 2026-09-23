import {
  canForgetPlaidItem,
  checkBodyHash,
  checkVerificationJwt,
  isForeignPlaidAccessToken,
  planWebhookAction,
} from './plaid-webhook';

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

  it('treats Sandbox tokens as unusable on Production', () => {
    expect(isForeignPlaidAccessToken('access-sandbox-00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isForeignPlaidAccessToken('access-development-00000000-0000-0000-0000-000000000000')).toBe(
      true,
    );
    expect(isForeignPlaidAccessToken('access-production-00000000-0000-0000-0000-000000000000')).toBe(
      false,
    );
  });

  it('forgets an Item Plaid says belongs to another environment', () => {
    expect(canForgetPlaidItem('INVALID_ACCESS_TOKEN')).toBe(true);
    expect(canForgetPlaidItem('ITEM_NOT_FOUND')).toBe(true);
    expect(
      canForgetPlaidItem(
        'INVALID_FIELD',
        'provided access token is for the wrong Plaid environment. expected "production", got "sandbox"',
      ),
    ).toBe(true);
    expect(canForgetPlaidItem('INVALID_FIELD', 'access_token is required')).toBe(false);
    expect(canForgetPlaidItem('ITEM_LOGIN_REQUIRED')).toBe(false);
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
