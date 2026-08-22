(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
var root=document.getElementById('app');
var currentTable=null;

function getVM(){
  if(!root)return null;
  try{
    if(root.__vueParentComponent&&root.__vueParentComponent.proxy)return root.__vueParentComponent.proxy;
    if(root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy)return root.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}
function token(){return new URLSearchParams(location.search).get('token')||'';}
function tableText(t){return t?(t.name||('Стол '+t.table_number)):'';};

async function loadTable(v){
  var t=token();if(!t||!v)return null;
  try{var r=await db.rpc('get_public_table',{p_venue_id:v.id,p_qr_token:t});if(!r.error&&r.data)return r.data;}catch(e){}
  return null;
}

// УБРАНО: бейдж в меню (дублируется config.js bootQrTable).
// Оставлен только бейдж в tracking.
function showTrackingTable(){
  var x=getVM();if(!x)return;
  var t=x.tracking;
  var text=null;
  if(t&&t.table_number!=null)text=t.table_name||('Стол '+t.table_number);
  else if(currentTable)text=tableText(currentTable);
  if(!text)return;
  var old=document.getElementById('customer-table-badge');
  if(old){old.textContent='🪑 '+text;return;}
  var card=document.querySelector('.order-card');
  if(!card)return;
  var b=document.createElement('div');
  b.id='customer-table-badge';
  b.style.cssText='display:block;width:max-content;max-width:100%;margin:8px 0;padding:7px 13px;border-radius:999px;background:rgba(99,102,241,.18);border:1px solid rgba(129,140,248,.32);color:#c7d2fe;font-size:12px;font-weight:600';
  b.textContent='🪑 '+text;
  card.insertBefore(b,card.firstChild);
}

function install(x,t){
  if(!x||x.__tableFlowInstalled)return;
  x.__tableFlowInstalled=true;
  x.tableInfo=t||null;
  currentTable=t||null;
  var oldCheckout=x.checkout;
  if(typeof oldCheckout!=='function')return;
  x.checkout=async function(){
    var self=this,tt=token();
    if(!tt)return oldCheckout.call(self);
    self.msg='';
    var phone=self.norm(self.form.phone);
    if(!phone){self.msg='Укажите телефон';return;}
    if(self.form.type==='delivery'&&!self.form.address.trim()){self.msg='Укажите адрес';return;}
    if(!self.cart.length){self.msg='Корзина пустая';return;}
    
    // FIX #3: Validate delivery fee before submission
    if(self.form.type==='delivery'){
      if(typeof self.deliveryFee !== 'number' || !isFinite(self.deliveryFee) || self.deliveryFee < 0){
        self.msg='Ошибка расчёта доставки. Попробуйте ещё раз.';
        return;
      }
    }
    
    self.busy=true;
    try{
      var items=self.cart.map(function(i){return{product_id:i.id,qty:Number(i.qty)||1};});
      var addons=[];
      self.cart.forEach(function(i){(i.addons||[]).forEach(function(a){var q=Number(a.qty)||0;if(q>0)addons.push({id:a.id,qty:q,item_name:i.name});});});
      var r=await db.rpc('create_public_order',{
        p_venue_id:self.venue.id,
        p_order_type:self.form.type,
        p_customer_name:self.form.name||null,
        p_customer_phone:phone,
        p_delivery_address:self.form.type==='delivery'?self.form.address:null,
        p_comment:self.form.comment||null,
        p_payment_method:self.form.pay,
        p_items:items,
        p_addons:addons,
        p_total_price:self.cartTotal,
        p_table_token:tt,
        p_delivery_fee:(self.form.type==='delivery'&&typeof self.deliveryFee==='number'&&isFinite(self.deliveryFee))?Math.max(self.deliveryFee,0):null
      });
      if(r.error)throw r.error;
      localStorage.setItem('last_phone',phone);
      if(r.data&&r.data.id)localStorage.setItem('last_order_id',r.data.id);
      self.cart=[];self.showCart=false;self.view='tracking';
      self.trackPhone=phone;self.previousStatus='';self.tracking=null;
      self.startTrackingTimer();
      await self.trackOrder();
      setTimeout(showTrackingTable,50);
    }catch(e){self.msg='Ошибка: '+(e.message||String(e));}
    finally{self.busy=false;}
  };
}

function tick(){
  var x=getVM();if(!x)return;
  if(x.venue&&!x.__tableFlowInstalled){
    loadTable(x.venue).then(function(t){install(x,t);});
  }
  showTrackingTable();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
setInterval(tick,500);
})();
