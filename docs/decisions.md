# Architectural decisions — full cleanup

## 2026-09-09 — Full `/src` migration deferred

**Decision:** Do not physically move the production HTML/JS/CSS tree in this cleanup branch.

**Reason:** The repository currently uses root-level production URLs, relative asset references, Service Worker precaching/injection, multiple PWA manifests, and compatibility bridge files. A safe move requires a complete dependency graph plus coordinated URL/relative-path migration and regression testing for every role. Blind moves would violate the requirement not to change working business logic.

**Impact:** The requested `/src/pages/*` and `/src/assets/*` hierarchy is not yet the canonical runtime location. A directory skeleton may be introduced, but production files remain where they are until migration can be validated end-to-end.

## 2026-09-09 — `menu.html` and `menu-v2.html` preserved

**Decision:** Do not delete either menu implementation in this branch.

**Reason:** Both files exist in production and the current source tree alone does not prove that `menu-v2.html` is a drop-in replacement for every deep link, query parameter, embedded script, and generated URL. The two versions must first be compared against all references and runtime flows.

**Impact:** No business-facing menu URL was changed. Deduplication is deferred.

## 2026-09-09 — Temporary/legacy file deletion deferred

**Decision:** Do not remove demo, compatibility, verification, or versioned implementation files solely because their names look temporary.

**Reason:** The current repository contains active bridge/runtime code and recent production fixes. File-name heuristics are insufficient proof of dead code; deletion requires repository-wide reference analysis and execution coverage.

**Impact:** Cleanup prioritizes configuration/docs and provably stale references in the Service Worker rather than speculative source deletion.

## 2026-09-09 — Client Supabase publishable key treatment

**Decision:** Remove the public Supabase key from `vercel.json`, but do not introduce a new runtime configuration transport for static browser pages in this branch.

**Reason:** The key is a publishable/anon client credential, not a service-role secret, and the static application already expects browser-side configuration. Replacing its transport would require coordinated frontend changes. Server-side service-role, management, payment, AI and integration credentials remain environment-only.

**Impact:** `vercel.json` no longer acts as committed environment storage. The public browser key remains subject to normal publishable-key handling and should be rotated if the project's security policy requires it.
