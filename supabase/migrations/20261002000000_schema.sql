-- =====================================================================
-- Ozone Scents — database schema, constraints and row-level security
--
-- Security model
--   * The browser only ever holds the public anon key + the user's JWT.
--   * Every table has RLS enabled; anything not explicitly allowed is denied.
--   * "Admin" comes from auth.users.raw_app_meta_data.role = 'admin', which only
--     the service role (server) can set — users cannot grant it to themselves.
--   * Orders are never written directly by clients: create_order() recomputes
--     every price, discount, fee and tax from the database inside one transaction.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- settings (single row) ----------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  free_shipping_threshold numeric(10,2) not null default 99 check (free_shipping_threshold >= 0),
  shipping_fee numeric(10,2) not null default 15 check (shipping_fee >= 0),
  express_fee numeric(10,2) not null default 35 check (express_fee >= 0),
  vat_rate numeric(5,2) not null default 5 check (vat_rate between 0 and 30),
  gift_wrap jsonb not null default '{"standard":0,"premium":25,"luxury":45}',
  announcement boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------- products ----------
create table public.products (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  sku text not null unique check (char_length(sku) between 2 and 40),
  type text not null check (type in ('tower','hvac','wall','portable','car','oil')),
  line text not null default '' check (line in ('','signature','hotel')),
  family text check (family in ('citrus','floral','fresh','woody')),
  spaces text[] not null default '{home}' check (spaces <@ array['home','office','commercial','car']),
  price numeric(10,2) not null check (price > 0),
  compare_at numeric(10,2) not null default 0 check (compare_at >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  giftable boolean not null default true,
  best_seller boolean not null default false,
  aroma_deal boolean not null default false,
  is_new boolean not null default false,
  sizes jsonb not null check (jsonb_typeof(sizes) = 'array' and jsonb_array_length(sizes) between 1 and 6),
  features text[] not null default '{}',
  specs jsonb not null default '[]' check (jsonb_typeof(specs) = 'array'),
  ideal jsonb,
  notes jsonb not null default '{"top":[],"heart":[],"base":[]}',
  name jsonb not null check (char_length(name ->> 'en') between 2 and 120),
  tagline jsonb not null default '{}',
  description jsonb not null default '{}',
  img text not null check (char_length(img) <= 300),
  gallery text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compare_at_gte_price check (compare_at = 0 or compare_at >= price)
);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ---------- coupons (never readable by the public; validated through RPC) ----------
create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,20}$'),
  type text not null check (type in ('percent','fixed','ship')),
  value numeric(10,2) not null default 0 check (value >= 0),
  min_subtotal numeric(10,2) not null default 0 check (min_subtotal >= 0),
  active boolean not null default true,
  note text not null default '' check (char_length(note) <= 200),
  expires_at timestamptz,
  constraint percent_cap check (type <> 'percent' or value <= 90)
);

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 30 and (phone = '' or phone ~ '^[+0-9][0-9 ()-]{6,}$')),
  newsletter boolean not null default false,
  order_emails boolean not null default true,
  created_at timestamptz not null default now()
);

-- New auth user → profile row (email copied for the admin customer list)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Users may edit their name/phone/preferences but never their email or id
create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.email <> old.email then raise exception 'immutable field'; end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- ---------- addresses ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default 'Address' check (char_length(label) between 1 and 40),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  country text not null check (country in ('AE','SA','OM','QA','BH','KW','GB','US','ES','OTHER')),
  line1 text not null check (char_length(line1) between 4 and 160),
  line2 text not null default '' check (char_length(line2) <= 160),
  city text not null check (char_length(city) between 1 and 80),
  state text not null default '' check (char_length(state) <= 80),
  phone text not null check (phone ~ '^[+0-9][0-9 ()-]{6,29}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user on public.addresses (user_id);

-- ---------- special dates ----------
create table public.special_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occasion text not null check (occasion in ('birthday','anniversary','valentine','christmas','newYear','custom')),
  label text not null default '' check (char_length(label) <= 40),
  person_name text not null check (char_length(person_name) between 1 and 60),
  date date not null,
  reminder boolean not null default true,
  timing smallint not null default 7 check (timing in (0,1,3,7,14)),
  method text not null default 'email' check (method in ('email')),   -- 'whatsapp' reserved for later
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint custom_needs_label check (occasion <> 'custom' or char_length(label) > 0)
);
create index special_dates_user on public.special_dates (user_id);

-- ---------- wishlist ----------
create table public.wishlist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------- reviews ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

