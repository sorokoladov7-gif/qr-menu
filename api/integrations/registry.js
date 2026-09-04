'use strict';

const PROVIDERS={
  iiko:{name:'iiko',category:'POS',mode:'api',implemented:true},
  quick_resto:{name:'Quick Resto',category:'POS',mode:'api_login_password',implemented:true},
  r_keeper:{name:'r_keeper',category:'POS',mode:'delivery_api',implemented:true},
  poster:{name:'Poster',category:'POS',mode:'oauth',implemented:false},
  evotor:{name:'Эвотор',category:'POS',mode:'oauth',implemented:false},
  onec:{name:'1С',category:'Учет',mode:'http_exchange',implemented:false},
  tillypad:{name:'Tillypad',category:'POS',mode:'adapter',implemented:false},
  frontol:{name:'Frontol',category:'POS',mode:'adapter',implemented:false}
};
function getProvider(id){return PROVIDERS[String(id||'').trim()]||null}
module.exports={PROVIDERS,getProvider};
