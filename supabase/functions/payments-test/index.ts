/* Test payment provider — stands in for the real gateway until the client picks one (OD-001).

   OFF unless the server secret TEST_PAYMENTS_ENABLED=true is set, so it can never take "payments" in
   production (DEP-003, INT-PAY-007). Card details are never sent here: the browser sends only the
   order id, its secret token and the simulated outcome, and the caller must be the signed-in owner.

   The real gateway replaces this with: create-payment-session (hosted page / tokenized fields) and a
   signature-verified webhook that calls the same markPaid()/markCancelled() helpers. */
import { ORDER_ID_RE, UUID_RE, corsHeaders, serviceClient, requestUser, orderForCustomer, markPaid, markCancelled } from '../_shared/orders.ts';

const OUTCOMES = ['success', 'declined', 'insufficient', 'cancel'];

Deno.serve(async req => {
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (Deno.env.get('TEST_PAYMENTS_ENABLED') !== 'true') return reply(404, { error: 'disabled' });

  let body: { order_id?: unknown; token?: unknown; outcome?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'invalidInput' }); }
  const { order_id, token, outcome } = body;
  if (typeof order_id !== 'string' || !ORDER_ID_RE.test(order_id) || typeof token !== 'string' || !UUID_RE.test(token)
    || typeof outcome !== 'string' || !OUTCOMES.includes(outcome)) return reply(400, { error: 'invalidInput' });

  try {
    const admin = serviceClient();
    const user = await requestUser(admin, req);
    if (!user) return reply(401, { error: 'authRequired' });
    const order = await orderForCustomer(admin, order_id, token, user.id);
    if (!order) return reply(404, { error: 'orderNotFound' });
    if (order.payment_status === 'paid') return reply(200, { status: 'paid' });
    if (order.status !== 'awaiting_payment') return reply(409, { error: 'invalidState' });

    if (outcome === 'success') { await markPaid(admin, order, 'test', 'test_' + crypto.randomUUID()); return reply(200, { status: 'paid' }); }
    if (outcome === 'cancel') { await markCancelled(admin, order); return reply(200, { status: 'cancelled' }); }
    /* a declined attempt leaves the order awaiting payment so the customer can retry (FLOW-E2E-002) */
    return reply(200, { status: outcome });
  } catch (e) {
    console.error('payments-test', order_id, (e as Error).message);   // OBS-003: safe identifiers only
    return reply(500, { error: 'unknown' });
  }
});
