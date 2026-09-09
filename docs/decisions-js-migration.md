# JS/shared migration decision

The target shared-JS directory is present at `src/assets/js/shared`, but existing production scripts were not moved in this cleanup pass.

The frontend is a legacy browser-global runtime with scripts loaded in specific HTML order and many `window.*` compatibility flags. Extracting common Supabase/auth helpers without first tracing every script include and global dependency can change initialization order and duplicate side effects. The migration is therefore deferred until a per-file dependency graph and browser smoke suite are available for every role.

The safe next step is additive: identify one isolated helper, add a module-compatible wrapper, run role-by-role smoke tests, then migrate callers one group at a time. No business logic is to be rewritten during that migration.
