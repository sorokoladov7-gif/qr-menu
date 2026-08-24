(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  if(window.__qrMenuDesignLoaded) return;
  window.__qrMenuDesignLoaded=true;

  var state={settings:null,style:null,venueId:null,slug:null};

  function safeColor(v,fallback){
    var s=String(v||'').trim();
    return /^#[0-9a-f]{3,8}$/i.test(s)||/^(rgb|rgba|hsl|hsla)\(/i.test(s)||/^[a-z]+$/i.test(s)?s:fallback;
  }
  function num(v,fallback,min,max){
    var n=Number(v);
    if(!Number.isFinite(n)) n=fallback;
    if(min!=null) n=Math.max(min,n);
    if(max!=null) n=Math.min(max,n);
    return n;
  }
  function settingsFromVenue(v){
    var d=v&&v.design_settings&&typeof v.design_settings==='object'?v.design_settings:{};
    return {
      template:d.template||'default',
      brand_color:safeColor(d.brand_color||v.brand_color,'#6366f1'),
      button_color:safeColor(d.button_color,'#8b5cf6'),
      header_color:safeColor(d.header_color,'#ffffff'),
      font_family:d.font_family||'Plus+Jakarta+Sans',
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
    var allowed={
      'Plus+Jakarta+Sans':'Plus+Jakarta+Sans:wght@400;600;700;800',
      'Inter':'Inter:wght@400;600;700;800',
      'Roboto':'Roboto:wght@400;500;700;900',
      'Montserrat':'Montserrat:wght@400;600;700;800',
      'Oswald':'Oswald:wght@400;500;600;700'
    };
    return allowed[font]||allowed['Plus+Jakarta+Sans'];
  }

  function ensureFont(font){
    var id='qr-menu-design-font';
    var link=document.getElementById(id);
    var href='https://fonts.googleapis.com/css2?family='+fontUrl(font)+'&display=swap';
    if(!link){
      link=document.createElement('link');
      link.id=id;link.rel='stylesheet';document.head.appendChild(link);
    }
    link.href=href;
  }

  function cssFor(d){
    var header=safeColor(d.header_color,'#ffffff');
    var brand=safeColor(d.brand_color,'#6366f1');
    var button=safeColor(d.button_color,'#8b5cf6');
    var radius=d.card_radius+'px';
    var bradius=d.button_radius+'px';
    var ratio=d.image_ratio==='1:1'?'1 / 1':'4 / 3';
    var hero='linear-gradient(135deg,'+brand+','+button+' 55%,#ec4899)';
    if(d.hero_style==='warm') hero='linear-gradient(135deg,'+brand+','+button+' 65%,#f59e0b)';
    if(d.hero_style==='dark') hero='linear-gradient(135deg,#020617,'+brand+' 70%,#111827)';
    if(d.hero_style==='minimal') hero=header;

    var card='';
    if(d.card_style==='soft') card='background:rgba(255,255,255,.07);box-shadow:0 8px 24px rgba(0,0,0,.12);';
    if(d.card_style==='bold') card='background:rgba(255,255,255,.06);box-shadow:0 10px 30px rgba(0,0,0,.22);border:1px solid '+brand+'66;';
    if(d.card_style==='flat') card='background:transparent;box-shadow:none;border:1px solid rgba(148,163,184,.25);';
    if(d.card_style==='glass') card='background:rgba(255,255,255,.035);backdrop-filter:blur(12px);';

    var buttonCss='';
    if(d.button_style==='solid') buttonCss='background:'+button+' !important;';
    else if(d.button_style==='outline') buttonCss='background:transparent !important;color:'+button+' !important;border:1px solid '+button+' !important;';
    else buttonCss='background:linear-gradient(90deg,'+brand+','+button+') !important;';

    return `
      :root{--qr-design-brand:${brand};--qr-design-button:${button};--qr-design-header:${header};--qr-design-radius:${radius};--qr-design-button-radius:${bradius};}
      body{font-family:'${d.font_family.replace(/'/g,"\\'")}',sans-serif !important;}
      .topbar{background:${header} !important;}
      .hero{border-radius:${radius} !important;--brand:${brand} !important;background:${hero} !important;${d.hero_style==='minimal'?'color:#111827 !important;':''}}
      .hero h2{text-shadow:${d.hero_style==='minimal'?'none':'0 2px 8px rgba(0,0,0,.3)'} !important;}
      .hero p{color:inherit !important;}
      .dish,.menu-item,.order-card{border-radius:${radius} !important;${card}}
      .dish img{aspect-ratio:${ratio} !important;height:auto !important;}
      .add-btn{border-radius:${bradius} !important;${buttonCss}}
      .chip.on{border-radius:${bradius} !important;${buttonCss}}
      .btn-primary{border-radius:${bradius} !important;${buttonCss}}
      .btn-green{border-radius:${bradius} !important;}
      .price-pill{border-radius:${bradius} !important;}
      .cartbar button,.reorder-bar button{border-radius:${bradius} !important;${buttonCss}}
      .md-design-applied{--qr-design-brand:${brand};}
    `;
  }

  function apply(d){
    if(!d) return;
    state.settings=d;
    ensureFont(d.font_family);
    if(state.style) state.style.remove();
    var style=document.createElement('style');
    style.id='qr-menu-design-runtime';
    style.textContent=cssFor(d);
    document.head.appendChild(style);
    state.style=style;

    var hero=document.querySelector('.hero');
    if(hero){
      hero.style.setProperty('--brand',d.brand_color,'important');
      hero.style.setProperty('border-radius',d.card_radius+'px','important');
      hero.style.display=d.hero_enabled===false?'none':'';
    }
    document.documentElement.classList.add('md-design-applied');
  }

  function load(){
    var slug=new URLSearchParams(location.search).get('venue');
    if(!slug||typeof window.db==='undefined'||!window.db.rpc) return;
    state.slug=slug;
    window.db.rpc('public_venue_by_slug',{p_slug:slug}).then(function(r){
      if(r&&r.error) throw r.error;
      var v=Array.isArray(r&&r.data)?r.data[0]:r&&r.data;
      if(!v) return;
      state.venueId=v.id;
      apply(settingsFromVenue(v));
    }).catch(function(e){console.warn('[QR menu design]',e&&e.message||e);});
  }

  function boot(){
    load();
    var tries=0;
    var timer=setInterval(function(){
      var hero=document.querySelector('.hero');
      if(hero&&state.settings){
        apply(state.settings);
        if(++tries>12) clearInterval(timer);
      }else if(++tries>40){
        clearInterval(timer);
      }
    },250);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();