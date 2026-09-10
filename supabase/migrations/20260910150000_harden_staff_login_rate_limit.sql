begin;

-- Protect the intentionally-anonymous staff PWA login from PIN brute force.
-- Keep the rate-limit state outside the Data API surface.
create schema if not exists private;

create table if not exists private.staff_login_rate_limits (
  id bigint generated always as identity primary key,
  ip_key text not null,
  venue_id uuid not null,
  staff_type text not null check (staff_type in ('cook','courier','waiter')),
  window_started timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  unique (ip_key, venue_id, staff_type)
);

create index if not exists staff_login_rate_limits_locked_until_idx
  on private.staff_login_rate_limits (locked_until);

revoke all on schema private from public, anon, authenticated;
revoke all on private.staff_login_rate_limits from public, anon, authenticated;

create or replace function public.staff_login(p_type text, p_slug text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_venue_id uuid;
  v_venue_name text;
  v_staff_id uuid;
  v_staff_name text;
  v_token text;
  v_expires timestamptz;
  v_ip_key text;
  v_window_started timestamptz;
  v_failed_attempts integer;
  v_locked_until timestamptz;
begin
  delete from public.staff_sessions where expires_at < now() - interval '7 days';

  if p_type not in ('cook','courier','waiter') then raise exception 'invalid_staff_type'; end if;
  if nullif(trim(p_slug),'') is null or nullif(trim(p_pin),'') is null then raise exception 'slug_or_pin_required'; end if;

  select id, name into v_venue_id, v_venue_name from public.venues
   where lower(slug) = lower(trim(p_slug)) and status = 'active' limit 1;
  if v_venue_id is null then raise exception 'venue_not_found'; end if;

  v_ip_key := coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), 'unknown');

  perform pg_advisory_xact_lock(hashtextextended(v_ip_key || '|' || v_venue_id::text || '|' || p_type, 0));

  select window_started, failed_attempts, locked_until
    into v_window_started, v_failed_attempts, v_locked_until
    from private.staff_login_rate_limits
   where ip_key = v_ip_key and venue_id = v_venue_id and staff_type = p_type
   for update;

  if v_locked_until is not null and v_locked_until > now() then
    -- Do not raise here: the failure counter must survive the request.
    return jsonb_build_object('error', 'staff_login_rate_limited');
  end if;

  if v_window_started is null or v_window_started < now() - interval '10 minutes' then
    v_window_started := now(); v_failed_attempts := 0; v_locked_until := null;
  end if;

  if p_type = 'cook' then
    select id, name into v_staff_id, v_staff_name from public.cooks where venue_id = v_venue_id and is_active = true and pin = extensions.crypt(trim(p_pin), pin) limit 1;
  elsif p_type = 'courier' then
    select id, name into v_staff_id, v_staff_name from public.couriers where venue_id = v_venue_id and is_active = true and pin = extensions.crypt(trim(p_pin), pin) limit 1;
  elsif p_type = 'waiter' then
    select id, name into v_staff_id, v_staff_name from public.waiters where venue_id = v_venue_id and is_active = true and pin = extensions.crypt(trim(p_pin), pin) limit 1;
  end if;

  if v_staff_id is null then
    v_failed_attempts := coalesce(v_failed_attempts, 0) + 1;

    insert into private.staff_login_rate_limits (ip_key, venue_id, staff_type, window_started, failed_attempts, locked_until, last_attempt_at)
    values (v_ip_key, v_venue_id, p_type, v_window_started, v_failed_attempts, case when v_failed_attempts >= 5 then now() + interval '15 minutes' else null end, now())
    on conflict (ip_key, venue_id, staff_type) do update set
      window_started = excluded.window_started,
      failed_attempts = excluded.failed_attempts,
      locked_until = excluded.locked_until,
      last_attempt_at = excluded.last_attempt_at;

    -- Keep the existing client contract: staff pages already handle data.error.
    return jsonb_build_object('error', 'wrong_pin');
  end if;

  delete from private.staff_login_rate_limits where ip_key = v_ip_key and venue_id = v_venue_id and staff_type = p_type;

  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_expires := now() + interval '12 hours';
  insert into public.staff_sessions (staff_type, staff_id, venue_id, token, expires_at) values (p_type, v_staff_id, v_venue_id, v_token, v_expires);

  return jsonb_build_object('staffId', v_staff_id, 'staffName', v_staff_name, 'venueId', v_venue_id, 'venueName', v_venue_name, 'token', v_token, 'expiresAt', extract(epoch from v_expires)::bigint * 1000);
end;
$function$;

revoke execute on function public.staff_login(text,text,text) from public;
grant execute on function public.staff_login(text,text,text) to anon, service_role;

commit;
