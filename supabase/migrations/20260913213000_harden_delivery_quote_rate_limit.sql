begin;

-- delivery-quote is intentionally public because guest checkout can request a quote
-- before authentication. Keep abuse-control state outside the Data API surface.
create schema if not exists private;

create table if not exists private.delivery_quote_rate_limits (
  id bigint generated always as identity primary key,
  ip_key text not null,
  venue_id uuid not null,
  window_started timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz not null default now(),
  unique (ip_key, venue_id)
);

create index if not exists delivery_quote_rate_limits_window_idx
  on private.delivery_quote_rate_limits (window_started);

revoke all on schema private from public, anon, authenticated;
revoke all on private.delivery_quote_rate_limits from public, anon, authenticated;

create or replace function public.delivery_quote_rate_limit(
  p_venue_id uuid,
  p_ip_key text,
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_window_started timestamptz;
  v_request_count integer;
  v_now timestamptz := now();
  v_allowed boolean;
begin
  if p_venue_id is null then raise exception 'venue_required'; end if;
  if nullif(trim(p_ip_key), '') is null then raise exception 'ip_required'; end if;
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'invalid_rate_limit'; end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_ip_key) || '|' || p_venue_id::text, 0));

  select window_started, request_count
    into v_window_started, v_request_count
    from private.delivery_quote_rate_limits
   where ip_key = trim(p_ip_key) and venue_id = p_venue_id
   for update;

  if v_window_started is null or v_window_started < v_now - make_interval(secs => p_window_seconds) then
    v_window_started := v_now;
    v_request_count := 0;
  end if;

  v_request_count := coalesce(v_request_count, 0) + 1;
  v_allowed := v_request_count <= p_limit;

  insert into private.delivery_quote_rate_limits
    (ip_key, venue_id, window_started, request_count, last_request_at)
  values
    (trim(p_ip_key), p_venue_id, v_window_started, v_request_count, v_now)
  on conflict (ip_key, venue_id) do update set
    window_started = excluded.window_started,
    request_count = excluded.request_count,
    last_request_at = excluded.last_request_at;

  return jsonb_build_object(
    'allowed', v_allowed,
    'limit', p_limit,
    'window_seconds', p_window_seconds,
    'request_count', v_request_count,
    'retry_after_seconds', case
      when v_allowed then 0
      else greatest(1, ceil(extract(epoch from (v_window_started + make_interval(secs => p_window_seconds) - v_now)))::integer)
    end
  );
end;
$function$;

revoke execute on function public.delivery_quote_rate_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.delivery_quote_rate_limit(uuid,text,integer,integer) to service_role;

commit;
