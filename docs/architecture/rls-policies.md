# Supabase RLS policy model

This document describes the intended authorization boundary for QR Menu. It is a review document, not a migration: no production RLS policy is changed by this file.

## Core rules

1. Enable RLS on every tenant-scoped table.
2. Prefer `auth.uid()` and server-side/RPC checks over client-side role flags.
3. Tenant access must be derived from authoritative relationships such as `manager_venues`, `manager_venue_permissions`, the user's `profile.venue_id`, staff identity/token tables, or an explicit server-side RPC.
4. Separate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies where permissions differ.
5. Always use both `USING` and `WITH CHECK` for `UPDATE` when an attacker could move a row between tenants.
6. Keep `service_role`/management credentials server-only.
7. For `SECURITY DEFINER` RPCs, explicitly grant execution only to intended roles and avoid inherited `PUBLIC` execution.
8. Public/customer order RPCs should expose only the fields and operations required for order placement; never expose tenant-wide management data.

Recent hardening already follows these principles in several areas: admin DML policies are restricted to `authenticated`, broad `PUBLIC` RPC execution is revoked for staff functions, and public order execution is explicitly granted to `anon`/`service_role` for the intended endpoint. See the corresponding migrations in `supabase/migrations`.

## Role matrix

| Role | Read | Write | Critical boundary |
| --- | --- | --- | --- |
| Anonymous guest | Public menu/configuration and public order inputs only | Create a public order and explicitly permitted table-call endpoints | Must never read staff, manager, billing, subscriptions, integrations, or private analytics. |
| Waiter | Assigned venue/table/order/customer-service data | Assigned operational actions, table/session and order operations exposed by staff RPCs | Scope every read/write to the authenticated/validated staff identity and venue. |
| Cook | Kitchen queue, recipe/tech-card data allowed by venue | Production status actions and recipe operations explicitly assigned to cook | No customer billing, manager settings, subscriptions, or unrelated venue data. |
| Courier | Delivery jobs assigned to courier | Delivery status/location workflow allowed by role | No menu administration, staff administration, billing, or unrelated orders. |
| Manager | Venues explicitly owned/assigned; menu, staff, settings, integrations allowed by entitlements | Only tenant-scoped management operations; billing/subscription actions only through dedicated guarded paths | Never infer authorization from a URL/venue ID alone. Verify relationship in RLS/RPC. |
| Admin | Platform-wide operational data required by admin UI | Platform management operations | Require `authenticated` plus authoritative admin role; do not expose admin DML to `anon`. |
| Service role | Server-side only | Server-side operations required by trusted backend | Never use this key in browser code. Treat it as equivalent to full DB authority. |

## Manager example

The current manager policy style checks both the `manager_venues` relationship and explicit `manager_venue_permissions`, with an admin exception. This is the preferred shape for tenant-scoped manager operations:

```sql
using (
  exists (
    select 1
    from public.manager_venues mv
    where mv.venue_id = target_table.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1
    from public.manager_venue_permissions p
    where p.venue_id = target_table.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
```

Use a canonical helper (for example an existing `is_admin()` function) where available rather than duplicating subtly different admin predicates across dozens of policies.

## Staff RPCs

Token-bearing staff RPCs need explicit execution ACLs and server-side validation of the presented token/session. A recent migration revokes `PUBLIC` execution for the staff/table/order RPC set while retaining the intentionally supported anonymous/authenticated grants. Do not re-add blanket `GRANT EXECUTE ... TO PUBLIC` as a convenience fix.

## Admin policies

Admin DML should target `authenticated` and validate `auth.uid()` against the authoritative admin role. The current hardening migration follows this model for plans and venues. UI hiding is not an authorization control.

## Public orders

The public order creation function is intentionally anonymous-facing. Keep the function narrow and validate venue/menu/product identifiers, pricing, idempotency, and allowed modifiers inside the trusted function path. Do not solve RLS errors by granting broad table writes to `anon`.

## Review checklist for future migrations

- Does the policy identify the tenant from database relationships rather than user-supplied fields?
- Does `INSERT` use `WITH CHECK`?
- Does `UPDATE` have both `USING` and `WITH CHECK` when appropriate?
- Is the policy target role `anon`, `authenticated`, `service_role`, or a deliberately narrow combination?
- Could `PUBLIC` inherit an unsafe `EXECUTE` permission?
- Could a manager alter a foreign venue ID or bypass a subscription/entitlement check?
- Does the policy accidentally expose personal, billing, AI-usage, integration credentials, or internal analytics?
- Are security-definer functions hardened with an explicit `search_path` and narrow grants?

## Source migrations reviewed

- `20260908_consolidate_manager_rls_policies.sql`
- `20260908_consolidate_public_staff_execute_acl.sql`
- `20260908_restrict_admin_rls_to_authenticated.sql`
- `20260908_restrict_public_order_execute_final.sql`
