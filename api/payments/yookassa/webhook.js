const { json, supabase, decryptSecret, yookassaGetPlatformPayment } = require('../../_lib/yookassa');

async function getVenuePayment(paymentId, venueId) {
  const accounts = await supabase(`payment_accounts?venue_id=eq.${encodeURIComponent(venueId)}&provider=eq.yookassa&account_scope=eq.venue&status=eq.active&select=credentials_ref&limit=1`);
  const account = Array.isArray(accounts) ? accounts[0] : null;
  if (!account || !account.credentials_ref) throw new Error('payment_account_not_found');
  const token = decryptSecret(account.credentials_ref);
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok || !data || data.id !== paymentId) throw new Error(data && (data.description || data.message) || 'payment_verification_failed');
  return data;
}
function paymentStatus(status){if(status==='succeeded')return'paid';if(status==='canceled')return'cancelled';return'pending';}

module.exports = async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const body=req.body||{};const object=body.object||{};const paymentId=String(object.id||'').trim();
    if(!paymentId)return json(res,400,{ok:false,error:'payment_id_required'});

    const orders=await supabase(`orders?payment_id=eq.${encodeURIComponent(paymentId)}&select=id,venue_id,payment_id,payment_status&limit=1`);
    const order=Array.isArray(orders)?orders[0]:null;
    if(order){
      const payment=await getVenuePayment(paymentId,order.venue_id);const status=paymentStatus(payment.status);const patch={payment_status:status};
      if(status==='paid')patch.payment_paid_at=new Date().toISOString();
      await supabase(`orders?id=eq.${encodeURIComponent(order.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
      return json(res,200,{ok:true,type:'order',payment_id:paymentId,status:payment.status});
    }

    const subscriptions=await supabase(`subscriptions?payment_id=eq.${encodeURIComponent(paymentId)}&select=id,venue_id,manager_id,payment_id,payment_status,current_period_end&limit=1`);
    const subscription=Array.isArray(subscriptions)?subscriptions[0]:null;
    if(subscription){
      const payment=await yookassaGetPlatformPayment(paymentId);const status=paymentStatus(payment.status);const patch={payment_status:status};
      if(status==='paid'){
        const base=new Date(subscription.current_period_end||Date.now());
        const start=Math.max(base.getTime(),Date.now());
        const days=Number(process.env.SUBSCRIPTION_DURATION_DAYS||30);
        patch.paid_at=new Date().toISOString();
        patch.status='active';
        patch.current_period_end=new Date(start+days*86400000).toISOString();
      }
      await supabase(`subscriptions?id=eq.${encodeURIComponent(subscription.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
      return json(res,200,{ok:true,type:'subscription',payment_id:paymentId,status:payment.status});
    }
    return json(res,404,{ok:false,error:'payment_record_not_found'});
  }catch(e){console.error('[YooKassa webhook]',e);return json(res,e.status||500,{ok:false,error:e.message||'webhook_failed'});}
};
