'use strict';

const {fail,api,venue,rpc,num,str,resolveIngredient}=require('../context');

const TYPES=new Set(['create_ingredient','update_ingredient','delete_ingredient']);
const UNITS=['g','kg','ml','l','pcs'];

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_INGREDIENT_ACTION:'+type,400);
  await venue(c,vid,'menu');

  if(type==='create_ingredient'){
    const name=str(p.name,220);
    if(!name)throw fail('INGREDIENT_NAME_REQUIRED',400);
    const unit=UNITS.includes(str(p.unit,10))?str(p.unit,10):'g';
    return{type,status:'applied',result:await rpc('manager_ingredient_upsert',{p_venue_id:vid,p_name:name,p_unit:unit,p_purchase_quantity:num(p.purchase_quantity,1),p_purchase_price:num(p.purchase_price,0),p_id:null},c.token)};
  }

  const iid=await resolveIngredient(c,Object.assign({},p,{venue_id:vid}));
  if(type==='delete_ingredient'){
    return{type,status:'applied',result:await rpc('manager_ingredient_delete',{p_venue_id:vid,p_ingredient_id:iid},c.token)};
  }

  const old=(await api('ingredients?id=eq.'+encodeURIComponent(iid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=name,unit,purchase_quantity,purchase_price&limit=1',c.token))?.[0];
  if(!old)throw fail('INGREDIENT_ACCESS_DENIED',403);
  const unit=p.unit===undefined?old.unit:(UNITS.includes(str(p.unit,10))?str(p.unit,10):old.unit);
  return{type,status:'applied',result:await rpc('manager_ingredient_upsert',{p_venue_id:vid,p_name:p.name===undefined?old.name:str(p.name,220),p_unit:unit,p_purchase_quantity:p.purchase_quantity===undefined?Number(old.purchase_quantity||1):num(p.purchase_quantity,1),p_purchase_price:p.purchase_price===undefined?Number(old.purchase_price||0):num(p.purchase_price,0),p_id:iid},c.token)};
}

module.exports={TYPES,run};
