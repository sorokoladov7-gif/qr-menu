/* QR-Menu — менеджеры (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_MANAGERS__) return;
  window.__QR_ADMIN_MANAGERS__ = true;

  var managersMixin = {
    data: function() {
      return {
        managers: [],
        links: [],
        managerPeriods: {},
        addMgrModal: { show: false, name: '', email: '', password: '', role: 'manager', err: '' },
        mgrEditModal: { show: false, id: null, name: '', role: 'manager', allow_manage_delivery: false, allow_manage_design: false }
      };
    },
    computed: {
      managerVenuesMap: function() {
        var map = {};
        var self = this;
        this.managers.forEach(function(m) {
          var venueIds = self.links.filter(function(l) { return l.manager_id === m.id; }).map(function(l) { return l.venue_id; });
          var venues = venueIds.map(function(vid) {
            return self.venues.find(function(v) { return v.id === vid; });
          }).filter(function(v) { return v !== undefined; });
          map[m.id] = venues;
        });
        return map;
      }
    },
    methods: {
      addManager: function() {
        var self = this;
        self.busy = true;
        self.addMgrModal.err = '';
        var temp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, storageKey: 'admin-temp', autoRefreshToken: false, detectSessionInUrl: false }
        });
        temp.auth.signUp({
          email: self.addMgrModal.email,
          password: self.addMgrModal.password,
          options: { data: { display_name: self.addMgrModal.name, role: self.addMgrModal.role } }
        }).then(function(r) {
          self.busy = false;
          if (r.error) { self.addMgrModal.err = 'Ошибка: ' + r.error.message; return; }
          alert('Аккаунт создан! Передайте данные менеджеру.');
          self.addMgrModal.show = false;
          self.addMgrModal = { show: false, name: '', email: '', password: '', role: 'manager', err: '' };
          self.loadBaseData();
        });
      },
      openMgrEdit: function(m) {
        this.mgrEditModal = { show: true, id: m.id, name: m.display_name, role: m.role, allow_manage_delivery: !!m.allow_manage_delivery, allow_manage_design: !!m.allow_manage_design };
      },
      saveMgrEdit: function() {
        var self = this;
        db.from('profiles').update({
          display_name: self.mgrEditModal.name,
          role: self.mgrEditModal.role,
          allow_manage_delivery: self.mgrEditModal.allow_manage_delivery,
          allow_manage_design: self.mgrEditModal.allow_manage_design
        }).eq('id', self.mgrEditModal.id).then(function() {
          self.mgrEditModal.show = false;
          self.loadBaseData();
        });
      },
      toggleMgrVenue: function(mid, vid, on) {
        var self = this;
        var p = on ? db.from('manager_venues').insert({ manager_id: mid, venue_id: vid })
                   : db.from('manager_venues').delete().eq('manager_id', mid).eq('venue_id', vid);
        p.then(function() { self.loadBaseData(); });
      },
      delManager: function(m) {
        var self = this;
        if (!confirm('Удалить управляющего ' + m.display_name + '?')) return;
        db.rpc('admin_delete_manager', { p_manager_id: m.id }).then(function(r) {
          if (r.error) { self.msg = 'Ошибка удаления: ' + (r.error.message || r.error); return; }
          self.loadBaseData();
        });
      },
      isAssigned: function(m, v) {
        return this.links.some(function(l) { return l.manager_id === m && l.venue_id === v; });
      }
    }
  };

  window.__QR_ADMIN_MANAGERS_MIXIN__ = managersMixin;

  /* Дополнительный каталог менеджеров и окно подробностей.
     Существующая таблица и её действия сохраняются как резервный слой. */
  (function installManagerDirectory(){
    var STYLE_ID = 'qr-admin-manager-directory-style';
    var MODAL_ID = 'qr-admin-manager-details';
    var started = false;

    function esc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function date(v){
      if(!v) return '—';
      try { return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e){ return String(v); }
    }
    function money(v){ return Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:0}); }
    function proxy(){ var a=window.__QR_ADMIN_VUE_APP__; return a&&a._instance?a._instance.proxy:null; }

    function addStyle(){
      if(document.getElementById(STYLE_ID)) return;
      var s=document.createElement('style'); s.id=STYLE_ID;
      s.textContent=''
        +'.qr-manager-directory{margin-bottom:14px;} .qr-manager-directory-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;}'
        +'.qr-manager-card{display:flex;align-items:center;gap:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);cursor:pointer;transition:transform .2s,border-color .2s,background .2s,box-shadow .2s;}'
        +'.qr-manager-card:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.45);background:rgba(99,102,241,.06);box-shadow:0 10px 28px rgba(0,0,0,.18);}'
        +'.qr-manager-avatar{width:42px;height:42px;min-width:42px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-weight:800;color:#fff;}'
        +'.qr-manager-card-name{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .qr-manager-card-meta{font-size:11px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .qr-manager-card-count{margin-left:auto;font-size:11px;color:#c4b5fd;white-space:nowrap;}'
        +'.qr-manager-details{max-width:900px;width:calc(100vw - 28px);max-height:88vh;overflow:auto;} .qr-manager-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0;}'
        +'.qr-manager-detail-item{padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025);} .qr-manager-detail-label{font-size:11px;color:#94a3b8;margin-bottom:4px;} .qr-manager-detail-value{font-weight:700;word-break:break-word;}'
        +'.qr-manager-venue{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;margin-top:9px;background:rgba(255,255,255,.02);} .qr-manager-venue-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}'
        +'@media(max-width:640px){.qr-manager-directory-list{grid-template-columns:1fr}.qr-manager-detail-grid{grid-template-columns:1fr}.qr-manager-details{width:calc(100vw - 16px);max-height:92vh}}';
      document.head.appendChild(s);
    }

    function modal(){
      var m=document.getElementById(MODAL_ID); if(m) return m;
      m=document.createElement('div'); m.id=MODAL_ID; m.className='modal'; m.style.display='none';
      m.innerHTML='<div class="glass box qr-manager-details" role="dialog" aria-modal="true">'
        +'<div class="spread" style="margin-bottom:12px"><div><div id="qr-manager-details-title" style="font-size:20px;font-weight:800">Менеджер</div><div id="qr-manager-details-email" class="muted" style="font-size:12px;margin-top:3px"></div></div><button class="btn btn-ghost btn-sm" data-manager-close>✕</button></div>'
        +'<div id="qr-manager-details-body"></div>'
        +'<div class="row" style="margin-top:14px;gap:8px"><button class="btn btn-primary" data-manager-edit>✏️ Редактировать</button><button class="btn btn-ghost" data-manager-close>Закрыть</button></div></div>';
      m.addEventListener('click',function(e){
        if(e.target===m || e.target.closest('[data-manager-close]')) m.style.display='none';
        if(e.target.closest('[data-manager-edit]')){ var p=proxy(); if(p&&m.__manager){m.style.display='none';p.openMgrEdit(m.__manager);} }
      });
      document.body.appendChild(m); return m;
    }

    function showDetails(manager){
      var p=proxy(); if(!p) return;
      var m=modal(); m.__manager=manager;
      var venues=p.managerVenuesMap[manager.id]||[], cooks=p.cooksAll||[], couriers=p.couriersAll||[], waiters=p.waitersAll||[];
      var counts={cooks:0,couriers:0,waiters:0};
      venues.forEach(function(v){ counts.cooks+=cooks.filter(function(x){return x.venue_id===v.id;}).length; counts.couriers+=couriers.filter(function(x){return x.venue_id===v.id;}).length; counts.waiters+=waiters.filter(function(x){return x.venue_id===v.id;}).length; });
      var html='<div class="qr-manager-detail-grid">'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">ID менеджера</div><div class="qr-manager-detail-value" style="font-size:11px">'+esc(manager.id)+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Дата регистрации</div><div class="qr-manager-detail-value">'+date(manager.created_at)+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Роль</div><div class="qr-manager-detail-value">'+esc(manager.role||'manager')+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Заведений</div><div class="qr-manager-detail-value">'+venues.length+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Поваров</div><div class="qr-manager-detail-value">'+counts.cooks+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Курьеров</div><div class="qr-manager-detail-value">'+counts.couriers+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Официантов</div><div class="qr-manager-detail-value">'+counts.waiters+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Доступ к доставке</div><div class="qr-manager-detail-value">'+(manager.allow_manage_delivery?'Разрешён':'Нет')+'</div></div>'
        +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Доступ к дизайну</div><div class="qr-manager-detail-value">'+(manager.allow_manage_design?'Разрешён':'Нет')+'</div></div></div>'
        +'<h4 style="margin:16px 0 8px">🏢 Заведения менеджера</h4>';
      if(!venues.length) html+='<div class="muted" style="padding:12px;text-align:center">Заведений пока нет.</div>';
      venues.forEach(function(v){
        var sub=(p.subscriptions||[]).find(function(s){return s.venue_id===v.id;}), plan=(p.plans||[]).find(function(x){return x.id===v.plan;});
        var orders=(p.ordersAll||[]).filter(function(o){return o.venue_id===v.id;}), revenue=orders.reduce(function(sum,o){return sum+Number(o.total_price||0);},0);
        html+='<div class="qr-manager-venue"><div class="qr-manager-venue-head"><div><b>'+esc(v.name||'Без названия')+'</b><div class="muted" style="font-size:11px;margin-top:3px">/'+esc(v.slug||'—')+'</div></div><span class="badge b-on">'+esc(plan?plan.name:(v.plan||'без тарифа'))+'</span></div>'
          +'<div class="qr-manager-detail-grid" style="margin-bottom:0"><div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Создано</div><div class="qr-manager-detail-value">'+date(v.created_at)+'</div></div>'
          +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Подписка до</div><div class="qr-manager-detail-value">'+date(v.subscription_end||(sub&&sub.current_period_end))+'</div></div>'
          +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Заказов загружено</div><div class="qr-manager-detail-value">'+orders.length+'</div></div>'
          +'<div class="qr-manager-detail-item"><div class="qr-manager-detail-label">Выручка загруженных заказов</div><div class="qr-manager-detail-value">'+money(revenue)+' ₽</div></div></div></div>';
      });
      if(!p.ordersLoaded) html+='<div class="muted" style="font-size:11px;margin-top:10px">Статистика заказов появится после загрузки данных активности.</div>';
      document.getElementById('qr-manager-details-title').textContent=manager.display_name||'Менеджер';
      document.getElementById('qr-manager-details-email').textContent=manager.email||'';
      document.getElementById('qr-manager-details-body').innerHTML=html;
      m.style.display='grid';
    }

    function section(){
      var h=[].slice.call(document.querySelectorAll('h3')).find(function(x){var t=(x.textContent||'').trim();return t==='Управляющие'||t==='Менеджеры';});
      return h&&h.parentElement&&h.parentElement.parentElement;
    }
    function render(){
      var p=proxy(); if(!p||!p.managers||p.tab!=='managers') return false;
      [].slice.call(document.querySelectorAll('.tabs button')).forEach(function(b){if((b.textContent||'').indexOf('Управляющие')>=0)b.textContent='👤 Менеджеры';});
      var s=section(); if(!s) return false; addStyle();
      var box=s.querySelector('.qr-manager-directory'), table=s.querySelector('.tblwrap');
      if(!box){ box=document.createElement('div'); box.className='qr-manager-directory glass card'; if(table){table.style.display='none';s.insertBefore(box,table);}else{s.appendChild(box);} }
      box.innerHTML='<div class="spread" style="margin-bottom:10px"><div><b>Менеджеры</b><div class="muted" style="font-size:11px;margin-top:3px">Нажмите на менеджера, чтобы открыть подробную карточку</div></div><span class="muted" style="font-size:12px">Всего: '+p.managers.length+'</span></div><div class="qr-manager-directory-list"></div>';
      var list=box.querySelector('.qr-manager-directory-list');
      p.managers.forEach(function(m){
        var card=document.createElement('div'); card.className='qr-manager-card';
        var venues=p.managerVenuesMap[m.id]||[], initials=(m.display_name||m.email||'М').trim().split(/\s+/).slice(0,2).map(function(x){return x.charAt(0);}).join('').toUpperCase();
        card.innerHTML='<div class="qr-manager-avatar">'+esc(initials||'М')+'</div><div style="min-width:0;flex:1"><div class="qr-manager-card-name">'+esc(m.display_name||'Без имени')+'</div><div class="qr-manager-card-meta">'+esc(m.email||'')+'</div></div><div class="qr-manager-card-count">'+venues.length+' зав.</div>';
        card.addEventListener('click',function(){showDetails(m);}); list.appendChild(card);
      });
      return true;
    }
    function start(){
      if(started)return; started=true; addStyle();
      var tries=0, wait=setInterval(function(){tries++; if(proxy()||tries>40){clearInterval(wait); loop();}},500);
    }
    function loop(){render();setTimeout(loop,700);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  })();
})();