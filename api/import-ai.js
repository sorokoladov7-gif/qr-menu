'use strict';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.OPENAI_IMPORT_MODEL || 'gpt-5.6-luna';
const MAX_BODY = 14 * 1024 * 1024;

const MENU_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    venue_name: { type: 'string' },
    venue_description: { type: 'string' },
    products: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          category: { type: 'string' },
          image_url: { type: 'string' },
          is_available: { type: 'boolean' }
        },
        required: ['name', 'description', 'price', 'category', 'image_url', 'is_available']
      }
    }
  },
  required: ['venue_name', 'venue_description', 'products']
};

function clean(value, max = 600) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeProduct(p) {
  const price = Number(p && p.price);
  return {
    name: clean(p && p.name, 220),
    description: clean(p && p.description, 600),
    price: Number.isFinite(price) && price > 0 ? price : 0,
    category: clean(p && p.category, 120) || 'main',
    image_url: /^https?:\/\//i.test(String(p && p.image_url || '').trim()) ? String(p.image_url).trim() : '',
    is_available: p && p.is_available !== false
  };
}

function extractOutputText(data) {
  if (data && typeof data.output_text === 'string') return data.output_text;
  const chunks = [];
  for (const item of Array.isArray(data && data.output) ? data.output : []) {
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('');
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

async function fetchSiteText(url) {
  const parsed = new URL(url);
  if (!/^https?:$/i.test(parsed.protocol)) throw new Error('INVALID_URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(parsed.href, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 QR-Menu-AI-Importer/1.0',
        accept: 'text/html,application/xhtml+xml,text/plain,*/*;q=0.5',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!r.ok) throw new Error('SITE_HTTP_' + r.status);
    const html = (await r.text()).slice(0, 7 * 1024 * 1024);
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '', 300);
    return { url: parsed.href, title, text: visible.slice(0, 180000) };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(contents) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const e = new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    e.status = 503;
    throw e;
  }
  const payload = {
    model: MODEL,
    input: [{ role: 'user', content: contents }],
    text: {
      format: {
        type: 'json_schema',
        name: 'qr_menu_import',
        strict: true,
        schema: MENU_SCHEMA
      }
    },
    temperature: 0.1,
    max_output_tokens: 12000
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && data.error && data.error.message ? data.error.message : `OpenAI HTTP ${response.status}`;
      const e = new Error(message);
      e.status = response.status >= 500 ? 502 : response.status;
      throw e;
    }
    const raw = extractOutputText(data);
    if (!raw) throw new Error('AI_EMPTY_RESPONSE');
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) { throw new Error('AI_INVALID_JSON'); }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(kind, extra = '') {
  return [
    'Ты — профессиональный парсер меню ресторана для QR Menu.',
    'Из входных данных извлеки только реальные позиции меню.',
    'Не придумывай блюда, цены, описания или изображения.',
    'Сохраняй написание названий максимально близко к источнику, исправляя только очевидные OCR/опечатки.',
    'Цена должна быть числом в рублях без валюты. Если цена не указана, поставь 0.',
    'Определи понятную категорию на русском языке: например Закуски, Салаты, Супы, Основные блюда, Пицца, Суши, Десерты, Напитки, Завтраки, Соусы.',
    'Описание — краткое, только если оно реально присутствует в источнике.',
    'image_url заполняй только прямой HTTP(S)-ссылкой на изображение блюда, найденной в источнике; для фото/PDF оставляй пустым.',
    'Удаляй заголовки разделов, телефоны, адреса, акции, служебный текст и дубликаты.',
    'Ответ верни строго по заданной JSON-схеме.',
    `Источник: ${kind}.`,
    extra
  ].join('\n');
}

