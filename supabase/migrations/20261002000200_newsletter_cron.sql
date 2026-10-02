-- Newsletter sign-ups: write-only for the public (through a rate-limited function), readable by admins
create table public.newsletter_subscribers (
  email text primary key check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 254),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
create policy newsletter_admin on public.newsletter_subscribers for select using (public.is_admin());
revoke insert, update, delete on public.newsletter_subscribers from anon, authenticated;

create or replace function public.subscribe_newsletter(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.newsletter_subscribers where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.newsletter_subscribers (email) values (lower(trim(p_email))) on conflict (email) do nothing;
end $$;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

-- Release stock held by unpaid orders every 15 minutes
create extension if not exists pg_cron;
select cron.schedule('release-unpaid-orders', '*/15 * * * *', $$select public.release_unpaid_orders(interval '2 hours')$$);
