'use strict';

const {fail,api,venue,str}=require('../context');

const TYPES=new Set(['update_order']);
const STATUSES=new Set(['new','cooking','ready','delivery','arrived','done','cancelled','changed']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_ORDER_ACTION:'+type,400);
  await venue(c,vid,'venue');
  const oid=str(p.order_id,80);
  if(!oid)throw fail('ORDER_ID_REQUIRED',400);
  const own=await api('orders?id=eq.'+encodeURIComponent(oid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id&limit=1',c.token);
  if(!own?.[0])throw fail('ORDER_ACCESS_DENIED',403);
  const status=str(p.status,30);
  if(!STATUSES.has(status))throw fail('ORDER_STATUS_INVALID',400);
  const patch={status};
  if(status==='cooking')patch.cooking_started_at=new Date().toISOString();
  if(status==='ready')patch.ready_at=new Date().toISOString();
  return{type,status:'applied',result:await api('orders?id=eq.'+encodeURIComponent(oid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch)};
}

module.exports={TYPES,STATUSES,run};
