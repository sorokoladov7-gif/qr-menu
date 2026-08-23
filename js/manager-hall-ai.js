/* QR Menu — manager compatibility bootstrap v9. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V9__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V9__=true;

  function publish(app){
    try{
      window.__QR_MANAGER_VUE_APP__=app;
      window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;
      window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    }catch(e){console.warn('[QR Menu] publish Vue:',e);}
  }

  function patchVue(Vue){
    if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_MANAGER_PATCH_V9__) return;
    Vue.__QR_MANAGER_PATCH_V9__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options && typeof options==='object'){
        options.computed=options.computed||{};
        options.computed.canCreateVenue=function(){
          var p=this.plans && this.plans.find(function(x){return x.id==='start'});
          return this.myVenues.length < (p ? p.max_venues : 1);
        };

        options.methods=options.methods||{};
        options.methods.createVenue=function(){
          var self=this;
          self.formError='';
          if(!self.newVenueForm.name || !self.newVenueForm.slug){
            self.formError='Заполните название и код заведения';
            return;
          }
          if(!self.canCreateVenue){
            self.formError='Лимит заведений';
            return;
          }
          var template=self.selectedVenueTemplate;
          if(!template){
            self.formError='Выберите шаблон ниши';
            return;
          }
          if(self.currentPlan && self.currentPlan.max_products && template.products.length > self.currentPlan.max_products){
            self.formError='В выбранном тарифе недостаточно места для шаблона ('+template.products.length+' позиций).';
            return;
          }

          var slug=String(self.newVenueForm.slug||'').toLowerCase().trim()
            .replace(/\s+/g,'-')
            .replace(/[^a-z0-9а-яё_-]/gi,'')
            .replace(/[а-яё]/gi,function(c){
              var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
              return m[c.toLowerCase()]||'';
            });
          if(!slug){
            self.formError='Некорректный slug';
            return;
          }

          self.busy=true;
          var end=new Date();
          end.setDate(end.getDate()+3);

          db.rpc('create_venue_from_template',{
            p_template_id: self.newVenueForm.template,
            p_name: self.newVenueForm.name.trim(),
            p_slug: slug,
            p_plan: 'start',
            p_subscription_end: end.toISOString()
          }).then(function(r){
            if(r.error) throw r.error;
            var venue=Array.isArray(r.data) ? r.data[0] : r.data;
            if(!venue || !venue.id) throw new Error('Сервер не вернул созданное заведение');
            return venue;
          }).then(function(venue){
            self.showCreateVenue=false;
            self.newVenueForm={name:'',slug:'',template:'coffee'};
            return self.loadMyVenues().then(function(){
              self.selectVenue(venue);
              self.showToast('Заведение создано: '+template.name+' · '+template.products.length+' позиций добавлено');
            });
          }).catch(function(err){
            console.error('[Manager] createVenue canonical:',err);
            self.formError='Ошибка: '+(err.message||String(err));
          }).finally(function(){
            self.busy=false;
          });
        };
      }
      var app=original.apply(this,arguments);
      var originalMount=app.mount;
      app.mount=function(){
        var result=originalMount.apply(this,arguments);
        publish(this);
        return result;
      };
      return app;
    };
  }

  function init(){
    try{ if(window.Vue) patchVue(window.Vue); }catch(e){ console.warn('[QR Menu] Vue patch:',e); }
  }
  init();

  function load(src,key){
    if(document.querySelector('script['+key+']')) return;
    var s=document.createElement('script');
    s.src=src; s.async=false; s.setAttribute(key,'1');
    s.onerror=function(){console.error('[QR Manager] failed to load '+src);};
    document.head.appendChild(s);
  }

  load('/js/manager-hall.js?v=5','data-manager-hall-single-v9');
  load('/js/manager-recipes-ui.js?v=5','data-manager-recipes-ui-v9');
  load('/js/manager-subscription-owner.js?v=6','data-manager-subscription-owner-v9');
  load('/js/manager-create-venue-flow.js?v=9','data-manager-create-venue-flow-v9');
  load('/js/manager-personnel-final.js?v=6','data-manager-personnel-final-v9');
})();
