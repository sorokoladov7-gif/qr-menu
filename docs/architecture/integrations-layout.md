# Integration runtime layout

The integration backend is split into two boundaries under `/lib/integrations/`:

- control-plane modules remain at the integration root: `router.js`, `registry.js`, `manage.js`, `test.js`, and `sync-lock.js`;
- provider adapters live under `/lib/integrations/providers/`.

The provider adapter boundary currently contains `iiko.js`, `pos.js`, `saby-presto.js`, `poster.js`, `syrve.js`, `evotor.js`, and `frontpad.js`.

`router.js` is the canonical API integration dispatcher and loads adapters through `./providers/*`. `lib/jobs/integration-sync.js` invokes the same canonical provider adapters. This keeps provider-specific code separate from routing, registry, management, diagnostics, and synchronization infrastructure.

The relocation is a filesystem-level move using the existing Git blobs; provider source contents are not changed. Runtime URLs and API routes remain unchanged.
