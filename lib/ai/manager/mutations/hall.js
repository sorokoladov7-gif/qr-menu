'use strict';

const {fail,rpc,venue,num,str}=require('../context');

const TYPES=new Set(['create_table','update_table','move_table','delete_table','regenerate_table_qr','set_table_status','seat_table','set_table_reservation_guest','close_table_session','save_hall_plan','delete_hall_plan']);
const SHAPES=new Set(['round','square','rectangle']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_HALL_ACTION:'+type,400);
  await venue(c,vid,'venue');
  const tid=str(p.table_id,80);
  if(type!=='create_table'&&!tid)throw fail('TABLE_ID_REQUIRED',400);

  let out;
  if(type==='create_table')out=await rpc('manager_create_table',{p_venue_id:vid,p_number:num(p.number,null),p_name:str(p.name,120),p_shape:SHAPES.has(str(p.shape,20))?str(p.shape,20):'round',p_seats:num(p.seats,4),p_x:num(p.x,80),p_y:num(p.y,80)},c.token);
  else if(type==='update_table')out=await rpc('manager_update_table',{p_venue_id:vid,p_table_id:tid,p_number:num(p.number,null),p_name:str(p.name,120),p_shape:SHAPES.has(str(p.shape,20))?str(p.shape,20):'round',p_seats:num(p.seats,4),p_active:p.active!==false},c.token);
  else if(type==='move_table')out=await rpc('manager_move_table',{p_venue_id:vid,p_table_id:tid,p_x:num(p.x,80),p_y:num(p.y,80)},c.token);
  else if(type==='delete_table')out=await rpc('manager_delete_table',{p_venue_id:vid,p_table_id:tid},c.token);
  else if(type==='regenerate_table_qr')out=await rpc('manager_regenerate_table_qr',{p_venue_id:vid,p_table_id:tid},c.token);
  else if(type==='set_table_status')out=await rpc('manager_set_table_status',{p_venue_id:vid,p_table_id:tid,p_status:str(p.status,30)||'free',p_reserved_until:p.reserved_until||null,p_note:p.guest_name||null},c.token);
  else if(type==='seat_table')out=await rpc('manager_seat_table',{p_venue_id:vid,p_table_id:tid,p_guest_count:num(p.guest_count,1),p_guest_name:str(p.guest_name,220),p_guest_phone:str(p.phone||p.guest_phone,80)},c.token);
  else if(type==='set_table_reservation_guest')out=await rpc('manager_set_table_reservation_guest',{p_venue_id:vid,p_table_id:tid,p_guest_name:str(p.guest_name,220),p_guest_phone:str(p.phone||p.guest_phone,80)},c.token);
  else if(type==='close_table_session')out=await rpc('manager_close_table_session',{p_venue_id:vid,p_table_id:tid},c.token);
  else if(type==='save_hall_plan')out=await rpc('manager_save_hall_plan',{p_venue_id:vid,p_image_data:str(p.image_data||p.data,2000000),p_image_name:str(p.image_name||p.name||'hall-plan',220),p_image_width:num(p.image_width,p.width?num(p.width,1200):1200),p_image_height:num(p.image_height,p.height?num(p.height,800):800)},c.token);
  else if(type==='delete_hall_plan')out=await rpc('manager_delete_hall_plan',{p_venue_id:vid},c.token);

  return{type,status:'applied',result:out};
}

module.exports={TYPES,SHAPES,run};
