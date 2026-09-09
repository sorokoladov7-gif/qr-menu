'use strict';

let initialized = false;
let sentry = null;

function getSentry() {
  if (initialized) return sentry;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    // Optional dependency: production monitoring is enabled only when DSN is configured.
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || 'production',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0,
    });
    return sentry;
  } catch (error) {
    sentry = null;
    return null;
  }
}

function captureException(error, context) {
  const client = getSentry();
  if (!client) return;
  client.withScope((scope) => {
    if (context && typeof context === 'object') scope.setExtras(context);
    client.captureException(error);
  });
}

module.exports = { getSentry, captureException };
