window.QR_DEMO_DATA = {
  user: {
    id: 'demo-user-' + Date.now(),
    email: 'demo@qr-setka.ru',
    user_metadata: { display_name: 'Демо Управляющий' }
  },
  profile: {
    id: 'demo-user', email: 'demo@qr-setka.ru',
    display_name: 'Демо Управляющий', role: 'manager'
  },
  venue: {
    id: 'demo-venue', slug: 'demo-cafe', name: 'Демо Кафе «Прованс»',
    status: 'active', brand_color: '#6366f1', description: 'Демо-заведение',
    subscription_end: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    plan_id: 'demo-plan', manager_permissions: { addons:true, products:true, prices:true, design:true },
    delivery_base_price: 100, delivery_per_km: 30, latitude: 55.75, longitude: 37.61
  },
  session: { venueId: 'demo-venue', venueName: 'Демо Кафе «Прованс»', cookName: 'Иван Петров', courierName: 'Алексей Козлов', waiterName: 'Ольга Новикова' },
  cooks: [{ id:'c1', name:'Иван Петров', phone:'+7 900 111-22-33', pin:'1234', venue_id:'demo-venue' }],
  couriers: [{ id:'cr1', name:'Алексей Козлов', phone:'+7 900 777-88-99', pin:'1111', venue_id:'demo-venue' }],
  waiters: [{ id:'w1', name:'Ольга Новикова', phone:'+7 900 123-45-67', pin:'2222', venue_id:'demo-venue' }],
  products: [
    { id:'p1', name:'Капучино', category:'drink', price:250, is_available:true, description:'Классический капучино', venue_id:'demo-venue' },
    { id:'p2', name:'Сырники со сметаной', category:'breakfast', price:450, is_available:true, description:'Домашние сырники', venue_id:'demo-venue' },
    { id:'p3', name:'Чизкейк Нью-Йорк', category:'dessert', price:350, is_available:true, description:'Нежный чизкейк', venue_id:'demo-venue' },
    { id:'p4', name:'Паста Карбонара', category:'hot', price:520, is_available:true, description:'С беконом', venue_id:'demo-venue' }
  ],
  tables: [
    { id:'t1', table_number:1, name:'Стол 1', seats:4, shape:'round', pos_x:80, pos_y:80, occupancy_status:'occupied', is_active:true, qr_token:'demo-qr-1', venue_id:'demo-venue' },
    { id:'t2', table_number:2, name:'Стол 2', seats:2, shape:'square', pos_x:220, pos_y:80, occupancy_status:'free', is_active:true, qr_token:'demo-qr-2', venue_id:'demo-venue' },
    { id:'t3', table_number:3, name:'Стол 3', seats:6, shape:'rectangle', pos_x:80, pos_y:220, occupancy_status:'reserved', is_active:true, qr_token:'demo-qr-3', venue_id:'demo-venue' }
  ],
  orders: [
    { id:'o1', order_number:101, status:'new', order_type:'pickup', customer_name:'Анна', customer_phone:'+7 999 000-11-22', delivery_address:null, payment_method:'cash', total_price:700, comment:'Без сахара', table_id:'t1', table_number:1, table_name:'Стол 1', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p1', name:'Капучино', price:250, qty:2}], addons:[] },
    { id:'o2', order_number:102, status:'cooking', order_type:'delivery', customer_name:'Сергей', customer_phone:'+7 999 333-44-55', delivery_address:'ул. Ленина, 15', payment_method:'card', total_price:870, comment:'', cook_name:'Иван Петров', table_id:null, table_number:null, table_name:null, created_at:new Date(Date.now()-600000).toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p2', name:'Сырники со сметаной', price:450, qty:1},{product_id:'p1', name:'Капучино', price:250, qty:1}], addons:[] },
    { id:'o3', order_number:103, status:'ready', order_type:'delivery', customer_name:'Дмитрий', customer_phone:'+7 999 666-77-88', delivery_address:'пр. Мира, 42', payment_method:'cash', total_price:520, comment:'', cook_name:'Мария Сидорова', table_id:null, table_number:null, table_name:null, created_at:new Date(Date.now()-1200000).toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p4', name:'Паста Карбонара', price:520, qty:1}], addons:[] }
  ],
  analytics: { revenue:48750, orders:87, clients:64, avgCheck:560, avgCookTime:12, repeatClients:21, typeStats:{pickup:52,delivery:35}, payStats:{cash:40,card:47} }
};

/* Demo manager: keep the real create-venue UI/flow, but emulate the final RPC locally. */
(function(){
  'use strict';
  var p=new URLSearchParams(location.search);
  if(!/manager\\.html$/i.test(location.pathname)||p.get('demo')!=='1')return;
  var D=window.QR_DEMO_DATA;
  function install(){
    if(!window.db||!window.__managerVue){setTimeout(install,50);return;}
    if(window.__qrDemoManagerCreateInstalled)return;
    window.__qrDemoManagerCreateInstalled=true;
    var nativeRpc=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args){
      if(String(name)==='manager_import_venue'){
        args=args||{};
        var nameValue=args.p_name||args.name||'Новое заведение';
        var slugValue=args.p_slug||args.slug||('demo-'+Date.now());
        var id='demo-venue-'+Date.now();
        var products=args.p_products;
        if(typeof products==='string'){try{products=JSON.parse(products);}catch(e){products=[];}}
        if(!Array.isArray(products))products=[];
        var venue={id:id,slug:slugValue,name:nameValue,status:'active',brand_color:'#6366f1',description:args.p_description||'',address:args.p_address||null,phone:args.p_phone||null,website_url:args.p_website_url||null,logo_url:args.p_logo_url||null,opening_hours:args.p_opening_hours||null,plan_id:args.p_plan||'demo-plan',subscription_end:args.p_subscription_end||D.venue.subscription_end,created_at:new Date().toISOString()};
        venue.products=products;
        D.venue=venue;
        D.products=products;
        D.tables=[];
        D.orders=[];
        try{var list=window.__managerVue.myVenues||[];window.__managerVue.myVenues=[venue].concat(list.filter(function(v){return v&&v.id!==id;}));}catch(e){}
        return Promise.resolve({data:{venue:venue,venue_id:id,id:id,slug:slugValue},error:null});
      }
      return nativeRpc(name,args);
    };
    function enableCreate(){
      var root=document.getElementById('app');if(!root)return;
      var buttons=root.querySelectorAll('button');
      for(var i=0;i<buttons.length;i++){
        var b=buttons[i],t=String(b.textContent||'').toLowerCase();
        if(t.indexOf('создать')!==-1&&t.indexOf('заведение')!==-1)b.disabled=false;
      }
    }
    enableCreate();setTimeout(enableCreate,300);setTimeout(enableCreate,1000);setTimeout(enableCreate,2000);
    var observer=new MutationObserver(enableCreate);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    setTimeout(function(){try{observer.disconnect();}catch(e){}},15000);
  }
  var timer=setInterval(function(){if(window.__managerVue){clearInterval(timer);install();}},100);
  setTimeout(function(){clearInterval(timer);install();},15000);
})();

/* Demo UX bridge: real cabinets, local-only interactions, no production writes. */
(function(){
  'use strict';
  var p=new URLSearchParams(location.search);
  var path=location.pathname.toLowerCase();
  var demo=p.get('demo')==='1' || localStorage.getItem('qr_demo_mode')==='1';
  if(!demo || !/(manager|cook|waiter|courier)(?:-demo)?\\.html$/i.test(path))return;
  var D=window.QR_DEMO_DATA;
  D.ingredients=D.ingredients||[
    {id:'ing-coffee',name:'Кофе в зернах',unit:'g',purchase_quantity:1000,purchase_price:1800,venue_id:D.venue.id},
    {id:'ing-milk',name:'Молоко',unit:'ml',purchase_quantity:1000,purchase_price:110,venue_id:D.venue.id},
    {id:'ing-sugar',name:'Сахар',unit:'g',purchase_quantity:1000,purchase_price:90,venue_id:D.venue.id},
    {id:'ing-cheese',name:'Сливочный сыр',unit:'g',purchase_quantity:1000,purchase_price:850,venue_id:D.venue.id}
  ];
  D.recipeRows=D.recipeRows||{
    p1:[{ingredient_id:'ing-coffee',quantity:18,note:'Эспрессо'},{ingredient_id:'ing-milk',quantity:150,note:'Взбить до 60–65°C'},{ingredient_id:'ing-sugar',quantity:5,note:'По запросу'}],
    p2:[{ingredient_id:'ing-cheese',quantity:80,note:'Основа'},{ingredient_id:'ing-sugar',quantity:15,note:'В тесто'}],
    p4:[{ingredient_id:'ing-coffee',quantity:10,note:'Демо ингредиент'}]
  };
  D.payments=D.payments||[];
  window.SBP_PHONE=window.SBP_PHONE||'89053204350';

  function ok(data){return Promise.resolve({data:data,error:null});}
  function fail(){return Promise.resolve({data:null,error:{message:'Демо: операция выполнена локально'}});}
  function arrForType(type){return type==='cook'?D.cooks:(type==='courier'?D.couriers:D.waiters);}
  function findIng(id){return D.ingredients.find(function(x){return String(x.id)===String(id);});}
  function demoRecipeCost(productId){
    var rows=D.recipeRows[productId]||[];
    var cost=rows.reduce(function(sum,row){var i=findIng(row.ingredient_id);if(!i)return sum;var unitQty=Number(i.purchase_quantity)||1;var unitPrice=Number(i.purchase_price)||0;return sum+(Number(row.quantity)||0)/unitQty*unitPrice;},0);
    var product=D.products.find(function(x){return String(x.id)===String(productId);});
    var price=product?Number(product.price)||0:0;
    var profit=price-cost;
    return {cost:cost,price:price,gross_profit:profit,margin_percent:price?profit/price*100:0};
  }
  function patchDb(){
    if(!window.db||window.__QR_DEMO_UX_BRIDGE__)return false;
    window.__QR_DEMO_UX_BRIDGE__=true;
    var rpc0=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args){
      var n=String(name||''),a=args||{};
      if(n==='manager_staff_performance')return ok({period_days:Number(a.p_days)||30,cooks:D.cooks.map(function(x){return{id:x.id,name:x.name,orders_count:42,completed_orders:39,avg_time_min:12,revenue:14800};}),couriers:D.couriers.map(function(x){return{id:x.id,name:x.name,deliveries_count:18,revenue:9600};}),waiters:D.waiters.map(function(x){return{id:x.id,name:x.name,served_count:31,revenue:12700};})});
      if(n==='manager_ingredient_list')return ok(D.ingredients);
      if(n==='manager_recipe_list')return ok((D.recipeRows[a.p_product_id]||[]).map(function(x){return Object.assign({},x);}));
      if(n==='manager_recipe_cost')return ok(demoRecipeCost(a.p_product_id));
      if(n==='manager_product_recipe_save'){D.recipeRows[a.p_product_id]=(Array.isArray(a.p_rows)?a.p_rows:[]).map(function(x){return Object.assign({},x);});return ok({ok:true});}
      if(n==='manager_ingredient_upsert'){
        var id=a.p_id||('demo-ing-'+Date.now());var existing=findIng(id);
        var item={id:id,name:String(a.p_name||'Ингредиент'),unit:a.p_unit||'g',purchase_quantity:Number(a.p_purchase_quantity)||1,purchase_price:Number(a.p_purchase_price)||0,venue_id:D.venue.id};
        if(existing)Object.assign(existing,item);else D.ingredients.push(item);
        return ok(item);
      }
      if(n==='manager_ingredient_delete'){D.ingredients=D.ingredients.filter(function(x){return String(x.id)!==String(a.p_ingredient_id);});return ok({ok:true});}
      if(n==='manager_create_staff'){
        var type=a.p_type, list=arrForType(type);var item={id:'demo-staff-'+Date.now(),name:String(a.p_name||'Новый сотрудник'),phone:a.p_phone||'',pin:String(a.p_pin||'1234'),venue_id:D.venue.id,created_at:new Date().toISOString()};
        list.push(item);return ok(item);
      }
      if(n==='manager_reset_staff_pin'){
        var list2=arrForType(a.p_type),found=list2.find(function(x){return String(x.id)===String(a.p_staff_id);}),pin=String(Math.floor(1000+Math.random()*9000));
        if(found)found.pin=pin;return ok({pin:pin});
      }
      if(n==='manager_delete_staff')return ok({ok:true});
      if(n==='manager_import_venue'||n==='create_venue_for_manager'||n==='create_venue_from_template')return rpc0(name,args);
      if(/^(manager_.*(upsert|delete|set_|regenerate|create|update|remove|change)|.*_(insert|update|delete|upsert|create|remove|save|import|assign|approve|reject))$/i.test(n))return ok({ok:true,demo:true});
      return rpc0(name,args);
    };
    var from0=window.db.from.bind(window.db);
    window.db.from=function(table){
      if(table==='payments'){
        var chain={select:function(){return chain;},eq:function(){return chain;},order:function(){return chain;},then:function(resolve,reject){return ok(D.payments).then(resolve,reject);},catch:function(fn){return ok(D.payments).catch(fn);},insert:function(rows){var list=Array.isArray(rows)?rows:[rows];list.forEach(function(x){D.payments.unshift(Object.assign({id:'demo-payment-'+Date.now(),created_at:new Date().toISOString(),status:'pending'},x));});return {then:function(resolve,reject){return ok(list).then(resolve,reject);},catch:function(fn){return ok(list).catch(fn);}};}};return chain;
      }
      if(['cooks','couriers','waiters'].indexOf(table)>=0){
        var list=table==='cooks'?D.cooks:(table==='couriers'?D.couriers:D.waiters);
        var chain2={select:function(){return chain2;},eq:function(){return chain2;},order:function(){return chain2;},then:function(resolve,reject){return ok(list).then(resolve,reject);},catch:function(fn){return ok(list).catch(fn);},delete:function(){chain2.__delete=true;return chain2;},in:function(){return chain2;},single:function(){return ok(list[0]||null);},maybeSingle:function(){return ok(list[0]||null);}};return chain2;
      }
      if(table==='ingredients'){
        var c3={select:function(){return c3;},eq:function(){return c3;},order:function(){return c3;},then:function(resolve,reject){return ok(D.ingredients).then(resolve,reject);},catch:function(fn){return ok(D.ingredients).catch(fn);}};return c3;
      }
      return from0(table);
    };
    return true;
  }

  function enableDemoControls(){
    var root=document.getElementById('app')||document.body;
    if(!root)return;
    var els=root.querySelectorAll('button,input,select,textarea');
    for(var i=0;i<els.length;i++){
      var e=els[i],text=String(e.innerText||e.textContent||e.value||e.getAttribute('aria-label')||'').toLowerCase();
      if(e.disabled && !/выйти|закрыть/.test(text))e.disabled=false;
      e.removeAttribute('aria-disabled');
    }
  }
  function fixRecipeScroll(){
    if(document.getElementById('qrDemoUxStyle'))return;
    var s=document.createElement('style');s.id='qrDemoUxStyle';s.textContent='.recipe-tab-container{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}.recipe-tab-container .recipe-wrap{height:auto!important;min-height:0!important;overflow:visible!important}.recipe-tab-container .list{max-height:none!important;overflow:visible!important}.recipe-tab-container #ingredients{max-height:420px!important;overflow:auto!important}@media(max-width:800px){.recipe-tab-container{width:100%!important;overflow:visible!important}.recipe-tab-container .recipe-grid{grid-template-columns:1fr!important}.recipe-tab-container .list{max-height:360px!important;overflow:auto!important}}';document.head.appendChild(s);
  }
  function fixSbpCopy(){
    if(window.__QR_DEMO_SBP_COPY__)return;window.__QR_DEMO_SBP_COPY__=true;
    document.addEventListener('click',function(e){var b=e.target.closest('.sbp-box button');if(!b)return;e.preventDefault();e.stopImmediatePropagation();var text=window.SBP_PHONE||'89053204350';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){alert('Номер СБП скопирован: '+text);}).catch(function(){prompt('Скопируйте номер СБП:',text);});}else prompt('Скопируйте номер СБП:',text);},true);
  }
  function start(){
    if(!patchDb())return;
    fixRecipeScroll();fixSbpCopy();enableDemoControls();
    var count=0,t=setInterval(function(){count++;enableDemoControls();fixRecipeScroll();if(count>30)clearInterval(t);},250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
