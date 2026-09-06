'use strict';

const UPSTREAM = '/api/admin-ai-isolated';

function writeEvent(res, event, data) {
  res.write('event: ' + event + '\n');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

function origin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers.host || '');
  if (!host) throw new Error('HOST_REQUIRED');
  return proto + '://' + host;
}

function sendHeaders(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  sendHeaders(res);
  writeEvent(res, 'status', { stage: 'connecting', message: 'Qrchick подключается к проектному агенту…' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': String(req.headers.authorization || '')
    };

    writeEvent(res, 'status', { stage: 'agent', message: 'Передаю запрос существующему Qrchick без создания второго агента.' });

    const upstream = await fetch(origin(req) + UPSTREAM, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const raw = await upstream.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch (_) { payload = { error: raw || 'UPSTREAM_INVALID_RESPONSE' }; }

    if (!upstream.ok) {
      writeEvent(res, 'error', payload);
      res.write('event: done\ndata: {}\n\n');
      res.end();
      return;
    }

    const result = payload && payload.result ? payload.result : {};
    const answer = String(result.answer || result.summary || 'Готово.');
    writeEvent(res, 'status', { stage: 'response', message: 'Получен ответ. Передаю текст потоково…' });

    const chunkSize = 48;
    for (let i = 0; i < answer.length; i += chunkSize) {
      writeEvent(res, 'text', { delta: answer.slice(i, i + chunkSize) });
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    writeEvent(res, 'result', payload);
    writeEvent(res, 'done', {});
    res.end();
  } catch (e) {
    writeEvent(res, 'error', { error: String(e && e.message || 'STREAM_FAILED') });
    writeEvent(res, 'done', {});
    res.end();
  }
}

module.exports = handler;
