(function(){
  'use strict';
  if (!window.Vue || !/\/manager\.html$/i.test(location.pathname)) return;

  var Hall = {
    props: ['venue'],
    data: function(){
      return {
        tables: [], loading: false, saving: false, error: '', selected: null,
        editing: false, qr: false, drag: null, search: '', filter: 'all',
        form: {number:'', name:'', seats:4, shape:'round', x:80, y:80}
      };
    },
    computed: {
      filtered: function(){
        var q = String(this.search || '').toLowerCase(), f = this.filter;
        return this.tables.filter(function(t){
          var statusOk = f === 'all' || (f === 'busy' ? t.occupancy_status === 'occupied' : t.occupancy_status !== 'occupied');
          var textOk = !q || String(t.table_number || '').toLowerCase().indexOf(q) >= 0 || String(t.name || '').toLowerCase().indexOf(q) >= 0;
          return statusOk && textOk;
        });
      },
      busyCount: function(){ return this.tables.filter(function(t){return t.occupancy_status === 'occupied';}).length; },
      freeCount: function(){ return this.tables.length - this.busyCount; },
      orderCount: function(){ return this.tables.reduce(function(n,t){return n + Number(t.order_count || 0);},0); },
      total: function(){ return this.tables.reduce(function(n,t){return n + Number(t.session_total || t.total_amount || 0);},0); }
    },
    watch: {
      venue: function(){ this.selected=null; this.editing=false; this.load(); }
    },
    mounted: function(){ this.load(); },
    methods: {
      rpc: function(name,args){
        if (!window.db || !window.db.rpc) return Promise.reject(new Error('Supabase не подключен'));
        return window.db.rpc(name,args);
      },
      load: function(){
        var self=this;
        if(!this.venue) return;
        this.loading=true; this.error='';
        this.rpc('manager_table_board',{p_venue_id:this.venue.id}).then(function(r){
          if(r.error) throw r.error;
          var d=r.data;
          if(Array.isArray(d)) self.tables=d;
          else if(d && Array.isArray(d.tables)) self.tables=d.tables;
          else self.tables=[];
        }).catch(function(e){self.error=e.message || String(e);}).finally(function(){self.loading=false;});
      },
      title: function(t){ return t.name || ('Стол ' + (t.table_number == null ? '' : t.table_number)); },
      status: function(t){ return t.occupancy_status === 'occupied' ? 'Занят' : 'Свободен'; },
      edit: function(t){
        this.selected=t; this.editing=true;
        this.form={number:t.table_number == null ? '' : t.table_number,name:t.name || '',seats:Number(t.seats || 4),shape:t.shape || 'round',x:Number(t.pos_x || 80),y:Number(t.pos_y || 80)};
      },
      add: function(){
        this.selected=null; this.editing=true;
        this.form={number:'',name:'',seats:4,shape:'round',x:80 + (this.tables.length % 5)*140,y:80 + Math.floor(this.tables.length/5)*140};
      },
      cancel: function(){this.selected=null;this.editing=false;},
      save: function(){
        var self=this;
        if(!this.venue || this.saving) return;
        this.saving=true; this.error='';
        this.rpc('manager_upsert_table',{
          p_venue_id:this.venue.id,
          p_table_id:this.selected ? this.selected.id : null,
          p_table_number:this.form.number === '' ? null : Number(this.form.number),
          p_name:this.form.name || null,
          p_seats:Number(this.form.seats) || 4,
          p_shape:this.form.shape,
          p_pos_x:Number(this.form.x) || 80,
          p_pos_y:Number(this.form.y) || 80
        }).then(function(r){if(r.error) throw r.error; self.editing=false; self.selected=null; return self.load();}).catch(function(e){self.error=e.message || String(e);}).finally(function(){self.saving=false;});
      },
      remove: function(t){
        var self=this;
        if(!confirm('Удалить ' + this.title(t) + '?')) return;
        this.rpc('manager_delete_table',{p_venue_id:this.venue.id,p_table_id:t.id}).then(function(r){if(r.error) throw r;self.selected=null;self.editing=false;return self.load();}).catch(function(e){self.error=e.message || String(e);});
      },
      qrShow: function(t){this.selected=t;this.qr=true;},
      qrUrl: function(t){return location.origin + '/menu.html?table=' + encodeURIComponent(t.qr_token || t.id);},
      qrImage: function(t){return 'https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=10&data=' + encodeURIComponent(this.qrUrl(t));},
      qrNew: function(t){
        var self=this;
        if(!confirm('Старый QR перестанет работать. Создать новый?')) return;
        this.rpc('manager_regenerate_table_qr',{p_venue_id:this.venue.id,p_table_id:t.id}).then(function(r){if(r.error) throw r.error;return self.load();}).then(function(){var n=self.tables.find(function(x){return x.id===t.id;});if(n)self.selected=n;}).catch(function(e){self.error=e.message || String(e);});
      },
      printQr: function(t){
        var w=window.open('','_blank','width=700,height=850'); if(!w)return;
        w.document.write('<!doctype html><html><head><title>QR '+this.title(t)+'</title><style>body{font-family:Arial;text-align:center;padding:30px}img{width:500px;max-width:90%}h1{font-size:30px}</style></head><body><h1>'+this.title(t)+'</h1><img src="'+this.qrImage(t)+'"><p>Отсканируйте QR-код камерой телефона</p><script>window.onload=function(){setTimeout(function(){window.print()},500)}<\\/script></body></html>');
        w.document.close();
      },
      downloadQr: function(t){var a=document.createElement('a');a.href=this.qrImage(t);a.target='_blank';a.rel='noopener';a.click();},
      start: function(e,t){
        if(e.target.closest && e.target.closest('button')) return;
        this.drag={id:t.id,x:Number(t.pos_x || 80),y:Number(t.pos_y || 80),sx:e.clientX,sy:e.clientY};
      },
      move: function(e){
        if(!this.drag)return;
        var d=this.drag,t=this.tables.find(function(x){return x.id===d.id;});
        if(t){t.pos_x=Math.max(10,Math.min(1800,d.x+e.clientX-d.sx));t.pos_y=Math.max(10,Math.min(1000,d.y+e.clientY-d.sy));}
      },
      end: function(){
        var self=this;if(!this.drag)return;
        var d=this.drag,t=this.tables.find(function(x){return x.id===d.id;});this.drag=null;if(!t)return;
        this.rpc('manager_upsert_table',{p_venue_id:this.venue.id,p_table_id:t.id,p_table_number:t.table_number,p_name:t.name||null,p_seats:t.seats||4,p_shape:t.shape||'round',p_pos_x:Math.round(t.pos_x),p_pos_y:Math.round(t.pos_y)}).catch(function(e){self.error=e.message || String(e);self.load();});
      },
      style: function(t){
        var w=t.shape==='rectangle'?170:(t.shape==='square'?120:100), h=t.shape==='rectangle'?76:(t.shape==='square'?120:100);
        return {left:(Number(t.pos_x)||80)+'px',top:(Number(t.pos_y)||80)+'px',width:w+'px',height:h+'px'};
      }
    },
    template: '<section class="manager-hall"><div class="hall-toolbar"><div><h2>🪑 Зал / Столы</h2><p>План зала, посадка, QR-коды и текущие сессии</p></div><div class="hall-actions"><button class="btn btn-primary" @click="add">＋ Добавить стол</button><button class="btn btn-ghost" @click="load">↻ Обновить</button></div></div><div v-if="error" class="hall-alert">⚠️ {{error}}</div><div class="hall-stats"><button :class="{active:filter===\'all\'}" @click="filter=\'all\'"><b>{{tables.length}}</b><span>Всего</span></button><button :class="{active:filter===\'free\'}" @click="filter=\'free\'"><b class="green">{{freeCount}}</b><span>Свободно</span></button><button :class="{active:filter===\'busy\'}" @click="filter=\'busy\'"><b class="yellow">{{busyCount}}</b><span>Занято</span></button><div class="hall-stat"><b>{{orderCount}}</b><span>Заказов</span></div><div class="hall-stat"><b>{{total.toFixed(2)}} ₽</b><span>Сумма сессий</span></div></div><div class="hall-main"><div><div class="hall-board-head"><input v-model="search" class="hall-search" placeholder="Поиск стола…"><span class="muted">Перетаскивайте столы · двойной клик — редактирование</span></div><div class="hall-plan" @mousemove="move" @mouseup="end" @mouseleave="end"><div v-if="loading" class="hall-empty">Загрузка столов…</div><div v-for="t in filtered" :key="t.id" class="hall-table" :class="{busy:t.occupancy_status===\'occupied\',selected:selected&&selected.id===t.id}" :style="style(t)" @mousedown="start($event,t)" @dblclick="edit(t)"><b>{{title(t)}}</b><span>{{status(t)}}</span><small>{{t.seats||4}} мест · {{t.order_count||0}} заказов</small><strong v-if="t.session_total||t.total_amount">{{Number(t.session_total||t.total_amount||0).toFixed(2)}} ₽</strong><div class="hall-table-actions"><button @mousedown.stop @click.stop="edit(t)">✏️</button><button @mousedown.stop @click.stop="qrShow(t)">▣ QR</button></div></div><div v-if="!filtered.length&&!loading" class="hall-empty"><b>Столов нет</b><span>Добавьте первый стол и разместите его на плане.</span><button class="btn btn-primary" @click="add">＋ Добавить стол</button></div></div></div><aside class="hall-editor card"><div class="editor-title"><div><h3>{{editing?(selected?\'Стол: \'+title(selected):\'Новый стол\'):\'Управление столом\'}}</h3><span class="muted">{{editing?\'Настройте стол и сохраните\':\'Выберите стол на плане\'}}</span></div><button v-if="editing" class="icon-btn" @click="cancel">×</button></div><div v-if="editing" class="editor-form"><label>Номер<input v-model="form.number" type="number" min="1"></label><label>Название<input v-model="form.name" placeholder="Например VIP 1"></label><div class="two"><label>Мест<input v-model.number="form.seats" type="number" min="1" max="50"></label><label>Форма<select v-model="form.shape"><option value="round">Круг</option><option value="square">Квадрат</option><option value="rectangle">Прямоугольник</option></select></label></div><div class="two"><label>X<input v-model.number="form.x" type="number"></label><label>Y<input v-model.number="form.y" type="number"></label></div><div class="editor-buttons"><button class="btn btn-primary" :disabled="saving" @click="save">{{saving?\'Сохранение…\':\'Сохранить\'}}</button><button class="btn btn-ghost" @click="cancel">Отмена</button></div><button v-if="selected" class="btn btn-danger full" @click="remove(selected)">Удалить стол</button></div><div v-else class="editor-empty"><span>Выберите стол на плане или добавьте новый</span><button class="btn btn-primary" @click="add">＋ Добавить стол</button></div><div v-if="selected&&!editing" class="editor-info"><div><span>Статус</span><b>{{status(selected)}}</b></div><div><span>Заказов</span><b>{{selected.order_count||0}}</b></div><div><span>Сумма</span><b>{{Number(selected.session_total||selected.total_amount||0).toFixed(2)}} ₽</b></div><div class="editor-buttons"><button class="btn btn-ghost" @click="edit(selected)">✏️ Редактировать</button><button class="btn btn-ghost" @click="qrShow(selected)">▣ QR</button></div></div></aside></div><div v-if="qr&&selected" class="hall-modal" @click.self="qr=false"><div class="hall-modal-card"><button class="modal-close" @click="qr=false">×</button><h2>QR — {{title(selected)}}</h2><p class="muted">QR привязан к этому столу.</p><img class="qr-image" :src="qrImage(selected)" alt="QR-код"><div class="qr-url">{{qrUrl(selected)}}</div><div class="qr-buttons"><button class="btn btn-primary" @click="printQr(selected)">🖨 Печать</button><button class="btn btn-ghost" @click="downloadQr(selected)">Открыть PNG</button><button class="btn btn-danger" @click="qrNew(selected)">Новый QR</button></div></div></div></section>'
  };

  function styles(){
    if(document.getElementById('manager-hall-style')) return;
    var s=document.createElement('style'); s.id='manager-hall-style';
    s.textContent='.manager-hall{padding:4px 0 30px}.hall-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.hall-toolbar h2{margin:0 0 4px}.hall-toolbar p{margin:0;color:#94a3b8}.hall-actions,.editor-buttons,.qr-buttons{display:flex;gap:8px;flex-wrap:wrap}.hall-alert{padding:12px 14px;border-radius:12px;background:rgba(239,68,68,.12);color:#fca5a5;margin-bottom:14px}.hall-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.hall-stats>button,.hall-stat{min-width:105px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:12px;padding:10px 14px;color:inherit;text-align:left}.hall-stats>button{cursor:pointer}.hall-stats>button.active{border-color:#60a5fa;background:rgba(96,165,250,.1)}.hall-stats b{display:block;font-size:18px}.hall-stats span{display:block;color:#94a3b8;font-size:11px;margin-top:2px}.green{color:#34d399}.yellow{color:#fbbf24}.hall-main{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px}.hall-board-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.hall-search{width:230px;max-width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit}.hall-plan{position:relative;min-height:620px;overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:18px;background-color:rgba(255,255,255,.015);background-size:40px 40px;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)}.hall-table{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:2px solid #34d399;background:rgba(52,211,153,.12);border-radius:50%;cursor:grab;user-select:none;padding:8px;box-sizing:border-box;box-shadow:0 8px 25px rgba(0,0,0,.18)}.hall-table.busy{border-color:#fbbf24;background:rgba(251,191,36,.14)}.hall-table.selected{outline:3px solid rgba(96,165,250,.45)}.hall-table span,.hall-table small{font-size:10px;color:#cbd5e1}.hall-table strong{font-size:11px}.hall-table-actions{display:flex;gap:4px;margin-top:2px}.hall-table button{border:0;border-radius:6px;background:rgba(0,0,0,.35);color:#fff;padding:3px 6px;cursor:pointer}.hall-empty{min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#94a3b8}.hall-empty b{font-size:18px;color:#e2e8f0}.hall-editor{padding:16px;height:max-content;position:sticky;top:10px}.editor-title{display:flex;justify-content:space-between;gap:10px}.editor-form{display:grid;gap:10px;margin-top:14px}.editor-form label{display:grid;gap:5px;font-size:12px;color:#94a3b8}.editor-form input,.editor-form select{padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.editor-empty{padding:25px 0;display:grid;gap:10px;text-align:center;color:#94a3b8}.editor-info{margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,.08);display:grid;gap:10px}.editor-info>div{display:flex;justify-content:space-between}.editor-info span{color:#94a3b8}.full{width:100%}.hall-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px}.hall-modal-card{position:relative;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:24px;max-width:650px;width:100%;text-align:center}.modal-close{position:absolute;right:12px;top:10px;border:0;background:none;color:#fff;font-size:28px;cursor:pointer}.qr-image{width:min(500px,100%);background:#fff;padding:10px;border-radius:10px}.qr-url{word-break:break-all;color:#94a3b8;font-size:11px;margin:10px 0}.muted{color:#94a3b8}@media(max-width:900px){.hall-main{grid-template-columns:1fr}.hall-editor{position:static}.hall-board-head{align-items:flex-start;flex-direction:column}}';
    document.head.appendChild(s);
  }

  styles();

  var originalCreateApp=window.Vue.createApp;
  if(window.__managerHallInstalled) return;
  window.__managerHallInstalled=true;

  window.Vue.createApp=function(rootComponent,rootProps){
    var app=originalCreateApp.call(window.Vue,rootComponent,rootProps);
    app.component('manager-hall',Hall);
    var originalMount=app.mount;
    app.mount=function(target){
      var root=document.querySelector(target || '#app');
      if(root && !root.querySelector('manager-hall')){
        var el=document.createElement('manager-hall');
        el.setAttribute('v-if',"tab==='hall'");
        el.setAttribute(':venue','venue');
        root.appendChild(el);
      }
      return originalMount.call(app,target);
    };
    return app;
  };
})();
