'use strict';

const MODEL = process.env.RECEPT_AI_MODEL || 'gpt-4.1-mini';

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const apiKey = process.env.Recept_api_key;
  if (!apiKey) return send(res, 503, { error: 'Recept_api_key не настроен в Vercel Environment Variables' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.action !== 'recipe_suggest') return send(res, 400, { error: 'Unsupported action' });

    const product = body.product || {};
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    const globalIngredients = Array.isArray(body.globalIngredients) ? body.globalIngredients : [];

    const system = [
      'Ты QRChick — специализированный AI-ассистент только для модуля Рецептуры ресторанной системы.',
      'Подбери реалистичный состав блюда по названию, описанию и категории, используя в первую очередь ингредиенты из локальной базы.',
      'Если подходящий ингредиент есть в локальной базе, используй его точное название. Не выдумывай лишние компоненты.',
      'Количество указывай для одной стандартной порции. Единицы: g, kg, ml, l, pcs.',
      'Верни только валидный JSON без markdown: {"ingredients":[{"name":"...","quantity":100,"unit":"g","note":"..."}],"confidence":0.0,"comment":"..."}.',
      'Количество может быть профессиональной оценкой, но состав должен быть реалистичным для данного блюда.'
    ].join(' ');

    const user = JSON.stringify({ product, local_ingredients: ingredients, global_ingredients: globalIngredients });

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch (_) { data = null; }
    if (!upstream.ok) return send(res, upstream.status, { error: (data && data.error && data.error.message) || 'AI provider error' });

    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return send(res, 502, { error: 'Пустой ответ QRChick' });

    let result;
    try { result = JSON.parse(content); } catch (_) { return send(res, 502, { error: 'QRChick вернул некорректный JSON' }); }
    if (!result || !Array.isArray(result.ingredients)) return send(res, 502, { error: 'QRChick не вернул список ингредиентов' });

    result.ingredients = result.ingredients.filter(x => x && x.name && Number(x.quantity) > 0).map(x => ({
      name: String(x.name).trim(),
      quantity: Number(x.quantity),
      unit: ['g','kg','ml','l','pcs'].includes(String(x.unit || '').toLowerCase()) ? String(x.unit).toLowerCase() : 'g',
      note: x.note ? String(x.note).trim() : ''
    }));

    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, { ingredients: result.ingredients, confidence: Number(result.confidence) || 0, comment: result.comment ? String(result.comment) : '' });
  } catch (e) {
    console.error('[qrchick]', e);
    return send(res, 500, { error: e && e.message ? e.message : 'Internal server error' });
  }
};
