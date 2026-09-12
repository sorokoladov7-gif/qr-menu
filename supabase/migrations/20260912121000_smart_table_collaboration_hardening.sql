begin;

create or replace function public.smart_table_add_item(p_guest_token text,p_product_id uuid,p_qty integer default 1,p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_product public.products%rowtype; v_item public.table_shared_cart_items%rowtype;
begin
  if p_qty<1 or p_qty>99 then raise exception 'invalid_item_quantity'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select p.* into v_product from public.products p
    where p.id=p_product_id and p.is_available=true and p.category<>'addon'
      and exists(select 1 from public.table_sessions ts where ts.id=v_guest.table_session_id and ts.venue_id=p.venue_id and ts.status='active')
    limit 1;
  if v_product.id is null then raise exception 'product_not_available'; end if;
  insert into public.table_shared_cart_items(table_session_id,guest_id,product_id,item_name,unit_price,qty,note)
    values(v_guest.table_session_id,v_guest.id,v_product.id,v_product.name,v_product.price,p_qty,nullif(trim(p_note),''))
    on conflict(table_session_id,guest_id,product_id) do update set qty=least(99,public.table_shared_cart_items.qty+excluded.qty),note=coalesce(excluded.note,public.table_shared_cart_items.note),updated_at=now()
    returning * into v_item;
  update public.table_guest_sessions set last_seen_at=now() where id=v_guest.id;
  return jsonb_build_object('ok',true,'item_id',v_item.id);
end;
$$;

grant execute on function public.smart_table_add_item(text,uuid,integer,text) to anon,authenticated;

create or replace function public.smart_table_assign_item(p_guest_token text,p_item_id uuid,p_target_guest_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_target public.table_guest_sessions%rowtype;
begin
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select * into v_target from public.table_guest_sessions where id=p_target_guest_id and table_session_id=v_guest.table_session_id and left_at is null limit 1;
  if v_target.id is null then raise exception 'guest_not_found'; end if;
  update public.table_shared_cart_items set assigned_guest_id=v_target.id,updated_at=now() where id=p_item_id and table_session_id=v_guest.table_session_id;
  if not found then raise exception 'item_not_found'; end if;
  return jsonb_build_object('ok',true,'item_id',p_item_id,'assigned_guest_id',v_target.id);
end;
$$;

grant execute on function public.smart_table_assign_item(text,uuid,uuid) to anon,authenticated;

create or replace function public.smart_table_split_preview(p_guest_token text,p_mode text default 'items')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_total numeric; v_count integer; v_guests jsonb;
begin
  if p_mode not in ('items','equal','partial') then raise exception 'invalid_split_mode'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select count(*),coalesce(sum(i.unit_price*i.qty),0) into v_count,v_total from public.table_shared_cart_items i where i.table_session_id=v_guest.table_session_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'guest_id',g.id,
    'guest_name',coalesce(g.guest_name,'Гость'),
    'amount',case when p_mode='equal' then round(v_total/gc.cnt,2) else coalesce(x.amount,0) end
  ) order by g.joined_at),'[]'::jsonb') into v_guests
  from public.table_guest_sessions g
  cross join (select count(*)::numeric cnt from public.table_guest_sessions gg where gg.table_session_id=v_guest.table_session_id and gg.left_at is null) gc
  left join (select guest_id,sum(unit_price*qty) amount from public.table_shared_cart_items where table_session_id=v_guest.table_session_id group by guest_id) x on x.guest_id=g.id
  where g.table_session_id=v_guest.table_session_id and g.left_at is null and gc.cnt>0;
  return jsonb_build_object('ok',true,'mode',p_mode,'total',v_total,'guests',v_guests);
end;
$$;

grant execute on function public.smart_table_split_preview(text,text) to anon,authenticated;

create or replace function public.smart_table_get_context_by_token(p_qr_token text,p_language text default 'ru')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.venue_tables where qr_token=trim(p_qr_token) and is_active=true limit 1;
  if v_venue_id is null then raise exception 'table_not_found'; end if;
  return public.smart_table_context(v_venue_id,p_qr_token,p_language);
end;
$$;

grant execute on function public.smart_table_get_context_by_token(text,text) to anon,authenticated;

commit;
