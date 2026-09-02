const { json, redirect, sha256, supabase, yookassaToken, yookassaMe, encryptSecret, origin } = require('../../../_lib/yookassa');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const code = String((req.query && req.query.code) || '').trim();
    const state = String((req.query && req.query.state) || '').trim();
    const providerError = String((req.query && req.query.error) || '').trim();
    if (!state) return json(res, 400, { ok: false, error: 'oauth_state_required' });

    const rows = await supabase(`payment_oauth_states?provider=eq.yookassa&state_hash=eq.${encodeURIComponent(sha256(state))}&select=*&limit=1`);
    const oauthState = Array.isArray(rows) ? rows[0] : null;
    if (!oauthState) return json(res, 400, { ok: false, error: 'oauth_state_invalid' });
    if (oauthState.consumed_at) return json(res, 400, { ok: false, error: 'oauth_state_consumed' });
    if (!oauthState.expires_at || new Date(oauthState.expires_at).getTime() < Date.now()) return json(res, 400, { ok: false, error: 'oauth_state_expired' });

    await supabase(`payment_oauth_states?id=eq.${encodeURIComponent(oauthState.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ consumed_at: new Date().toISOString() })
    });

    if (providerError || !code) {
      return redirect(res, `${origin(req)}/manager.html?payment=yookassa&status=cancelled`);
    }

    const token = await yookassaToken(code, { redirectUri: oauthState.redirect_uri, codeVerifier: oauthState.code_verifier });
    const shop = await yookassaMe(token.access_token);
    const encryptedToken = encryptSecret(token.access_token);
    const scope = oauthState.requested_scope === 'shared' ? 'platform' : 'venue';
    const venueId = scope === 'platform' ? null : oauthState.venue_id;

    if (scope === 'platform') {
      const existingShared = await supabase(`payment_accounts?manager_id=eq.${encodeURIComponent(oauthState.manager_id)}&provider=eq.yookassa&account_scope=eq.platform&venue_id=is.null&select=id&limit=1`);
      if (Array.isArray(existingShared) && existingShared.length) {
        await supabase(`payment_accounts?id=eq.${encodeURIComponent(existingShared[0].id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            manager_id: oauthState.manager_id, account_scope: 'platform', venue_id: null,
            account_name: shop.account_name || null, merchant_id: shop.account_id || null, shop_id: shop.account_id || null,
            status: shop.status === 'enabled' ? 'active' : 'disabled', credentials_ref: encryptedToken,
            oauth_account_id: shop.account_id || null, connected_at: new Date().toISOString(), disconnected_at: null,
            metadata: { test: !!shop.test, status: shop.status || null, payment_methods: Array.isArray(shop.payment_methods) ? shop.payment_methods : [] },
            updated_at: new Date().toISOString()
          })
        });
      } else {
        await supabase('payment_accounts', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            manager_id: oauthState.manager_id, venue_id: null, account_scope: 'platform', provider: 'yookassa',
            account_name: shop.account_name || null, merchant_id: shop.account_id || null, shop_id: shop.account_id || null,
            status: shop.status === 'enabled' ? 'active' : 'disabled', credentials_ref: encryptedToken,
            oauth_account_id: shop.account_id || null, connected_at: new Date().toISOString(),
            metadata: { test: !!shop.test, status: shop.status || null, payment_methods: Array.isArray(shop.payment_methods) ? shop.payment_methods : [] }
          })
        });
      }
    } else {
      const existing = await supabase(`payment_accounts?manager_id=eq.${encodeURIComponent(oauthState.manager_id)}&venue_id=eq.${encodeURIComponent(venueId)}&provider=eq.yookassa&account_scope=eq.venue&select=id&limit=1`);
      const payload = {
        manager_id: oauthState.manager_id, venue_id: venueId, account_scope: 'venue', provider: 'yookassa',
        account_name: shop.account_name || null, merchant_id: shop.account_id || null, shop_id: shop.account_id || null,
        status: shop.status === 'enabled' ? 'active' : 'disabled', credentials_ref: encryptedToken,
        oauth_account_id: shop.account_id || null, connected_at: new Date().toISOString(), disconnected_at: null,
        metadata: { test: !!shop.test, status: shop.status || null, payment_methods: Array.isArray(shop.payment_methods) ? shop.payment_methods : [] },
        updated_at: new Date().toISOString()
      };
      if (Array.isArray(existing) && existing.length) {
        await supabase(`payment_accounts?id=eq.${encodeURIComponent(existing[0].id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
      } else {
        await supabase('payment_accounts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(Object.assign({ created_at: new Date().toISOString() }, payload)) });
      }
    }

    return redirect(res, `${origin(req)}/manager.html?payment=yookassa&status=connected`);
  } catch (e) {
    console.error('[YooKassa callback]', e);
    return redirect(res, `${origin(req)}/manager.html?payment=yookassa&status=error&message=${encodeURIComponent(e.message || 'oauth_callback_failed')}`);
  }
};
