'use strict';

const {fail,api,venue,rpc,str,resolveStaff}=require('../context');

const TYPES=new Set(['create_staff','reset_staff_pin','delete_staff']);
const STAFF_TYPES=new Set(['cook','waiter','courier']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_STAFF_ACTION:'+type,400);
  await venue(c,vid,'venue');

  if(type==='create_staff'){
    const st=str(p.type,20);
    if(!STAFF_TYPES.has(st))throw fail('STAFF_TYPE_INVALID',400);
    const pin=str(p.pin,10);
    if(!/^\d{4}$/.test(pin))throw fail('STAFF_PIN_INVALID',400);
    return{type,status:'applied',result:await rpc('manager_create_staff',{p_venue_id:vid,p_type:st,p_name:str(p.name,220),p_phone:str(p.phone,80)||null,p_pin:pin},c.token)};
  }

  const sid=await resolveStaff(c,p);
  const st=STAFF_TYPES.has(str(p.type,20))?str(p.type,20):'';
  if(!st)throw fail('STAFF_TYPE_REQUIRED',400);
  const table=st==='cook'?'cooks':st==='courier'?'couriers':'waiters';
  const own=await api(table+'?id=eq.'+encodeURIComponent(sid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id&limit=1',c.token);
  if(!own?.[0])throw fail('STAFF_ACCESS_DENIED',403);
  if(type==='reset_staff_pin')return{type,status:'applied',result:await rpc('manager_reset_staff_pin',{p_venue_id:vid,p_staff_id:sid,p_type:st},c.token)};
  await api(table+'?id=eq.'+encodeURIComponent(sid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');
  return{type,status:'applied',result:{staff_id:sid,type:st,deleted:true}};
}

module.exports={TYPES,run};
