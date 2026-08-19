/**
 * staff-auth.js — единая сессия персонала (повар/курьер/официант)
 * Подключать ПЕРЕД config.js. Заменяет 5 разрозненных ключей на один.
 */
(function(){
'use strict';
var STORAGE_KEY='qr_staff_session';

function get(){
  try{
    var raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    var s=JSON.parse(raw);
    if(!s||typeof s.token!=='string'||!s.type||!s.venueId)return null;
    if(s.expiresAt&&Date.now()>s.expiresAt){clear();return null;}
    return s;
  }catch(e){return null;}
}

function set(data){
  clear();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function clear(){
  localStorage.removeItem(STORAGE_KEY);
  ['cook_token','waiter_token','courier_token','staff_token',
   'cook_login_context','waiter_login_context','courier_login_context'
  ].forEach(function(k){localStorage.removeItem(k);});
}

function token(){var s=get();return s?s.token:null;}

function isExpired(){
  var s=get();
  if(!s)return true;
  if(!s.expiresAt)return false;
  return Date.now()>s.expiresAt;
}

window.StaffAuth={
  get:get,set:set,clear:clear,token:token,isExpired:isExpired,
  login:function(type,d){
    if(!d||!d.token)return false;
    set({token:d.token,type:type,venueId:d.venueId,staffId:d.staffId,
         venueName:d.venueName||'',staffName:d.staffName||'',
         expiresAt:d.expiresAt||(Date.now()+12*60*60*1000)});
    return true;
  },
  logout:function(){clear();location.reload();},
  requireSession:function(){
    var s=get();
    if(!s){showLogin('Сессия не найдена. Войдите заново.');return null;}
    if(isExpired()){clear();showLogin('Сессия истекла. Войдите заново.');return null;}
    return s;
  }
};

function showLogin(reason){
  if(document.getElementById('staff-auth-expired'))return;
  var o=document.createElement('div');
  o.id='staff-auth-expired';
  o.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px';
  o.innerHTML='<div style="background:#1f2937;border-radius:16px;padding:32px;max-width:360px;width:100%;text-align:center;color:#fff">'+
    '<div style="font-size:48px;margin-bottom:12px">🔒</div>'+
    '<h2 style="margin:0 0 8px;font-size:20px">'+(reason||'Сессия истекла')+'</h2>'+
    '<p style="color:#94a3b8;font-size:14px;margin-bottom:20px">Для продолжения войдите снова</p>'+
    '<button id="staff-auth-login-btn" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer">Войти заново</button>'+
    '</div>';
  document.body.appendChild(o);
  document.getElementById('staff-auth-login-btn').onclick=function(){clear();location.reload();};
}

setInterval(function(){
  if(isExpired()){clear();showLogin('Сессия истекла по времени');}
},60000);
})();