function browserClient() {
  return `(()=>{
'use strict';
if(window.__QR_MENU_AI_IMPORT__)return;window.__QR_MENU_AI_IMPORT__=true;
const API='/api/import-ai';
function clean(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim();}
function setStatus(block,text,error){const s=block&&block.querySelector('#qr-menu-import-status-v2');if(s){s.textContent=text||'';s.style.color=error?'#fca5a5':'';}}
function show(block,items){const p=block.querySelector('#qr-menu-import-preview-v2'),c=block.querySelector('#qr-menu-import-count-v2'),save=block.querySelector('#qr-menu-import-save-v2'),clear=block.querySelector('#qr-menu-import-clear-v2');c.textContent=items.length;p.innerHTML=items.slice(0,30).map(x=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+String(x.name||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))+'</span><b>'+Number(x.price||0).toLocaleString('ru-RU')+' ₽</b></div>').join('')+(items.length>30?'<div class="muted" style="font-size:11px;margin-top:6px">и ещё '+(items.length-30)+'…</div>':'');save.style.display=items.length?'inline-block':'none';clear.style.display=items.length?'inline-block':'none';}
async function sessionHeaders(){try{const r=await db.auth.getSession();const token=r&&r.data&&r.data.session&&r.data.session.access_token;return token?{Authorization:'Bearer '+token}:{}}catch(e){return{};}}
async function ai(body){const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:Object.assign({'Content-Type':'application/json','Accept':'application/json'},await sessionHeaders()),body:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok||!d||d.ok===false)throw new Error(d&&d.error&&d.error.message||d&&d.message||'Ошибка AI-импорта');return d;}
function normalize(vm,items){return(Array.isArray(items)?items:[]).map((x,i)=>{const p={name:clean(x.name),description:clean(x.description),price:Number(x.price)||0,category:clean(x.category)||'main',image_url:/^https?:\\/\\//i.test(String(x.image_url||''))?String(x.image_url).trim():'',is_available:x.is_available!==false,applies_to:'all'};if(!p.image_url&&vm&&typeof vm.dishImageUrl==='function')p.image_url=vm.dishImageUrl(p,i+1);return p;}).filter(x=>x.name);}
async function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Не удалось прочитать файл'));r.readAsDataURL(file);});}
function blockFor(el){return el&&el.closest('#qr-menu-import-block-v2');}
async function handle(block,vm,kind,payload,files){if(vm.importBusy)return;vm.importBusy=true;try{setStatus(block,'🤖 ИИ анализирует '+kind+'…');let d,items=[];if(files){for(let i=0;i<files.length;i++){setStatus(block,'🤖 ИИ анализирует фото '+(i+1)+' из '+files.length+'…');const data=await fileData(files[i]);d=await ai({kind:'image',filename:files[i].name,data});items=items.concat(normalize(vm,d.products));}}else{d=await ai(Object.assign({kind},payload||{}));items=normalize(vm,d.products);}vm.importItems=items;show(block,items);setStatus(block,'✓ ИИ нашёл '+items.length+' позиций');if(d.venue&&d.venue.name){try{vm.importVenue=d.venue;}catch(e){}}}catch(e){console.error('[QR AI import]',e);vm.importItems=[];show(block,[]);setStatus(block,'Ошибка AI: '+(e.message||e),true);}finally{vm.importBusy=false;}}
function getVM(){return window.__managerVue||null;}
document.addEventListener('click',function(e){const t=e.target&&e.target.closest&&e.target.closest('#qr-menu-import-pdf-v2,#qr-menu-import-photo-v2,#qr-menu-import-site-v2');if(!t)return;const block=blockFor(t),vm=getVM();if(!block||!vm)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(vm.importBusy)return;if(t.id==='qr-menu-import-site-v2'){const u=prompt('Адрес сайта заведения:','https://');if(u&&u!=='https://')handle(block,vm,'сайт',{url:u});return;}const input=t.id==='qr-menu-import-pdf-v2'?block.querySelector('#qr-menu-import-pdf-input-v2'):block.querySelector('#qr-menu-import-photo-input-v2');if(input)input.click();},true);
document.addEventListener('change',function(e){const input=e.target;if(!input||!input.closest||!input.closest('#qr-menu-import-block-v2'))return;const block=blockFor(input),vm=getVM();if(!block||!vm)return;e.stopPropagation();e.stopImmediatePropagation();if(input.id==='qr-menu-import-pdf-input-v2'){const f=input.files&&input.files[0];input.value='';if(f)handle(block,vm,'PDF',{filename:f.name,data:null},{/*unused*/});}else if(input.id==='qr-menu-import-photo-input-v2'){const fs=Array.prototype.slice.call(input.files||[]);input.value='';if(fs.length)handle(block,vm,'фото',null,fs);}},true);
const observer=new MutationObserver(()=>{const b=document.querySelector('#qr-menu-import-block-v2');if(b&&!b.dataset.qrAiReady)b.dataset.qrAiReady='1';});observer.observe(document.documentElement,{childList:true,subtree:true});
})();`;
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'GET' && String(req.query && req.query.client || '') === '1') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).send(browserClient());
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Используйте POST' } });
  try {
    const body = await readRequestBody(req);
    const kind = String(body.kind || '').toLowerCase();
    let contents;
    if (kind === 'image') {
      const data = String(body.data || '');
      if (!/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,/i.test(data)) return res.status(400).json({ ok:false, error:{ code:'IMAGE_REQUIRED', message:'Ожидается изображение в data URL' } });
      contents = [{ type:'input_text', text:buildPrompt('фото меню', `Имя файла: ${clean(body.filename, 200)}`) }, { type:'input_image', image_url:data, detail:'high' }];
    } else if (kind === 'pdf') {
      const data = String(body.data || '');
      if (!/^data:application\/pdf;base64,/i.test(data)) return res.status(400).json({ ok:false, error:{ code:'PDF_REQUIRED', message:'Ожидается PDF в data URL' } });
      contents = [{ type:'input_text', text:buildPrompt('PDF меню', `Имя файла: ${clean(body.filename, 200)}`) }, { type:'input_file', filename:clean(body.filename, 200) || 'menu.pdf', file_data:data }];
    } else if (kind === 'site') {
      const url = clean(body.url, 2000);
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ ok:false, error:{ code:'URL_REQUIRED', message:'Передайте URL сайта' } });
      const site = await fetchSiteText(url);
      contents = [{ type:'input_text', text:buildPrompt('сайт', `URL: ${site.url}\nTITLE: ${site.title}\nТЕКСТ СТРАНИЦЫ:\n${site.text}`) }];
    } else {
      return res.status(400).json({ ok:false, error:{ code:'KIND_REQUIRED', message:'Неизвестный тип импорта' } });
    }
    const parsed = await callOpenAI(contents);
    const products = (Array.isArray(parsed.products) ? parsed.products : []).map(normalizeProduct).filter(p => p.name);
    return res.status(200).json({ ok:true, venue:{ name:clean(parsed.venue_name,220), description:clean(parsed.venue_description,600) }, products, meta:{ provider:'openai', model:MODEL, kind, products_found:products.length } });
  } catch (error) {
    const code = String(error && error.message || 'IMPORT_AI_ERROR');
    const status = Number(error && error.status) || (code === 'REQUEST_TOO_LARGE' ? 413 : code === 'OPENAI_API_KEY_NOT_CONFIGURED' ? 503 : 500);
    return res.status(status).json({ ok:false, error:{ code, message: code === 'OPENAI_API_KEY_NOT_CONFIGURED' ? 'Не настроен OPENAI_API_KEY на сервере.' : code === 'REQUEST_TOO_LARGE' ? 'Файл слишком большой для AI-импорта.' : clean(error && error.message || 'Ошибка AI-импорта',500) } });
  }
};
