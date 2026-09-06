const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROPOSE_PATH = '/api/manager-ai-propose';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const token = bearer(req);
  if (!token) return json(res, 401, { ok: false, error: 'missing_authorization' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json(res, 500, { ok: false, error: 'supabase_not_configured' });

  try {
    // Keep the historical /api/manager-ai endpoint compatible, but route it
    // through the same proposal engine used by the executable Qrchick UI.
    // This removes the duplicate serverless function without removing the API.
    const upstream = `${SUPABASE_URL.replace(/\/$/, '')}`;
    const sb = createClient(upstream, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData?.user) return json(res, 401, { ok: false, error: 'invalid_token' });

    const host = req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${host}`;
    const body = req.body || {};
    const message = body.message || body.prompt || body.text || '';
    if (!String(message).trim()) return json(res, 400, { ok: false, error: 'message_required' });

    const response = await fetch(`${base}${PROPOSE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ...body,
        message: String(message),
        mode: 'propose'
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { ok: false, error: text || 'invalid_upstream_response' }; }
    return json(res, response.status, data);
  } catch (error) {
    console.error('manager-ai compatibility route error', error);
    return json(res, 500, { ok: false, error: 'manager_ai_unavailable', message: error.message });
  }
};
