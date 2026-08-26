/* Lightweight fixed-window rate limiter for public payment endpoints.
   Vercel functions are ephemeral, so this is per-instance best-effort DoS
   blunting (not a distributed guarantee). Thresholds default high so normal
   usage — including status polling — never trips; only floods do. */
const buckets = new Map();

function clientIp(req) {
  const xf = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  if (xf) return xf;
  const real = req.headers && req.headers['x-real-ip'];
  if (real) return String(real).trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function num(name, fallback) {
  const raw = process.env[name];
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Returns true when the request is blocked (and writes a 429 response).
function blocked(req, res, name, defaultCount, defaultWindowMs) {
  const count = num('RATE_LIMIT_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_COUNT', defaultCount);
  const windowMs = num('RATE_LIMIT_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_WINDOW_MS', defaultWindowMs);
  const now = Date.now();
  const key = name + '|' + clientIp(req);
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) { b = { start: now, count: 0 }; buckets.set(key, b); }
  b.count++;
  if (buckets.size > 10000) { for (const [k, v] of buckets) { if (now - v.start >= windowMs) buckets.delete(k); } }
  if (b.count > count) {
    const retry = Math.max(1, Math.ceil((b.start + windowMs - now) / 1000));
    res.setHeader('Retry-After', String(retry));
    res.status(429).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify({ ok: false, error: 'rate_limited', retry_after_s: retry }));
    return true;
  }
  return false;
}

module.exports = { blocked, clientIp };
