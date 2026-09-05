/* QR-Menu — AI usage analytics for admin cabinet */
(function(){
  'use strict';
  if(window.__QR_ADMIN_AI_USAGE__) return;
  window.__QR_ADMIN_AI_USAGE__=true;

  var state={days:30,data:null,busy:false,error:'',active:false};
  var FEATURES={assistant:'Ассистент',menu_analysis:'Анализ меню',menu_import:'Импорт меню',analytics:'Аналитика',recipes:'Рецепты',chef:'AI Chef',staff:'Персонал',marketing:'Маркетинг',settings:'Настройки',engineer:'ИИ-инженер'};
  var panel=null,button=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU');}
  function pct(a,b){return b?Math.round(Number(a||0)*1000/Number(b))/10:0;}
  function showToast(text,error){var el=document.createElement('div');el.textContent=text;el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;padding:12px 16px;border-radius:12px;background:'+(error?'#7f1d1d':'#064e3b')+';color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.3);font-size:13px;max-width:420px;';document.body.appendChild(el);setTimeout(function(){el.remove();},3500);}

  function style(){
    if(document.getElementById('qr-admin-ai-usage-style'))return;
    var s=document.createElement('style');s.id='qr-admin-ai-usage-style';s.textContent=''
      +'.qr-admin-ai-usage-panel{display:none;margin-top:0}.qr-admin-ai-usage-panel.active{display:block;animation:qrAdminAIUsageIn .3s ease-out}'
      +'.qr-admin-ai-usage-panel .aiu-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}'
      +'.qr-admin-ai-usage-panel .aiu-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}'
      +'.qr-admin-ai-usage-panel .aiu-period button.on{border-color:rgba(99,102,241,.7);background:rgba(99,102,241,.18);box-shadow:0 5px 16px rgba(99,102,241,.18)}'
      +'.qr-admin-ai-usage-panel .aiu-kpis{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-bottom:14px}'
      +'.qr-admin-ai-usage-panel .aiu-kpi{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}'
      +'.qr-admin-ai-usage-panel .aiu-kpi .n{font-size:25px;font-weight:800;line-height:1.1}.qr-admin-ai-usage-panel .aiu-kpi .l{font-size:11px;color:#94a3b8;margin-top:6px}'
      +'.qr-admin-ai-usage-panel .aiu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}'
      +'.qr-admin-ai-usage-panel .aiu-card{padding:16px}.qr-admin-ai-usage-panel .aiu-row{display:flex;align-items:center;gap:9px;margin:9px 0}.qr-admin-ai-usage-panel .aiu-row .label{width:150px;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}'
      +'.qr-admin-ai-usage-panel .aiu-bar{height:7px;flex:1;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}.qr-admin-ai-usage-panel .aiu-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#6366f1,#a78bfa)}'
      +'.qr-admin-ai-usage-panel .aiu-table{width:100%;border-collapse:collapse;font-size:12px}.qr-admin-ai-usage-panel .aiu-table th,.qr-admin-ai-usage-panel .aiu-table td{padding:8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;vertical-align:top}.qr-admin-ai-usage-panel .aiu-table th{color:#94a3b8;font-weight:600}.qr-admin-ai-usage-panel .aiu-scroll{overflow:auto;max-height:520px}'
      +'@keyframes qrAdminAIUsageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
      +'@media(max-width:900px){.qr-admin-ai-usage-panel .aiu-kpis{grid-template-columns:repeat(2,minmax(130px,1fr))}.qr-admin-ai-usage-panel .aiu-grid{grid-template-columns:1fr}.qr-admin-ai-usage-panel .aiu-row .label{width:105px}}'
      +'@media(max-width:520px){.qr-admin-ai-usage-panel .aiu-kpis{grid-template-columns:1fr 1fr}.qr-admin-ai-usage-panel .aiu-kpi .n{font-size:20px}}';document.head.appendChild(s);
  }

  function sessionToken(){return db.auth.getSession().then(function(r){return r?.data?.session?.access_token||'';});}
  function load(){
    if(state.busy)return;state.busy=true;state.error='';render();
    sessionToken().then(function(token){if(!token)throw new Error('Сессия администратора не найдена');return fetch('/api/admin-ai-usage?days='+state.days,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d?.error||'Ошибка загрузки статистики');return d;});}).then(function(d){state.data=d;}).catch(function(e){state.error=e?.message||'Ошибка загрузки';showToast(state.error,true);}).finally(function(){state.busy=false;render();});
  }
  function cardKpi(n,l){return '<div class="aiu-kpi"><div class="n">'+fmt(n)+'</div><div class="l">'+esc(l)+'</div></div>';}
  function list(title,items,labelKey){items=items||[];var max=items.length?Math.max.apply(null,items.map(function(x){return Number(x.total_tokens)||0})):0;return '<div class="glass card aiu-card"><h4 style="margin:0 0 12px">'+esc(title)+'</h4>'+(items.length?items.slice(0,10).map(function(x){var label=x[labelKey]||x.name||'—';return '<div class="aiu-row"><div class="label" title="'+esc(label)+'">'+esc(FEATURES[label]||label)+'</div><div class="aiu-bar"><div class="aiu-fill" style="width:'+Math.max(2,pct(x.total_tokens,max))+'%"></div></div><b style="font-size:12px;white-space:nowrap">'+fmt(x.total_tokens)+'</b></div>';}).join(''):'<div class="muted">Нет данных за период</div>')+'</div>';}
  function tableRecent(rows){return '<div class="glass card aiu-card" style="grid-column:1/-1"><div class="spread" style="margin-bottom:10px"><h4 style="margin:0">🧾 Последние AI-запросы</h4><span class="muted" style="font-size:11px">до 100 записей</span></div><div class="aiu-scroll"><table class="aiu-table"><tr><th>Дата</th><th>Управляющий</th><th>Функция</th><th>Модель</th><th>Токены</th><th>Fallback</th><th>Время</th></tr>'+(rows||[]).map(function(r){return '<tr><td class="muted">'+esc(new Date(r.created_at).toLocaleString('ru-RU'))+'</td><td><b>'+esc(r.manager_name||r.manager_id)+'</b>'+(r.venue_name?'<div class="muted" style="font-size:10px">'+esc(r.venue_name)+'</div>':'')+'</td><td>'+esc(FEATURES[r.feature]||r.feature)+'</td><td>'+esc(r.model)+'</td><td><b>'+fmt(r.total_tokens)+'</b><div class="muted" style="font-size:10px">in '+fmt(r.prompt_tokens)+' · out '+fmt(r.output_tokens)+'</div></td><td>'+(r.fallback_used?'✓ '+fmt(r.fallback_attempts):'—')+'</td><td>'+fmt(r.request_ms)+' ms</td></tr>';}).join('')+'</table></div></div>';}
  function render(){if(!panel)return;var d=state.data||{};var s=d.summary||{requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,thoughts_tokens:0,fallback_requests:0,avg_tokens_per_request:0};var p=d.periods?.[state.days===1?'24h':state.days===7?'7d':'30d']||s;var title=state.days===1?'24 часа':state.days===7?'7 дней':state.days+' дней';panel.innerHTML='<div class="aiu-head"><div><h3 style="margin:0">🤖 Расход токенов ИИ</h3><div class="muted" style="font-size:12px;margin-top:4px">Реальное потребление Gemini ИИ-модулями управляющих</div></div><div class="aiu-actions"><div class="aiu-period"><button class="btn btn-sm '+(state.days===1?'on':'')+'" data-days="1">24ч</button><button class="btn btn-sm '+(state.days===7?'on':'')+'" data-days="7">7 дней</button><button class="btn btn-sm '+(state.days===30?'on':'')+'" data-days="30">30 дней</button><button class="btn btn-sm '+(state.days===90?'on':'')+'" data-days="90">90 дней</button></div><button class="btn btn-primary btn-sm" data-refresh>🔄 Обновить</button></div></div>'+(state.error?'<div class="msg error" style="margin-bottom:12px">'+esc(state.error)+'</div>':'')+(state.busy?'<div class="glass card" style="padding:18px;text-align:center;margin-bottom:12px">Загрузка статистики…</div>':'')+'<div class="aiu-kpis">'+cardKpi(p.requests,'Запросов за '+title)+cardKpi(p.total_tokens,'Всего токенов')+cardKpi(p.prompt_tokens,'Входные токены')+cardKpi(p.output_tokens,'Выходные токены')+cardKpi(p.thoughts_tokens,'Thinking tokens')+cardKpi(p.avg_tokens_per_request,'Среднее на запрос')+cardKpi(p.fallback_requests,'Переключений fallback')+cardKpi(p.cached_tokens,'Cached tokens')+'</div><div class="aiu-grid">'+list('👤 По управляющим',d.by_manager,'name')+list('🧠 По моделям',d.by_model,'model')+list('⚙️ По функциям ИИ',d.by_feature,'feature')+list('💳 По тарифам',d.by_plan,'name')+tableRecent(d.recent)+'</div>';
    panel.querySelectorAll('[data-days]').forEach(function(b){b.onclick=function(){state.days=Number(b.dataset.days)||30;load();};});var refresh=panel.querySelector('[data-refresh]');if(refresh)refresh.onclick=load;
  }
  function hideVueContent(){var wrap=document.querySelector('#app .wrap');if(!wrap)return;Array.from(wrap.children).forEach(function(el){if(el===panel||el.classList.contains('stats')||el.classList.contains('tabs'))return;if(el.classList.contains('qr-admin-ai-usage-panel'))return;el.dataset.qrAiUsageHidden=el.style.display;el.style.display='none';});}
  function restoreVueContent(){var wrap=document.querySelector('#app .wrap');if(!wrap)return;Array.from(wrap.children).forEach(function(el){if(el.dataset.qrAiUsageHidden!==undefined){el.style.display=el.dataset.qrAiUsageHidden;delete el.dataset.qrAiUsageHidden;}});}
  function open(){state.active=true;button.classList.add('on');hideVueContent();panel.classList.add('active');load();}
  function close(){state.active=false;button.classList.remove('on');panel.classList.remove('active');restoreVueContent();}
  function mount(){
    if(panel||!window.__QR_ADMIN_VUE_VM__)return false;style();var tabs=document.querySelector('#app .tabs');var wrap=document.querySelector('#app .wrap');if(!tabs||!wrap)return false;
    button=document.createElement('button');button.type='button';button.className='btn btn-ghost btn-sm';button.textContent='🤖 ИИ / Токены';button.title='Расход токенов ИИ управляющих';button.dataset.qrAiUsageTab='1';tabs.appendChild(button);
    panel=document.createElement('div');panel.className='qr-admin-ai-usage-panel';wrap.appendChild(panel);button.onclick=function(e){e.preventDefault();e.stopPropagation();if(state.active)close();else open();};
    document.addEventListener('click',function(e){if(!state.active)return;if(e.target.closest('[data-qr-ai-usage-tab]'))return;var oldTab=e.target.closest('#app .tabs button');if(oldTab&&oldTab!==button)close();},true);
    return true;
  }
  var tries=0;function boot(){if(mount())return;if(tries++<80)setTimeout(boot,100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
