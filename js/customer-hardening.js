window.customerTrackOrder = async function(venueId, phone){
  var r=await db.rpc('customer_track_order',{p_venue_id:venueId,p_phone:phone});
  if(r.error) throw new Error(r.error.message||'Не удалось получить заказ');
  return r.data;
};
window.customerChangeOrderStatus = async function(orderId, phone, status){
  var r=await db.rpc('customer_change_order_status',{p_order_id:orderId,p_phone:phone,p_status:status});
  if(r.error) throw new Error(r.error.message||'Не удалось изменить заказ');
  return r.data;
};
