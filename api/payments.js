'use strict';

const handlers = {
  '/api/payments/yookassa/accounts': require('../lib/payments/yookassa/accounts'),
  '/api/payments/yookassa/callback': require('../lib/payments/yookassa/callback'),
  '/api/payments/yookassa/connect': require('../lib/payments/yookassa/connect'),
  '/api/payments/yookassa/create-order': require('../lib/payments/yookassa/create-order'),
  '/api/payments/yookassa/create-subscription': require('../lib/payments/yookassa/create-subscription'),
  '/api/payments/yookassa/status-order': require('../lib/payments/yookassa/status-order'),
  '/api/payments/yookassa/webhook': require('../lib/payments/yookassa/webhook')
};

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  const target = handlers[pathname];
  if (!target) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'payment_route_not_found', path: pathname }));
  }
  return target(req, res);
};
