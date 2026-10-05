-- =====================================================================
-- Stripe Checkout (OD-001 decided: Stripe) — INT-PAY-002..006
-- =====================================================================

-- The Checkout Session currently open for an order. A retry expires the previous session first, and webhooks
-- for any other session can never cancel the order — so one order can't be charged twice or cancelled by a stale event.
alter table public.orders add column payment_session_id text;

-- Refund made in the Stripe dashboard → mirror it on the order (service role only, idempotent)
create or replace function public.mark_order_refunded(p_id text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'orderNotFound'; end if;
  if o.payment_status = 'refunded' then return; end if;
  if o.payment_status <> 'paid' then raise exception 'invalidState'; end if;
  update public.orders set payment_status = 'refunded', status = 'refunded' where id = p_id;
  insert into public.order_events (order_id, status) values (p_id, 'refunded');
end $$;
revoke execute on function public.mark_order_refunded(text, text) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(text, text) to service_role;
