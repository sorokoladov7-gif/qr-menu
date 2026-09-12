# Sentry

Sentry support is provided by `lib/observability/sentry.js`.

Set these Vercel environment variables:

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`

The helper is intentionally optional: when no DSN is configured, it is a no-op. Server handlers can import it and call `captureException(error, context)` without changing their primary business flow.

For production, configure Sentry in the Vercel project rather than committing DSNs or other credentials.
