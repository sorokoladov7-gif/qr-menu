/* QR-Menu — менеджеры (админ) */
(function(){
  'use strict';
  if(window.__QR_ADMIN_MANAGERS__) return;
  window.__QR_ADMIN_MANAGERS__=true;

  var managersMixin={
    data:function(){return{
      managers:[],links:[],managerPeriods:{},
      addMgrModal:{show:false,name:'',email:'',password:'',role:'manager',err:''},
      mgrEditModal:{show:false,id:null,name:'',role:'manager',allow_manage_delivery:false,allow_manage_design:false}
    }},
    computed:{
      managerVenuesMap:function(){
        var map={},self=this;
        (this.managers||[]).forEach(function(m){
          var ids=(self.links||[]).filter(function(l){return l.manager_id===m.id}).map(function(l){return l.venue_id});
          map[m.id]=ids.map(function(id){return (self.venues||[]).find(function(v){return v.id===id})}).filter(Boolean);
        });
        return map;
      }
    },
    methods:{
      addManager:function(){
        var self=this;self.busy=true;self.addMgrModal.err='';
        var temp=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,storageKey:'admin-temp',autoRefreshToken:false,detectSessionInUrl:false}});
        temp.auth.signUp({email:self.addMgrModal.email,password:self.addMgrModal.password,options:{data:{display_name:self.addMgrModal.name,role:self.addMgrModal.role}}}).then(function(r){
          self.busy=false;
          if(r.error){self.addMgrModal.err='Ошибка: '+r.error.message;return;}
          alert('Аккаунт создан! Передайте данные менеджеру.');self.addMgrModal.show=false;
          self.addMgrModal={show:false,name:'',email:'',password:'',role:'manager',err:''};self.loadBaseData();
        });
      },
      openMgrEdit:function(m){this.mgrEditModal={show:true,id:m.id,name:m.display_name,role:m.role,allow_manage_delivery:!!m.allow_manage_delivery,allow_manage_design:!!m.allow_manage_design}},
      saveMgrEdit:function(){
        var self=this;
        db.from('profiles').update({display_name:self.mgrEditModal.name,role:self.mgrEditModal.role,allow_manage_delivery:self.mgrEditModal.allow_manage_delivery,allow_manage_design:self.mgrEditModal.allow_manage_design}).eq('id',self.mgrEditModal.id).then(function(r){
          if(r.error){self.msg='Ошибка: '+r.error.message;return}self.mgrEditModal.show=false;self.loadBaseData();
        });
      },
      toggleMgrVenue:function(mid,vid,on){var self=this,p=on?db.from('manager_venues').insert({manager_id:mid,venue_id:vid}):db.from('manager_venues').delete().eq('manager_id',mid).eq('venue_id',vid);p.then(function(){self.loadBaseData()})},
      delManager:function(m){var self=this;if(!confirm('Удалить управляющего '+m.display_name+'?'))return;db.rpc('admin_delete_manager',{p_manager_id:m.id}).then(function(r){if(r.error){self.msg='Ошибка удаления: '+(r.error.message||r.error);return}self.loadBaseData()})},
      isAssigned:function(m,v){return this.links.some(function(l){return l.manager_id===m&&l.venue_id===v})}
    }
  };
  window.__QR_ADMIN_MANAGERS_MIXIN__=managersMixin;

  var STYLE_ID='qr-admin-manager-directory-style',MODAL_ID='qr-admin-manager-details';
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;')}
  function date(v){if(!v)return '—';var d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function money(v){return Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:0})}
  function app(){return window.__QR_ADMIN_VUE_APP__}
  function proxy(){var a=app();return a&&a._instance?a._instance.proxy:null}

  function renameManagerLabels(){
    var nodes=document.querySelectorAll('.tabs button,#qr-admin-shell .qr-nav button');
    for(var i=0;i<nodes.length;i++){
      var b=nodes[i],t=b.textContent||'';
      if(t.indexOf('Управляющие')>=0){
        b.innerHTML=b.innerHTML.replace(/Управляющие/g,'Менеджеры');
      }
    }
    var hs=document.querySelectorAll('h3,h4,b,span');
    for(var j=0;j<hs.length;j++){
      if((hs[j].textContent||'').trim()==='Управляющие' && !hs[j].closest('.tbl')) hs[j].textContent='Менеджеры';
    }
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=
      '.qr-manager-directory{margin:0 0 14px}.qr-manager-directory-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.qr-manager-card{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);cursor:pointer;transition:.2s}.qr-manager-card:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.07)}.qr-manager-avatar{width:44px;height:44px;min-width:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-weight:800;color:#fff}.qr-manager-card-name{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qr-manager-card-meta{font-size:11px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qr-manager-card-count{margin-left:auto;font-size:11px;color:#c4b5fd;white-space:nowrap}.qr-manager-details{width:min(940px,calc(100vw - 24px));max-height:90vh;overflow:auto}.qr-manager-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.qr-manager-detail-item{padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025)}.qr-manager-detail-label{font-size:11px;color:#94a3b8;margin-bottom:4px}.qr-manager-detail-value{font-weight:700;word-break:break-word}.qr-manager-venue{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;margin-top:9px;background:rgba(255,255,255,.02)}.qr-manager-venue-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.qr-manager-history{position:relative;margin:12px 0 4px;padding-left:20px}.qr-manager-history:before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:1px;background:rgba(148,163,184,.25)}.qr-manager-event{position:relative;padding:7px 0 7px 12px;font-size:12px}.qr-manager-event:before{content:"";position:absolute;left:-19px;top:12px;width:8px;height:8px;border-radius:50%;background:#8b5cf6}.qr-manager-staff{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.qr-manager-staff span{padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.04);font-size:11px}.qr-manager-status{font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(52,211,153,.1);color:#6ee7b7}.qr-manager-status.off{background:rgba(248,113,113,.1);color:#fca5a5}@media(max-width:640px){.qr-manager-directory-list{grid-template-columns:1fr}.qr-manager-detail-grid{grid-template-columns:1fr}.qr-manager-details{width:calc(100vw - 12px)}}';
    document.head.appendChild(s);
  }

  function getSection(){
    var root=document.getElementById('app');if(!root)return null;
    var hs=root.querySelectorAll('h3');
    for(var i=0;i<hs.length;i++){var t=(hs[i].textContent||'').trim();if(t==='Управляющие'||t==='Менеджеры'){var p=hs[i];while(p&&p!==root){if(p.querySelector&&p.querySelector('.tblwrap'))return p;p=p.parentElement}}}
    return null;
  }

  function getModal(){
    var m=document.getElementById(MODAL_ID);if(m)return m;
    m=document.createElement('div');m.id=MODAL_ID;m.className='modal';m.style.display='none';
    m.innerHTML='<div class="glass box qr-manager-details" role="dialog" aria-modal="true"><div class="spread" style="margin-bottom:12px"><div><div id="qr-manager-details-title" style="font-size:20px;font-weight:800">Менеджер</div><div id="qr-manager-details-email" class="muted" style="font-size:12px;margin-top:3px"></div></div><button class="btn btn-ghost btn-sm" data-manager-close>✕</button></div><div id="qr-manager-details-body"></div><div class="row" style="margin-top:14px;gap:8px"><button class="btn btn-primary" data-manager-edit>✏️ Редактировать</button><button class="btn btn-ghost" data-manager-close>Закрыть</button></div></div>';
    m.addEventListener('click',function(e){
      if(e.target===m||e.target.closest('[data-manager-close]'))m.style.display='none';
      if(e.target.closest('[data-manager-edit]')){var p=proxy();if(p&&m.__manager){m.style.display='none';p.openMgrEdit(m.__manager)}}
    });
    document.body.appendChild(m);return m;
  }

  function showDetails(manager){
    var p=proxy();if(!p)return;
    var venues=(p.managerVenuesMap&&p.managerVenuesMap[manager.id])||[],orders=p.ordersAll||[],cooks=p.cooksAll||[],couriers=p.couriersAll||[],waiters=p.waitersAll||[];
    var totalOrders=0,totalRevenue=0,staff=0;
    venues.forEach(function(v){
      var vo=orders.filter(function(o){return o.venue_id===v.id});totalOrders+=vo.length;totalRevenue+=vo.reduce(function(a,o){return a+Number(o.total_price||0)},0);
      staff+=cooks.filter(function(x){return x.venue_id===v.id}).length+couriers.filter(function(x){return x.venue_id===v.id}).length+waiters.filter(function(x){return x.venue_id===v.id}).length;
    });
    var last=manager.last_login_at?new Date(manager.last_login_at):null,active=last&&!isNaN(last.getTime())&&(Date.now()-last.getTime()<2592000000);
    var html='<div class="qr-manager-detail-grid"><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Статус</div><div class="qr-manager-detail-value"><span class="qr-manager-status '+(active?'':'off')+'">'+(active?'Активен':'Нет входа за 30 дней')+'</span></div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Регистрация</div><div class="qr-manager-detail-value">'+date(manager.created_at)+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Последний вход</div><div class="qr-manager-detail-value">'+date(manager.last_login_at)+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Роль</div><div class="qr-manager-detail-value">'+esc(manager.role||'manager')+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Заведений</div><div class="qr-manager-detail-value">'+venues.length+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Персонал</div><div class="qr-manager-detail-value">'+staff+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Доставка</div><div class="qr-manager-detail-value">'+(manager.allow_manage_delivery?'Разрешена':'Нет')+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Дизайн</div><div class="qr-manager-detail-value">'+(manager.allow_manage_design?'Разрешён':'Нет')+'</div></div></div>';
    html+='<h4 style="margin:16px 0 8px">📈 Сводка</h4><div class="qr-manager-detail-grid"><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Заказов</div><div class="qr-manager-detail-value">'+totalOrders+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Выручка загруженных заказов</div><div class="qr-manager-detail-value">'+money(totalRevenue)+' ₽</div></div></div>';
    html+='<h4 style="margin:16px 0 8px">🏢 Заведения</h4>';
    if(!venues.length)html+='<div class="muted" style="padding:12px;text-align:center">Заведений пока нет.</div>';
    venues.forEach(function(v){
      var sub=(p.subscriptions||[]).find(function(s){return s.venue_id===v.id}),plan=(p.plans||[]).find(function(x){return x.id===v.plan}),vo=orders.filter(function(o){return o.venue_id===v.id}),rev=vo.reduce(function(a,o){return a+Number(o.total_price||0)},0),vc=cooks.filter(function(x){return x.venue_id===v.id}),vr=couriers.filter(function(x){return x.venue_id===v.id}),vw=waiters.filter(function(x){return x.venue_id===v.id});
      html+='<div class="qr-manager-venue"><div class="qr-manager-venue-head"><div><b>'+esc(v.name||'Без названия')+'</b><div class="muted" style="font-size:11px;margin-top:3px">/'+esc(v.slug||'—')+'</div></div><span class="badge b-on">'+esc(plan?plan.name:(v.plan||'без тарифа'))+'</span></div><div class="qr-manager-detail-grid" style="margin-bottom:0"><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Создано</div><div class="qr-manager-detail-value">'+date(v.created_at)+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Подписка до</div><div class="qr-manager-detail-value">'+date(v.subscription_end||(sub&&sub.current_period_end))+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Заказов</div><div class="qr-manager-detail-value">'+vo.length+'</div></div><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Выручка</div><div class="qr-manager-detail-value">'+money(rev)+' ₽</div></div></div><div class="qr-manager-staff">'+vc.map(function(x){return '<span>👨‍🍳 '+esc(x.name||'Повар')+'</span>'}).join('')+vr.map(function(x){return '<span>🚗 '+esc(x.name||'Курьер')+'</span>'}).join('')+vw.map(function(x){return '<span>🤵 '+esc(x.name||'Официант')+'</span>'}).join('')+'</div></div>';
    });
    var events=[{d:manager.created_at,t:'Регистрация менеджера',s:manager.email||''}];
    venues.forEach(function(v){events.push({d:v.created_at,t:'Создано заведение',s:v.name||'Без названия'});var sub=(p.subscriptions||[]).find(function(x){return x.venue_id===v.id});if(sub&&sub.created_at)events.push({d:sub.created_at,t:'Создана подписка',s:v.name||'Заведение'})});
    if(manager.last_login_at)events.push({d:manager.last_login_at,t:'Последний вход',s:'Менеджер входил в кабинет'});
    events.sort(function(a,b){return new Date(b.d||0)-new Date(a.d||0)});
    html+='<h4 style="margin:18px 0 8px">🕒 История</h4><div class="qr-manager-history">'+events.map(function(e){return '<div class="qr-manager-event"><b>'+esc(e.t)+'</b><div>'+esc(e.s)+'</div><div class="muted">'+date(e.d)+'</div></div>'}).join('')+'</div>';
    var m=getModal();m.__manager=manager;document.getElementById('qr-manager-details-title').textContent=manager.display_name||'Менеджер';document.getElementById('qr-manager-details-email').textContent=manager.email||'';document.getElementById('qr-manager-details-body').innerHTML=html;m.style.display='grid';
  }

  function render(){
    renameManagerLabels();
    var p=proxy();if(!p||p.tab!=='managers'||!Array.isArray(p.managers))return;
    var s=getSection();if(!s)return;
    addStyle();
    var table=s.querySelector('.tblwrap'),box=s.querySelector('.qr-manager-directory');
    if(!box){
      box=document.createElement('div');box.className='qr-manager-directory glass card';
      if(table){table.style.display='none';s.insertBefore(box,table)}else{s.appendChild(box)}
    }
    var oldCount=box.getAttribute('data-count');if(oldCount===String(p.managers.length)&&box.getAttribute('data-ready')==='1')return;
    box.setAttribute('data-count',String(p.managers.length));box.setAttribute('data-ready','1');
    box.innerHTML='<div class="spread" style="margin-bottom:10px"><div><b>Менеджеры</b><div class="muted" style="font-size:11px;margin-top:3px">Нажмите на менеджера, чтобы открыть полное досье</div></div><span class="muted" style="font-size:12px">Всего: '+p.managers.length+'</span></div><div class="qr-manager-directory-list"></div>';
    var list=box.querySelector('.qr-manager-directory-list');
    p.managers.forEach(function(m){
      var card=document.createElement('div'),venues=(p.managerVenuesMap&&p.managerVenuesMap[m.id])||[],base=(m.display_name||m.email||'М').trim().split(/\s+/).slice(0,2),initials=base.map(function(x){return x.charAt(0)}).join('').toUpperCase();
      card.className='qr-manager-card';card.innerHTML='<div class="qr-manager-avatar">'+esc(initials||'М')+'</div><div style="min-width:0;flex:1"><div class="qr-manager-card-name">'+esc(m.display_name||'Без имени')+'</div><div class="qr-manager-card-meta">'+esc(m.email||'')+'</div></div><div class="qr-manager-card-count">'+venues.length+' зав.</div>';
      card.addEventListener('click',function(){showDetails(m)});list.appendChild(card);
    });
  }

  function boot(){
    addStyle();renameManagerLabels();
    var obs=new MutationObserver(function(){renameManagerLabels();render()});
    if(document.body)obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    setInterval(function(){renameManagerLabels();render()},1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
