const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function jwtSubject(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return payload && typeof payload.sub === 'string' ? payload.sub : null;
  } catch (_) {
    return null;
  }
}

async function getManagerUser(accessToken) {
  if (!accessToken) {
    const error = new Error('auth_required');
    error.status = 401;
    throw error;
  }

  // Primary validation against Supabase Auth using the same public project/key as manager.html.
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (authResponse.ok) {
    const user = await authResponse.json();
    if (user && user.id) return user;
  }

  // Fallback: let PostgREST/RLS validate the bearer token and return only the matching profile.
  // The JWT subject is used only to address the row; authorization is still enforced by PostgREST.
  const sub = jwtSubject(accessToken);
  if (sub) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (serviceKey) {
      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(sub)}&select=id,email,display_name,role&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        }
      );
      if (profileResponse.ok) {
        const rows = await profileResponse.json();
        if (Array.isArray(rows) && rows[0] && rows[0].id === sub) return rows[0];
      }
    }
  }

  const error = new Error('supabase_user_auth_failed');
  error.status = authResponse.status || 401;
  try { error.data = await authResponse.clone().json(); } catch (_) { error.data = null; }
  throw error;
}

module.exports = { bearer, getManagerUser };
