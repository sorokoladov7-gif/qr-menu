/* QR-Menu — QRChick AI for Recipes. Separate recipe-only assistant. */
(function () {
  'use strict';
  if (window.__QR_RECEPT_AI__) return;
  window.__QR_RECEPT_AI__ = true;

  var lastProductId = null, busy = false;
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(v) { return String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim(); }
  function unitLabel(u) { return {g:'г',kg:'кг',ml:'мл',l:'л',pcs:'шт'}[u] || u || ''; }
  function st() { return window.__QR_MANAGER_RECIPES_STATE__ || {}; }
  function product() { var s=st(); return (s.products||[]).find(function(p){return p.id===s.selected;}) || null; }
  function matchIngredient(name) {
    var s=st(), t=norm(name); if(!t) return null;
    var exact=(s.ingredients||[]).find(function(i){return norm(i.name)===t;});
    if(exact)return exact;
    var best=null, score=0, tokens=t.split(' ').filter(Boolean);
    (s.ingredients||[]).forEach(function(i){ var n=norm(i.name), sc=0;
      if(n.indexOf(t)>=0 || t.indexOf(n)>=0) sc=.75;
      tokens.forEach(function(x){if(n.split(' ').indexOf(x)>=0) sc+=.25;});
      if(sc>score){score=sc;best=i;}
    });
    return score>=.75?best:null;
  }
  function ensurePanel() {
    if($('qrReceptAiPanel')) return;
    var host=$('recipe'); if(!host||!host.parentElement)return;
    var panel=document.createElement('div'); panel.id='qrReceptAiPanel'; panel.className='glass card';
    panel.style.cssText='margin-top:12px;padding:14px;border:1px solid rgba(99,102,241,.22);background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(52,211,153,.04))';
    panel.innerHTML='<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div style="display:flex;gap:10px;align-items:center"><img src="/assets/img/qrchick-avatar.svg" alt="Qrchick" width="42" height="42" style="width:42px;height:42px;flex:0 0 42px;border-radius:50%;display:block;object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.18)"><div><b>Qrchick · Рецептура</b><div id="qrReceptAiStatus" class="muted" style="margin-top:3px">Готов к автоматическому анализу.</div></div></div><button type="button" class="btn btn-primary btn-sm" id="qrReceptAiRun">↻ Повторить анализ</button></div><div id="qrReceptAiBody" style="margin-top:10px"></div>';
    host.parentElement.appendChild(panel);
    $('qrReceptAiRun').onclick=function(){runAnalysis(false);};
  }
  function status(text,error){var e=$('qrReceptAiStatus');if(!e)return;e.textContent=text;e.style.color=error?'#fca5a5':'';}
  function renderResult(result){
    var body=$('qrReceptAiBody');if(!body)return;var rows=Array.isArray(result&&result.ingredients)?result.ingredients:[];
    if(!rows.length){body.innerHTML='<div class="muted">Qrchick не смог сформировать состав. Проверьте название блюда и ингредиенты.</div>';return;}
    body.innerHTML='<div style="display:grid;gap:7px">'+rows.map(function(r){var m=matchIngredient(r.name);var name=m?m.name:r.name;var unit=m?unitLabel(m.unit):unitLabel(r.unit||'g');return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px"><span style="flex:1"><b>'+esc(name)+'</b>'+(!m?' <span style="color:#fbbf24">· нет в базе</span>':'')+'</span><span>'+esc(r.quantity)+' '+esc(unit)+'</span><span class="muted" style="font-size:11px">'+esc(r.note||'')+'</span></div>';}).join('')+'</div><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap"><span class="muted" style="font-size:11px">Проверьте состав перед сохранением.</span><button type="button" class="btn btn-primary btn-sm" id="qrReceptAiApply">Применить к рецептуре</button></div>';
    $('qrReceptAiApply').onclick=function(){applyResult(rows);};
  }
  function applyResult(rows){
    var s=st(), mapped=[], missing=[]; if(!s.selected)return;
    rows.forEach(function(r){var m=matchIngredient(r.name);if(!m){missing.push(r.name);return;}mapped.push({ingredient_id:m.id,quantity:Number(r.quantity)||0,note:r.note||'QRChick'});});
    if(!mapped.length){status('Не удалось сопоставить ингредиенты с базой.',true);return;}
    s.rows=mapped;
    var save=document.getElementById('save');
    if(save){save.hidden=false;}
    renderIntoRecipe();
    status(missing.length?'Состав подготовлен. Не найдены: '+missing.join(', '):'Состав подготовлен. Проверьте его и сохраните.',false);
  }
  function renderIntoRecipe(){
    var s=st(), box=$('recipe');if(!box||!s.selected)return;
    box.innerHTML=(s.rows||[]).map(function(row,i){var ing=(s.ingredients||[]).find(function(x){return x.id===row.ingredient_id;});return '<div class="recipe-row"><select data-qrai-ri="'+i+'">'+(s.ingredients||[]).map(function(x){return '<option value="'+esc(x.id)+'" '+(x.id===row.ingredient_id?'selected':'')+'>'+esc(x.name)+' ('+esc(unitLabel(x.unit))+')</option>';}).join('')+'</select><input data-qrai-rq="'+i+'" type="number" min=".001" step=".001" value="'+esc(row.quantity)+'"><span class="muted">'+esc(unitLabel(ing?ing.unit:'g'))+'</span><input data-qrai-rn="'+i+'" placeholder="Примечание" value="'+esc(row.note||'')+'"><button type="button" class="btn btn-danger" data-qrai-rd="'+i+'">×</button></div>';}).join('')+'<button type="button" class="btn btn-ghost" id="addRow">+ Ингредиент</button>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-qrai-ri]'),function(e){e.onchange=function(){s.rows[+e.dataset.qraiRi].ingredient_id=e.value;renderIntoRecipe();};});
    Array.prototype.forEach.call(box.querySelectorAll('[data-qrai-rq]'),function(e){e.oninput=function(){s.rows[+e.dataset.qraiRq].quantity=Number(e.value)||0;};});
    Array.prototype.forEach.call(box.querySelectorAll('[data-qrai-rn]'),function(e){e.oninput=function(){s.rows[+e.dataset.qraiRn].note=e.value;};});
    Array.prototype.forEach.call(box.querySelectorAll('[data-qrai-rd]'),function(e){e.onclick=function(){s.rows.splice(+e.dataset.qraiRd,1);renderIntoRecipe();};});
  }
  function getSessionToken(){
    if(!window.db||!window.db.auth||!window.db.auth.getSession)return Promise.reject(new Error('Сессия Supabase недоступна'));
    return window.db.auth.getSession().then(function(r){var session=r&&r.data&&r.data.session;if(!session||!session.access_token)throw new Error('Сессия управляющего не найдена');return session.access_token;});
  }
  function runAnalysis(auto){
    var s=st(),p=product();
    if(!p||!s.venueId){status('Сначала выберите блюдо и заведение.',true);return;}
    if(busy)return;
    busy=true;
    var btn=$('qrReceptAiRun');if(btn)btn.disabled=true;
    status(auto?'Qrchick автоматически анализирует выбранное блюдо…':'Qrchick анализирует блюдо и подбирает ингредиенты…',false);
    getSessionToken().then(function(token){
      return fetch('/api/manager-ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({feature:'recipes',message:'Автоматически подбери рецептуру для выбранного блюда. Сформируй action save_recipe с реальными ingredient_id из переданного списка; используй product_id выбранного блюда. Не выполняй сохранение сам.',context:JSON.stringify({product:p,venue_id:s.venueId,ingredients:(s.ingredients||[]).map(function(i){return{id:i.id,name:i.name,unit:i.unit,purchase_quantity:i.purchase_quantity||null,purchase_price:i.purchase_price||null};}),global_ingredients:(s.globalIngredients||[]).slice(0,300).map(function(i){return{id:i.id||null,name:i.name,unit:i.unit,category:i.category||'',aliases:i.aliases||''};}),current_rows:s.rows||[]})})});
    }).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Qrchick API error');return d;});})
      .then(function(d){
        var action=(d.actions||[]).find(function(a){return a&&a.type==='save_recipe';});
        var rows=action&&action.payload&&(action.payload.rows||action.payload.ingredients);
        if(!Array.isArray(rows))throw new Error('Qrchick не вернул состав рецептуры');
        rows=rows.map(function(x){var id=x.ingredient_id||x.id||'';var byId=(s.ingredients||[]).find(function(i){return String(i.id)===String(id);});return{name:x.name||x.ingredient_name||(byId&&byId.name)||'',quantity:Number(x.quantity)||0,unit:x.unit||(byId&&byId.unit)||'g',note:x.note||'Qrchick',ingredient_id:byId?byId.id:id};});
        renderResult({ingredients:rows});
        status('Qrchick сформировал рецептуру. Проверьте состав и нажмите «Применить».',false);
      })
      .catch(function(e){console.error('[Qrchick Recipes]',e);status('Qrchick недоступен: '+(e.message||e),true);})
      .finally(function(){busy=false;if(btn)btn.disabled=false;});
  }
  function watch(){var s=st();if(!s.selected||s.selected===lastProductId)return;lastProductId=s.selected;ensurePanel();var b=$('qrReceptAiBody');if(b)b.innerHTML='<div class="muted">Выбрано блюдо: <b>'+esc((product()||{}).name||'')+'</b>. Запускаю Qrchick автоматически…</div>';runAnalysis(true);}
  function init(){ensurePanel();setInterval(function(){ensurePanel();watch();},500);window.addEventListener('manager-venue-selected',function(){lastProductId=null;});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();