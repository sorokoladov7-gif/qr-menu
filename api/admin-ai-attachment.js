'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
/* Admin Qrchick is strictly isolated: never fall back to the menu-import key. */
const AI_KEY = process.env.ADMIN_AI_KEY || '';
const MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|jpg|webp|gif|bmp|heic|heif)|application\/pdf|text\/plain|text\/markdown|text\/csv|application\/json|application\/javascript|text\/javascript|text\/css|text\/html|application\/xml|text\/xml)$/i;

function fail(message, status) { return Object.assign(new Error(message), { status: status || 500 }); }
function bearer(req) {
  const h = String(req.headers?.authorization || req.headers?.Authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}
async function adminAuth(req) {
  const token = bearer(req);
  if (!token) throw fail('AUTH_REQUIRED', 401);
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const user = await r.json().catch(() => null);
  if (!r.ok || !user?.id) throw fail('AUTH_INVALID', 401);
  const p = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role&limit=1', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const rows = await p.json().catch(() => []);
  if (!p.ok || String(rows?.[0]?.role || '').toLowerCase() !== 'admin') throw fail('ADMIN_ONLY', 403);
  return user;
}
function failover(e) {
  const s = Number(e?.status || 0);
  const m = String(e?.message || '').toLowerCase();
  return [408, 409, 429, 500, 502, 503, 504].includes(s) || /quota|rate.?limit|resource.?exhausted|overloaded|unavailable|not found|timeout|unsupported/.test(m);
}
function outputText(d) {
  if (d?.output_text) return d.output_text;
  return (d?.steps || [])
    .filter(s => s?.type === 'model_output')
    .flatMap(s => s?.content || [])
    .filter(c => c?.type === 'text')
    .map(c => c.text || '')
    .join('\n')
    .trim();
}
async function analyze(model, file, prompt) {
  const isImage = /^image\//i.test(file.mime_type);
  const content = [
    { type: 'text', text: prompt },
    isImage
      ? { type: 'image', data: file.data, mime_type: file.mime_type }
      : { type: 'document', data: file.data, mime_type: file.mime_type }
  ];
  const body = {
    model,
    input: content,
    store: true,
    generation_config: /^gemini-3\./.test(model)
      ? { max_output_tokens: 2500, thinking_level: /lite/.test(model) ? 'minimal' : 'medium' }
      : { max_output_tokens: 2500 }
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': AI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw fail(d?.error?.message || 'AI_ATTACHMENT_HTTP_' + r.status, r.status);
  return { text: outputText(d), model };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  try {
    await adminAuth(req);
    if (!AI_KEY) throw fail('ADMIN_AI_KEY_NOT_CONFIGURED', 503);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const file = body.file || {};
    const name = String(file.name || 'attachment').slice(0, 180);
    const mime = String(file.mime_type || file.type || 'application/octet-stream').toLowerCase();
    const data = String(file.data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (!data) throw fail('ATTACHMENT_DATA_REQUIRED', 400);
    if (!ALLOWED.test(mime)) throw fail('UNSUPPORTED_ATTACHMENT_TYPE', 415);
    const bytes = Math.floor(data.length * 3 / 4);
    if (bytes > MAX_BYTES) throw fail('ATTACHMENT_TOO_LARGE_3MB', 413);
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) throw fail('INVALID_BASE64', 400);

    const userPrompt = String(body.prompt || '').trim().slice(0, 6000) ||
      'Проанализируй это вложение как инженер Qrchick. Опиши только факты, которые видишь в файле. Если это скриншот — найди UI/UX и технические проблемы. Если PDF/текстовый файл — извлеки важные данные и ошибки. Не выдумывай отсутствующие сведения. Ответ дай структурировано и на русском языке.';
    const prompt = `Имя файла: ${name}\nТип: ${mime}\n\nЗадача администратора:\n${userPrompt}\n\nПосле анализа сформируй компактный инженерный контекст, который будет передан Qrchick для проверки проекта. Не предлагай изменения, которых нельзя подтвердить содержимым вложения.`;

    let last;
    for (const model of MODELS) {
      try {
        const result = await analyze(model, { data, mime_type: mime }, prompt);
        return res.status(200).json({
          ok: true,
          file: { name, mime_type: mime, size_bytes: bytes },
          analysis: result.text || 'Вложение обработано, но текст анализа не получен.',
          model: 'Qrchick',
          active_model_hidden: true,
          free_tier_only: true
        });
      } catch (e) {
        last = e;
        if (!failover(e)) throw e;
      }
    }
    throw last || fail('ALL_FREE_ATTACHMENT_MODELS_UNAVAILABLE', 503);
  } catch (e) {
    const status = Number(e?.status || 500);
    return res.status(status).json({ ok: false, error: String(e?.message || 'attachment_processing_failed') });
  }
};
