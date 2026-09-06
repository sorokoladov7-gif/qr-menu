'use strict';

/* Qrchick admin execution bridge.
 * Read/analysis requests stay on the existing agent. Confirmed database changes
 * are executed here with the authenticated admin session and server-side
 * Supabase Management API credentials.
 */
process.env.GEMINI_API_KEY = '';
const agent = require('./admin-ai-agent');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_MGMT = process.env.SUPABASE_MANAGEMENT_API_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const SUPABASE_REF = process.env.SUPABASE_PROJECT_REF || 'ulxfsozdryqrnlxzlblt';

function bearer(req) {
  const h = String(req.headers?.authorization || req.headers?.Authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

async function requireAdmin(req) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const user = await r.json().catch(() => null);
  if (!r.ok || !user?.id) throw Object.assign(new Error('AUTH_INVALID'), { status: 401 });
  const p = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role&limit=1', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const rows = await p.json().catch(() => []);
  if (!p.ok || String(rows?.[0]?.role || '').toLowerCase() !== 'admin') {
    throw Object.assign(new Error('ADMIN_ONLY'), { status: 403 });
  }
  return user;
}

function normalizeSql(sql) {
  return String(sql || '').trim().replace(/^```sql\s*/i, '').replace(/```$/i, '').trim();
}

function validateSql(sql) {
  const q = normalizeSql(sql);
  if (!q || q.length > 100000) throw Object.assign(new Error('INVALID_SQL'), { status: 400 });
  const low = q.toLowerCase().replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  if (/\b(create|alter|drop)\s+(role|user|policy)\b/i.test(low)) throw Object.assign(new Error('SECURITY_SENSITIVE_SQL_BLOCKED'), { status: 403 });
  if (/\b(grant|revoke)\b/i.test(low)) throw Object.assign(new Error('PRIVILEGE_SQL_BLOCKED'), { status: 403 });
  if (/\b(pg_read_file|pg_write_file|copy\s+.*program)\b/i.test(low)) throw Object.assign(new Error('SERVER_FILE_SQL_BLOCKED'), { status: 403 });
  if (/\b(truncate)\b/i.test(low)) throw Object.assign(new Error('TRUNCATE_REQUIRES_EXPLICIT_MIGRATION'), { status: 403 });
  return q;
}

async function executeDatabaseChanges(changes) {
  if (!SUPABASE_MGMT) throw Object.assign(new Error('SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED'), { status: 503 });
  if (!Array.isArray(changes) || !changes.length || changes.length > 20) {
    throw Object.assign(new Error('INVALID_CHANGE_SET'), { status: 400 });
  }
  const results = [];
  for (let i = 0; i < changes.length; i += 1) {
    const item = changes[i] || {};
    const sql = validateSql(item.sql);
    const r = await fetch('https://api.supabase.com/v1/projects/' + encodeURIComponent(SUPABASE_REF) + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SUPABASE_MGMT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw Object.assign(new Error(data?.message || data?.error || ('SUPABASE_QUERY_FAILED_' + r.status)), { status: r.status });
    }
    results.push({ index: i, sql, reason: String(item.reason || ''), result: data });
  }
  return results;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const body = req.body || {};
    const action = String(body.action || 'audit');
    if (action === 'apply_db') {
      await requireAdmin(req);
      const changes = await executeDatabaseChanges(body.database_changes);
      return res.status(200).json({ ok: true, changes });
    }
    return agent(req, res);
  } catch (e) {
    return res.status(Number(e.status) || 500).json({ error: e.message || 'Qrchick execution error' });
  }
};
