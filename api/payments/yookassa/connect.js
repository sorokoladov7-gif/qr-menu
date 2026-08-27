const { json, redirect, randomToken, sha256, supabase, callbackUrl, pkceChallenge, authorizeUrl } = require('../../_lib/yookassa');
const { bearer, getManagerUser } = require('../../_lib/manager-auth');

async function assertManagerVenue(userId, venueId) {
  const rows = await supabase(`manager_venues?manager_id=eq.${encodeURIComponent(userId)}&venue_id=eq.${encodeURIComponent(venueId)}&select=id,manager_id,venue_id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const venueId = String(source.venue_id || '').trim();
    const requestedScope = String(source.scope || 'venue').trim() === 'shared' ? 'shared' : 'venue';
    if (!venueId) return json(res, 400, { ok: false, error: 'venue_id_required' });

    const user = await getManagerUser(bearer(req));
    if (!(await assertManagerVenue(user.id, venueId))) return json(res, 403, { ok: false, error: 'venue_access_denied' });

    const clientId = process.env.YOOKASSA_CLIENT_ID;
    if (!clientId) return json(res, 503, { ok: false, error: 'yookassa_not_configured' });

    const state = randomToken(32);
    const codeVerifier = randomToken(64);
    const redirectUri = callbackUrl(req);
    await supabase('payment_oauth_states', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ provider: 'yookassa', venue_id: requestedScope === 'shared' ? null : venueId, manager_id: user.id, state_hash: sha256(state), redirect_uri: redirectUri, requested_scope: requestedScope, code_verifier: codeVerifier, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    });

    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state, code_challenge: pkceChallenge(codeVerifier), code_challenge_method: 'S256' });
    const authorizationUrl = `${authorizeUrl()}?${params.toString()}`;
    if (req.method === 'POST') return json(res, 200, { ok: true, authorization_url: authorizationUrl });
    return redirect(res, authorizationUrl);
  } catch (e) {
    console.error('[YooKassa connect]', e);
    return json(res, e.status || 500, { ok:false, error:e.message || 'oauth_start_failed', details:e.data || null });
  }
};
