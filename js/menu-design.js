(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
if(window.__qrMenuDesignRuntimeLoaded)return;
window.__qrMenuDesignRuntimeLoaded=true;

var state={settings:null,style:null,venueId:null};
function n(v,d,min,max){var x=Number(v);if(!Number.isFinite(x))x=d;if(min!=null)x=Math.max(min,x);if(max!=null)x=Math.min(max,x);return x;}
function color(v,d){var s=String(v==null?'':v).trim();return /^#[0-9a-f]{3,8}$/i.test(s)||/^(rgb|rgba|hsl|hsla)\(/i.test(s)||/^[a-z]+$/i.test(s)?s:d;}
function font(v){return String(v||'Plus+Jakarta+Sans').replace(/\+/g,' ');}
function settings(v){
 var d=v&&v.design_settings&&typeof v.design_settings==='object'?v.design_settings:{};
 return {
  brand_color:color(d.brand_color||v.brand_color,'#6366f1'),
  accent_color:color(d.accent_color,d.brand_color||'#8b5cf6'),
  button_color:color(d.button_color,'#8b5cf6'),
  button_text_color:color(d.button_text_color,'#ffffff'),
  header_color:color(d.header_color,'#0f172a'),
  background_color:color(d.background_color,'#0b1020'),
  card_background:color(d.card_background,'rgba(255,255,255,.035)'),
  text_color:color(d.text_color,'#e5e7eb'),
  border_color:color(d.border_color,'rgba(255,255,255,.1)'),
  border_width:n(d.border_width,1,0,8),
  border_radius:n(d.border_radius,d.card_radius||18,0,50),
  card_radius:n(d.card_radius,d.border_radius||18,0,50),
  button_radius:n(d.button_radius,12,0,50),
  card_padding:n(d.card_padding,12,0,40),
  card_image_height:n(d.card_image_height,130,60,400),
  font_family:font(d.font_family),
  font_size:n(d.font_size,16,10,30),
  body_weight:n(d.body_weight,400,300,900),
  heading_weight:n(d.heading_weight,700,300,900),
  button_weight:n(d.button_weight,700,300,900),
  line_height:n(d.line_height,1.6,1,2.5),
  letter_spacing:n(d.letter_spacing,0,-5,10),
  card_text_align:d.card_text_align||'left',
  show_price:d.show_price!==false,
  show_description:d.show_description!==false,
  image_ratio:d.image_ratio||'4:3',
  card_style:d.card_style||'glass',
  button_style:d.button_style||'gradient',
  hero_enabled:d.hero_enabled!==false,
  hero_style:d.hero_style||'gradient',
  gradient_start:color(d.gradient_start,'#0b1120'),
  gradient_end:color(d.gradient_end,'#0b1120'),
  gradient_direction:d.gradient_direction||'to right',
  category_style:d.category_style||'chips',
  transition_speed:n(d.transition_speed,.2,0,.8)
 };
}
function heroBg(d){
 if(d.hero_style==='dark')return 'linear-gradient(135deg,'+d.gradient_start+','+d.brand_color+' 70%,'+d.gradient_end+')';
 if(d.hero_style==='warm')return 'linear-gradient(135deg,'+d.brand_color+','+d.button_color+' 65%,#f59e0b)';
 if(d.hero_style==='minimal')return d.header_color;
 return 'linear-gradient('+d.gradient_direction+','+d.brand_color+','+d.button_color+' 55%,'+d.accent_color+')';
}
function buttonBg(d){
 if(d.button_style==='solid')return d.button_color;
 if(d.button_style==='outline')return 'transparent';
 return 'linear-gradient('+d.gradient_direction+','+d.brand_color+','+d.button_color+')';
}
function cardBg(d){
 if(d.card_style==='flat')return 'transparent';
 if(d.card_style==='soft')return d.card_background||'rgba(255,255,255,.07)';
 if(d.card_style==='bold')return d.card_background||'rgba(255,255,255,.06)';
 return d.card_background||'rgba(255,255,255,.035)';
}
function css(d){
 var radius=d.card_radius+'px',br=d.button_radius+'px',ratio=d.image_ratio==='1:1'?'1 / 1':'4 / 3';
 return ':root{--brand:'+d.brand_color+' !important;--qr-brand:'+d.brand_color+' !important;--qr-button:'+d.button_color+' !important;}'+
 'html,body{background:'+d.background_color+' !important;color:'+d.text_color+' !important;font-family:"'+d.font_family+'",sans-serif !important;font-size:'+d.font_size+'px !important;line-height:'+d.line_height+' !important;}'+
 '.topbar{background:'+d.header_color+' !important;border-color:'+d.border_color+' !important;}'+
 '.hero{display:'+(d.hero_enabled?'block':'none')+' !important;border-radius:'+radius+' !important;background:'+heroBg(d)+' !important;}'+
 '.hero h2{font-weight:'+d.heading_weight+' !important;}'+
 '.hero p,.muted{line-height:'+d.line_height+' !important;}'+
 '.dish,.menu-item,.order-card,.glass.card{border-radius:'+radius+' !important;background:'+cardBg(d)+' !important;border:'+d.border_width+'px solid '+d.border_color+' !important;padding:'+d.card_padding+'px !important;}'+
 '.dish img{height:'+d.card_image_height+'px !important;aspect-ratio:'+ratio+' !important;object-fit:cover !important;}'+
 '.dish .body{padding:'+d.card_padding+'px !important;text-align:'+d.card_text_align+' !important;}'+
 '.dish b{font-weight:'+d.heading_weight+' !important;}'+
 '.price-pill{display:'+(d.show_price?'inline-block':'none')+' !important;border-radius:'+br+' !important;}'+
 '.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button{border-radius:'+br+' !important;background:'+buttonBg(d)+' !important;color:'+d.button_text_color+' !important;font-weight:'+d.button_weight+' !important;border:'+((d.button_style==='outline'?d.border_width:0))+'px solid '+d.button_color+' !important;transition:'+d.transition_speed+'s !important;}'+
 '.add-btn:hover,.btn-primary:hover{transform:scale(1.02);}'+
 '.chip{border-color:'+d.border_color+' !important;}'+
 '.chips{gap:8px;}'+
 '.grid{gap:12px;}'+
 '.modal .box{border-radius:'+radius+'px !important;background:'+cardBg(d)+' !important;}';
}
function apply(d){
 state.settings=d;
 if(state.style)state.style.remove();
 var s=document.createElement('style');s.id='qr-menu-design-runtime';s.textContent=css(d);document.head.appendChild(s);state.style=s;
 document.documentElement.style.setProperty('--brand',d.brand_color,'important');
 document.body.style.setProperty('background',d.background_color,'important');
 document.body.style.setProperty('color',d.text_color,'important');
 document.body.style.setProperty('font-family','"'+d.font_family+'",sans-serif','important');
 document.querySelectorAll('.topbar').forEach(function(x){x.style.setProperty('background',d.header_color,'important');});
 document.querySelectorAll('.hero').forEach(function(x){x.style.setProperty('background',heroBg(d),'important');x.style.setProperty('border-radius',d.card_radius+'px','important');x.style.setProperty('display',d.hero_enabled?'block':'none','important');});
 document.querySelectorAll('.dish,.menu-item,.order-card,.glass.card').forEach(function(x){x.style.setProperty('border-radius',d.card_radius+'px','important');x.style.setProperty('background',cardBg(d),'important');x.style.setProperty('border',d.border_width+'px solid '+d.border_color,'important');});
 document.querySelectorAll('.dish img').forEach(function(x){x.style.setProperty('height',d.card_image_height+'px','important');});
 document.querySelectorAll('.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button').forEach(function(x){x.style.setProperty('background',buttonBg(d),'important');x.style.setProperty('color',d.button_text_color,'important');x.style.setProperty('border-radius',d.button_radius+'px','important');x.style.setProperty('font-weight',d.button_weight,'important');});
 document.documentElement.classList.add('qr-design-applied');
}
function load(){
 var q=new URLSearchParams(location.search),slug=q.get('venue');
 if(!slug)return;
 var wait=setInterval(function(){
  if(window.db&&window.db.rpc){clearInterval(wait);window.db.rpc('public_venue_by_slug',{p_slug:slug}).then(function(r){
   if(r&&r.error)throw r.error;
   var v=Array.isArray(r.data)?r.data[0]:r.data;
   if(!v)return;
   state.venueId=v.id;apply(settings(v));
  }).catch(function(e){console.warn('[QR design]',e&&e.message||e);});}
 },50);
 setTimeout(function(){clearInterval(wait);},10000);
}
function boot(){load();var count=0;var timer=setInterval(function(){if(state.settings)apply(state.settings);if(++count>120)clearInterval(timer);},250);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();