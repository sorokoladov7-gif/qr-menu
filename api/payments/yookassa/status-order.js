const { json, supabase, decryptSecret, yookassaGetPayment } = require('../../_lib/yookassa');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = req.body || {};
    const query = req.query || {};
    const orderId = String(body.order_id || query.order_id || '').trim();
    if (!orderId) return json(res, 400, { ok: false, error: 'order_id_required' });

    const orders = await supabase(
      `orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,venue_id,total_price,payment_method,payment_status,payment_provider,payment_id&limit=1`
    );
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) return json(res, 404, { ok: false, error: 'order_not_found' });

    if (order.payment_method !== 'card') {
      return json(res, 200, {
        ok: true,
        order_id: order.id,
        payment_required: false,
        payment_status: order.payment_status || null
      });
    }

    if (!order.payment_id || order.payment_provider !== 'yookassa') {
      return json(res, 200, {
        ok: true,
        order_id: order.id,
        payment_required: true,
        payment_status: order.payment_status || 'pending',
        payment_id: null
      });
    }

    const accounts = await supabase(
      `payment_accounts?venue_id=eq.${encodeURIComponent(order.venue_id)}&provider=eq.yookassa&account_scope=eq.venue&status=eq.active&select=id,credentials_ref&limit=1`
    );
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account || !account.credentials_ref) {
      return json(res, 409, { ok: false, error: 'venue_payment_not_configured' });
    }

    const token = decryptSecret(account.credentials_ref);
    const payment = await yookassaGetPayment(token, order.payment_id);
    const status = String(payment.status || order.payment_status || 'pending');
    const paid = status === 'succeeded';

    if (status !== order.payment_status) {
      await supabase(`orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ payment_status: status })
      });
    }

    return json(res, 200, {
      ok: true,
      order_id: order.id,
      payment_id: payment.id,
      payment_required: true,
      payment_status: status,
      paid,
      confirmation_url: payment.confirmation && payment.confirmation.confirmation_url || null
    });
  } catch (e) {
    console.error('[YooKassa order status]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'payment_status_failed' });
  }
};