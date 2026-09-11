'use strict';

const {fail,rpc,venue,num,str,resolveProduct,resolveIngredient}=require('../context');

const TYPES=new Set(['attach_ingredients','create_tech_card','save_recipe']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_RECIPE_ACTION:'+type,400);
  await venue(c,vid,'menu');

  const pid=await resolveProduct(c,p);
  const rows=Array.isArray(p.rows)?p.rows:(Array.isArray(p.ingredients)?p.ingredients:[]);
  if(!rows.length)throw fail('RECIPE_ROWS_REQUIRED',400);
  const ids=new Set(),norm=[];
  for(const r of rows){
    const iid=await resolveIngredient(c,Object.assign({},r,{venue_id:vid}));
    const q=num(r.quantity,NaN);
    if(!iid||!Number.isFinite(q)||q<=0||ids.has(iid))throw fail('RECIPE_ROW_INVALID',400);
    ids.add(iid);
    norm.push({ingredient_id:iid,quantity:q,note:r.note?str(r.note,500):null});
  }
  return{type,status:'applied',result:await rpc('manager_product_recipe_save',{p_venue_id:vid,p_product_id:pid,p_rows:norm},c.token)};
}

module.exports={TYPES,run};
