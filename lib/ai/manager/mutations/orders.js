'use strict';

const {fail,venue,rpc,str}=require('../context');

const TYPES=new Set(['update_order']);
const STATUSES=new Set(['new','cooking','ready','delivery','arrived','done','cancelled','changed']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_ORDER_ACTION:'+type,400);
  // Order workflow is operational access to the selected venue, not venue-settings editing.
  await venue(c,vid);
  const oid=str(p.order_id,80);
  if(!oid)throw fail('ORDER_ID_REQUIRED',400);
  const status=str(p.status,30).toLowerCase();
  if(!STATUSES.has(status))throw fail('ORDER_STATUS_INVALID',400);
  return{type,status:'applied',result:await rpc('manager_update_order',{p_venue_id:vid,p_order_id:oid,p_status:status},c.token)};
}

module.exports={TYPES,STATUSES,run};
