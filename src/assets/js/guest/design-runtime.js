(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  if(window.__designRuntimeLoaded) return;
  window.__designRuntimeLoaded=true;

  var current=null;
  var venueSlug=new URLSearchParams(location.search).get('venue');

  function hex(v,f){
    return /^#[0-9a-f]{6}$/i.test(String(v||'')) ? String(v) : f;
  }
  function num(v,f,min,max){
    var n=Number(v);
    if(!Number.isFinite(n)) n=f;
    if(min!=null) n=Math.max(min,n);
    if(max!=null) n=Math.min(max,n);
    return n;
  }
  function defaults(v){
    var d=(v&&v.design_settings)||{};
    return Object.assign({
      brand_color:(v&&v.brand_color)||'#6366f1',
      button_color:'#8b5cf6',
      header_color:'#ffffff',
      font_family:'Plus+Jakarta+Sans',
      hero_enabled:true,
      hero_style:'gradient',
      card_style:'glass',
      card_radius:18,
      button_radius:12,
      button_style:'gradient',
      image_ratio:'4:3',
      category_style:'chips'
    },d);
  }
  function loadFont(font){
    var name=String(font||'Plus+Jakarta+Sans').replace(/\+/g,' ');
    var old=document.getElementById('design-runtime-font');
    if(old && old.dataset.font===name) return;
    if(old) old.remove();
    var link=document.createElement('link');
    link.id='design-runtime-font';
    link.dataset.font=name;
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(String(font||'Plus+Jakarta+Sans')).replace(/%2B/g,'+')+':wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  function heroBg(d,brand,header){
    if(d.hero_style==='dark') return 'linear-gradient(135deg,#020617,'+brand+')';
    if(d.hero_style==='warm') return 'linear-gradient(135deg,'+brand+','+header+')';
    if(d.hero_style==='minimal') return header;
    return 'linear-gradient(135deg,'+brand+','+brand+'aa,#8b5cf6)';
  }
  function apply(v){
    if(!v || !document.body) return;
    current=v;
    var d=defaults(v);
    var brand=hex(d.brand_color,v.brand_color||'#6366f1');
    var button=hex(d.button_color,'#8b5cf6');
    var header=hex(d.header_color,'#ffffff');
    var cr=num(d.card_radius,18,0,40);
    var br=num(d.button_radius,12,0,40);
    var root=document.documentElement,body=document.body;

    root.style.setProperty('--brand',brand);
    root.style.setProperty('--design-button',button);
    root.style.setProperty('--design-header',header);
    root.style.setProperty('--design-card-radius',cr+'px');
    root.style.setProperty('--design-button-radius',br+'px');
    loadFont(d.font_family);
    body.style.fontFamily=String(d.font_family||'Plus+Jakarta+Sans').replace(/\+/g,' ')+',sans-serif';

    var top=document.querySelector('.topbar');
    if(top){
      top.style.background=header;
      top.style.borderColor=brand+'33';
    }

    var hero=document.querySelector('.hero');
    if(hero){
      hero.style.display=d.hero_enabled===false?'none':'';
      hero.style.borderRadius=cr+'px';
      hero.style.background=heroBg(d,brand,header);
      hero.style.color=d.hero_style==='minimal'?'#111827':'#fff';
    }

    document.querySelectorAll('.dish').forEach(function(x){
      x.style.borderRadius=cr+'px';
      if(d.card_style==='flat'){
        x.style.background='transparent';
        x.style.border='1px solid rgba(148,163,184,.18)';
        x.style.backdropFilter='none';
      }else if(d.card_style==='bold'){
        x.style.background='linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.02))';
        x.style.border='1px solid '+brand+'66';
        x.style.backdropFilter='none';
      }else if(d.card_style==='soft'){
        x.style.background='rgba(255,255,255,.055)';
        x.style.border='1px solid rgba(255,255,255,.08)';
        x.style.backdropFilter='none';
      }else{
        x.style.background='rgba(255,255,255,.035)';
        x.style.border='1px solid rgba(255,255,255,.08)';
        x.style.backdropFilter='blur(10px)';
      }
    });

    var ratio=d.image_ratio||'4:3';
    document.querySelectorAll('.dish img').forEach(function(img){
      img.style.width='100%';
      img.style.objectFit='cover';
      if(ratio==='1:1'){
        img.style.aspectRatio='1 / 1';
        img.style.height='auto';
      }else if(ratio==='16:9'){
        img.style.aspectRatio='16 / 9';
        img.style.height='auto';
      }else{
        img.style.aspectRatio='4 / 3';
        img.style.height='auto';
      }
    });

    document.querySelectorAll('.add-btn,.cartbar button,.reorder-bar button').forEach(function(x){
      x.style.borderRadius=br+'px';
      if(d.button_style==='solid'){
        x.style.background=button;
        x.style.border='none';
        x.style.color='#fff';
      }else if(d.button_style==='outline'){
        x.style.background='transparent';
        x.style.border='1px solid '+button;
        x.style.color=button;
      }else{
        x.style.background='linear-gradient(90deg,'+brand+','+button+')';
        x.style.border='none';
        x.style.color='#fff';
      }
    });

    document.querySelectorAll('.chip').forEach(function(x){
      x.style.borderRadius=br+'px';
      if(x.classList.contains('on')){
        x.style.background=d.button_style==='outline'?'transparent':'linear-gradient(90deg,'+brand+','+button+')';
        x.style.borderColor=button;
        x.style.color=d.button_style==='outline'?button:'#fff';
      }
    });

    document.querySelectorAll('.price-pill').forEach(function(x){
      x.style.borderRadius=br+'px';
      x.style.background='linear-gradient(90deg,'+brand+','+button+')';
    });

    document.querySelectorAll('.glass').forEach(function(x){
      x.style.borderRadius=cr+'px';
    });
  }

  function loadVenue(){
    if(!venueSlug || !window.db || !window.db.rpc) return;
    window.db.rpc('public_venue_by_slug',{p_slug:venueSlug}).then(function(r){
      if(r && !r.error){
        var v=Array.isArray(r.data)?r.data[0]:r.data;
        if(v){
          window.__qrDesignVenue=v;
          apply(v);
          watchDom();
        }
      }else if(r&&r.error){
        console.warn('[Design Runtime] venue:',r.error.message||r.error);
      }
    }).catch(function(e){console.warn('[Design Runtime] venue exception:',e);});
  }

  var observer=null;
  function watchDom(){
    if(observer||!current||!document.body) return;
    observer=new MutationObserver(function(){
      if(current) apply(current);
    });
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  }

  function boot(){
    loadVenue();
    var tries=0;
    var timer=setInterval(function(){
      if(current){apply(current);watchDom();}
      else loadVenue();
      if(++tries>80) clearInterval(timer);
    },500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
