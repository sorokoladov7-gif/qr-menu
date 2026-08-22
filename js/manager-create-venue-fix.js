/* QR Menu — stable manager venue creation fix. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_VENUE_FIX__) return;
  window.__QR_MANAGER_CREATE_VENUE_FIX__=true;

  function getProxy(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      return app&&app._instance&&app._instance.proxy||null;
    }catch(e){ return null; }
  }

  function patch(p){
    if(!p || p.__qrCreateVenueFixed) return !!p;
    p.__qrCreateVenueFixed=true;
    p.createVenue=async function(){
      var self=this;
      self.formError='';
      var template=self.selectedVenueTemplate;
      if(!template){ self.formError='Выберите шаблон ниши'; return; }
      if(!self.newVenueForm.name || !self.newVenueForm.slug){ self.formError='Заполните название и код заведения'; return; }
      if(!self.canCreateVenue){ self.formError='Лимит заведений'; return; }
      if(self.currentPlan && self.currentPlan.max_products && template.products.length>self.currentPlan.max_products){
        self.formError='В выбранном тарифе недостаточно места для шаблона ('+template.products.length+' позиций).';
        return;
      }
      self.busy=true;
      try{
        var end=self.subscriptionEnd || (self.managerSubscription&&self.managerSubscription.current_period_end) || null;
        var plan=(self.managerSubscription&&self.managerSubscription.plan_id) || (self.currentPlan&&self.currentPlan.id) || null;
        if(!plan){
          var u=await db.auth.getUser();
          if(!u.data.user) throw new Error('Не удалось определить управляющего');
          var sr=await db.from('subscriptions').select('plan_id,current_period_end,status').eq('manager_id',u.data.user.id).maybeSingle();
          if(sr.error) throw sr.error;
          if(!sr.data || ['trialing','active'].indexOf(sr.data.status)===-1 || new Date(sr.data.current_period_end)<new Date()){
            throw new Error('Сначала выберите тариф');
          }
          plan=sr.data.plan_id;
          end=sr.data.current_period_end;
        }
        var slug=self.newVenueForm.slug.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9а-яё_-]/gi,'').replace(/[а-яё]/gi,function(c){
          var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
          return m[c.toLowerCase()]||'';
        });
        if(!slug) throw new Error('Некорректный slug');
        var products=template.products.map(function(item){
          return {name:item.name,description:item.description||null,price:Number(item.price)||0,category:item.category||'main',image_url:item.image_url||null,applies_to:item.applies_to||'all',is_available:true};
        });
        var r=await db.rpc('create_venue_for_manager',{p_name:self.newVenueForm.name.trim(),p_slug:slug,p_plan:plan,p_subscription_end:end,p_products:products});
        if(r.error) throw r.error;
        var venue=r.data;
        self.showCreateVenue=false;
        self.newVenueForm={name:'',slug:'',template:null};
        await self.loadMyVenues();
        self.selectVenue(venue);
        self.showToast('Заведение создано: '+template.name+' · '+template.products.length+' позиций добавлено');
      }catch(err){
        console.error('createVenue error:',err);
        self.formError='Ошибка: '+(err.message||String(err));
      }finally{ self.busy=false; }
    };
    return true;
  }

  function patchWhenReady(){
    var p=getProxy();
    if(p) patch(p);
  }

  document.addEventListener('DOMContentLoaded',function(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      patchWhenReady();
      var p=getProxy();
      if(p&&p.__qrCreateVenueFixed || tries>=20){ clearInterval(timer); }
    },300);
    patchWhenReady();
  });

  /* Correct stale copy visible in the empty-venues card without touching Vue rendering. */
  document.addEventListener('DOMContentLoaded',function(){
    var replace=function(){
      document.querySelectorAll('#app *').forEach(function(el){
        if(el.children.length===0 && (el.textContent||'').indexOf('3 дня бесплатно')!==-1){
          el.textContent=(el.textContent||'').replace(/3 дня бесплатно/g,'5 дней бесплатно');
        }
      });
    };
    setTimeout(replace,800);
  });
})();
