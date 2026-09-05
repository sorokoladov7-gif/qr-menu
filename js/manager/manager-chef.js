/* QR Menu — AI Chef inside Recipes. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CHEF__)return;
  window.__QR_MANAGER_CHEF__=true;

  var state=window.__QR_MANAGER_RECIPES_STATE__;
  if(!state){
    window.addEventListener('qr-manager-recipes-ready',boot,{once:true});
    setTimeout(boot,1200);
  }else boot();

  var rootId='qr-manager-chef';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function $(id){return document.getElementById(id);}
  function vue(){return window.__managerVue||window.__QR_MANAGER_VUE_VM__||null;}
  function allowed(){var v=vue();try{return !!(v&&typeof v.hasAIFeature==='function'&&v.hasAIFeature('chef'));}catch(e){return false;}}
  function token(){return window.db.auth.getSession().then(function(r){var t=r&&r.data&&r.data.session&&r.data.session.access_token;if(!t)throw new Error('Сессия управляющего не найдена');return t;});}
  function post(url,body){return token().then(function(t){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(body)});}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok||!d.ok)throw new Error(d.error||('HTTP_'+r.status));return d;});});}
  function context(){
    state=window.__QR_MANAGER_RECIPES_STATE__||state||{};
    var product=(state.products||[]).find(function(p){return String(p.id)===String(state.selected);})||null;
    var ingredients=(state.ingredients||[]).map(function(i){return {id:i.id,name:i.name,unit:i.unit,purchase_quantity:i.purchase_quantity,purchase_price:i.purchase_price};});
    var rows=(state.rows||[]).map(function(r){return {ingredient_id:r.ingredient_id,quantity:Number(r.quantity)||0,note:r.note||''};});
    var cards=(state.techCards||[]).filter(function(c){return !product||String(c.product_id)===String(product.id);}).slice(0,5).map(function(c){return {id:c.id,product_id:c.product_id,file_name:c.file_name,status:c.status,ocr_text:String(c.ocr_text||'').slice(0,2500)};});
    return JSON.stringify({venue:{id:state.venueId||null},recipes:{products:product?[product]:[],ingredients:ingredients,selected_product:product,selected_rows:rows,tech_cards:cards}}).slice(0,12000);
  }
  function ensureBox(){
    var target=document.querySelector('.recipe-tab-container')||document.getElementById('recipe');
    if(!target)return null;
    var box=$(rootId);
    if(!box){
      box=document.createElement('section');box.id=rootId;box.className='card';
      box.innerHTML='<div class="chef-head"><div><div class="chef-kicker">ИИ-ШЕФ</div><h3 style="margin:2px 0 4px">AI-шеф для выбранного блюда</h3><div id="chefStatus" class="muted">Выберите блюдо, чтобы получить экономический и технологический разбор.</div></div><span id="chefLock" class="muted"></span></div><div id="chefMetrics" class="chef-metrics"></div><div class="chef-actions"><button type="button" class="btn" data-chef-task="check">Проверить блюдо</button><button type="button" class="btn btn-ghost" data-chef-task="optimize">Оптимизировать рецептуру</button><button type="button" class="btn btn-ghost" data-chef-task="price">Проверить цену</button></div><div id="chefAnswer" class="chef-answer"></div><div id="chefProposals" class="chef-proposals"></div>';
      target.insertBefore(box,target.firstChild);
      bind();
    }
    return box;
  }
  function bind(){
    var box=$(rootId);if(!box)return;
    Array.prototype.forEach.call(box.querySelectorAll('[data-chef-task]'),function(b){b.onclick=function(){run(b.dataset.chefTask);};});
  }
  function calc(){
    var s=window.__QR_MANAGER_RECIPES_STATE__||state||{},map={};(s.ingredients||[]).forEach(function(i){map[String(i.id)]=i;});var cost=0,valid=true;
    (s.rows||[]).forEach(function(r){var i=map[String(r.ingredient_id)],q=Number(r.quantity),pq=Number(i&&i.purchase_quantity),pp=Number(i&&i.purchase_price);if(!i||!(q>0)||!(pq>0)||!Number.isFinite(pp)){valid=false;return;}var u=String(i.unit||'').toLowerCase(),f={kg:1000,g:1,l:1000,ml:1,pcs:1,шт:1,кг:1000,г:1,л:1000,мл:1}[u];if(!f){valid=false;return;}cost+=pp/(pq*f)*q;});
    var p=(s.products||[]).find(function(x){return String(x.id)===String(s.selected);})||null,price=Number(p&&p.price),margin=valid&&price>0?(price-cost)/price*100:null;return {valid:valid&&!!(s.rows||[]).length,cost:valid&&s.rows&&s.rows.length?cost:null,price:Number.isFinite(price)?price:null,margin:margin};
  }
  function renderMetrics(){var m=calc(),box=$('chefMetrics');if(!box)return;if(!m.valid){box.innerHTML='<div class="muted">Недостаточно данных для достоверного расчёта себестоимости. ИИ не будет придумывать недостающие цены или нормы.</div>';return;}box.innerHTML='<div class="chef-metric"><b>'+m.cost.toFixed(2)+' ₽</b><span>Себестоимость</span></div><div class="chef-metric"><b>'+((m.price||0).toFixed(2))+' ₽</b><span>Цена</span></div><div class="chef-metric"><b>'+(m.margin==null?'—':m.margin.toFixed(1)+'%')+'</b><span>Маржа</span></div>';}
  function promptFor(task){return {check:'Проведи полный аудит выбранного блюда: проверь состав рецептуры, нормы, себестоимость, маржу и очевидные технологические риски. Дай конкретные рекомендации.',optimize:'Проанализируй выбранную рецептуру и предложи безопасную оптимизацию себестоимости и технологии. Не придумывай отсутствующие цены, нормы или ингредиенты.',price:'Проверь текущую цену выбранного блюда относительно подтверждённой себестоимости. Если данных достаточно, предложи обоснованную цену; изменение не более 10%.'}[task];}
  function run(task){
    var box=ensureBox(),answer=$('chefAnswer'),proposals=$('chefProposals');if(!box||!answer)return;
    if(!allowed()){answer.innerHTML='<div class="msg err">Функция «ИИ-шеф» не подключена к текущему тарифу. Администратор должен включить её в конструкторе тарифа.</div>';return;}
    if(!state||!state.selected){answer.innerHTML='<div class="msg err">Сначала выберите блюдо.</div>';return;}
    renderMetrics();answer.innerHTML='<div class="muted">ИИ-шеф анализирует выбранное блюдо…</div>';if(proposals)proposals.innerHTML='';
    post('/api/manager-ai',{feature:'chef',message:promptFor(task),context:context()}).then(function(d){answer.innerHTML='<div class="chef-result"><b>Результат</b><div style="margin-top:6px;white-space:pre-wrap">'+esc(d.answer||'Анализ завершён.')+'</div></div>';return post('/api/manager-ai-propose',{feature:'chef',message:promptFor(task),context:context()}).then(function(p){renderProposals(p);});}).catch(function(e){answer.innerHTML='<div class="msg err">Ошибка ИИ-шефа: '+esc(e.message||e)+'</div>';});
  }
  function renderProposals(d){var box=$('chefProposals');if(!box)return;var actions=Array.isArray(d.actions)?d.actions:[];if(!actions.length){box.innerHTML='<div class="muted" style="margin-top:10px">Безопасных изменений для автоматического применения не предложено. Рекомендации можно выполнить вручную.</div>';return;}box.innerHTML='<h4 style="margin:14px 0 8px">Безопасные изменения</h4>'+actions.map(function(a,i){var p=a.payload||{};var detail=a.type==='save_recipe'?('Сохранить '+(Array.isArray(p.rows)?p.rows.length:0)+' строк рецептуры'):a.type==='update_product_price'?('Новая цена: '+Number(p.price||0).toFixed(2)+' ₽'):a.type==='update_product'?('Изменить данные выбранного товара'):'';return '<div class="chef-proposal" data-proposal="'+i+'"><b>'+esc(a.title||'Предложенное изменение')+'</b><div class="muted" style="margin:4px 0">'+esc(a.reason||'')+'</div><div>'+esc(detail)+'</div><button type="button" class="btn" data-apply-chef="'+i+'" style="margin-top:8px">Применить</button><button type="button" class="btn btn-ghost" data-reject-chef="'+i+'" style="margin:8px 0 0 6px">Отклонить</button></div>';}).join('');
    box.__actions=actions;Array.prototype.forEach.call(box.querySelectorAll('[data-apply-chef]'),function(b){b.onclick=function(){apply(actions[+b.dataset.applyChef],b);};});Array.prototype.forEach.call(box.querySelectorAll('[data-reject-chef]'),function(b){b.onclick=function(){b.closest('.chef-proposal').remove();};});
  }
  function apply(action,button){if(!action)return;if(!confirm('Применить предложенное изменение ИИ-шефа? Изменение будет дополнительно проверено сервером.'))return;button.disabled=true;post('/api/manager-ai-action',{feature:'chef',action:action}).then(function(d){button.textContent='Применено';message(d.message||'Изменение применено.');if(window.__managerVue&&typeof window.__managerVue.loadProducts==='function')window.__managerVue.loadProducts();var s=window.__QR_MANAGER_RECIPES_STATE__||state;if(s&&s.selected&&typeof window.__QR_MANAGER_RECIPES_RELOAD__==='function')window.__QR_MANAGER_RECIPES_RELOAD__(s.selected);}).catch(function(e){button.disabled=false;message('Не применено: '+(e.message||e),true);});}
  function message(t,err){var s=$(rootId);if(!s)return;var old=$('msg');if(old&&old.id==='msg'){}var x=s.querySelector('.chef-local-msg');if(!x){x=document.createElement('div');x.className='chef-local-msg';s.appendChild(x);}x.className='chef-local-msg '+(err?'err':'ok');x.textContent=t;}
  function styles(){if($('qrChefStyle'))return;var s=document.createElement('style');s.id='qrChefStyle';s.textContent='#'+rootId+'{margin-bottom:14px;padding:16px}.chef-head{display:flex;justify-content:space-between;gap:16px}.chef-kicker{font-size:10px;letter-spacing:.12em;opacity:.65}.chef-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.chef-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.chef-metric{padding:10px;border:1px solid rgba(127,127,127,.18);border-radius:10px}.chef-metric b,.chef-metric span{display:block}.chef-metric span{font-size:11px;opacity:.65;margin-top:3px}.chef-proposal{padding:12px;margin-top:8px;border:1px solid rgba(127,127,127,.18);border-radius:10px}.chef-local-msg{margin-top:10px}.chef-local-msg.err{color:#b42318}.chef-local-msg.ok{color:#147a42}@media(max-width:700px){.chef-metrics{grid-template-columns:1fr}.chef-head{display:block}}';document.head.appendChild(s);}
  function boot(){if(window.__QR_MANAGER_CHEF_BOOTED__)return;window.__QR_MANAGER_CHEF_BOOTED__=true;styles();var tries=0;function tick(){var b=ensureBox();if(b)return;if(++tries<40)setTimeout(tick,500);}tick();var obs=new MutationObserver(function(){ensureBox();renderMetrics();});obs.observe(document.body,{childList:true,subtree:true});}
  boot();
})();