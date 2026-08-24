(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
if(window.__designRuntimeLoaded)return;
window.__designRuntimeLoaded=true;

var state={venue:null,style:null,appliedKey:''};
function color(v,f){var s=String(v==null?'':v).trim();return /^#[0-9a-f]{3,8}$/i.test(s)||/^(rgb|rgba|hsl|hsla)\(/i.test(s)||/^[a-z]+$/i.test(s)?s:f;}
function num(v,f,min,max){var n=Number(v);if(!Number.isFinite(n))n=f;if(min!=null)n=Math.max(min,n);if(max!=null)n=Math.min(max,n);return n;}
function font(v){return String(v||'Plus Jakarta Sans').replace(/\+/g,' ').trim();}
function normalize(v){
 var d=v&&v.design_settings&&typeof v.design_settings==='object'?v.design_settings:{};
 return {
  brand_color:color(d.brand_color||v.brand_color,'#6366f1'),
  button_color:color(d.button_color,'#8b5cf6'),
  button_text_color:color(d.button_text_color,'#ffffff'),
  header_color:color(d.header_color,'#0f172a'),
  background_color:color(d.background_color,'#0b1020'),
  card_background:color(d.card_background,'rgba(255,255,255,.035)'),
  text_color:color(d.text_color,'#e5e7eb'),
  border_color:color(d.border_color,'rgba(255,255,255,.1)'),
  border_width:num(d.border_width,1,0,8),
  card_radius:num(d.card_radius,18,0,50),
  button_radius:num(d.button_radius,12,0,50),
  card_padding:num(d.card_padding,12,0,40),
  card_image_height:num(d.card_image_height,130,60,400),
  font_family:font(d.font_family),
  font_size:num(d.font_size,16,10,30),
  body_weight:num(d.body_weight,400,300,900),
  heading_weight:num(d.heading_weight,700,300,900),
  button_weight:num(d.button_weight,700,300,900),
  line_height:num(d.line_height,1.6,1,2.5),
  letter_spacing:num(d.letter_spacing,0,-5,10),
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
  transition_speed:num(d.transition_speed,.2,0,.8)
 };
}
function heroBg(d){
 if(d.hero_style==='dark')return 'linear-gradient(135deg,'+d.gradient_start+','+d.brand_color+' 70%,'+d.gradient_end+')';
 if(d.hero_style==='warm')return 'linear-gradient(135deg,'+d.brand_color+','+d.button_color+' 65%,#f59e0b)';
 if(d.hero_style==='minimal')return d.header_color;
 return 'linear-gradient('+d.gradient_direction+','+d.brand_color+','+d.button_color+' 55%,'+d.gradient_end+')';
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
 return ':root{--brand:'+d.brand_color+' !important;--design-button:'+d.button_color+' !important;--design-header:'+d.header_color+' !important;}'+
 'html,body{background:'+d.background_color+' !important;color:'+d.text_color+' !important;font-family:"'+d.font_family+'",sans-serif !important;font-size:'+d.font_size+'px !important;line-height:'+d.line_height+' !important;}'+
 'body{font-weight:'+d.body_weight+' !important;letter-spacing:'+d.letter_spacing+'px !important;}'+
 '.topbar{background:'+d.header_color+' !important;border-color:'+d.border_color+' !important;}'+
 '.hero{display:'+(d.hero_enabled?'block':'none')+' !important;border-radius:'+radius+' !important;background:'+heroBg(d)+' !important;color:'+(d.hero_style==='minimal'?'#111827':'#fff')+' !important;}'+
 '.hero h2{font-weight:'+d.heading_weight+' !important;}'+
 '.dish,.menu-item,.order-card,.glass.card{border-radius:'+radius+' !important;background:'+cardBg(d)+' !important;border:'+d.border_width+'px solid '+d.border_color+' !important;}'+
 '.dish img{height:'+d.card_image_height+'px !important;aspect-ratio:'+ratio+' !important;object-fit:cover !important;}'+
 '.dish .body{padding:'+d.card_padding+'px !important;text-align:'+d.card_text_align+' !important;}'+
 '.dish b{font-weight:'+d.heading_weight+' !important;}'+
 '.dish .muted{display:'+(d.show_description?'block':'none')+' !important;}'+
 '.price-pill{display:'+(d.show_price?'inline-block':'none')+' !important;border-radius:'+br+' !important;}'+
 '.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button{border-radius:'+br+' !important;background:'+buttonBg(d)+' !important;color:'+d.button_text_color+' !important;font-weight:'+d.button_weight+' !important;border:'+((d.button_style==='outline'?d.border_width:0))+'px solid '+d.button_color+' !important;transition:'+d.transition_speed+'s !important;}'+
 '.chip{border-color:'+d.border_color+' !important;}'+
 '.modal .box{border-radius:'+radius+' !important;background:'+cardBg(d)+' !important;border-color:'+d.border_color+' !important;}';
}
function ensureFont(d){
 var id='design-runtime-font',old=document.getElementById(id);if(old)old.remove();
 var link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(d.font_family).replace(/%20/g,'+')+':wght@400;500;600;700;800&display=swap';document.head.appendChild(link);
}
function apply(v){
 if(!v)return;
 var d=normalize(v),key=JSON.stringify(d);
 if(key===state.appliedKey && document.getElementById('qr-design-live-style')){applyDirect(d);return;}
 state.appliedKey=key;state.venue=v;ensureFont(d);
 if(state.style)state.style.remove();
 var style=document.createElement('style');style.id='qr-design-live-style';style.textContent=css(d);document.head.appendChild(style);state.style=style;
 applyDirect(d);
}
function applyDirect(d){
 document.documentElement.style.setProperty('--brand',d.brand_color,'important');
 document.documentElement.style.setProperty('--design-button',d.button_color,'important');
 document.documentElement.style.setProperty('--design-header',d.header_color,'important');
 document.body.style.setProperty('background',d.background_color,'important');
 document.body.style.setProperty('color',d.text_color,'important');
 document.body.style.setProperty('font-family','"'+d.font_family+'",sans-serif','important');
 document.body.style.setProperty('font-size',d.font_size+'px','important');
 document.querySelectorAll('.topbar').forEach(function(x){x.style.setProperty('background',d.header_color,'important');x.style.setProperty('border-color',d.border_color,'important');});
 document.querySelectorAll('.hero').forEach(function(x){x.style.setProperty('display',d.hero_enabled?'block':'none','important');x.style.setProperty('background',heroBg(d),'important');x.style.setProperty('border-radius',d.card_radius+'px','important');});
 document.querySelectorAll('.dish,.menu-item,.order-card,.glass.card').forEach(function(x){x.style.setProperty('border-radius',d.card_radius+'px','important');x.style.setProperty('background',cardBg(d),'important');x.style.setProperty('border',d.border_width+'px solid '+d.border_color,'important');});
 document.querySelectorAll('.dish img').forEach(function(x){x.style.setProperty('height',d.card_image_height+'px','important');x.style.setProperty('aspect-ratio',d.image_ratio==='1:1'?'1 / 1':'4 / 3','important');});
 document.querySelectorAll('.dish .body').forEach(function(x){x.style.setProperty('padding',d.card_padding+'px','important');x.style.setProperty('text-align',d.card_text_align,'important');});
 document.querySelectorAll('.price-pill').forEach(function(x){x.style.setProperty('display',d.show_price?'inline-block':'none','important');x.style.setProperty('border-radius',d.button_radius+'px','important');});
 document.querySelectorAll('.add-btn,.btn-primary,.chip.on,.cartbar button,.reorder-bar button').forEach(function(x){x.style.setProperty('background',buttonBg(d),'important');x.style.setProperty('color',d.button_text_color,'important');x.style.setProperty('border-radius',d.button_radius+'px','important');x.style.setProperty('font-weight',d.button_weight,'important');});
}
function getVm(){try{var app=document.getElementById('app');return app&&app.__vue_app__&&app.__vue_app__._instance?app.__vue_app__._instance.proxy:null;}catch(e){return null;}}
function boot(){
 var n=0,t=setInterval(function(){
  var vm=getVm();
  if(vm&&vm.venue){apply(vm.venue);}
  if(++n>120)clearInterval(t);
 },250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();