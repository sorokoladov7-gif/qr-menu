/* QR-Menu — заведения (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_VENUES__) return;
  window.__QR_ADMIN_VENUES__ = true;
  var venuesMixin = {
    data: function() { return { venues: [], showModal: false, nform: { name: '', slug: '', plan: 'start' }, venueEditModal: { show: false, id: null, name: '', description: '', brand_color: '#6366f1', logo_url: '', perms: { addons: true, products: true, prices: true } }, msg: '' }; },
    methods: {
      createVenue: function() {
        var self = this;
        self.msg = '';
        if (!self.nform.name || !self.nform.slug) { self.msg = 'Заполните название и slug'; return; }
        self.busy = true;
        var end = new Date();
        end.setDate(end.getDate() + 5);
        db.from('venues').insert({ name: self.nform.name, slug: self.nform.slug.toLowerCase(), plan: self.nform.plan, subscription_end: end.toISOString() }).select().single().then(function(r) {
          if (r.error) { self.msg = 'Ошибка: ' + r.error.message; self.busy = false; return Promise.reject(r.error); }
          return r;
        }).then(function() {
          self.busy = false; self.showModal = false; self.nform = { name: '', slug: '', plan: 'start' }; self.loadBaseData();
        }).catch(function(e) { if (e) { self.busy = false; self.msg = 'Ошибка: ' + (e.message || e); } });
      },
      openVenueEdit: function(v) { var mp=v.manager_permissions||{}; this.venueEditModal={show:true,id:v.id,name:v.name,description:v.description||'',brand_color:v.brand_color||'#6366f1',logo_url:v.logo_url||'',perms:{addons:mp.addons!==false,products:mp.products!==false,prices:mp.prices!==false}}; },
      saveVenueEdit: function() { var self=this; db.from('venues').update({name:self.venueEditModal.name,description:self.venueEditModal.description,brand_color:self.venueEditModal.brand_color,logo_url:self.venueEditModal.logo_url||null,manager_permissions:self.venueEditModal.perms}).eq('id',self.venueEditModal.id).then(function(r){if(r.error)throw r.error;self.venueEditModal.show=false;return self.loadBaseData();}).catch(function(e){alert('Ошибка: '+e.message);}); },
      uploadVenueLogo: function(ev) { var self=this,f=ev.target.files[0];if(!f)return;self.resizeImage(f,512,.9).then(function(blob){var fn='logos/'+self.venueEditModal.id+'/'+Date.now()+'.jpg';return db.storage.from('menu-images').upload(fn,blob,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'}).then(function(r){if(r.error)throw r.error;self.venueEditModal.logo_url=db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;});}).catch(function(e){alert('Ошибка: '+e.message);}).finally(function(){ev.target.value='';}); },
      toggleStatus: function(v) { var self=this; db.from('venues').update({status:v.status==='active'?'paused':'active'}).eq('id',v.id).then(function(r){if(r.error)throw r.error;return self.loadBaseData();}).catch(function(e){alert('Ошибка: '+e.message);}); },
      delVenue: function(v) { var self=this;if(!confirm('Удалить заведение "'+v.name+'" и все его данные?'))return;db.from('venues').delete().eq('id',v.id).then(function(r){if(r.error)throw r.error;return self.loadBaseData();}).catch(function(e){alert('Ошибка: '+e.message);}); },
      changePlan: function(v,plan) { var self=this;db.from('venues').update({plan:plan}).eq('id',v.id).then(function(r){if(r.error)throw r.error;return db.from('subscriptions').update({plan_id:plan}).eq('venue_id',v.id);}).then(function(){self.loadBaseData();}).catch(function(e){alert('Ошибка: '+e.message);}); },
      extendSub: function(v) { var self=this,e=v.subscription_end&&new Date(v.subscription_end)>new Date()?new Date(v.subscription_end):new Date();e.setDate(e.getDate()+30);db.from('venues').update({subscription_end:e.toISOString(),status:'active'}).eq('id',v.id).then(function(r){if(r.error)throw r.error;return db.from('subscriptions').update({current_period_end:e.toISOString(),status:'active'}).eq('venue_id',v.id);}).then(function(){self.loadBaseData();}).catch(function(e){alert('Ошибка: '+e.message);}); },
      resizeImage: function(file,mw,q) { return new Promise(function(res,rej){var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas'),w=img.width,h=img.height;if(w>mw){h=Math.round(h*mw/w);w=mw;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);canvas.toBlob(function(b){b?res(b):rej(new Error('err'));},'image/jpeg',q);};img.onerror=function(){rej(new Error('err'));};img.src=e.target.result;};reader.onerror=function(){rej(new Error('err'));};reader.readAsDataURL(file);}); }
    }
  };
  window.__QR_ADMIN_VENUES_MIXIN__=venuesMixin;
})();
