const crypto = require('crypto');

const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function base64urlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function decodeJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(base64urlDecode(parts[0]).toString('utf8')),
      payload: JSON.parse(base64urlDecode(parts[1]).toString('utf8')),
      signature: base64urlDecode(parts[2]),
      signingInput: `${parts[0]}.${parts[1]}`
    };
  } catch (_) {
    return null;
  }
}

function verifyJwtWithJwk(decoded, jwk) {
  if (!decoded || !jwk) return false;
  const alg = decoded.header && decoded.header.alg;
  if (!alg || alg === 'none') return false;

  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const data = Buffer.from(decoded.signingInput, 'utf8');

    if (alg.startsWith('RS')) {
      return crypto.verify(alg.toLowerCase().replace('rs', 'RSA-SHA'), data, publicKey, decoded.signature);
    }

    if (alg.startsWith('ES')) {
      const size = Number(alg.slice(2)) / 8;
      if (!Number.isInteger(size) || decoded.signature.length !== size * 2) return false;
      const r = decoded.signature.subarray(0, size);
      const s = decoded.signature.subarray(size);
      const toDerInt = (part) => {
        let value = Buffer.from(part);
        while (value.length > 1 && value[0] === 0) value = value.subarray(1);
        if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
        return Buffer.concat([Buffer.from([0x02, value.length]), value]);
      };
      const rDer = toDerInt(r);
      const sDer = toDerInt(s);
      const body = Buffer.concat([rDer, sDer]);
      const derSignature = Buffer.concat([Buffer.from([0x30, body.length]), body]);
      const hash = alg === 'ES256' ? 'SHA256' : alg === 'ES384' ? 'SHA384' : 'SHA512';
      return crypto.verify(hash, data, publicKey, derSignature);
    }
  } catch (_) {
    return false;
  }
  return false;
}

async function fetchJwks() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Accept: 'application/json' }
  });
  if (!response.ok) return null;
  const data = await response.json();
  return Array.isArray(data.keys) ? data.keys : null;
}

async function verifyAccessToken(accessToken) {
  const decoded = decodeJwt(accessToken);
  if (!decoded || !decoded.payload || !decoded.payload.sub) return null;

  const now = Math.floor(Date.now() / 1000);
  const { exp, nbf, iss, aud } = decoded.payload;
  if (typeof exp === 'number' && exp <= now) return null;
  if (typeof nbf === 'number' && nbf > now + 30) return null;
  if (iss && iss !== `${SUPABASE_URL}/auth/v1`) return null;
  if (aud && aud !== 'authenticated') return null;

  const keys = await fetchJwks();
  if (!keys || !keys.length) return null;

  const candidates = decoded.header.kid ? keys.filter(k => k.kid === decoded.header.kid) : keys;
  if (!candidates.length) return null;
  if (!candidates.some(k => verifyJwtWithJwk(decoded, k))) return null;

  return decoded.payload;
}

async function getProfile(userId) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return null;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,display_name,role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json'
      }
    }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getManagerUser(accessToken) {
  if (!accessToken) {
    const error = new Error('auth_required');
    error.status = 401;
    throw error;
  }

  // First use Supabase Auth directly, retaining compatibility with the existing session.
  try {
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
  } catch (_) {}

  // Reliable fallback: cryptographically verify the JWT using Supabase JWKS.
  const claims = await verifyAccessToken(accessToken);
  if (!claims || !claims.sub) {
    const error = new Error('supabase_user_auth_failed');
    error.status = 401;
    throw error;
  }

  const profile = await getProfile(claims.sub);
  if (!profile || profile.id !== claims.sub || profile.role !== 'manager') {
    const error = new Error('manager_access_required');
    error.status = 403;
    throw error;
  }

  return {
    id: claims.sub,
    email: profile.email || claims.email || null,
    user_metadata: { display_name: profile.display_name || null },
    role: profile.role
  };
}

module.exports = { bearer, getManagerUser };
