const { json, supabase } = require('../../_lib/yookassa');
const { bearer, getManagerUser } = require('../../_lib/manager-auth');

async function managerVenues(managerId) {
  return supabase(`manager_venues?manager_id=eq.${encodeURIComponent(managerId)}&select=venue_id`);
}

async function assertManagerVenue(userId, venueId) {
  const rows = await supabase(`manager_venues?manager_id=eq.${encodeURIComponent(userId)}&venue_id=eq.${encodeURIComponent(venueId)}&select=venue_id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'PATCH', 'POST'].includes(req.method)) {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const user = await getManagerUser(bearer(req));

    const venueRows = await managerVenues(user.id);
    const venueIds = (venueRows || []).map(x => x.venue_id).filter(Boolean);
    if (!venueIds.length) return json(res, 200, { ok: true, shared: null, venues: [] });

    if (req.method === 'GET') {
      const accounts = await supabase(
        `payment_accounts?manager_id=eq.${encodeURIComponent(user.id)}&provider=eq.yookassa&select=id,venue_id,account_scope,provider,account_name,merchant_id,shop_id,status,metadata,oauth_account_id,connected_at,disconnected_at,created_at,updated_at&order=created_at.desc`
      );
      const byVenue = {};
      let shared = null;
      (accounts || []).forEach(a => {
        if (a.account_scope === 'platform' && !a.venue_id) shared = a;
        else if (a.venue_id) byVenue[a.venue_id] = a;
      });
      return json(res, 200, {
        ok: true,
        shared,
        venues: venueIds.map(id => ({ venue_id: id, account: byVenue[id] || null }))
      });
    }

    const body = req.body || {};
    const accountId = String(body.account_id || '').trim();
    if (!accountId) return json(res, 400, { ok: false, error: 'account_id_required' });

    const existingRows = await supabase(
      `payment_accounts?id=eq.${encodeURIComponent(accountId)}&manager_id=eq.${encodeURIComponent(user.id)}&provider=eq.yookassa&select=id,venue_id,account_scope,status&limit=1`
    );
    const account = Array.isArray(existingRows) ? existingRows[0] : null;
    if (!account) return json(res, 404, { ok: false, error: 'payment_account_not_found' });

    if (req.method === 'PATCH') {
      const action = String(body.action || '').trim();
      if (action === 'enable' || action === 'disable') {
        const status = action === 'enable' ? 'active' : 'disabled';
        await supabase(`payment_accounts?id=eq.${encodeURIComponent(accountId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, disconnected_at: action === 'disable' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        });
        return json(res, 200, { ok: true, status });
      }

      if (action === 'make_shared') {
        const sharedRows = await supabase(
          `payment_accounts?manager_id=eq.${encodeURIComponent(user.id)}&provider=eq.yookassa&account_scope=eq.platform&venue_id=is.null&select=id&limit=1`
        );
        if (Array.isArray(sharedRows) && sharedRows.length && sharedRows[0].id !== accountId) {
          return json(res, 409, { ok: false, error: 'shared_payment_account_already_exists' });
        }
        await supabase(`payment_accounts?id=eq.${encodeURIComponent(accountId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ account_scope: 'platform', venue_id: null, updated_at: new Date().toISOString() })
        });
        return json(res, 200, { ok: true, account_scope: 'platform', venue_id: null });
      }

      if (action === 'make_venue') {
        const venueId = String(body.venue_id || '').trim();
        if (!venueId || !(await assertManagerVenue(user.id, venueId))) {
          return json(res, 403, { ok: false, error: 'venue_access_denied' });
        }
        const conflict = await supabase(
          `payment_accounts?venue_id=eq.${encodeURIComponent(venueId)}&provider=eq.yookassa&account_scope=eq.venue&select=id&limit=1`
        );
        if (Array.isArray(conflict) && conflict.length && conflict[0].id !== accountId) {
          return json(res, 409, { ok: false, error: 'venue_payment_account_already_exists' });
        }
        await supabase(`payment_accounts?id=eq.${encodeURIComponent(accountId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ account_scope: 'venue', venue_id: venueId, updated_at: new Date().toISOString() })
        });
        return json(res, 200, { ok: true, account_scope: 'venue', venue_id: venueId });
      }

      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    return json(res, 400, { ok: false, error: 'unsupported_action' });
  } catch (e) {
    console.error('[YooKassa accounts]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'payment_accounts_failed', details: e.data || null });
  }
};
