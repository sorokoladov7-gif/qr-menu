const { json, randomToken, supabase, yookassaCreatePayment, decryptSecret, origin } = require('../../_lib/yookassa');

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

    const accounts = await supabase(`payment_accounts?venue_id=eq.${encodeURIComponent(order.venue_id)}&provider=eq.yookassa&account_scope=eq.venue&status=eq.active&select=id,credentials_ref,merchant_id,metadata&limit=1`);
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account || !account.credentials_ref) return json(res, 409, { ok: false, error: 'venue_payment_not_configured' });

    const token = decryptSecret(account.credentials_ref);
    const amount = Number(order.total_price);
    if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { ok: false, error: 'invalid_order_amount' });

    const payment = await yookassaCreatePayment(token, {
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      capture: true,
      payment_method_data: { type: 'sbp' },
      confirmation: {
        type: 'redirect',
        return_url: `${origin(req)}/menu.html?payment=order&order_id=${encodeURIComponent(order.id)}`
      },
      description: `Заказ №${order.order_number}`,
      metadata: {
        qr_menu_order_id: order.id,
        qr_menu_venue_id: order.venue_id
      }
    }, randomToken(24));

    await supabase(`orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_provider: 'yookassa',
        payment_id: payment.id,
        payment_status: payment.status || 'pending'
      })
    });

    const confirmationUrl = payment.confirmation && payment.confirmation.confirmation_url;
    if (!confirmationUrl) return json(res, 502, { ok: false, error: 'confirmation_url_missing' });
    return json(res, 200, {
      ok: true,
      payment_id: payment.id,
      status: payment.status,
      confirmation_url: confirmationUrl
    });
  } catch (e) {
    console.error('[YooKassa create order]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'payment_create_failed' });
  }
};
