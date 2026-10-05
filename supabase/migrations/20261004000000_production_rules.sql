-- =====================================================================
-- Production business rules
-- Source: Ozone_Scents_Production_Requirements_and_Flows.md
--   GAP-001  account required to purchase (FR-AUTH-014/015, BR-AUTH-001)
--   GAP-003/008  data-driven UAE/GCC shipping (FR-SHIP-001..011, DATA-SHIPPING-RULE)
--   GAP-004  gift wrap AED 10/20/35 (BR-GIFT-002..004)
--   GAP-005  WELCOME10 first order, LAUNCH20 above AED 600 (FR-PROMO-010..013, BR-PROMO-001..005)
--   GAP-006  VAT inclusive/exclusive is a setting (OD-003 still OPEN; FR-CART-010)
--   GAP-009/010  crypto + special dates behind feature flags
--   FR-ORD-014 order state machine, FR-INV-008 exactly-once stock release,
--   FR-PROD-016 no destructive delete of ordered products, PROC-15 order email outbox
-- =====================================================================

-- ---------- store settings (DATA-STORE-SETTINGS) ----------
alter table public.settings
  add column tax_mode text not null default 'inclusive' check (tax_mode in ('inclusive', 'exclusive')),  -- OD-003 OPEN
  add column free_shipping_inclusive boolean not null default false,  -- OD-004: false = strictly "over" the threshold
  add column low_stock_threshold integer not null default 10 check (low_stock_threshold between 0 and 1000),
  add column features jsonb not null default '{"special_dates": false, "crypto": false}' check (jsonb_typeof(features) = 'object');
alter table public.settings alter column free_shipping_threshold set default 250;
alter table public.settings alter column gift_wrap set default '{"standard":10,"premium":20,"luxury":35}';
alter table public.settings add constraint gift_wrap_object check (jsonb_typeof(gift_wrap) = 'object');
-- Flat fees are replaced by shipping_rules below
alter table public.settings drop column shipping_fee, drop column express_fee;
update public.settings set free_shipping_threshold = 250, gift_wrap = '{"standard":10,"premium":20,"luxury":35}' where id = 1;

