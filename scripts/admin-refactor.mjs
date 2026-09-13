import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const src=path.join(root,'src/pages/admin/admin-shell.html');
if(!fs.existsSync(src)) throw new Error('Expected transitional admin-shell.html was not found');
const html=fs.readFileSync(src,'utf8');
const outDir=path.join(root,'src/pages/admin');
const modDir=path.join(outDir,'modules');
fs.mkdirSync(modDir,{recursive:true});

const style=(html.match(/<style>([\s\S]*?)<\/style>/i)||[])[1];
if(!style) throw new Error('admin-shell: style block not found');
fs.writeFileSync(path.join(root,'src/assets/css/admin/admin-motion.css'),style.trim()+'\n');

const body=(html.match(/<body>([\s\S]*?)<\/body>/i)||[])[1];
if(!body) throw new Error('admin-shell: body not found');
const clean=body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').trim();
const appStart=clean.indexOf('<div id="app" v-cloak>');
if(appStart<0) throw new Error('admin-shell: #app not found');
const beforeApp=clean.slice(0,appStart).trim();
const app=clean.slice(appStart);
const appEnd=app.lastIndexOf('</div>');
if(appEnd<0) throw new Error('admin-shell: app closing tag not found');
const appInner=app.slice('<div id="app" v-cloak>'.length,appEnd).trim();

const markers=[
 ['settings','<!-- Настройки админки -->'],['templates','<!-- Шаблоны заведений -->'],['stats','<!-- Статистика -->'],['subscriptions','<!-- Подписки -->'],['analytics','<!-- Аналитика -->'],['activity','<!-- Активность -->'],['venues','<!-- Заведения -->'],['menu','<!-- Меню заведения -->'],['managers','<!-- Управляющие -->'],['plans','<!-- Тарифы и оплаты -->'],['modals','<!-- Модалки -->']
];
const positions=markers.map(([name,marker])=>({name,marker,pos:appInner.indexOf(marker)}));
for(const p of positions) if(p.pos<0) throw new Error(`admin-shell: marker missing: ${p.name}`);
for(let i=1;i<positions.length;i++) if(positions[i].pos<=positions[i-1].pos) throw new Error(`admin-shell: marker order invalid at ${positions[i].name}`);

const prefix=appInner.slice(0,positions[0].pos).trim();
const modules={};
for(let i=0;i<positions.length;i++){
 const start=positions[i].pos;
 const end=i+1<positions.length?positions[i+1].pos:appInner.length;
 modules[positions[i].name]=appInner.slice(start,end).trim().replace(/^<!--[^>]+-->\s*/,'').trim();
}
const expanded='<!-- Расширенная аналитика -->';
const splitAt=modules.analytics.indexOf(expanded);
if(splitAt<0) throw new Error('admin-shell: expanded analytics marker missing');
modules['analytics-expanded']=modules.analytics.slice(splitAt+expanded.length).trim();
modules.analytics=modules.analytics.slice(0,splitAt).trim();

const moduleOrder=['settings','templates','stats','subscriptions','analytics','analytics-expanded','activity','venues','menu','managers','plans','modals'];
for(const name of moduleOrder) fs.writeFileSync(path.join(modDir,`${name}.html`),modules[name]+'\n');
const placeholders=moduleOrder.map(n=>`<!-- ADMIN_MODULE:${n} -->`).join('\n');
fs.writeFileSync(path.join(outDir,'admin-layout.html'),beforeApp+'\n<div id="app" v-cloak>\n'+prefix+'\n'+placeholders+'\n</div>\n');
fs.writeFileSync(path.join(outDir,'admin-module-manifest.json'),JSON.stringify(moduleOrder,null,2)+'\n');

fs.writeFileSync(path.join(outDir,'admin.html'),`<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>АДМИН OS QR-Меню</title>\n<link rel="manifest" href="/src/assets/pwa/manifest-admin.webmanifest">\n<link rel="icon" type="image/svg+xml" href="/src/assets/icons/favicon.svg">\n<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="/src/assets/css/style.css">\n<link rel="stylesheet" href="/src/assets/css/shared/common.css">\n<link rel="stylesheet" href="/src/assets/css/admin/admin.css">\n<link rel="stylesheet" href="/src/assets/css/admin/admin-motion.css">\n</head>\n<body>\n<div id="admin-bootstrap-loader" style="position:fixed;inset:0;display:grid;place-items:center;background:#0a0f1a;color:#94a3b8;font:600 14px system-ui,sans-serif;z-index:99999">Загрузка админ-панели…</div>\n<script type="module" src="/src/assets/js/admin/admin-bootstrap.js"></script>\n</body>\n</html>\n`);

fs.writeFileSync(path.join(root,'src/assets/js/admin/admin-bootstrap.js'),`const SCRIPT_MANIFEST='/src/assets/js/admin/admin-module-manifest.js';\nconst LAYOUT_URL='/src/pages/admin/admin-layout.html';\nconst TEMPLATE_MANIFEST='/src/pages/admin/admin-module-manifest.json';\nfunction loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Admin module load failed: '+src));document.head.appendChild(s);});}\nasync function fetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Admin asset load failed: '+r.status+' '+url);return r.text();}\nasync function assemble(){const [layout,manifestText]=await Promise.all([fetchText(LAYOUT_URL),fetchText(TEMPLATE_MANIFEST)]);const modules=JSON.parse(manifestText);if(!Array.isArray(modules)||!modules.length)throw new Error('Admin template manifest is empty');const html=await Promise.all(modules.map(n=>fetchText('/src/pages/admin/modules/'+n+'.html')));const doc=new DOMParser().parseFromString(layout,'text/html');let assembled=doc.body.innerHTML;modules.forEach((name,i)=>{const token='<!-- ADMIN_MODULE:'+name+' -->';if(!assembled.includes(token))throw new Error('Missing admin placeholder: '+name);assembled=assembled.replace(token,html[i]);});document.body.innerHTML=assembled;}\nasync function boot(){await assemble();await loadScript(SCRIPT_MANIFEST);const scripts=window.QR_ADMIN_MODULES;if(!Array.isArray(scripts)||!scripts.length)throw new Error('QR_ADMIN_MODULES is empty');for(const src of scripts)await loadScript(src);document.getElementById('admin-bootstrap-loader')?.remove();}\nboot().catch(err=>{console.error('[admin-bootstrap] fatal:',err);document.body.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#0a0f1a;color:#f87171;font:600 14px system-ui,sans-serif;padding:24px;text-align:center">Не удалось загрузить админ-панель.<br>Откройте консоль для диагностики.</div>';});\n`);
fs.unlinkSync(src);
console.log('Admin modularization complete');
