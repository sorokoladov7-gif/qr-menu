'use strict';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODEL = process.env.GEMINI_IMPORT_MODEL || 'gemini-3.7-flash';
const MAX_BODY = 14 * 1024 * 1024;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    venue_name: { type: 'STRING' },
    venue_description: { type: 'STRING' },
    products: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          price: { type: 'NUMBER' },
          category: { type: 'STRING' },
          image_url: { type: 'STRING' },
          is_available: { type: 'BOOLEAN' }
        },
        required: ['name', 'description', 'price', 'category', 'image_url', 'is_available']
      }
    }
  },
  required: ['venue_name', 'venue_description', 'products']
};

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 600);
}

function normalizeProduct(item) {
  const name = clean(item && item.name, 220);
  const value = Number(item && item.price);
  const image = clean(item && item.image_url, 2000);
  return {
    name,
    description: clean(item && item.description, 600),
    price: Number.isFinite(value) && value > 0 ? value : 0,
    category: clean(item && item.category, 120) || 'Основные блюда',
    image_url: image.indexOf('http://') === 0 || image.indexOf('https://') === 0 ? image : '',
    is_available: !!(item && item.is_available !== false)
  };
}

function getOutputText(data) {
  const candidates = data && Array.isArray(data.candidates) ? data.candidates : [];
  const parts = candidates[0] && candidates[0].content && Array.isArray(candidates[0].content.parts)
    ? candidates[0].content.parts
    : [];
  return parts.map(function (part) { return part && part.text || ''; }).join('');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
  }
  return text ? JSON.parse(text) : {};
}

async function fetchSiteText(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('INVALID_URL');

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 12000);

  try {
    const response = await fetch(parsed.href, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 QR-Menu-Gemini/1.0',
        'accept': 'text/html,application/xhtml+xml,text/plain,*/*;q=0.5',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) throw new Error('SITE_HTTP_' + response.status);

    const html = (await response.text()).slice(0, 7 * 1024 * 1024);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180000);

    return {
      url: response.url || parsed.href,
      title: clean(titleMatch && titleMatch[1] || '', 300),
      text
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'), { status: 503 });

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 55000);

  try {
    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: SCHEMA
      }
    };

    const response = await fetch(GEMINI_URL + MODEL + ':generateContent', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-goog-api-key': key,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(function () { return null; });

    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : 'Gemini HTTP ' + response.status;
      throw Object.assign(new Error(message), { status: response.status >= 500 ? 502 : response.status });
    }

    const raw = getOutputText(data);
    if (!raw) throw new Error('AI_EMPTY_RESPONSE');
    return JSON.parse(raw);
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(kind, extra) {
  return [
    'Ты профессиональный парсер меню для QR Menu.',
    'Извлекай только реальные блюда и позиции, присутствующие в источнике.',
    'Не выдумывай названия, цены, описания и изображения.',
    'Исправляй только очевидные OCR-ошибки.',
    'Цена — число в рублях; если её нет, 0.',
    'Категория — понятная категория на русском.',
    'Описание заполняй только когда оно реально есть в источнике.',
    'image_url заполняй только прямой http/https ссылкой, найденной в источнике; для фото и PDF оставляй пустым.',
    'Удали заголовки разделов, адреса, телефоны, акции, служебный текст и дубликаты.',
    'Верни только JSON по заданной схеме.',
    'Источник: ' + kind + '.',
    extra || ''
  ].join('\n');
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('INVALID_DATA_URL');
  return { mime: match[1].toLowerCase(), data: match[2] };
}

