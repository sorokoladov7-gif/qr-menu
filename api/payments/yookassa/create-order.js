const { json, randomToken, supabase, yookassaCreatePayment, decryptSecret, origin } = require('../../_lib/yookassa');

async function findAccount(venueId) {
  let accounts = await supabase(`payment_accounts?venue_id=eq.${encodeURIComponent(venueId)}&provider=eq.yookassa&account_scope=eq.venue&status=eq.active&select=id,credentials_ref,merchant_id,metadata&limit=1`);
  let account = Array.isArray(accounts) ? accounts[0] : null;
  if (account) return account;
  const relations = await supabase(`manager_venues?venue_id=eq.${encodeURIComponent(venueId)}&select=manager_id&limit=1`);
  const managerId = Array.isArray(relations) && relations[0] ? relations[0].manager_id : null;
  if (!managerId) return null;
  accounts = await supabase(`payment_accounts?manager_id=eq.${encodeURIComponent(managerId)}&account_scope=eq.platform&venue_id=is.null&provider=eq.yookassa&status=eq.active&select=id,credentials_ref,merchant_id,metadata&limit=1`);
  return Array.isArray(accounts) ? accounts[0] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = req.body || {};
    const orderId = String(body.order_id || '').trim();
    if (!orderId) return json(res, 400, { ok: false, error: 'order_id_required' });

    const orders = await supabase(`orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,venue_id,total_price,payment_method,payment_status,payment_provider,payment_id&limit=1`);
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) return json(res, 404, { ok: false, error: 'order_not_found' });
    if (order.payment_method !== 'sbp') return json(res, 400, { ok: false, error: 'order_payment_method_not_sbp' });
    if (order.payment_status === 'paid' || order.payment_status === 'succeeded') return json(res, 409, { ok: false, error: 'order_already_paid' });

    const account = await findAccount(order.venue_id);
    if (!account || !account.credentials_ref) return json(res, 409, { ok: false, error: 'venue_payment_not_configured' });

    if (order.payment_id && order.payment_provider === 'yookassa') {
      try {
        const { yookassaGetPayment } = require('../../_lib/yookassa');
        const existing = await yookassaGetPayment(decryptSecret(account.credentials_ref), order.payment_id);
        return json(res, 200, { ok: true, payment_id: existing.id, status: existing.status, confirmation_url: existing.confirmation && existing.confirmation.confirmation_url || null, reused: true });
      } catch (_) {}
    }

    const amount = Number(order.total_price);
    if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { ok: false, error: 'invalid_order_amount' });

    const relations = await supabase(`manager_venues?venue_id=eq.${encodeURIComponent(order.venue_id)}&select=manager_id&limit=1`);
    const managerId = Array.isArray(relations) && relations[0] ? relations[0].manager_id : null;
    if (!managerId) return json(res, 409, { ok: false, error: 'venue_manager_not_found' });

    const idempotenceKey = `order:${order.id}:${order.payment_id || 'new'}`;
    const payment = await yookassaCreatePayment(decryptSecret(account.credentials_ref), {
      amount: { value: amount.toFixed(2), currency: 'RUB' }, capture: true,
      payment_method_data: { type: 'sbp' },
      confirmation: { type: 'redirect', return_url: `${origin(req)}/menu.html?payment=order&order_id=${encodeURIComponent(order.id)}` },
      description: `Заказ №${order.order_number}`,
      metadata: { qr_menu_order_id: order.id, qr_menu_venue_id: order.venue_id }
    }, idempotenceKey);

    await supabase(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_provider: 'yookassa', payment_id: payment.id, payment_status: payment.status || 'pending' }) });

    const transactionRows = await supabase(`payment_transactions?order_id=eq.${encodeURIComponent(order.id)}&provider=eq.yookassa&payment_type=eq.order&select=id&limit=1`);
    const transactionPayload = {
      venue_id: order.venue_id, manager_id: managerId, order_id: order.id, subscription_id: null,
      payment_account_id: account.id, provider: 'yookassa', payment_type: 'order', provider_payment_id: payment.id,
      amount, currency: 'RUB', status: payment.status || 'pending', payment_method: 'sbp',
      confirmation_url: payment.confirmation && payment.confirmation.confirmation_url || null,
      description: `Заказ №${order.order_number}`,
      metadata: { source: 'qr-menu', venue_id: order.venue_id, order_id: order.id }, updated_at: new Date().toISOString()
    };
    if (Array.isArray(transactionRows) && transactionRows.length) {
      await supabase(`payment_transactions?id=eq.${encodeURIComponent(transactionRows[0].id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(transactionPayload) });
    } else {
      await supabase('payment_transactions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(transactionPayload) });
    }

    const confirmationUrl = payment.confirmation && payment.confirmation.confirmation_url;
    if (!confirmationUrl) return json(res, 502, { ok: false, error: 'confirmation_url_missing' });
    return json(res, 200, { ok: true, payment_id: payment.id, status: payment.status, confirmation_url: confirmationUrl, reused: false });
  } catch (e) {
    console.error('[YooKassa create order]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'payment_create_failed' });
  }
};
