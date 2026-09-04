'use strict';

/* Canonical provider registry. `implemented` means a real backend adapter exists. */
const PROVIDERS={
  iiko:{name:'iiko',category:'POS',mode:'api',implemented:true},
  r_keeper:{name:'r_keeper',category:'POS',mode:'delivery_api',implemented:true},
  quick_resto:{name:'Quick Resto',category:'POS',mode:'api_login_password',implemented:true},
  saby_presto:{name:'Saby Presto',category:'POS',mode:'api_service_auth',implemented:false},
  yuma:{name:'YUMA',category:'POS',mode:'api',implemented:false},
  poster:{name:'Poster',category:'POS',mode:'api',implemented:false},
  syrve:{name:'Syrve',category:'POS',mode:'api',implemented:false},
  tillypad:{name:'Tillypad',category:'POS',mode:'adapter',implemented:false},
  evotor:{name:'Эвотор',category:'POS',mode:'api',implemented:false},
  frontol:{name:'Frontol',category:'POS',mode:'adapter',implemented:false},
  frontpad:{name:'FrontPad',category:'POS',mode:'api',implemented:false},
  fast_operator:{name:'Fast Operator',category:'POS',mode:'api',implemented:false},
  jowi:{name:'Jowi',category:'POS',mode:'api',implemented:false},
  smarttouch:{name:'SmartTouch',category:'POS',mode:'api',implemented:false},
  traktir:{name:'Трактиръ',category:'POS',mode:'adapter',implemented:false},
  restik:{name:'Restik',category:'POS/CRM',mode:'api',implemented:false},
  paladin:{name:'Paladin',category:'POS',mode:'adapter',implemented:false},
  parus_restaurant:{name:'Парус-Ресторан',category:'POS/Учет',mode:'adapter',implemented:false},
  kontur_market:{name:'Контур.Маркет: Общепит',category:'Учет/POS',mode:'api',implemented:false},
  onec:{name:'1С: Ресторан / Общепит / 1С-Рарус',category:'Учет',mode:'http_exchange',implemented:false}
};
function getProvider(id){return PROVIDERS[String(id||'').trim()]||null}
module.exports={PROVIDERS,getProvider};
