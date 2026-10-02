-- =====================================================================
-- Server-side business logic (SECURITY DEFINER functions with a fixed search_path)
-- Clients call these through supabase.rpc(); they never write orders directly.
-- =====================================================================

-- ---------- coupon check (no table access for the public) ----------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (code text, type text, value numeric, min_subtotal numeric, note text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.coupons;
begin
  select * into c from public.coupons where public.coupons.code = upper(trim(p_code));
  if not found then raise exception 'couponInvalid'; end if;
  if not c.active or (c.expires_at is not null and c.expires_at < now()) then raise exception 'couponExpired'; end if;
  if coalesce(p_subtotal, 0) < c.min_subtotal then raise exception 'couponMin:%', c.min_subtotal; end if;
  return query select c.code, c.type, c.value, c.min_subtotal, c.note;
end $$;

-- ---------- order creation ----------
-- p_items: [{ "product_id": text, "size_id": text, "qty": int, "gift": {...} | null }]
-- p_shipping: { first_name, last_name, country, line1, line2, city, state, phone }
create or replace function public.create_order(
  p_items jsonb, p_email text, p_shipping jsonb, p_shipping_method text, p_coupon text default null
) returns table (order_id text, access_token uuid, total numeric)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  s public.settings;
  it jsonb; p public.products; sz jsonb; g jsonb;
  v_qty int; v_unit numeric; v_cmp numeric; v_delta numeric;
  v_sub numeric := 0; v_sav numeric := 0; v_gift numeric := 0; v_disc numeric := 0; v_ship numeric := 0;
  v_total numeric; v_vat numeric; v_free boolean := false;
  c public.coupons;
  v_id text; v_token uuid;
  v_email text := lower(trim(p_email));
  v_wrap text;
begin
  -- shape & size limits
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'emptyCart'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'tooManyItems'; end if;
  if v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 254 then raise exception 'invalidEmail'; end if;
  if p_shipping_method not in ('standard', 'express') then raise exception 'invalidShipping'; end if;
  if char_length(coalesce(p_shipping ->> 'first_name', '')) not between 1 and 60
     or char_length(coalesce(p_shipping ->> 'last_name', '')) not between 1 and 60
     or char_length(coalesce(p_shipping ->> 'line1', '')) not between 4 and 160
     or char_length(coalesce(p_shipping ->> 'line2', '')) > 160
     or char_length(coalesce(p_shipping ->> 'city', '')) not between 1 and 80
     or char_length(coalesce(p_shipping ->> 'state', '')) > 80
     or coalesce(p_shipping ->> 'country', '') not in ('AE','SA','OM','QA','BH','KW','GB','US','ES','OTHER')
     or coalesce(p_shipping ->> 'phone', '') !~ '^[+0-9][0-9 ()-]{6,29}$' then
    raise exception 'invalidAddress';
  end if;

  -- abuse protection: max 5 orders per email (or user) per 10 minutes
  if (select count(*) from public.orders o
      where (o.email = v_email or (auth.uid() is not null and o.user_id = auth.uid()))
        and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;

  select * into s from public.settings where id = 1;
  insert into public.orders as o (user_id, email, shipping, shipping_method, subtotal, savings, discount, gift_fee, shipping_fee, vat, total)
  values (auth.uid(), v_email,
          jsonb_build_object('first_name', p_shipping ->> 'first_name', 'last_name', p_shipping ->> 'last_name', 'country', p_shipping ->> 'country',
                             'line1', p_shipping ->> 'line1', 'line2', coalesce(p_shipping ->> 'line2', ''), 'city', p_shipping ->> 'city',
                             'state', coalesce(p_shipping ->> 'state', ''), 'phone', p_shipping ->> 'phone'),
          p_shipping_method, 0, 0, 0, 0, 0, 0, 0)
  returning o.id, o.access_token into v_id, v_token;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::int;
    if v_qty is null or v_qty not between 1 and 20 then raise exception 'invalidQty'; end if;

    -- lock the product row so concurrent orders can't oversell
    select * into p from public.products where id = it ->> 'product_id' and active for update;
    if not found then raise exception 'unavailable'; end if;
    if p.stock < v_qty then raise exception 'stock:%:%', p.id, p.stock; end if;

    select e into sz from jsonb_array_elements(p.sizes) e where e ->> 'id' = coalesce(it ->> 'size_id', p.sizes -> 0 ->> 'id');
    if sz is null then raise exception 'invalidSize'; end if;
    v_delta := coalesce((sz ->> 'delta')::numeric, 0);
    v_unit := p.price + v_delta;
    v_cmp := case when p.compare_at > 0 then p.compare_at + v_delta else 0 end;

    -- optional gift: validated and size-limited
    g := it -> 'gift';
    if g is not null and jsonb_typeof(g) = 'object' then
      if not p.giftable then raise exception 'notGiftable'; end if;
      v_wrap := coalesce(g ->> 'wrap', 'standard');
      if v_wrap not in ('standard', 'premium', 'luxury')
         or char_length(coalesce(g ->> 'recipientName', '')) not between 1 and 60
         or char_length(coalesce(g ->> 'message', '')) > 250
         or char_length(coalesce(g ->> 'recipientEmail', '')) > 254 then
        raise exception 'invalidGift';
      end if;
      g := jsonb_build_object('recipientName', g ->> 'recipientName', 'recipientEmail', coalesce(g ->> 'recipientEmail', ''),
                              'message', coalesce(g ->> 'message', ''), 'wrap', v_wrap,
                              'deliveryDate', coalesce(g ->> 'deliveryDate', ''), 'hidePrices', coalesce((g ->> 'hidePrices')::boolean, true));
      v_gift := v_gift + coalesce((s.gift_wrap ->> v_wrap)::numeric, 0);
    else
      g := null;
    end if;

    update public.products set stock = stock - v_qty where id = p.id;   -- reserve stock
    insert into public.order_items (order_id, product_id, size_id, ml, qty, unit_price, compare_at, name, img, gift)
    values (v_id, p.id, sz ->> 'id', (sz ->> 'ml')::int, v_qty, v_unit, v_cmp, p.name ->> 'en', p.img, g);

    v_sub := v_sub + v_unit * v_qty;
    v_sav := v_sav + greatest(v_cmp - v_unit, 0) * v_qty;
  end loop;

  -- coupon (re-validated here; the client's earlier check is only a convenience)
  if p_coupon is not null and trim(p_coupon) <> '' then
    select * into c from public.coupons
    where code = upper(trim(p_coupon)) and active and (expires_at is null or expires_at > now()) and v_sub >= min_subtotal;
    if not found then raise exception 'couponInvalid'; end if;
    if c.type = 'percent' then v_disc := round(v_sub * c.value / 100, 2);
    elsif c.type = 'fixed' then v_disc := least(c.value, v_sub);
    else v_free := true; end if;
  end if;

  if p_shipping_method = 'express' then v_ship := s.express_fee;
  elsif v_free or (v_sub - v_disc) >= s.free_shipping_threshold then v_ship := 0;
  else v_ship := s.shipping_fee; end if;

  v_total := greatest(v_sub - v_disc + v_gift + v_ship, 0);
  v_vat := round(v_total * s.vat_rate / (100 + s.vat_rate), 2);   -- prices are VAT-inclusive

  update public.orders set subtotal = v_sub, savings = v_sav, discount = v_disc, gift_fee = v_gift, shipping_fee = v_ship,
         vat = v_vat, total = v_total, coupon_code = case when c.code is null then null else c.code end
  where id = v_id;
  insert into public.order_events (order_id, status) values (v_id, 'placed');

  return query select v_id, v_token, v_total;
end $$;

-- ---------- guest order view (needs the secret token returned at checkout) ----------
create or replace function public.get_order(p_id text, p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'access_token',
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id = o.id), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.order_events e where e.order_id = o.id), '[]'))
  from public.orders o
  where o.id = p_id and (o.access_token = p_token or o.user_id = auth.uid() or public.is_admin())
