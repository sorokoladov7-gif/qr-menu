'use strict';

const {fail,api,venue,num,str,product,resolveProduct}=require('../context');

const TYPES=new Set(['create_product','update_product','update_product_price','delete_product']);

async function run(type,c,vid,p,e){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_MENU_ACTION:'+type,400);
  if(type==='create_product'){
    await venue(c,vid,'menu');
    const row=product(p);
    row.venue_id=vid;
    const max=Number(e.plan.max_products||0);
    if(max){
      const total=await api('products?venue_id=eq.'+encodeURIComponent(vid)+'&select=id',c.token);
      if((total||[]).length>=max)throw fail('PRODUCT_LIMIT_REACHED',403);
    }
    row.category=({'бургеры':'burger','бургер':'burger'})[String(row.category||'').toLowerCase()]||row.category||'main';
    const out=await api('products',c.token,'POST',row);
    return{type,status:'applied',result:Array.isArray(out)?out[0]:out};
  }

  await venue(c,vid,type==='update_product_price'?'price':'menu');
  const pid=await resolveProduct(c,p);
  const own=await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id,price&limit=1',c.token);
  if(!own?.[0])throw fail('PRODUCT_ACCESS_DENIED',403);

  if(type==='delete_product'){
    await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');
    return{type,status:'applied',result:{product_id:pid,deleted:true}};
  }

  const patch=type==='update_product_price'?{price:Number(p.price)}:product(p);
  if(patch.price!==undefined&&!Number.isFinite(Number(patch.price)))throw fail('PRODUCT_PRICE_INVALID',400);
  if(patch.price!==undefined){
    const next=Number(patch.price),old=Number(own[0].price);
    if(!Number.isFinite(next)||next<0)throw fail('PRODUCT_PRICE_INVALID',400);
    if(Number.isFinite(old)&&old>0&&(next<old*0.9||next>old*1.1))throw fail('PRODUCT_PRICE_CHANGE_LIMIT_EXCEEDED',400);
    patch.price=Math.round(next*100)/100;
  }
  await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch);
  return{type,status:'applied',result:{product_id:pid,fields:Object.keys(patch)}};
}

module.exports={TYPES,run};