-- Customers can't approve their own review or fake "verified purchase"
create or replace function public.guard_review_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.user_id := auth.uid();
    new.status := 'pending';
    new.verified := exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.user_id = auth.uid() and oi.product_id = new.product_id and o.payment_status = 'paid');
    if (select count(*) from public.reviews where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'rate_limited';
    end if;
  end if;
  return new;
end $$;

-- ---------- orders ----------
create sequence public.order_seq start 100232;

create table public.orders (
  id text primary key default ('OZ' || nextval('public.order_seq')),
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 254),
  access_token uuid not null default gen_random_uuid(),   -- lets a guest view their own confirmation
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','processing','shipped','delivered','cancelled','refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  payment_provider text,
  payment_ref text,
  currency text not null default 'AED',
  shipping jsonb not null,
  shipping_method text not null check (shipping_method in ('standard','express')),
  subtotal numeric(10,2) not null, savings numeric(10,2) not null, discount numeric(10,2) not null,
  gift_fee numeric(10,2) not null, shipping_fee numeric(10,2) not null, vat numeric(10,2) not null,
  total numeric(10,2) not null check (total >= 0),
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user on public.orders (user_id);
create index orders_email_created on public.orders (email, created_at);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders (id) on delete cascade,
  product_id text references public.products (id) on delete set null,
  size_id text not null,
  ml integer not null,
  qty integer not null check (qty between 1 and 20),
  unit_price numeric(10,2) not null,
  compare_at numeric(10,2) not null,
  name text not null,
  img text not null,
  gift jsonb
);
create index order_items_order on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now()
);
create index order_events_order on public.order_events (order_id);

-- ---------- contact messages ----------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 30),
  topic text not null default 'general' check (topic in ('general','order','product','business','warranty')),
  message text not null check (char_length(message) between 10 and 2000),
  created_at timestamptz not null default now()
);

-- ---------- translation overrides ----------
create table public.translations (
  lang text not null check (lang in ('en','es','ar')),
  key text not null check (char_length(key) <= 120),
  value text not null check (char_length(value) <= 2000),
  primary key (lang, key)
);

-- ---------- audit log (written by triggers only) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid(),
  action text not null,
  table_name text not null,
  row_key text,
  changes jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  k := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'code', to_jsonb(old) ->> 'code', to_jsonb(new) ->> 'key');
  insert into public.audit_log (action, table_name, row_key, changes)
  values (tg_op, tg_table_name, k, case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit();
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function public.audit();
create trigger audit_settings after update on public.settings for each row execute function public.audit();
create trigger audit_translations after insert or update or delete on public.translations for each row execute function public.audit();
create trigger audit_order_status after update of status, payment_status on public.orders for each row execute function public.audit();
create trigger audit_reviews after update or delete on public.reviews for each row execute function public.audit();

create trigger reviews_guard before insert on public.reviews for each row execute function public.guard_review_insert();

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.special_dates enable row level security;
alter table public.wishlist enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.contact_messages enable row level security;
alter table public.translations enable row level security;
alter table public.audit_log enable row level security;

-- public catalogue
create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());
create policy products_read on public.products for select using (active or public.is_admin());
create policy products_admin_ins on public.products for insert with check (public.is_admin());
create policy products_admin_upd on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy products_admin_del on public.products for delete using (public.is_admin());
create policy translations_read on public.translations for select using (true);
create policy translations_admin on public.translations for all using (public.is_admin()) with check (public.is_admin());

-- coupons: admin only (customers validate through validate_coupon())
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- own data
create policy profiles_own_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_own_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_admin_read on public.addresses for select using (public.is_admin());
create policy dates_own on public.special_dates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dates_admin_read on public.special_dates for select using (public.is_admin());
create policy wishlist_own on public.wishlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reviews: approved are public; authors see their own; only admins moderate
create policy reviews_read on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert with check (auth.uid() is not null and user_id = auth.uid());
create policy reviews_admin_upd on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy reviews_admin_del on public.reviews for delete using (public.is_admin());

-- orders: read own (or admin); no direct writes — create_order()/admin RPCs only
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy order_items_read on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy order_events_read on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- contact: admins read; inserts go through send_message() (rate-limited)
create policy contact_admin on public.contact_messages for select using (public.is_admin());
create policy audit_admin on public.audit_log for select using (public.is_admin());

-- Column-level hardening: the anon/authenticated roles can never touch these directly
revoke insert, update, delete on public.orders, public.order_items, public.order_events, public.contact_messages, public.audit_log from anon, authenticated;
revoke all on public.coupons from anon;
