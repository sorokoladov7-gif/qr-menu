'use strict';

const routes = {
  '/api/payments/yookassa/accounts': '../lib/payments/yookassa/accounts',
  '/api/payments/yookassa/callback': '../lib/payments/yookassa/callback',
  '/api/payments/yookassa/connect': '../lib/payments/yookassa/connect',
  '/api/payments/yookassa/create-order': '../lib/payments/yookassa/create-order',
  '/api/payments/yookassa/create-subscription': '../lib/payments/yookassa/create-subscription',
  '/api/payments/yookassa/status-order': '../lib/payments/yookassa/status-order',
  '/api/payments/yookassa/webhook': '../lib/payments/yookassa/webhook'
};

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  const modulePath = routes[pathname];
  if (!modulePath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'payment_route_not_found', path: pathname }));
  }
  try {
    const target = require(modulePath);
    return target(req, res);
  } catch (error) {
    console.error('[payments dispatcher]', error);
    res.statusCode = error && error.status || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: error && error.message || 'payment_dispatch_error' }));
  }
};
