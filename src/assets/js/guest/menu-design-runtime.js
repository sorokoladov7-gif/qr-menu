(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  var applied=null;
  var styleId='qr-menu-design-runtime';
  function hex(v,f){return /^#[0-9a-f]{6}$/i.test(String(v||''))?v:f;}
  function settings(v){
    var d=(v&&v.design_settings)||{};
    return Object.assign({
      brand_color:(v&&v.brand_color)||'#6366f1',button_color:'#8b5cf6',header_color:'#ffffff',
      font_family:'Plus+Jakarta+Sans',hero_enabled:true,hero_style:'gradient',card_style:'glass',
      card_radius:18,button_radius:12,button_style:'gradient',image_ratio:'4:3',category_style:'chips'
    },d);
  }
  function css(d){
    var brand=hex(d.brand_color,'#6366f1'),button=hex(d.button_color,'#8b5cf6'),header=hex(d.header_color,'#ffffff');
    var font=String(d.font_family||'Plus+Jakarta+Sans').replace(/\+/g,' ');
    var cr=Math.max(0,Math.min(40,Number(d.card_radius)||18));
    var br=Math.max(0,Math.min(40,Number(d.button_radius)||12));
    var bs=d.button_style||'gradient', ratio=d.image_ratio||'4:3';
    var imgH=ratio==='1:1'?'auto':ratio==='16:9'?'auto':'130px';
    var ratioRule=ratio==='1:1'?'aspect-ratio:1/1;height:auto;':ratio==='16:9'?'aspect-ratio:16/9;height:auto;':'';
    var buttonBg=bs==='solid'?button:bs==='outline'?'transparent':'linear-gradient(90deg,'+brand+','+button+')';
    var buttonExtra=bs==='outline'?'border:1px solid '+button+';color:'+button+';':'color:#fff;';
    var cardBg=d.card_style==='flat'?'rgba(255,255,255,.02)':d.card_style==='soft'?'rgba(255,255,255,.055)':d.card_style==='bold'?'rgba(255,255,255,.07)':'rgba(255,255,255,.035)';
    var cardBorder=d.card_style==='bold'?brand:'rgba(255,255,255,.1)';
    var hero='';
    if(d.hero_style==='warm') hero='linear-gradient(135deg,'+brand+',#f59e0b)';
    else if(d.hero_style==='dark') hero='linear-gradient(135deg,#020617,'+brand+')';
    else if(d.hero_style==='minimal') hero='linear-gradient(135deg,'+header+','+header+')';
    else hero='linear-gradient(135deg,'+brand+','+button+' 55%,#ec4899)';
    var textColor=d.hero_style==='minimal'?'#111827':'#fff';
    var s=document.getElementById(styleId);
    if(!s){s=document.createElement('style');s.id=styleId;document.head.appendChild(s);}
    s.textContent=':root{--qr-brand:'+brand+';--qr-button:'+button+';--qr-header:'+header+';--qr-card-radius:'+cr+'px;--qr-button-radius:'+br+'px;--qr-font:'+font+';}'+
      'body{font-family:"'+font+'",sans-serif;} .topbar{background:'+header+';}'+
      '.hero{border-radius:'+cr+'px;background:'+hero+';color:'+textColor+';}'+
      '.chip{border-radius:'+br+'px;} .chip.on{background:'+buttonBg+';'+(bs==='outline'?'color:'+button+';':'')+'}'+
      '.dish{border-radius:'+cr+'px;background:'+cardBg+';border-color:'+cardBorder+';}'+
      '.dish img{'+ratioRule+'object-fit:cover;}'+
      '.add-btn{border-radius:'+br+'px;background:'+buttonBg+';'+buttonExtra+'}'+
      '.price-pill{border-radius:'+br+'px;background:linear-gradient(90deg,'+brand+','+button+');}'+
      '.cartbar button,.reorder-bar button{border-radius:'+br+'px;background:'+buttonBg+';'+buttonExtra+'}'+
      '.glass{border-radius:'+cr+'px;}'+
      (d.hero_enabled===false?'.hero{display:none!important;}':'');
    applied=d;
  }
  function apply(){
    try{
      var root=document.getElementById('app');
      var vm=root&&root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy;
      var v=vm&&vm.venue;
      if(v)css(settings(v));
    }catch(e){console.warn('[Menu Design]',e);}
  }
  var tries=0;
  var timer=setInterval(function(){apply();if(++tries>120)clearInterval(timer);},250);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
