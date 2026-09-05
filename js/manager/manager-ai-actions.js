/* QR Menu — safe AI action confirmation layer. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_ACTIONS__)return;
  window.__QR_MANAGER_AI_ACTIONS__=true;
  var lastRequest=null,lastResponse=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  async function token(){if(!window.db||!db.auth)throw new Error('Supabase не подключен');var r=await db.auth.getSession(),t=r&&r.data&&r.data.session&&r.data.session.access_token;if(!t)throw new Error('Сессия управляющего не найдена');return t;}
  async function post(url,body){var t=await token();var r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(body)});var d=await r.json().catch(function(){return{};});if(!r.ok||!d.ok)throw new Error(d.error||('HTTP_'+r.status));return d;}
  function answerBox(){return document.getElementById('qr-ai-feature-answer');}
  function renderNotice(text,error){var box=answerBox();if(!box)return;var n=document.createElement('div');n.style.cssText='margin-top:9px;padding:9px;border-radius:9px;background:rgba(255,255,255,.035);font-size:11px;line-height:1.45;';n.textContent=text;if(error)n.style.border='1px solid rgba(248,113,113,.3)';box.appendChild(n);}
  function renderActions(actions,feature,message,context){
    var box=answerBox();if(!box||!Array.isArray(actions)||!actions.length)return;
    var wrap=document.createElement('div');wrap.setAttribute('data-ai-actions','1');wrap.style.cssText='margin-top:10px;border-top:1px solid rgba(148,163,184,.16);padding-top:10px;';
    wrap.innerHTML='<div style="font-weight:700;font-size:12px;margin-bottom:7px">Предлагаемые изменения</div><div data-action-list></div><div style="font-size:10px;color:#94a3b8;margin-top:7px">Ничего не изменяется автоматически. Каждое действие требует отдельного подтверждения.</div>';
    var list=wrap.querySelector('[data-action-list]');
    actions.forEach(function(action){
      var card=document.createElement('div');card.style.cssText='margin-top:7px;padding:9px;border:1px solid rgba(129,140,248,.25);border-radius:10px;background:rgba(99,102,241,.06);';
      card.innerHTML='<div style="font-weight:700;font-size:11px">'+esc(action.title||action.type)+'</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">'+esc(action.reason||'')+'</div><div style="display:flex;gap:6px;margin-top:8px"><button type="button" data-apply style="border:0;border-radius:8px;padding:7px 10px;background:#6366f1;color:#fff;cursor:pointer;font-size:11px;font-weight:700">Применить</button><button type="button" data-reject style="border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:7px 10px;background:transparent;color:#cbd5e1;cursor:pointer;font-size:11px">Отклонить</button></div><div data-status style="font-size:10px;margin-top:6px"></div>';
      card.querySelector('[data-reject]').onclick=function(){card.remove();};
      card.querySelector('[data-apply]').onclick=async function(){
        var btn=this,status=card.querySelector('[data-status]');btn.disabled=true;btn.textContent='Проверяю…';
        try{var r=await post('/api/manager-ai-action',{feature:feature,action:action});btn.textContent='Применено';btn.style.opacity='.55';status.textContent='Изменение подтверждено сервером.';if(r.result&&r.result.text){status.textContent='Черновик готов. '+r.result.text.slice(0,240);try{await navigator.clipboard.writeText(r.result.text);}catch(e){}}if(window.__managerVue&&typeof window.__managerVue.loadProducts==='function')window.__managerVue.loadProducts();if(window.__managerVue&&typeof window.__managerVue.loadDeliverySettings==='function')window.__managerVue.loadDeliverySettings();}
        catch(e){btn.disabled=false;btn.textContent='Применить';status.textContent='Ошибка: '+(e.message||String(e));status.style.color='#fca5a5';}
      };
      list.appendChild(card);
    });
    box.appendChild(wrap);
  }
  async function propose(reqBody){
    try{
      var d=await post('/api/manager-ai-propose',{feature:reqBody.feature,message:reqBody.message,context:reqBody.context||''});
      lastResponse=d;
      renderActions(d.actions,reqBody.feature,reqBody.message,reqBody.context||'');
      if(!d.actions||!d.actions.length)renderNotice('ИИ не предложил безопасных изменений для подтверждения. Результат оставлен как рекомендация.');
    }catch(e){renderNotice('Не удалось подготовить безопасное действие: '+(e.message||String(e)),true);}
  }
  function addButton(){
    var box=answerBox();if(!box||box.querySelector('[data-ai-action-propose]')||!lastRequest)return;
    var feature=String(lastRequest.feature||'');if(['menu_analysis','recipes','chef','marketing','settings'].indexOf(feature)<0)return;
    var b=document.createElement('button');b.type='button';b.setAttribute('data-ai-action-propose','1');b.style.cssText='margin-top:9px;border:1px solid rgba(129,140,248,.35);border-radius:9px;padding:8px 10px;background:rgba(99,102,241,.08);color:#c7d2fe;cursor:pointer;font-size:11px;font-weight:700;';b.textContent='Проверить, можно ли применить безопасное изменение';b.onclick=function(){b.disabled=true;b.textContent='Формирую предложение…';propose(lastRequest);};box.appendChild(b);
  }
  var originalFetch=window.fetch;
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    var isAI=String(url).indexOf('/api/manager-ai')!==-1&&!String(url).indexOf('/api/manager-ai-action')!==-1;
    var body=init&&init.body;
    if(isAI&&body){try{lastRequest=typeof body==='string'?JSON.parse(body):body;}catch(e){lastRequest=null;}}
    var p=originalFetch.apply(this,arguments);
    if(isAI)p.then(function(response){response.clone().json().then(function(data){if(data&&data.ok){lastResponse=data;setTimeout(addButton,80);}}).catch(function(){});}).catch(function(){});
    return p;
  };
})();
