const { json, supabase, decryptSecret, yookassaGetPlatformPayment } = require('../../_lib/yookassa');

async function getVenuePayment(paymentId, venueId) {
  let accounts = await supabase(`payment_accounts?venue_id=eq.${encodeURIComponent(venueId)}&provider=eq.yookassa&account_scope=eq.venue&status=eq.active&select=credentials_ref&limit=1`);
  let account = Array.isArray(accounts) ? accounts[0] : null;
  if (!account) {
    const relations = await supabase(`manager_venues?venue_id=eq.${encodeURIComponent(venueId)}&select=manager_id&limit=1`);
    const managerId = Array.isArray(relations) && relations[0] ? relations[0].manager_id : null;
    if (managerId) {
      accounts = await supabase(`payment_accounts?manager_id=eq.${encodeURIComponent(managerId)}&account_scope=eq.platform&venue_id=is.null&provider=eq.yookassa&status=eq.active&select=credentials_ref&limit=1`);
      account = Array.isArray(accounts) ? accounts[0] : null;
    }
  }
  if (!account || !account.credentials_ref) throw new Error('payment_account_not_found');
  const token = decryptSecret(account.credentials_ref);
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok || !data || data.id !== paymentId) throw new Error(data && (data.description || data.message) || 'payment_verification_failed');
  return data;
}
function paymentStatus(status) { if (status === 'succeeded') return 'paid'; if (status === 'canceled') return 'cancelled'; return 'pending'; }
function ledgerStatus(status) { return ['succeeded','canceled','waiting_for_capture','pending'].includes(status) ? status : 'failed'; }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = req.body || {}, object = body.object || {}, paymentId = String(object.id || '').trim();
    if (!paymentId) return json(res, 400, { ok: false, error: 'payment_id_required' });

    const orders = await supabase(`orders?payment_id=eq.${encodeURIComponent(paymentId)}&select=id,order_number,venue_id,payment_id,payment_status,total_price&limit=1`);
    const order = Array.isArray(orders) ? orders[0] : null;
    if (order) {
      const payment = await getVenuePayment(paymentId, order.venue_id);
      const status = paymentStatus(payment.status);
      const patch = { payment_status: status };
      if (status === 'paid') patch.payment_paid_at = new Date().toISOString();
      await supabase(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });

      const relations = await supabase(`manager_venues?venue_id=eq.${encodeURIComponent(order.venue_id)}&select=manager_id&limit=1`);
      const managerId = Array.isArray(relations) && relations[0] ? relations[0].manager_id : null;
      const accounts = await supabase(`payment_accounts?venue_id=eq.${encodeURIComponent(order.venue_id)}&provider=yookassa&account_scope=eq.venue&select=id&limit=1`);
      let accountId = Array.isArray(accounts) && accounts[0] ? accounts[0].id : null;
      if (!accountId && managerId) {
        const shared = await supabase(`payment_accounts?manager_id=eq.${encodeURIComponent(managerId)}&provider=yookassa&account_scope=eq.platform&venue_id=is.null&select=id&limit=1`);
        accountId = Array.isArray(shared) && shared[0] ? shared[0].id : null;
      }
      if (managerId && accountId) {
        const tx = await supabase(`payment_transactions?order_id=eq.${encodeURIComponent(order.id)}&provider=yookassa&payment_type=eq.order&select=id&limit=1`);
        const payload = { venue_id: order.venue_id, manager_id: managerId, order_id: order.id, payment_account_id: accountId, provider: 'yookassa', payment_type: 'order', provider_payment_id: paymentId, amount: Number(order.total_price) || 0, currency: 'RUB', status: ledgerStatus(payment.status), payment_method: 'sbp', confirmation_url: payment.confirmation && payment.confirmation.confirmation_url || null, description: `Заказ №${order.order_number}`, metadata: { webhook_event: body.event || null }, paid_at: payment.status === 'succeeded' ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
        if (Array.isArray(tx) && tx.length) await supabase(`payment_transactions?id=eq.${encodeURIComponent(tx[0].id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
        else await supabase('payment_transactions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
      }
      return json(res, 200, { ok: true, type: 'order', payment_id: paymentId, status: payment.status });
    }

    const subscriptions = await supabase(`subscriptions?payment_id=eq.${encodeURIComponent(paymentId)}&select=id,venue_id,manager_id,plan_id,payment_id,payment_status,current_period_end&limit=1`);
    const subscription = Array.isArray(subscriptions) ? subscriptions[0] : null;
    if (subscription) {
      const payment = await yookassaGetPlatformPayment(paymentId), status = paymentStatus(payment.status), patch = { payment_status: status };
      if (status === 'paid') {
        const base = new Date(subscription.current_period_end || Date.now()), start = Math.max(base.getTime(), Date.now()), days = Number(process.env.SUBSCRIPTION_DURATION_DAYS || 30);
        const targetPlanId = payment.metadata && String(payment.metadata.qr_menu_plan_id || '').trim();
        patch.paid_at = new Date().toISOString();
        patch.status = 'active';
        patch.current_period_end = new Date(start + days * 86400000).toISOString();
        if (targetPlanId) patch.plan_id = targetPlanId;

        if (targetPlanId && subscription.manager_id && !subscription.venue_id) {
          const managerVenues = await supabase(`manager_venues?manager_id=eq.${encodeURIComponent(subscription.manager_id)}&select=venue_id`);
          const venueRows = Array.isArray(managerVenues) ? managerVenues : [];
          const newEnd = patch.current_period_end;
          for (const row of venueRows) {
            if (!row || !row.venue_id) continue;
            await supabase(`venues?id=eq.${encodeURIComponent(row.venue_id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ plan: targetPlanId, subscription_end: newEnd })
            });
            await supabase(`subscriptions?venue_id=eq.${encodeURIComponent(row.venue_id)}`, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ plan_id: targetPlanId, status: 'active', current_period_end: newEnd })
            });
          }
        }
      }
      await supabase(`subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      return json(res, 200, { ok: true, type: 'subscription', payment_id: paymentId, status: payment.status });
    }
    return json(res, 404, { ok: false, error: 'payment_record_not_found' });
  } catch (e) {
    console.error('[YooKassa webhook]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'webhook_failed' });
  }
};
