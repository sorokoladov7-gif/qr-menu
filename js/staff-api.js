/* Secure staff API: no direct table access from staff pages. */
(function(){
  window.StaffAPI = {
    login: async function(type, slug, pin){
      const {data,error}=await db.rpc('staff_login',{p_type:type,p_slug:slug,p_pin:pin});
      if(error) throw error; return data;
    },
    orders: async function(token){
      const {data,error}=await db.rpc('staff_orders',{p_token:token});
      if(error) throw error; return data||[];
    },
    update: async function(token,id,status){
      const {data,error}=await db.rpc('staff_update_order',{p_token:token,p_order_id:id,p_status:status});
      if(error) throw error; return data;
    },
    history: async function(token){
      const {data,error}=await db.rpc('staff_history',{p_token:token});
      if(error) throw error; return data||[];
    },
    logout: async function(token){ try{await db.rpc('staff_logout',{p_token:token});}catch(e){} }
  };
})();
