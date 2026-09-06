/* QR Menu — manager AI entitlement/action bridge.
   IMPORTANT: this file intentionally creates NO button and NO second assistant UI.
   It only connects the existing manager AI assistant to the manager subscription state. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_AGENT_BRIDGE__) return;
  window.__QR_MANAGER_AI_AGENT_BRIDGE__=true;

  var FEATURES=['assistant','menu_analysis','menu_import','analytics','recipes','chef','staff','marketing','settings','engineer'];

  function validSubscription(s){
    return !!(s && ['active','trialing'].indexOf(String(s.status))!==-1 && s.current_period_end && new Date(s.current_period_end)>=new Date());
  }

  function findPlan(vm){
    if(!vm) return null;
    if(vm.currentPlan && vm.currentPlan.id) return vm.currentPlan;
    var s=vm.managerSubscription;
    if(!s || !Array.isArray(vm.plans)) return null;
    return vm.plans.find(function(p){return p && p.id===s.plan_id;}) || null;
  }

  function install(vm){
    if(!vm || vm.__qrManagerAIEntitlementBridge) return;
    vm.__qrManagerAIEntitlementBridge=true;

    var original=typeof vm.hasAIFeature==='function' ? vm.hasAIFeature.bind(vm) : null;
    vm.hasAIFeature=function(feature){
      feature=String(feature||'').trim();
      if(!feature) return false;
      if(this.profile && this.profile.role==='admin') return true;
      var s=this.managerSubscription;
      if(validSubscription(s) && String(s.status)==='trialing') return true;
      var plan=findPlan(this);
      if(plan && plan.ai_enabled===true){
        var features=plan.ai_features && typeof plan.ai_features==='object' ? plan.ai_features : {};
        if(features[feature]===true) return true;
        if(feature==='assistant' && Object.keys(features).length===0) return true;
      }
      return original ? !!original(feature) : false;
    };

    var plan=findPlan(vm);
    if(plan && !vm.currentPlan) vm.currentPlan=plan;
    if(validSubscription(vm.managerSubscription)) vm.aiEntitlementReady=true;

    try{
      window.dispatchEvent(new CustomEvent('qr-manager-ai-entitlement-ready',{detail:{subscription:vm.managerSubscription||null,plan:plan||null}}));
    }catch(e){}
  }

  function tryInstall(){
    var vm=window.__managerVue;
    if(vm) install(vm);
  }

  window.addEventListener('qr-manager-vue-ready',tryInstall);
  window.addEventListener('qr-manager-subscription-ready',tryInstall);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tryInstall,{once:true});
  else tryInstall();
  [250,750,1500,3000].forEach(function(ms){setTimeout(tryInstall,ms);});
})();