function browserClient() {
  return "(()=>{'use strict';if(window.__QR_MENU_AI_IMPORT__)return;window.__QR_MENU_AI_IMPORT__=true;const API='/api/import-ai';const vm=()=>window.__managerVue||null;const status=(b,t,e)=>{const x=b&&b.querySelector('#qr-menu-import-status-v2');if(x){x.textContent=t||'';x.style.color=e?'#fca5a5':'';}};const token=async()=>{try{const r=await db.auth.getSession();return r&&r.data&&r.data.session?r.data.session.access_token:'';}catch(e){return'';}};const send=async p=>{const h={'Content-Type':'application/json','Accept':'application/json'},t=await token();if(t)h.Authorization='Bearer '+t;const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:h,body:JSON.stringify(p)}),d=await r.json().catch(()=>null);if(!r.ok||!d||!d.ok)throw new Error(d&&d.error&&d.error.message||('AI HTTP '+r.status));return d;};const fileData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(f);});const norm=(v,a)=>(Array.isArray(a)?a:[]).map((x,i)=>{const iu=String(x&&x.image_url||'').trim(),p={name:String(x&&x.name||'').trim(),description:String(x&&x.description||'').trim(),price:Number(x&&x.price)||0,category:String(x&&x.category||'Основные блюда').trim()||'Основные блюда',image_url:(iu.indexOf('http://')===0||iu.indexOf('https://')===0)?iu:'',is_available:x&&x.is_available!==false,applies_to:'all'};if(!p.image_url&&v&&typeof v.dishImageUrl==='function')p.image_url=v.dishImageUrl(p,i+1);return p;}).filter(x=>x.name);const render=(b,a)=>{const p=b&&b.querySelector('#qr-menu-import-preview-v2'),c=b&&b.querySelector('#qr-menu-import-count-v2'),s=b&&b.querySelector('#qr-menu-import-save-v2'),cl=b&&b.querySelector('#qr-menu-import-clear-v2');if(!p||!c||!s||!cl)return;c.textContent=String(a.length);p.innerHTML=a.slice(0,30).map(x=>'<div style=\"display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)\"><span>'+String(x.name).replace(/[&<>\\\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[c]))+'</span><b>'+Number(x.price||0).toLocaleString('ru-RU')+' ₽</b></div>').join('')+(a.length>30?'<div class=\"muted\" style=\"font-size:11px;margin-top:6px\">и ещё '+(a.length-30)+'…</div>':'');s.style.display=a.length?'inline-block':'none';cl.style.display=a.length?'inline-block':'none';};const run=async(b,v,k,p)=>{if(v.importBusy)return;v.importBusy=true;try{status(b,'🤖 ИИ Gemini анализирует '+k+'…');const d=await send(Object.assign({kind:k},p||{}));v.importItems=norm(v,d.products);render(b,v.importItems);status(b,'✓ Gemini нашёл '+v.importItems.length+' позиций');}catch(e){console.error('[QR Gemini import]',e);v.importItems=[];render(b,[]);status(b,'Ошибка AI: '+e.message,true);}finally{v.importBusy=false;}};document.addEventListener('click',e=>{const t=e.target&&e.target.closest?e.target.closest('#qr-menu-import-pdf-v2,#qr-menu-import-photo-v2,#qr-menu-import-site-v2'):null;if(!t)return;const b=t.closest('#qr-menu-import-block-v2'),v=vm();if(!b||!v)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(t.id==='qr-menu-import-site-v2'){const u=prompt('Адрес сайта заведения:','https://');if(u&&u!=='https://')run(b,v,'сайт',{url:u.trim()});return;}const i=b.querySelector(t.id==='qr-menu-import-pdf-v2'?'#qr-menu-import-pdf-input-v2':'#qr-menu-import-photo-input-v2');if(i)i.click();},true);document.addEventListener('change',async e=>{const i=e.target;if(!i||!i.closest||!i.closest('#qr-menu-import-block-v2'))return;const b=i.closest('#qr-menu-import-block-v2'),v=vm();if(!b||!v)return;e.stopPropagation();e.stopImmediatePropagation();if(i.id==='qr-menu-import-pdf-input-v2'){const f=i.files&&i.files[0];i.value='';if(!f||v.importBusy)return;v.importBusy=true;try{status(b,'🤖 ИИ Gemini анализирует PDF…');const d=await send({kind:'pdf',filename:f.name,data:await fileData(f)});v.importItems=norm(v,d.products);render(b,v.importItems);status(b,'✓ Gemini нашёл '+v.importItems.length+' позиций');}catch(x){v.importItems=[];render(b,[]);status(b,'Ошибка AI: '+x.message,true);}finally{v.importBusy=false;}return;}if(i.id==='qr-menu-import-photo-input-v2'){const fs=Array.from(i.files||[]);i.value='';if(!fs.length||v.importBusy)return;v.importBusy=true;try{let all=[];for(let n=0;n<fs.length;n++){status(b,'🤖 ИИ Gemini анализирует фото '+(n+1)+' из '+fs.length+'…');const d=await send({kind:'image',filename:fs[n].name,data:await fileData(fs[n])});all=all.concat(norm(v,d.products));}v.importItems=all;render(b,all);status(b,'✓ Gemini нашёл '+all.length+' позиций',false);}catch(x){v.importItems=[];render(b,[]);status(b,'Ошибка AI: '+x.message,true);}finally{v.importBusy=false;}}},true);})();";
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const query = req.query || {};

  if (req.method === 'GET' && String(query.client || '') === '1') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).send(browserClient());
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Используйте POST' } });
  }

  try {
    const body = await readBody(req);
    const kind = String(body.kind || '').toLowerCase();
    let parts;

    if (kind === 'image') {
      const image = parseDataUrl(body.data);
      if (image.mime.indexOf('image/') !== 0) throw Object.assign(new Error('IMAGE_REQUIRED'), { status: 400 });
      parts = [
        { text: buildPrompt('фото меню', 'Имя файла: ' + clean(body.filename, 200)) },
        { inline_data: { mime_type: image.mime, data: image.data } }
      ];
    } else if (kind === 'pdf') {
      const pdf = parseDataUrl(body.data);
      if (pdf.mime !== 'application/pdf') throw Object.assign(new Error('PDF_REQUIRED'), { status: 400 });
      parts = [
        { text: buildPrompt('PDF меню', 'Имя файла: ' + clean(body.filename, 200)) },
        { inline_data: { mime_type: 'application/pdf', data: pdf.data } }
      ];
    } else if (kind === 'site') {
      const url = clean(body.url, 2000);
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) throw Object.assign(new Error('URL_REQUIRED'), { status: 400 });
      const site = await fetchSiteText(url);
      parts = [{ text: buildPrompt('сайт', 'URL: ' + site.url + '\nTITLE: ' + site.title + '\nТЕКСТ:\n' + site.text) }];
    } else {
      throw Object.assign(new Error('KIND_REQUIRED'), { status: 400 });
    }

    const result = await callGemini(parts);
    const products = (Array.isArray(result.products) ? result.products : [])
      .map(normalizeProduct)
      .filter(function (item) { return item.name; });

    return res.status(200).json({
      ok: true,
      venue: {
        name: clean(result.venue_name, 220),
        description: clean(result.venue_description, 600)
      },
      products,
      meta: {
        provider: 'google-gemini',
        model: MODEL,
        kind,
        products_found: products.length
      }
    });
  } catch (error) {
    const code = String(error && error.message || 'IMPORT_AI_ERROR');
    const status = Number(error && error.status) || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code,
        message: code === 'GEMINI_API_KEY_NOT_CONFIGURED'
          ? 'Не настроен GEMINI_API_KEY на сервере.'
          : code === 'REQUEST_TOO_LARGE'
            ? 'Файл слишком большой для AI-импорта.'
            : clean(code, 500)
      }
    });
  }
};
