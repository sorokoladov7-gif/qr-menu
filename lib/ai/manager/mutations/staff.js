'use strict';

const {fail,api,venue,rpc,str,resolveStaff}=require('../context');

const TYPES=new Set(['create_staff','reset_staff_pin','delete_staff']);
const STAFF_TYPES=new Set(['cook','waiter','courier']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_STAFF_ACTION:'+type,400);
  // Staff management is scoped by manager_venues, not by venue-edit permission.
  await venue(c,vid);

  if(type==='create_staff'){
    const st=str(p.type,20);
    if(!STAFF_TYPES.has(st))throw fail('STAFF_TYPE_INVALID',400);
    const pin=str(p.pin,10);
    if(!/^\d{4}$/.test(pin))throw fail('STAFF_PIN_INVALID',400);
    return{type,status:'applied',result:await rpc('manager_create_staff',{p_venue_id:vid,p_type:st,p_name:str(p.name,220),p_phone:str(p.phone,80)||null,p_pin:pin},c.token)};
  }

  // The manager UI already supplies the staff id and role. Do not perform an
  // additional REST lookup here: staff-table RLS may intentionally hide rows
  // from the manager JWT. The scoped SECURITY DEFINER RPC performs the
  // authoritative venue/type/id check and mutation.
  const sid=str(p.staff_id,80);
  if(!sid)throw fail('STAFF_ID_REQUIRED',400);
  const st=STAFF_TYPES.has(str(p.type,20))?str(p.type,20):'';
  if(!st)throw fail('STAFF_TYPE_REQUIRED',400);
  if(type==='reset_staff_pin')return{type,status:'applied',result:await rpc('manager_reset_staff_pin',{p_venue_id:vid,p_staff_id:sid,p_type:st},c.token)};
  return{type,status:'applied',result:await rpc('manager_delete_staff',{p_venue_id:vid,p_staff_id:sid,p_type:st},c.token)};
}

module.exports={TYPES,run};
