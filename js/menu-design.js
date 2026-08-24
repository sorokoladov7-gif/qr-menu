(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  if(window.__qrMenuDesignLoaded) return;
  window.__qrMenuDesignLoaded=true;

  var state={settings:null,style:null};

  function safeColor(v,fallback){
    var s=String(v==null?'':v).trim();
    return (/^#[0-9a-f]{3,8}$/i.test(s)||/^(rgb|rgba|hsl|hsla)\(/i.test(s)||/^[a-z]+$/i.test(s))?s:fallback;
  }
  function num(v,f,min,max){var n=Number(v);if(!Number.isFinite(n))n=f;if(min!=null)n=Math.max(min,n);if(max!=null)n=Math.min(max,n);return n;}
  function normalizeFont(v){
    var s=String(v||'Plus Jakarta Sans').replace(/\+/g,' ').trim();
    return ['Plus Jakarta Sans','Inter','Roboto','Montserrat','Oswald'].indexOf(s)!==-1?s:'Plus Jakarta Sans';
  }
  function settingsFromVenue(v){
    var d=v&&v.design_settings&&typeof v.design_settings==='object'?v.design_settings:{};
    return {
      template:d.template||'default',
      brand_color:safeColor(d.brand_color||v.brand_color,'#6366f1'),
      button_color:safeColor(d.button_color,'#8b5cf6'),
      header_color:safeColor(d.header_color,'#0f172a'),
      font_family:normalizeFont(d.font_family),
      hero_enabled:d.hero_enabled!==false,
      hero_style:d.hero_style||'gradient',
      card_style:d.card_style||'glass',
      card_radius:num(d.card_radius,18,0,40),
      button_radius:num(d.button_radius,12,0,40),
      button_style:d.button_style||'gradient',
      image_ratio:d.image_ratio||'4:3'
    };
  }
  function fontUrl(font){
    var map={'Plus Jakarta Sans':'Plus+Jakarta+Sans:wght@400;600;700;800','Inter':'Inter:wght@400;600;700;800','Roboto':'Roboto:wght@400;500;700;900','Montserrat':'Montserrat:wght@400;600;700;800','Oswald':'Oswald:wght@400;500;600;700'};
    return map[font]||map['Plus Jakarta Sans'];
  }
  function ensureFont(font){
    var link=document.getElementById('qr-menu-design-font');
    if(!link){link=document.createElement('link');link.id='qr-menu-design-font';link.rel='stylesheet';document.head.appendChild(link);}
    link.href='https://fonts.googleapis.com/css2?family='+fontUrl(font)+'&display=swap';
  }
  function heroBackground(d){
    var b=d.brand_color,u=d.button_color;
    if(d.hero_style==='dark')return 'linear-gradient(135deg,#020617,'+b+' 70%,#111827)';
    if(d.hero_style==='warm')return 'linear-gradient(135deg,'+b+','+u+' 65%,#f59e0b)';
    if(d.hero_style==='minimal')return d.header_color;
    return 'linear-gradient(135deg,'+b+','+u+' 55%,#ec4899)';
  }
  function cardCss(d){
    if(d.card_style==='soft')return 'background:rgba(255,255,255,.07);box-shadow:0 8px 24px rgba(0,0,0,.12);';
    if(d.card_style==='bold')return 'background:rgba(255,255,255,.06);box-shadow:0 10px 30px rgba(0,0,0,.22);border:1px solid '+d.brand_color+'66;';
    if(d.card_style==='flat')return 'background:transparent;box-shadow:none;border:1px solid rgba(148,163,184,.25);';
    return 'background:rgba(255,255,255,.035);backdrop-filter:blur(12px);';
  }
  function buttonCss(d){
    if(d.button_style==='solid')return 'background:'+d.button_color+' !important;color:#fff !important;border:0 !important;';
    if(d.button_style==='outline')return 'background:transparent !important;color:'+d.button_color+' !important;border:1px solid '+d.button_color+' !important;';
    return 'background:linear-gradient(90deg,'+d.brand_color+','+d.button_color+') !important;color:#fff !important;border:0 !important;';
  }
  function cssFor(d){
    var r=d.card_radius+'px',br=d.button_radius+'px',ratio=d.image_ratio==='1:1'?'1 / 1':'4 / 3';
    return ':root{--qr-design-brand:'+d.brand_color+' !important;--qr-design-button:'+d.button_color+' !important;--qr-design-header:'+d.header_color+' !important;}'+
      'body{font-family:"'+d.font_family+'",sans-serif !important;}'+
      '.topbar{background:'+d.header_color+' !important;}'+
      '.hero{border-radius:'+r+' !important;background:'+heroBackground(d)+' !important;color:'+(d.hero_style==='minimal'?'#111827':'#fff')+' !important;}'+
      '.dish,.menu-item,.order-card{border-radius:'+r+' !important;'+cardCss(d)+'}'+
      '.dish img{aspect-ratio:'+ratio+' !important;height:auto !important;}'+
      '.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button{border-radius:'+br+' !important;'+buttonCss(d)+'}'+
      '.price-pill{border-radius:'+br+' !important;}';
  }
  function directApply(d){
    document.documentElement.style.setProperty('--brand',d.brand_color);
    document.documentElement.style.setProperty('--qr-design-brand',d.brand_color);
    document.documentElement.style.setProperty('--qr-design-button',d.button_color);
    document.documentElement.style.setProperty('--qr-design-header',d.header_color);
    document.body.style.setProperty('font-family','"'+d.font_family+'",sans-serif','important');
    var top=document.querySelector('.topbar');if(top)top.style.setProperty('background',d.header_color,'important');
    var hero=document.querySelector('.hero');if(hero){hero.style.setProperty('background',heroBackground(d),'important');hero.style.setProperty('border-radius',d.card_radius+'px','important');hero.style.setProperty('display',d.hero_enabled?'':'none');hero.style.setProperty('color',d.hero_style==='minimal'?'#111827':'#fff','important');}
    document.querySelectorAll('.dish,.menu-item,.order-card').forEach(function(el){el.style.setProperty('border-radius',d.card_radius+'px','important');});
    document.querySelectorAll('.dish img').forEach(function(el){el.style.setProperty('aspect-ratio',d.image_ratio==='1:1'?'1 / 1':'4 / 3','important');el.style.setProperty('height','auto','important');});
    document.querySelectorAll('.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button').forEach(function(el){el.style.setProperty('border-radius',d.button_radius+'px','important');if(d.button_style==='solid'){el.style.setProperty('background',d.button_color,'important');el.style.setProperty('color','#fff','important');}else if(d.button_style==='outline'){el.style.setProperty('background','transparent','important');el.style.setProperty('color',d.button_color,'important');el.style.setProperty('border','1px solid '+d.button_color,'important');}else{el.style.setProperty('background','linear-gradient(90deg,'+d.brand_color+','+d.button_color+')','important');el.style.setProperty('color','#fff','important');}});
    document.querySelectorAll('.price-pill').forEach(function(el){el.style.setProperty('border-radius',d.button_radius+'px','important');});
  }
  function apply(d){
    if(!d)return;
    state.settings=d;
    ensureFont(d.font_family);
    if(state.style)state.style.remove();
    var style=document.createElement('style');style.id='qr-menu-design-runtime';style.textContent=cssFor(d);document.head.appendChild(style);state.style=style;
    directApply(d);
    document.documentElement.classList.add('md-design-applied');
  }
  window.__qrApplyMenuDesign=function(raw){apply(raw&&raw.brand_color?raw:settingsFromVenue(raw||{}));};
  function load(){
    var slug=new URLSearchParams(location.search).get('venue');
    if(!slug||!window.db||!window.db.rpc)return;
    window.db.rpc('public_venue_by_slug',{p_slug:slug}).then(function(r){
      if(r&&r.error)throw r.error;
      var v=Array.isArray(r&&r.data)?r.data[0]:r&&r.data;
      if(v)apply(settingsFromVenue(v));
    }).catch(function(e){console.warn('[QR menu design]',e&&e.message||e);});
  }
  function boot(){
    load();
    var tries=0;
    var timer=setInterval(function(){
      if(state.settings)directApply(state.settings);
      if(++tries>80)clearInterval(timer);
    },250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();