-- ---------- shipping rules ----------
create table public.shipping_rules (
  id bigint generated always as identity primary key,
  country text not null check (country ~ '^[A-Z]{2}$'),
  method text not null check (method in ('standard', 'express')),
  min_weight_kg numeric(8,3) not null default 0 check (min_weight_kg >= 0),
  max_weight_kg numeric(8,3) check (max_weight_kg is null or max_weight_kg > min_weight_kg),  -- exclusive upper bound
  fee numeric(10,2) not null check (fee >= 0),
  free_eligible boolean not null default false,  -- may become free once the order passes the free-shipping threshold
  eta jsonb not null default '{}' check (jsonb_typeof(eta) = 'object'),  -- {"en","es","ar"}; empty = storefront default text
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_rules_lookup on public.shipping_rules (country, method) where active;
create trigger shipping_rules_touch before update on public.shipping_rules for each row execute function public.touch_updated_at();
create trigger audit_shipping_rules after insert or update or delete on public.shipping_rules for each row execute function public.audit();
alter table public.shipping_rules enable row level security;
create policy shipping_rules_read on public.shipping_rules for select using (active or public.is_admin());
create policy shipping_rules_admin on public.shipping_rules for all using (public.is_admin()) with check (public.is_admin());

-- Confirmed UAE values (BR-SHIP-001..004). GCC rules are added in the admin once OD-005 is decided.
insert into public.shipping_rules (country, method, fee, free_eligible) values ('AE', 'standard', 20, true), ('AE', 'express', 35, false);

-- Weight for country/weight rules: per size (sizes[].weight_kg) or per product
alter table public.products add column weight_kg numeric(8,3) check (weight_kg is null or weight_kg > 0);

-- Saved addresses accept any ISO country; whether we ship there is decided by shipping_rules
alter table public.addresses drop constraint addresses_country_check;
alter table public.addresses add constraint addresses_country_check check (country ~ '^[A-Z]{2}$');

-- Fee for one method. Internal: called by create_order(); the storefront mirrors it for display only.
create or replace function public.shipping_quote(p_country text, p_method text, p_weight numeric, p_amount numeric, p_force_free boolean default false)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare r public.shipping_rules; s public.settings;
begin
  select * into s from public.settings where id = 1;
  select * into r from public.shipping_rules
   where active and country = upper(p_country) and method = p_method
     and coalesce(p_weight, 0) >= min_weight_kg and (max_weight_kg is null or coalesce(p_weight, 0) < max_weight_kg)
   order by min_weight_kg desc limit 1;
  if not found then raise exception 'shippingUnavailable'; end if;
  if r.free_eligible and (p_force_free or case when s.free_shipping_inclusive then p_amount >= s.free_shipping_threshold
                                                 else p_amount > s.free_shipping_threshold end) then
    return 0;
  end if;
  return r.fee;
end $$;
revoke execute on function public.shipping_quote(text, text, numeric, numeric, boolean) from public, anon, authenticated;

-- ---------- coupons ----------
alter table public.coupons
  add column first_order_only boolean not null default false,
  add column min_exclusive boolean not null default false,   -- true = subtotal must be strictly above min_subtotal
  add column created_at timestamptz not null default now();

-- Confirmed launch codes. Created INACTIVE: the admin switches them on for production (FR-PROMO-010/011).
insert into public.coupons (code, type, value, min_subtotal, min_exclusive, first_order_only, active, note) values
  ('WELCOME10', 'percent', 10, 0, false, true, false, '10% off a first purchase'),
  ('LAUNCH20', 'percent', 20, 600, true, false, false, '20% off orders above AED 600')
on conflict (code) do update set type = excluded.type, value = excluded.value, min_subtotal = excluded.min_subtotal,
  min_exclusive = excluded.min_exclusive, first_order_only = excluded.first_order_only, note = excluded.note;

-- Single source of truth for coupon eligibility (raises the reason when not eligible)
create or replace function public.coupon_lookup(p_code text, p_subtotal numeric, p_user uuid, p_exclude_order text default null)
returns public.coupons language plpgsql stable security definer set search_path = '' as $$
declare c public.coupons;
begin
  select * into c from public.coupons where code = upper(trim(p_code));
  if not found then raise exception 'couponInvalid'; end if;
  if not c.active or (c.expires_at is not null and c.expires_at < now()) then raise exception 'couponExpired'; end if;
  if c.min_exclusive and coalesce(p_subtotal, 0) <= c.min_subtotal then raise exception 'couponAbove:%', c.min_subtotal; end if;
  if not c.min_exclusive and coalesce(p_subtotal, 0) < c.min_subtotal then raise exception 'couponMin:%', c.min_subtotal; end if;
  if c.first_order_only then
    if p_user is null then raise exception 'couponLogin'; end if;
    -- first purchase = no earlier paid/refunded order, and no other unpaid order already holding this code
    if exists (select 1 from public.orders o
               where o.user_id = p_user and o.id is distinct from p_exclude_order
                 and (o.payment_status in ('paid', 'refunded') or (o.status = 'awaiting_payment' and o.coupon_code = c.code))) then
      raise exception 'couponFirstOrder';
    end if;
  end if;
  return c;
end $$;
revoke execute on function public.coupon_lookup(text, numeric, uuid, text) from public, anon, authenticated;

drop function public.validate_coupon(text, numeric);
create function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (code text, type text, value numeric, min_subtotal numeric, min_exclusive boolean, note text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.coupons;
begin
  c := public.coupon_lookup(p_code, p_subtotal, auth.uid());
  return query select c.code, c.type, c.value, c.min_subtotal, c.min_exclusive, c.note;
end $$;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- ---------- orders ----------
alter table public.orders
  add column lang text not null default 'en' check (lang in ('en', 'es', 'ar')),
  add column tax_mode text not null default 'inclusive' check (tax_mode in ('inclusive', 'exclusive')),
  add column weight_kg numeric(10,3) not null default 0,
  add column stock_released boolean not null default false;
alter table public.order_items add column sku text;

-- Restore an order's reserved stock exactly once (FR-INV-008, BR-INV-003). Internal.
create or replace function public.release_order_stock(p_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set stock_released = true where id = p_id and not stock_released;
  if not found then return false; end if;
  update public.products p set stock = p.stock + i.qty from public.order_items i where i.order_id = p_id and i.product_id = p.id;
  return true;
end $$;
revoke execute on function public.release_order_stock(text) from public, anon, authenticated;

drop function public.create_order(jsonb, text, jsonb, text, text);
-- p_items:    [{ "product_id": text, "size_id": text, "qty": int, "gift": {...} | null }]
-- p_shipping: { first_name, last_name, country, line1, line2, city, state, phone }
create function public.create_order(p_items jsonb, p_shipping jsonb, p_shipping_method text, p_coupon text default null, p_lang text default 'en')
returns table (order_id text, access_token uuid, total numeric)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_email text;
  s public.settings;
  it jsonb; p public.products; sz jsonb; g jsonb;
  v_qty int; v_unit numeric; v_cmp numeric; v_delta numeric;
  v_sub numeric := 0; v_sav numeric := 0; v_gift numeric := 0; v_disc numeric := 0; v_ship numeric := 0;
  v_weight numeric := 0; v_taxable numeric; v_total numeric; v_vat numeric; v_free boolean := false;
  c public.coupons;
  v_id text; v_token uuid; v_wrap text;
  v_country text := upper(coalesce(p_shipping ->> 'country', ''));
begin
  -- an authenticated, email-verified customer is required (GAP-001)
  if v_uid is null then raise exception 'authRequired'; end if;
  select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then raise exception 'notConfirmed'; end if;
  if p_lang is null or p_lang not in ('en', 'es', 'ar') then p_lang := 'en'; end if;

  -- shape & size limits
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'emptyCart'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'tooManyItems'; end if;
  if p_shipping_method not in ('standard', 'express') then raise exception 'invalidShipping'; end if;
  if jsonb_typeof(p_shipping) <> 'object'
     or char_length(coalesce(p_shipping ->> 'first_name', '')) not between 1 and 60
     or char_length(coalesce(p_shipping ->> 'last_name', '')) not between 1 and 60
     or char_length(coalesce(p_shipping ->> 'line1', '')) not between 4 and 160
     or char_length(coalesce(p_shipping ->> 'line2', '')) > 160
     or char_length(coalesce(p_shipping ->> 'city', '')) not between 1 and 80
     or char_length(coalesce(p_shipping ->> 'state', '')) > 80
     or v_country !~ '^[A-Z]{2}$'
     or coalesce(p_shipping ->> 'phone', '') !~ '^[+0-9][0-9 ()-]{6,29}$' then
    raise exception 'invalidAddress';
  end if;

  -- abuse protection: max 5 orders per customer per 10 minutes
  if (select count(*) from public.orders o where o.user_id = v_uid and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;

  select * into s from public.settings where id = 1;
  insert into public.orders as o (user_id, email, lang, tax_mode, shipping, shipping_method, subtotal, savings, discount, gift_fee, shipping_fee, vat, total)
  values (v_uid, v_email, p_lang, s.tax_mode,
          jsonb_build_object('first_name', p_shipping ->> 'first_name', 'last_name', p_shipping ->> 'last_name', 'country', v_country,
                             'line1', p_shipping ->> 'line1', 'line2', coalesce(p_shipping ->> 'line2', ''), 'city', p_shipping ->> 'city',
                             'state', coalesce(p_shipping ->> 'state', ''), 'phone', p_shipping ->> 'phone'),
          p_shipping_method, 0, 0, 0, 0, 0, 0, 0)
  returning o.id, o.access_token into v_id, v_token;

  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it -> 'qty') <> 'number' then raise exception 'invalidQty'; end if;
    v_qty := (it ->> 'qty')::int;
    if v_qty is null or v_qty not between 1 and 20 then raise exception 'invalidQty'; end if;

    -- lock the product row so concurrent orders can't oversell (FR-INV-007)
    select * into p from public.products where id = it ->> 'product_id' and active for update;
    if not found then raise exception 'unavailable'; end if;
    if p.stock < v_qty then raise exception 'stock:%:%', p.id, p.stock; end if;

    select e into sz from jsonb_array_elements(p.sizes) e where e ->> 'id' = coalesce(it ->> 'size_id', p.sizes -> 0 ->> 'id');
    if sz is null then raise exception 'invalidSize'; end if;
    v_delta := coalesce((sz ->> 'delta')::numeric, 0);
    v_unit := p.price + v_delta;
    v_cmp := case when p.compare_at > 0 then p.compare_at + v_delta else 0 end;
    v_weight := v_weight + coalesce((sz ->> 'weight_kg')::numeric, p.weight_kg, 0) * v_qty;

    g := it -> 'gift';
    if g is not null and jsonb_typeof(g) = 'object' then
      if not p.giftable then raise exception 'notGiftable'; end if;
      v_wrap := coalesce(g ->> 'wrap', 'standard');
      if v_wrap not in ('standard', 'premium', 'luxury')
         or char_length(trim(coalesce(g ->> 'recipientName', ''))) not between 1 and 60
         or char_length(coalesce(g ->> 'message', '')) > 250
         or char_length(coalesce(g ->> 'recipientEmail', '')) > 254
         or (coalesce(g ->> 'recipientEmail', '') <> '' and (g ->> 'recipientEmail') !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
         or (coalesce(g ->> 'deliveryDate', '') <> '' and (g ->> 'deliveryDate') !~ '^\d{4}-\d{2}-\d{2}$') then
        raise exception 'invalidGift';
      end if;
      g := jsonb_build_object('recipientName', trim(g ->> 'recipientName'), 'recipientEmail', coalesce(g ->> 'recipientEmail', ''),
                              'message', coalesce(g ->> 'message', ''), 'wrap', v_wrap,
                              'deliveryDate', coalesce(g ->> 'deliveryDate', ''), 'hidePrices', coalesce((g ->> 'hidePrices')::boolean, true));
      v_gift := v_gift + coalesce((s.gift_wrap ->> v_wrap)::numeric, 0);
    else
      g := null;
    end if;

    update public.products set stock = stock - v_qty where id = p.id;   -- reserve stock
    insert into public.order_items (order_id, product_id, sku, size_id, ml, qty, unit_price, compare_at, name, img, gift)
    values (v_id, p.id, p.sku, sz ->> 'id', (sz ->> 'ml')::int, v_qty, v_unit, v_cmp, p.name ->> 'en', p.img, g);

    v_sub := v_sub + v_unit * v_qty;
    v_sav := v_sav + greatest(v_cmp - v_unit, 0) * v_qty;
  end loop;

  -- coupon: re-validated here (the storefront check is only a convenience)
  if p_coupon is not null and trim(p_coupon) <> '' then
    c := public.coupon_lookup(p_coupon, v_sub, v_uid, v_id);
    if c.type = 'percent' then v_disc := round(v_sub * c.value / 100, 2);
    elsif c.type = 'fixed' then v_disc := least(c.value, v_sub);
    else v_free := true; end if;
  end if;

  v_ship := public.shipping_quote(v_country, p_shipping_method, v_weight, v_sub - v_disc, v_free);

  v_taxable := greatest(v_sub - v_disc + v_gift + v_ship, 0);
  if s.tax_mode = 'exclusive' then
    v_vat := round(v_taxable * s.vat_rate / 100, 2);
    v_total := v_taxable + v_vat;
  else
    v_total := v_taxable;
    v_vat := round(v_total * s.vat_rate / (100 + s.vat_rate), 2);
  end if;

  update public.orders set subtotal = v_sub, savings = v_sav, discount = v_disc, gift_fee = v_gift, shipping_fee = v_ship,
         vat = v_vat, total = v_total, weight_kg = v_weight, coupon_code = c.code
  where id = v_id;
  insert into public.order_events (order_id, status) values (v_id, 'placed');

  return query select v_id, v_token, v_total;
end $$;
revoke execute on function public.create_order(jsonb, jsonb, text, text, text) from public, anon;
grant execute on function public.create_order(jsonb, jsonb, text, text, text) to authenticated;

-- Orders are visible to their owner and the admin only (no guest token access)
drop function public.get_order(text, uuid);
create function public.get_order(p_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'access_token',
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id = o.id), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.order_events e where e.order_id = o.id), '[]'))
  from public.orders o
  where o.id = p_id and (o.user_id = auth.uid() or public.is_admin())
$$;
revoke execute on function public.get_order(text) from public, anon;
grant execute on function public.get_order(text) to authenticated;

-- ---------- payment state (service role only) ----------
create or replace function public.mark_order_paid(p_id text, p_provider text, p_ref text, p_amount numeric, p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'orderNotFound'; end if;
  if o.payment_status = 'paid' then return; end if;                        -- idempotent (BR-PAY-002)
  if round(p_amount, 2) <> o.total or upper(p_currency) <> o.currency then raise exception 'amountMismatch'; end if;
  if o.status <> 'awaiting_payment' or o.stock_released then raise exception 'invalidState'; end if;
  update public.orders set payment_status = 'paid', payment_provider = p_provider, payment_ref = p_ref, status = 'processing' where id = p_id;
  insert into public.order_events (order_id, status) values (p_id, 'processing');
end $$;

create or replace function public.mark_order_failed(p_id text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if p_status not in ('failed', 'cancelled') then raise exception 'invalidState'; end if;
  select * into o from public.orders where id = p_id for update;
  if not found or o.payment_status = 'paid' or o.status <> 'awaiting_payment' then return; end if;
  update public.orders set payment_status = p_status, status = 'cancelled' where id = p_id;
  perform public.release_order_stock(p_id);
  insert into public.order_events (order_id, status) values (p_id, 'cancelled');
end $$;
revoke execute on function public.mark_order_paid(text, text, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.mark_order_failed(text, text) from public, anon, authenticated;

-- ---------- admin order status: only valid transitions (FR-ORD-014, section 13) ----------
create or replace function public.admin_set_order_status(p_id text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; ok boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'orderNotFound'; end if;
  ok := case o.status
    when 'awaiting_payment' then p_status = 'cancelled'
    when 'processing' then p_status in ('shipped', 'cancelled')
    when 'shipped' then p_status in ('delivered', 'refunded')
    when 'delivered' then p_status = 'refunded'
    when 'cancelled' then p_status = 'refunded'
    else false end;
  if p_status = 'refunded' and o.payment_status <> 'paid' then ok := false; end if;
  if not ok then raise exception 'invalidTransition'; end if;

  if p_status = 'cancelled' then perform public.release_order_stock(p_id); end if;
  update public.orders set status = p_status,
         payment_status = case when p_status = 'refunded' then 'refunded'
                               when p_status = 'cancelled' and payment_status = 'pending' then 'cancelled'
                               else payment_status end
  where id = p_id;
  insert into public.order_events (order_id, status) values (p_id, p_status);
end $$;

-- ---------- products referenced by orders are archived, never deleted (FR-PROD-015/016) ----------
create or replace function public.guard_product_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.order_items where product_id = old.id) then raise exception 'productInUse'; end if;
  return old;
end $$;
create trigger products_guard_delete before delete on public.products for each row execute function public.guard_product_delete();

-- ---------- transactional order emails (PROC-15, section 19) ----------
create table public.email_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled', 'order_refunded')),
  order_id text not null references public.orders (id) on delete cascade,
  to_email text not null,
  lang text not null default 'en',
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, kind)                      -- one email per order event: retries/duplicates can't double-send
);
alter table public.email_outbox enable row level security;
create policy email_outbox_admin on public.email_outbox for select using (public.is_admin());
revoke insert, update, delete on public.email_outbox from anon, authenticated;

create or replace function public.enqueue_order_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.orders; k text; wants boolean;
begin
  k := case new.status when 'processing' then 'order_confirmed' when 'shipped' then 'order_shipped' when 'delivered' then 'order_delivered'
                       when 'cancelled' then 'order_cancelled' when 'refunded' then 'order_refunded' end;
  if k is null then return new; end if;
  select * into o from public.orders where id = new.order_id;
  if k = 'order_cancelled' and o.payment_status <> 'paid' then return new; end if;   -- abandoned checkouts don't email
  if k in ('order_shipped', 'order_delivered') then                                  -- optional updates follow the customer's preference
    select order_emails into wants from public.profiles where id = o.user_id;
    if wants is false then return new; end if;
  end if;
  insert into public.email_outbox (kind, order_id, to_email, lang) values (k, o.id, o.email, o.lang) on conflict do nothing;
  return new;
end $$;
create trigger order_events_email after insert on public.order_events for each row execute function public.enqueue_order_email();

-- Dispatcher API (service role only): claim a batch, then report the result of each send
create or replace function public.claim_emails(p_limit integer default 20)
returns table (id bigint, kind text, to_email text, lang text, data jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select e.id from public.email_outbox e
    where e.status = 'pending'
       or (e.status = 'failed' and e.attempts < 5 and e.claimed_at < now() - interval '5 minutes')
       or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes')
    order by e.id limit least(greatest(p_limit, 1), 100)
    for update skip locked)
  update public.email_outbox e set status = 'sending', attempts = e.attempts + 1, claimed_at = now()
  from picked where e.id = picked.id
  returning e.id, e.kind, e.to_email, e.lang,
    (select jsonb_build_object(
       'order', to_jsonb(o) - 'access_token',
       'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id = o.id), '[]'))
     from public.orders o where o.id = e.order_id);
end $$;

create or replace function public.finish_email(p_id bigint, p_ok boolean, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.email_outbox set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end, last_error = left(p_error, 500)
  where id = p_id;
$$;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;
revoke execute on function public.finish_email(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_emails(integer) to service_role;
grant execute on function public.finish_email(bigint, boolean, text) to service_role;

-- Scheduler: calls the send-emails Edge Function every minute. It does nothing until two Vault secrets exist:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random string, same as EMAIL_DISPATCH_SECRET>', 'email_dispatch_secret');
create extension if not exists pg_net with schema extensions;
create or replace function public.dispatch_emails() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status in ('pending', 'failed', 'sending')) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_dispatch_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url || '/functions/v1/send-emails',
                        headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
                        body := '{}'::jsonb);
end $$;
revoke execute on function public.dispatch_emails() from public, anon, authenticated;
select cron.schedule('dispatch-emails', '* * * * *', $$select public.dispatch_emails()$$);
