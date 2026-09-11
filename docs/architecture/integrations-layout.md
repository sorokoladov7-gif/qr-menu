# Integration runtime layout

The integration backend is split into control-plane and adapter boundaries under `/lib/integrations/`:

- control-plane modules remain at the integration root: `router.js`, `registry.js`, `manage.js`, `test.js`, and `sync-lock.js`;
- provider adapters live under `/lib/integrations/providers/`;
- `providers/index.js` is the single adapter-loading boundary shared by HTTP routing and scheduled synchronization.

The provider adapter boundary currently contains `iiko.js`, `pos.js`, `saby-presto.js`, `poster.js`, `syrve.js`, `evotor.js`, and `frontpad.js`.

`quick_resto` and `r_keeper` intentionally resolve to the shared `pos.js` adapter while remaining separate provider IDs in the domain registry.

`router.js` owns API route dispatch and synchronization locking. `lib/jobs/integration-sync.js` consumes the same canonical adapter map instead of maintaining a second provider `require()` list. `registry.js` remains the source of provider capability/implementation metadata.

The reorganization is filesystem/module-boundary only. Provider runtime URLs, API route paths, and provider business contracts remain unchanged.
