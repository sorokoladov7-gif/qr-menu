const { json, randomToken, supabase, getSupabaseUser, bearer, origin, yookassaCreatePlatformPayment } = require('../../_lib/yookassa');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const user = await getSupabaseUser(bearer(req));
    if (!user) return json(res, 401, { ok: false, error: 'auth_required' });

    const body = req.body || {};
    const subscriptionId = String(body.subscription_id || '').trim();
    if (!subscriptionId) return json(res, 400, { ok: false, error: 'subscription_id_required' });

    const rows = await supabase(`subscriptions?id=eq.${encodeURIComponent(subscriptionId)}&manager_id=eq.${encodeURIComponent(user.id)}&select=id,manager_id,venue_id,plan_id,status,payment_status,payment_id,current_period_end&limit=1`);
    const subscription = Array.isArray(rows) ? rows[0] : null;
    if (!subscription) return json(res, 404, { ok: false, error: 'subscription_not_found' });
    if (subscription.payment_status === 'paid' && subscription.status === 'active') return json(res, 409, { ok: false, error: 'subscription_already_paid' });

    const configuredAmount = Number(process.env.SUBSCRIPTION_PRICE_BUSINESS_RUB || 0);
    if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) return json(res, 503, { ok: false, error: 'subscription_price_not_configured' });

    const payment = await yookassaCreatePlatformPayment({
      amount: { value: configuredAmount.toFixed(2), currency: 'RUB' },
      capture: true,
      payment_method_data: { type: 'sbp' },
      confirmation: {
        type: 'redirect',
        return_url: `${origin(req)}/manager.html?payment=subscription&subscription_id=${encodeURIComponent(subscription.id)}`
      },
      description: `Подписка OS QR-Меню — ${subscription.plan_id}`,
      metadata: {
        qr_menu_subscription_id: subscription.id,
        qr_menu_manager_id: subscription.manager_id,
        qr_menu_plan_id: subscription.plan_id
      }
    }, randomToken(24));

    await supabase(`subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ payment_provider: 'yookassa', payment_id: payment.id, payment_status: payment.status || 'pending' })
    });

    const confirmationUrl = payment.confirmation && payment.confirmation.confirmation_url;
    if (!confirmationUrl) return json(res, 502, { ok: false, error: 'confirmation_url_missing' });
    return json(res, 200, { ok: true, payment_id: payment.id, status: payment.status, confirmation_url: confirmationUrl, amount: configuredAmount });
  } catch (e) {
    console.error('[YooKassa create subscription]', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'subscription_payment_create_failed' });
  }
};
