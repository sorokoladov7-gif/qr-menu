/* QR-SETKA manager staff statistics dashboard. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_STAFF_STATS__) return;
  window.__QR_MANAGER_STAFF_STATS__=true;
  const URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
  const KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
  let client=null;
  function getClient(){if(client)return client;if(window.db&&window.db.auth&&window.db.rpc){client=window.db;return client;}if(window.supabase){client=window.supabase.createClient(URL,KEY);return client;}return null;}
  function venueId(){try{const root=document.querySelector('#app');const vm=root&&root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy;return vm&&vm.venue&&vm.venue.id?vm.venue.id:null;}catch(e){return null;}}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU');}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isoDate(d){return d.toISOString().slice(0,10)}
  function open(){
    const v=venueId(); if(!v){alert('Сначала выберите заведение.');return;}
    const m=document.createElement('div');m.id='qr-manager-staff-modal';m.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML='<div style="width:min(1100px,100%);max-height:94vh;overflow:auto;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;box-shadow:0 25px 90px rgba(0,0,0,.55)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h2 style="margin:0">📊 Статистика персонала</h2><div style="color:#94a3b8;font-size:12px;margin-top:4px">Данные по дням сохраняются в архиве</div></div><button id="qrm-close" style="border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:9px 12px">✕</button></div><div style="display:flex;gap:8px;align-items:center;margin:16px 0"><button class="qrm-period" data-days="7">7 дней</button><button class="qrm-period" data-days="30">30 дней</button><button class="qrm-period" data-days="90">90 дней</button></div><div id="qrm-body"><div style="text-align:center;color:#94a3b8;padding:30px">Загрузка…</div></div></div>';
    document.body.appendChild(m);m.querySelector('#qrm-close').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};
    m.querySelectorAll('.qrm-period').forEach(b=>{b.style.cssText='border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer';b.onclick=()=>loadDays(Number(b.dataset.days),v)});
    loadDays(7,v);
  }
  async function loadDays(days,v){
    const body=document.querySelector('#qrm-body'); if(!body)return;
    body.innerHTML='<div style="text-align:center;color:#94a3b8;padding:30px">Загрузка…</div>';
    const to=new Date(), from=new Date();from.setDate(to.getDate()-days+1);
    const c=getClient(); if(!c){body.innerHTML='<div style="color:#f87171">Supabase client не найден</div>';return;}
    const r=await c.rpc('manager_staff_statistics',{p_venue_id:v,p_from:isoDate(from),p_to:isoDate(to)});
    if(r.error){body.innerHTML='<div style="color:#f87171">'+esc(r.error.message)+'</div>';return;}
    const rows=Array.isArray(r.data)?r.data:[];
    const html=rows.map((d,i)=>{
      const staff=Array.isArray(d.staff)?d.staff:[];
      const groups={waiter:[],cook:[],courier:[]};staff.forEach(s=>(groups[s.staff_type]||[]).push(s));
      return '<div class="qrm-day" style="border:1px solid rgba(255,255,255,.1);border-radius:14px;margin-bottom:10px;overflow:hidden"><button data-day="'+i+'" style="width:100%;text-align:left;border:0;background:rgba(255,255,255,.04);color:#fff;padding:14px;cursor:pointer"><b>'+esc(new Date(d.business_date+'T12:00:00').toLocaleDateString('ru-RU'))+'</b><span style="float:right">'+fmt(d.total_revenue)+' ₽ · '+fmt(d.total_orders)+' заказов</span></button><div data-panel="'+i+'" style="display:none;padding:12px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px"><div style="background:rgba(52,211,153,.08);border-radius:10px;padding:10px"><b>'+fmt(d.completed_orders)+'</b><div style="color:#94a3b8;font-size:11px">Выдано</div></div><div style="background:rgba(248,113,113,.08);border-radius:10px;padding:10px"><b>'+fmt(d.cancelled_orders)+'</b><div style="color:#94a3b8;font-size:11px">Отменено</div></div><div style="background:rgba(251,191,36,.08);border-radius:10px;padding:10px"><b>'+fmt(d.avg_cooking_minutes)+' мин</b><div style="color:#94a3b8;font-size:11px">Ср. готовка</div></div></div>'+staffTable('🤵 Официанты',groups.waiter)+staffTable('👨‍🍳 Повара',groups.cook)+staffTable('🚗 Курьеры',groups.courier)+'</div></div>';
    }).join('');
    body.innerHTML=html||'<div style="text-align:center;color:#94a3b8;padding:30px">Нет данных за выбранный период</div>';
    body.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const p=body.querySelector('[data-panel="'+b.dataset.day+'"]');if(p)p.style.display=p.style.display==='none'?'block':'none';});
  }
  function staffTable(title,rows){if(!rows.length)return '<div style="margin-top:10px;color:#94a3b8">'+title+': данных нет</div>';return '<div style="margin-top:10px"><b>'+title+'</b><div style="margin-top:6px">'+rows.map(s=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+esc(s.staff_name||'Без имени')+'</span><span>'+fmt(s.orders_count)+' заказов · '+fmt(s.revenue)+' ₽</span></div>').join('')+'</div></div>';}
  function install(){const tabs=document.querySelector('.tabs');if(!tabs||document.getElementById('qr-manager-staff-tab'))return;const b=document.createElement('button');b.id='qr-manager-staff-tab';b.className='';b.textContent='📊 Персонал';b.type='button';b.style.cssText='background:rgba(255,255,255,.06)';b.onclick=open;tabs.appendChild(b);}
  let n=0;const timer=setInterval(()=>{install();if(++n>60)clearInterval(timer)},500);
})();
