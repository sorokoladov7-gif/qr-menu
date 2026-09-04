/* QR Menu — public modifier selector and order persistence. */
(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  if(window.__QR_MENU_MODIFIERS__) return;
  window.__QR_MENU_MODIFIERS__=true;

  var state={product:null,groups:[],selected:{},busy:false};
  var originalRpc=null;

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}
  function money(v){return Number(v||0).toLocaleString('ru-RU');}
  function vm(){var el=document.getElementById('app');return el&&el.__vueParentComponent&&el.__vueParentComponent.proxy?el.__vueParentComponent.proxy:null;}
  function close(){var x=document.getElementById('qr-modifier-modal');if(x)x.remove();state.product=null;state.groups=[];state.selected={};}
  function selectedCount(g){var n=0; (g.items||[]).forEach(function(m){n+=Number(state.selected[m.id]||0);});return n;}
  function selectedPrice(){var n=0;(state.groups||[]).forEach(function(g){(g.items||[]).forEach(function(m){n+=(Number(m.price)||0)*Number(state.selected[m.id]||0);});});return n;}
  function render(){
    var modal=document.getElementById('qr-modifier-modal');if(!modal)return;
    var body=modal.querySelector('[data-modifier-body]');if(!body)return;
    var html='';
    state.groups.forEach(function(g){
      var count=selectedCount(g), min=Number(g.min_count)||0,max=Number(g.max_count)||0;
      html+='<section style="margin:0 0 16px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px">';
      html+='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px"><b>'+esc(g.name)+'</b><span style="font-size:11px;color:'+(min>0&&count<min?'#f87171':'#94a3b8')+'">'+(min>0?'обязательно · минимум '+min:'необязательно')+(max>0?' · максимум '+max:'')+'</span></div>';
      (g.items||[]).forEach(function(m){
        var q=Number(state.selected[m.id]||0),disabled=max>0&&count>=max&&q===0;
        html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.05)">';
        if(m.image_url) html+='<img src="'+esc(m.image_url)+'" style="width:42px;height:42px;object-fit:cover;border-radius:10px">';
        html+='<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">'+esc(m.name)+'</div><div style="font-size:12px;color:#94a3b8">'+(Number(m.price)>0?'+'+money(m.price)+' ₽':'Без доплаты')+'</div></div>';
        html+='<div style="display:flex;align-items:center;gap:5px"><button data-dec="'+esc(m.id)+'" class="btn btn-ghost btn-sm" '+(q?'':'disabled')+'>−</button><b style="min-width:20px;text-align:center">'+q+'</b><button data-inc="'+esc(m.id)+'" class="btn btn-ghost btn-sm" '+(disabled?'disabled':'')+'>+</button></div></div>';
      });
      html+='</section>';
    });
    if(!html) html='<div style="padding:20px;text-align:center;color:#94a3b8">Для этого блюда модификаторы не настроены.</div>';
    body.innerHTML=html;
    var total=modal.querySelector('[data-modifier-total]');if(total)total.textContent=money(selectedPrice())+' ₽';
    var add=modal.querySelector('[data-modifier-add]');if(add){var invalid=state.groups.some(function(g){return (Number(g.min_count)||0)>selectedCount(g);});add.disabled=invalid||state.busy;add.textContent=invalid?'Выберите обязательные варианты':('Добавить · '+money((Number(state.product.price)||0)+selectedPrice())+' ₽');}
  }
  function open(p){
    var v=vm();if(!v||!v.venue||!p)return;
    state.product=p;state.busy=true;state.selected={};
    var modal=document.createElement('div');modal.id='qr-modifier-modal';modal.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML='<div style="width:min(560px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-size:20px;font-weight:800">'+esc(p.name)+'</div><div style="color:#a5b4fc;font-weight:800;margin-top:4px">'+money(p.price)+' ₽</div></div><button data-close class="btn btn-ghost btn-sm">✕</button></div>'+
      '<div data-modifier-body style="margin-top:16px"><div style="text-align:center;color:#94a3b8;padding:30px">Загрузка вариантов…</div></div>'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid rgba(255,255,255,.08);padding-top:12px;margin-top:4px"><span class="muted">Модификаторы: <b data-modifier-total>0 ₽</b></span><button data-modifier-add class="btn btn-primary" style="flex:1">Добавить</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=close;
    modal.addEventListener('click',function(e){if(e.target===modal)close();var inc=e.target.closest('[data-inc]');var dec=e.target.closest('[data-dec]');if(inc){var id=inc.getAttribute('data-inc');state.selected[id]=(Number(state.selected[id])||0)+1;render();}if(dec){var id2=dec.getAttribute('data-dec');state.selected[id2]=Math.max(0,(Number(state.selected[id2])||0)-1);render();}});
    modal.querySelector('[data-modifier-add]').onclick=function(){addToCart();};
    db.from('modifier_groups').select('*').eq('product_id',p.id).eq('is_active',true).order('sort_order').then(function(r){
      if(r.error)throw r.error;state.groups=r.data||[];return db.from('modifiers').select('*').eq('product_id',p.id).eq('is_active',true).order('sort_order');
    }).then(function(r){
      if(r.error)throw r.error;var by={};(r.data||[]).forEach(function(m){(by[m.modifier_group_id]||(by[m.modifier_group_id]=[])).push(m);});state.groups.forEach(function(g){g.items=by[g.id]||[];});state.busy=false;render();
    }).catch(function(e){console.warn('[QR modifiers]',e);state.busy=false;state.groups=[];render();});
  }
  function addToCart(){
    var v=vm();if(!v||!state.product)return;
    var invalid=state.groups.some(function(g){return (Number(g.min_count)||0)>selectedCount(g);});if(invalid)return;
    var mods=[];state.groups.forEach(function(g){(g.items||[]).forEach(function(m){var q=Number(state.selected[m.id]||0);if(q>0)mods.push({modifier_id:m.id,name:m.name,price:Number(m.price)||0,qty:q,group_id:g.id,group_name:g.name});});});
    var f=v.cart.find(function(i){return i.id===state.product.id;});
    if(f){f.qty++;mods.forEach(function(m){var x=(f.modifiers||[]).find(function(z){return z.modifier_id===m.modifier_id;});if(x)x.qty+=m.qty;else (f.modifiers||(f.modifiers=[])).push(m);});}
    else v.cart.push({id:state.product.id,name:state.product.name,price:Number(state.product.price)||0,qty:1,addons:[],modifiers:mods});
    close();
  }
  function installRpcPatch(){
    if(!window.db||typeof db.rpc!=='function'||db.__qrModifierRpcPatch)return !!(db&&db.__qrModifierRpcPatch);
    originalRpc=db.rpc.bind(db);
    db.rpc=async function(name,params,options){
      if(name==='create_public_order'&&params&&Array.isArray(params.p_items)){
        var cartMods={};
        var v=vm();if(v&&Array.isArray(v.cart))v.cart.forEach(function(i){if(i.modifiers&&i.modifiers.length)cartMods[i.id]=i.modifiers;});
        params=Object.assign({},params,{p_items:params.p_items.map(function(i){return Object.assign({},i,{modifiers:cartMods[i.product_id]||[]});})});
        var result=await originalRpc(name,params,options);
        if(result&&result.error)return result;
        var order=result&&result.data&&result.data.id?result.data:(result&&result.data&&result.data.order?result.data.order:null);
        if(order&&order.id&&Object.keys(cartMods).length){
          var attached=await originalRpc('public_attach_order_modifiers',{p_order_id:order.id,p_phone:params.p_customer_phone,p_items:params.p_items},options);
          if(attached&&attached.error)return attached;
          if(attached&&attached.data&&typeof attached.data==='object'){
            result.data=Object.assign({},order,{total_price:attached.data.total_price,modifier_total:attached.data.modifier_total});
          }
        }
        return result;
      }
      return originalRpc(name,params,options);
    };
    db.__qrModifierRpcPatch=true;return true;
  }
  function install(){
    installRpcPatch();
    document.addEventListener('click',function(e){
      var dish=e.target.closest&&e.target.closest('.dish');if(!dish)return;
      var v=vm();if(!v||!v.products)return;
      var p=v.products.find(function(x){return x.id===dish.__qrProductId;});
      if(!p){var cards=Array.from(document.querySelectorAll('.dish'));var idx=cards.indexOf(dish);p=v.filtered&&v.filtered[idx];}
      if(!p)return;
      e.preventDefault();e.stopImmediatePropagation();open(p);
    },true);
    var obs=new MutationObserver(function(){installRpcPatch();});obs.observe(document.body,{childList:true,subtree:true});
  }
  var tries=0;var t=setInterval(function(){tries++;if(installRpcPatch()||tries>100){clearInterval(t);if(document.body)install();}},100);
})();
