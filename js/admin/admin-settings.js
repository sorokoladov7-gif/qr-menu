/* QR-Menu — настройки интерфейса админки */
/* Qrchick is owned entirely by admin-ai-audit.js */
(function(){
  'use strict';
  if(window.__QR_ADMIN_SETTINGS__) return;
  window.__QR_ADMIN_SETTINGS__ = true;
  var DARK_BG='#020617', DARK_TEXT='#f8fafc', DARK_CARD='rgba(255,255,255,0.03)';
  function forceDark(){
    var r=document.documentElement,b=document.body;
    if(!r) return;
    r.style.setProperty('--admin-bg',DARK_BG,'important');
    r.style.setProperty('--admin-text',DARK_TEXT,'important');
    r.style.setProperty('--admin-card-bg',DARK_CARD,'important');
    r.style.setProperty('color-scheme','dark','important');
    if(b){
      b.style.setProperty('background-color',DARK_BG,'important');
      b.style.setProperty('color',DARK_TEXT,'important');
    }
  }
  function hideProviderNames(){
    var root=document.getElementById('qr-center')||document.body;
    if(!root) return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n;
    while((n=walker.nextNode())){
      if(/Gemini|Flash/i.test(n.nodeValue)){
        n.nodeValue=n.nodeValue
          .replace(/Gemini(?:\s+3(?:\.\d+)?(?:\s+Flash(?:\s+(?:Lite|Pro))?)?|\s+API)?/gi,'Qrchick')
          .replace(/Flash/gi,'AI');
      }
    }
  }
  forceDark();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',forceDark);
  else setTimeout(forceDark,0);
  try{
    new MutationObserver(function(){forceDark();hideProviderNames();})
      .observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
  var settingsMixin={
    data:function(){
      return {uiSettings:{
        background_color:DARK_BG,
        text_color:DARK_TEXT,
        button_primary_bg:'#8b5cf6',
        button_primary_text:'#ffffff',
        card_bg:DARK_CARD,
        card_radius:12,
        button_radius:12,
        background_image:''
      }};
    },
    methods:{
      loadUISettings:function(){
        try{
          var saved=localStorage.getItem('adminUISettings');
          if(saved){
            var p=JSON.parse(saved),self=this;
            Object.keys(p).forEach(function(k){if(k in self.uiSettings) self.uiSettings[k]=p[k];});
          }
        }catch(e){}
        this.uiSettings.background_color=DARK_BG;
        this.uiSettings.text_color=DARK_TEXT;
        this.uiSettings.card_bg=DARK_CARD;
        this.uiSettings.background_image='';
        this.applyUISettings();
      },
      saveUISettings:function(){
        localStorage.setItem('adminUISettings',JSON.stringify(this.uiSettings));
        this.applyUISettings();
        alert('Настройки сохранены!');
      },
      resetUISettings:function(){
        this.uiSettings={
          background_color:DARK_BG,text_color:DARK_TEXT,
          button_primary_bg:'#8b5cf6',button_primary_text:'#ffffff',
          card_bg:DARK_CARD,card_radius:12,button_radius:12,background_image:''
        };
        localStorage.removeItem('adminUISettings');
        this.applyUISettings();
        alert('Настройки сброшены');
      },
      applyUISettings:function(){
        var s=this.uiSettings,r=document.documentElement;
        r.style.setProperty('--admin-bg',DARK_BG,'important');
        r.style.setProperty('--admin-text',DARK_TEXT,'important');
        r.style.setProperty('--admin-btn-bg',s.button_primary_bg);
        r.style.setProperty('--admin-btn-text',s.button_primary_text);
        r.style.setProperty('--admin-card-bg',DARK_CARD,'important');
        r.style.setProperty('--admin-card-radius',s.card_radius+'px');
        r.style.setProperty('--admin-btn-radius',s.button_radius+'px');
        document.body.style.setProperty('background-color',DARK_BG,'important');
        document.body.style.setProperty('color',DARK_TEXT,'important');
        forceDark();
        hideProviderNames();
      },
      resizeImage:function(file,mw,q){
        return new Promise(function(res,rej){
          var reader=new FileReader();
          reader.onload=function(ev){
            var img=new Image();
            img.onload=function(){
              var c=document.createElement('canvas'),w=img.width,h=img.height;
              if(w>mw){h=Math.round(h*mw/w);w=mw;}
              c.width=w;c.height=h;
              c.getContext('2d').drawImage(img,0,0,w,h);
              c.toBlob(function(b){b?res(b):rej(Error('err'));},'image/jpeg',q);
            };
            img.onerror=function(){rej(Error('err'));};
            img.src=ev.target.result;
          };
          reader.onerror=function(){rej(Error('err'));};
          reader.readAsDataURL(file);
        });
      },
      uploadAdminBg:function(ev){
        var self=this,f=ev.target.files[0];
        if(!f) return;
        self.resizeImage(f,1920,.8)
          .then(function(blob){
            var fn='admin_bg/'+Date.now()+'.jpg';
            return db.storage.from('menu-images').upload(fn,blob,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'});
          })
          .then(function(r){
            if(r.error) throw r.error;
            self.uiSettings.background_image=db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
            self.saveUISettings();
          })
          .catch(function(e){alert('Ошибка загрузки фона: '+e.message);})
          .finally(function(){ev.target.value='';});
      }
    }
  };
  window.__QR_ADMIN_SETTINGS_MIXIN__=settingsMixin;
})();
