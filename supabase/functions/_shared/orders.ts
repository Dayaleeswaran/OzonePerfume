/* Server-side order/payment helpers shared by payment providers (INT-PAY-001).

   A provider integration only has to:
     1. identify the order (and, for browser calls, the signed-in customer who owns it), and
     2. after the provider has VERIFIED the payment (signed webhook / API lookup), call markPaid()
        with the provider's reference — amount and currency always come from the database row.
   mark_order_paid() is idempotent and rejects amount/currency mismatches (BR-PAY-001..004). */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type Order = { id: string; user_id: string; total: number; currency: string; access_token: string; status: string; payment_status: string };

export const ORDER_ID_RE = /^OZ\d{6,12}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

/* The customer behind the request's JWT, or null (anon key / invalid / expired token) */
export async function requestUser(admin: SupabaseClient, req: Request): Promise<{ id: string } | null> {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error || !data.user ? null : { id: data.user.id };
}

/* Load an order the caller is allowed to pay: it must belong to them and the secret token must match.
   Returns null for "not found", "not yours" and "wrong token" alike so order ids can't be probed. */
export async function orderForCustomer(admin: SupabaseClient, id: string, token: string, userId: string): Promise<Order | null> {
  const { data, error } = await admin.from('orders')
    .select('id, user_id, total, currency, access_token, status, payment_status').eq('id', id).maybeSingle();
  if (error) throw new Error('lookup failed');
  if (!data || data.user_id !== userId || data.access_token !== token) return null;
  return data as Order;
}

export async function markPaid(admin: SupabaseClient, o: Order, provider: string, ref: string) {
  const { error } = await admin.rpc('mark_order_paid', { p_id: o.id, p_provider: provider, p_ref: ref, p_amount: o.total, p_currency: o.currency });
  if (error) throw new Error('mark_order_paid: ' + error.message);
}

export async function markCancelled(admin: SupabaseClient, o: Order) {
  const { error } = await admin.rpc('mark_order_failed', { p_id: o.id, p_status: 'cancelled' });
  if (error) throw new Error('mark_order_failed: ' + error.message);
}

/* CORS limited to the configured storefront origins (SEC-019) */
export function corsHeaders(req: Request) {
  const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:4173').split(',').map(s => s.trim());
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : origins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}
