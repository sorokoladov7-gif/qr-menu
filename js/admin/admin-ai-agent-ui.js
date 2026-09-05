/* QR MENU — Qrchick agent execution timeline adapter. Does not duplicate chat logic. */
(function(){
  'use strict';
  if(window.__QR_ADMIN_AI_AGENT_UI__)return;
  window.__QR_ADMIN_AI_AGENT_UI__=true;

  var labels={
    github_tree:'Сканирование проекта',
    github_search:'Поиск по коду',
    github_read_file:'Чтение файла',
    supabase_schema:'Проверка схемы Supabase',
    supabase_query:'Проверка данных Supabase',
    vercel_deployments:'Проверка Vercel',
    vercel_runtime:'Анализ runtime Vercel'
  };
  var icons={github_tree:'⌘',github_search:'⌕',github_read_file:'▤',supabase_schema:'◈',supabase_query:'◇',vercel_deployments:'▲',vercel_runtime:'◉'};
  var lastSignature='';

  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c})}
  function root(){return document.getElementById('qr-ai-result')||document.getElementById('qr-ai-chat')}
  function ensureStyle(){
    if(document.getElementById('qr-ai-agent-style'))return;
    var s=document.createElement('style');s.id='qr-ai-agent-style';s.textContent=''+
      '.qr-ai-agent-panel{max-width:820px;margin:0 auto 14px;border:1px solid #dfe8f0;background:linear-gradient(180deg,#fbfdff,#f6f9fc);border-radius:14px;overflow:hidden;box-shadow:0 5px 18px rgba(24,62,96,.05)}'+
      '.qr-ai-agent-head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid #e6edf3}'+
      '.qr-ai-agent-title{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:800;color:#244766}'+
      '.qr-ai-agent-live{width:7px;height:7px;border-radius:50%;background:#21c879;box-shadow:0 0 0 4px rgba(33,200,121,.1);animation:qrAgentPulse 1.3s infinite}'+
      '.qr-ai-agent-done{font-size:8px;color:#6d8398}'+
      '.qr-ai-agent-steps{padding:5px 13px 10px}'+
      '.qr-ai-agent-step{display:grid;grid-template-columns:25px 1fr auto;align-items:center;gap:8px;min-height:34px;border-bottom:1px solid #edf1f5}'+
      '.qr-ai-agent-step:last-child{border-bottom:0}'+
      '.qr-ai-agent-icon{width:23px;height:23px;border-radius:7px;display:grid;place-items:center;background:#edf6ff;color:#167ef0;font-size:11px;font-weight:800}'+
      '.qr-ai-agent-step b{display:block;font-size:9px;color:#365571}.qr-ai-agent-step small{display:block;margin-top:2px;font-size:7px;color:#94a4b3}'+
      '.qr-ai-agent-time{font-size:7px;color:#91a1af}'+
      '.qr-ai-agent-summary{padding:8px 13px 11px;border-top:1px solid #e6edf3;font-size:8px;color:#71879a}'+
      '@keyframes qrAgentPulse{50%{opacity:.35;transform:scale(.75)}}'+
      '@media(max-width:480px){.qr-ai-agent-step{grid-template-columns:23px 1fr}.qr-ai-agent-time{display:none}}';
    document.head.appendChild(s)
  }
  function panel(events,done){
    ensureStyle();var host=root();if(!host)return;
    var old=document.getElementById('qr-ai-agent-panel');if(old)old.remove();
    var p=document.createElement('section');p.id='qr-ai-agent-panel';p.className='qr-ai-agent-panel';
    var html='<div class="qr-ai-agent-head"><div class="qr-ai-agent-title"><i class="qr-ai-agent-live"></i>Qrchick · выполнение задачи</div><span class="qr-ai-agent-done">'+(done?'Завершено':'Выполняется…')+'</span></div><div class="qr-ai-agent-steps">';
    (events||[]).forEach(function(e){var name=e.name||e.tool||'agent_step';var label=labels[name]||name;var args=e.arguments||{};var detail='Инструмент выполнен';if(name==='github_read_file'&&args.path)detail=args.path;else if(name==='github_search'&&args.query)detail='Запрос: '+String(args.query).slice(0,100);else if(name==='supabase_query')detail='Read-only SQL';else if(name==='vercel_runtime'&&args.deployment_id)detail='Deployment '+String(args.deployment_id).slice(0,16);html+='<div class="qr-ai-agent-step"><span class="qr-ai-agent-icon">'+esc(icons[name]||'✓')+'</span><div><b>'+esc(label)+'</b><small>'+esc(detail)+'</small></div><span class="qr-ai-agent-time">'+(Number(e.duration_ms||0)?(Number(e.duration_ms)/1000).toFixed(1)+' c':'готово')+'</span></div>'});
    if(!events.length)html+='<div class="qr-ai-agent-step"><span class="qr-ai-agent-icon">✦</span><div><b>Анализ и рассуждение</b><small>Модель сформировала план без внешних инструментов</small></div><span class="qr-ai-agent-time">готово</span></div>';
    html+='</div><div class="qr-ai-agent-summary">'+(done?'Агент завершил исследование. Изменения не применяются без подтверждения администратора.':'Агент собирает данные проекта…')+'</div>';p.innerHTML=html;
    if(host===document.getElementById('qr-ai-result'))host.insertBefore(p,host.firstChild);else host.appendChild(p);
  }
  function handle(data){
    if(!data||!data.tool_calls)return;
    var events=Array.isArray(data.tool_calls)?data.tool_calls:[];
    var sig=JSON.stringify(events.map(function(e){return[e.name,e.arguments,e.duration_ms]}));
    if(sig===lastSignature&&!document.getElementById('qr-ai-agent-panel'))return;
    lastSignature=sig;panel(events,true);
  }
  var nativeFetch=window.fetch;
  if(typeof nativeFetch!=='function')return;
  window.fetch=function(){
    var args=arguments,url=String(args[0]&&args[0].url||args[0]||'');
    var p=nativeFetch.apply(this,args);
    if(url.indexOf('/api/admin-ai-audit')===-1)return p;
    p.then(function(response){
      try{response.clone().json().then(handle).catch(function(){});}catch(_){ }
      return response;
    }).catch(function(){});
    return p;
  };
})();
