/* Test payment provider — stands in for the real gateway until the client picks one.

   It is OFF unless the server secret TEST_PAYMENTS_ENABLED=true is set, so it can never take
   "payments" in production by accident. Card details are never sent here (nor anywhere we host):
   the browser only sends the order id, its secret access token and the simulated outcome.

   The real gateway will replace this with: create-payment-session (redirect / hosted fields) +
   a signature-verified webhook calling the same mark_order_paid / mark_order_failed functions. */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:4173').split(',').map(s => s.trim());
const ID_RE = /^OZ\d{6,12}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES = ['success', 'declined', 'insufficient', 'cancel'];

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

Deno.serve(async req => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (Deno.env.get('TEST_PAYMENTS_ENABLED') !== 'true') return reply(404, { error: 'disabled' });

  let body: { order_id?: unknown; token?: unknown; outcome?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'invalidInput' }); }
  const { order_id, token, outcome } = body;
  if (typeof order_id !== 'string' || !ID_RE.test(order_id) || typeof token !== 'string' || !UUID_RE.test(token)
    || typeof outcome !== 'string' || !OUTCOMES.includes(outcome)) return reply(400, { error: 'invalidInput' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: order, error } = await admin.from('orders')
    .select('id, total, currency, access_token, status, payment_status').eq('id', order_id).maybeSingle();
  if (error) return reply(500, { error: 'unknown' });
  /* Same response for "no such order" and "wrong token" so ids can't be probed */
  if (!order || order.access_token !== token) return reply(404, { error: 'orderNotFound' });
  if (order.payment_status === 'paid') return reply(200, { status: 'paid' });
  if (order.status !== 'awaiting_payment') return reply(409, { error: 'invalidState' });

  if (outcome === 'success') {
    /* amount and currency come from the database row, never from the browser */
    const { error: e } = await admin.rpc('mark_order_paid', {
      p_id: order.id, p_provider: 'test', p_ref: 'test_' + crypto.randomUUID(), p_amount: order.total, p_currency: order.currency
    });
    if (e) return reply(500, { error: 'unknown' });
    return reply(200, { status: 'paid' });
  }
  if (outcome === 'cancel') {
    const { error: e } = await admin.rpc('mark_order_failed', { p_id: order.id, p_status: 'cancelled' });
    if (e) return reply(500, { error: 'unknown' });
    return reply(200, { status: 'cancelled' });
  }
  /* A declined attempt leaves the order awaiting payment so the shopper can retry */
  return reply(200, { status: outcome });
});
