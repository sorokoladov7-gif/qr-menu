# Architectural decisions — full cleanup

## 2026-09-09 — Role-page filesystem migration

**Decision:** Physically relocate the 16 production role-oriented HTML entrypoints into `/src/pages/{guest,staff,manager,admin,auth}` while preserving their existing document contents.

**Reason:** The requested role-based source hierarchy is useful for maintenance, but the frontend relies on root-relative runtime assets, browser globals, script side effects, Service Worker precaching, PWA manifests, and compatibility bridges. The safe approach is therefore to move the HTML blobs without rewriting their runtime logic, then preserve the old production URLs and page-relative asset resolution at the hosting layer.

**Impact:** GitHub detects the 16 page changes as pure renames with zero content additions/deletions. Legacy URLs remain available through Vercel redirects; existing `/css`, `/js`, `/img`, and `/icons` runtime locations remain unchanged. `/api`, `/lib`, `/supabase`, and `/docs` remain root-level boundaries.

## 2026-09-09 — `/src/assets` migration remains staged

**Decision:** Do not mass-move the production CSS/JS/image/icon tree yet.

**Reason:** Existing frontend files use root-absolute paths, browser globals, side effects, compatibility bridges, Service Worker references, and multiple PWA manifests. Moving those assets requires repository-wide reference analysis and role-by-role runtime validation.

**Impact:** `/src/assets/{css,js,img,icons}` is only a prepared target structure. Production asset URLs continue to resolve from the existing root-level directories.

## 2026-09-09 — `menu.html` and `menu-v2.html` preserved

**Decision:** Do not delete either menu implementation in this branch.

**Reason:** Both files exist in production and the current source tree alone does not prove that `menu-v2.html` is a drop-in replacement for every deep link, query parameter, embedded script, and generated URL. The two versions must first be compared against all references and runtime flows.

**Impact:** Both menu entrypoints remain available. Deduplication is deferred.

## 2026-09-09 — Temporary/legacy file deletion deferred

**Decision:** Do not remove demo, compatibility, verification, or versioned implementation files solely because their names look temporary.

**Reason:** The current repository contains active bridge/runtime code and recent production fixes. File-name heuristics are insufficient proof of dead code; deletion requires repository-wide reference analysis and execution coverage.

**Impact:** Cleanup prioritizes configuration/docs and provably stale references rather than speculative source deletion.

## 2026-09-09 — Client Supabase publishable key treatment

**Decision:** Remove the public Supabase key from `vercel.json`, but do not introduce a new runtime configuration transport for static browser pages in this branch.

**Reason:** The key is a publishable/anon client credential, not a service-role secret, and the static application already expects browser-side configuration. Replacing its transport would require coordinated frontend changes. Server-side service-role, management, payment, AI and integration credentials remain environment-only.

**Impact:** `vercel.json` no longer acts as committed environment storage. The public browser key remains subject to normal publishable-key handling and should be rotated if the project's security policy requires it.

## 2026-09-09 — Qrchick action execution gate

**Decision:** Qrchick action execution remains separate from the intelligence layer and is exposed through the existing `/api/admin-ai-audit` compatibility route to `admin-ai-isolated.js`. Code and database changes are validated server-side before execution.

**Reason:** The existing UI already presents an explicit administrator confirmation before sending `apply` / `apply_db`. The previous gateway did not implement code application at all, and database application accepted raw change sets after client-side confirmation. The new gateway adds administrator authentication, code path/SHA validation, SQL safety validation, optional cryptographic approval tokens with a five-minute TTL, and atomic Git tree/commit/ref updates for multi-file code changes.

**Impact:** Qrchick can now perform real approved repository and database actions instead of returning analysis-only responses. Code changes are only applied to existing files, require an `expected_sha`, and are written as one Git commit on `main`; stale proposals are rejected. Database changes remain capped and blocked for sensitive privilege/server-file/truncate operations. No production database mutation is performed automatically by the assistant during development of this block.

## 2026-09-09 — Qrchick menu business operations

**Decision:** Natural-language menu requests are treated as real operational requests against the canonical `public.products` table, using the existing Qrchick action gateway rather than a parallel AI-specific persistence layer.

**Reason:** The production menu runtime already loads venue products from `public.products`. Qrchick must resolve the actual venue/product against live Supabase data before proposing a mutation, rather than inventing identifiers or keeping a shadow state.

**Operational rules:** Creation uses an explicit `INSERT` with the real `venue_id` and existing product columns. Updates use an unambiguous product id or exact live-data resolution. A request to remove a dish defaults to `is_available=false` unless the administrator explicitly requests physical deletion. Mutating statements should use `RETURNING id,name,price,category,is_available` so the execution result can be reported from the database.

**Impact:** The intended path is now user command → live schema/data inspection → `database_changes` proposal → explicit administrator confirmation → privileged execution → actual returned result. No production SQL was executed while implementing this business-action block.
