/* QR Menu — manager AI entitlement/action bridge.
   IMPORTANT: this file intentionally creates NO button and NO second assistant UI.
   It connects the existing manager AI assistant to subscription state and keeps
   proposal requests on the proposal endpoint while confirmed actions use the action endpoint. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_AGENT_BRIDGE__) return;
  window.__QR_MANAGER_AI_AGENT_BRIDGE__=true;

  function validSubscription(s){
    if(!s)return false;
    var status=String(s.status||'').toLowerCase();
    if(status!=='trialing'&&status!=='active')return false;
    if(!s.current_period_end)return true;
    var end=new Date(s.current_period_end);
    return !isNaN(end.getTime())&&end>=new Date();
  }

  function findPlan(vm){
    if(!vm)return null;
    if(vm.currentPlan&&vm.currentPlan.id)return vm.currentPlan;
    var s=vm.managerSubscription;
    if(!s||!Array.isArray(vm.plans))return null;
    return vm.plans.find(function(p){return p&&String(p.id)===String(s.plan_id);})||null;
  }

  function install(vm){
    if(!vm||vm.__qrManagerAIEntitlementBridge)return;
    vm.__qrManagerAIEntitlementBridge=true;
    var original=typeof vm.hasAIFeature==='function'?vm.hasAIFeature.bind(vm):null;
    vm.hasAIFeature=function(feature){
      feature=String(feature||'').trim();
      if(!feature)return false;
      if(this.profile&&String(this.profile.role).toLowerCase()==='admin')return true;
      var s=this.managerSubscription;
      if(validSubscription(s))return true;
      var plan=findPlan(this);
      if(plan&&plan.ai_enabled===true){
        var features=plan.ai_features&&typeof plan.ai_features==='object'?plan.ai_features:{};
        if(features[feature]===true)return true;
        if(feature==='assistant'&&Object.keys(features).length===0)return true;
      }
      return original?!!original(feature):false;
    };
    var plan=findPlan(vm);
    if(plan&&!vm.currentPlan)vm.currentPlan=plan;
    if(validSubscription(vm.managerSubscription))vm.aiEntitlementReady=true;
    try{window.dispatchEvent(new CustomEvent('qr-manager-ai-entitlement-ready',{detail:{subscription:vm.managerSubscription||null,plan:plan||null}}));}catch(e){}
  }

  /* The existing assistant historically posted proposals to the legacy action route.
     Keep that route for confirmed actions, but transparently route proposal-shaped
     assistant requests to the unified proposal API. No new UI or AI system is created. */
  function patchProposalRoute(){
    if(window.__QR_MANAGER_AI_PROPOSAL_ROUTE_PATCH__)return;
    if(typeof window.fetch!=='function')return;
    window.__QR_MANAGER_AI_PROPOSAL_ROUTE_PATCH__=true;
    var nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      try{
        var url=typeof input==='string'?input:(input&&input.url)||'';
        if(/\/api\/manager-ai-assistant-action(?:\?|$)/i.test(url)&&init&&typeof init.body==='string'){
          var body=JSON.parse(init.body);
          if(body&&body.message&&!body.confirm&&!body.action){
            return nativeFetch('/api/manager-ai-propose',init);
          }
        }
      }catch(e){}
      return nativeFetch(input,init);
    };
  }

  /* If an old cached manager page omitted the explicit assistant script, load the
     existing manager-ai.js bundle. This is only a loader; it creates no duplicate UI. */
  function ensureExistingAssistantBundle(){
    if(!/\/manager\.html$/i.test(location.pathname))return;
    if(document.getElementById('qr-ai-feature-center'))return;
    if(document.querySelector('script[data-qr-manager-ai-ui]'))return;
    var s=document.createElement('script');
    s.src='/js/manager/manager-ai.js?v=3';
    s.async=true;
    s.setAttribute('data-qr-manager-ai-ui','1');
    document.head.appendChild(s);
  }

  function tryInstall(){
    var vm=window.__managerVue;
    if(vm)install(vm);
    patchProposalRoute();
    ensureExistingAssistantBundle();
  }

  window.addEventListener('qr-manager-vue-ready',tryInstall);
  window.addEventListener('qr-manager-subscription-ready',tryInstall);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryInstall,{once:true});else tryInstall();
  [250,750,1500,3000,5000,8000].forEach(function(ms){setTimeout(tryInstall,ms);});
})();