$$;

-- ---------- payment state (server only: called by the payment webhook with the service role) ----------
create or replace function public.mark_order_paid(p_id text, p_provider text, p_ref text, p_amount numeric, p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'orderNotFound'; end if;
  if o.payment_status = 'paid' then return; end if;                       -- idempotent: duplicate webhooks are ignored
  if round(p_amount, 2) <> o.total or upper(p_currency) <> o.currency then raise exception 'amountMismatch'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'invalidState'; end if;
  update public.orders set payment_status = 'paid', payment_provider = p_provider, payment_ref = p_ref, status = 'processing' where id = p_id;
  insert into public.order_events (order_id, status) values (p_id, 'processing');
end $$;

create or replace function public.mark_order_failed(p_id text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if p_status not in ('failed', 'cancelled') then raise exception 'invalidState'; end if;
  select * into o from public.orders where id = p_id for update;
  if not found or o.payment_status = 'paid' then return; end if;
  update public.orders set payment_status = p_status, status = 'cancelled' where id = p_id;
  -- release reserved stock
  update public.products p set stock = p.stock + i.qty from public.order_items i where i.order_id = p_id and i.product_id = p.id;
  insert into public.order_events (order_id, status) values (p_id, 'cancelled');
end $$;

-- Release stock held by orders that were never paid (run on a schedule)
create or replace function public.release_unpaid_orders(p_older_than interval default interval '2 hours')
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where payment_status = 'pending' and status = 'awaiting_payment' and created_at < now() - p_older_than loop
    perform public.mark_order_failed(r.id, 'cancelled'); n := n + 1;
  end loop;
  return n;
end $$;

-- Only the server (service role) may change payment state
revoke execute on function public.mark_order_paid(text, text, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.mark_order_failed(text, text) from public, anon, authenticated;
revoke execute on function public.release_unpaid_orders(interval) from public, anon, authenticated;

-- ---------- admin: order status ----------
create or replace function public.admin_set_order_status(p_id text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('processing','shipped','delivered','cancelled','refunded') then raise exception 'invalidState'; end if;
  update public.orders set status = p_status,
         payment_status = case when p_status = 'refunded' then 'refunded' else payment_status end
  where id = p_id;
  if not found then raise exception 'orderNotFound'; end if;
  insert into public.order_events (order_id, status) values (p_id, p_status);
end $$;

-- ---------- contact form (rate-limited) ----------
create or replace function public.send_message(p_name text, p_email text, p_phone text, p_topic text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_messages where email = lower(trim(p_email)) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into public.contact_messages (name, email, phone, topic, message)
  values (trim(p_name), lower(trim(p_email)), coalesce(trim(p_phone), ''), coalesce(p_topic, 'general'), trim(p_message));
end $$;

-- ---------- admin: customer overview ----------
create or replace function public.admin_customers()
returns table (id uuid, email text, full_name text, verified boolean, created_at timestamptz, orders bigint, spent numeric, addresses bigint, dates bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.id, u.email::text, coalesce(pr.full_name, ''), u.email_confirmed_at is not null, u.created_at,
           (select count(*) from public.orders o where o.user_id = u.id),
           coalesce((select sum(o.total) from public.orders o where o.user_id = u.id and o.payment_status = 'paid'), 0),
           (select count(*) from public.addresses a where a.user_id = u.id),
           (select count(*) from public.special_dates d where d.user_id = u.id)
    from auth.users u left join public.profiles pr on pr.id = u.id
    where coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
    order by u.created_at desc;
end $$;

grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
grant execute on function public.create_order(jsonb, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_order(text, uuid) to anon, authenticated;
grant execute on function public.send_message(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_order_status(text, text) to authenticated;
grant execute on function public.admin_customers() to authenticated;

-- ---------- storage: product images (public read, admin write, images only, 5 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy product_images_read on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_admin_ins on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_upd on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_del on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());
