export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI не настроен: добавьте OPENAI_API_KEY в Vercel Environment Variables.' });
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Нужно передать изображение плана.' });
    }
    const prompt = `Ты анализируешь план ресторана/кафе/фуд-точки. Верни ТОЛЬКО валидный JSON без markdown. Найди видимые гостевые столы. Не выдумывай столы, если их нельзя уверенно распознать. Для каждого стола верни: {"number": number, "seats": number, "shape":"round|square|rect", "x":0..1000, "y":0..1000, "confidence":0..1}. x/y — центр стола в координатах изображения, затем обязательно верни image_width и image_height. Формат: {"image_width":number,"image_height":number,"tables":[...]}. Также не включай бар, стойки, диваны, кресла, кухонное оборудование и декоративные элементы.`;
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image, detail: 'high' }] }],
        max_output_tokens: 2500
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Ошибка AI анализа' });
    const text = (data.output || []).flatMap(x => x.content || []).map(x => x.text || '').join('').trim();
    let parsed;
    try { parsed = JSON.parse(text.replace(/^```json\s*/,'').replace(/```$/,'')); }
    catch { return res.status(502).json({ error: 'AI вернул некорректный JSON.' }); }
    if (!Array.isArray(parsed.tables)) parsed.tables = [];
    parsed.tables = parsed.tables.filter(t => Number(t.confidence ?? 1) >= 0.55).map((t,i) => ({ number: Number(t.number)||i+1, seats: Math.min(20, Math.max(1, Number(t.seats)||4)), shape: ['round','square','rect'].includes(t.shape) ? t.shape : 'round', x: Number(t.x)||0, y:Number(t.y)||0, confidence:Number(t.confidence ?? 0.8) }));
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: e?.message || 'AI analysis failed' }); }
}
