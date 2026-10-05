/* Creates a Stripe Checkout Session for an order the signed-in customer owns (INT-PAY-002/004).

   The amount and currency come from the database row created by create_order() — never from the browser.
   The customer pays on Stripe's hosted page, so card data never reaches this site (FR-PAY-003/004).
   The order is marked paid only by the signature-verified webhook (stripe-webhook), not by this redirect. */
import { ORDER_ID_RE, UUID_RE, corsHeaders, serviceClient, requestUser, orderForCustomer } from '../_shared/orders.ts';
import { stripe, toMinor } from '../_shared/stripe.ts';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
const LOCALES: Record<string, string> = { en: 'en', es: 'es', ar: 'auto' };   // Stripe Checkout has no Arabic UI yet

Deno.serve(async req => {
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return reply(503, { error: 'paymentsUnavailable' });

  let body: { order_id?: unknown; token?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'invalidInput' }); }
  const { order_id, token } = body;
  if (typeof order_id !== 'string' || !ORDER_ID_RE.test(order_id) || typeof token !== 'string' || !UUID_RE.test(token)) return reply(400, { error: 'invalidInput' });

  try {
    const admin = serviceClient();
    const user = await requestUser(admin, req);
    if (!user) return reply(401, { error: 'authRequired' });
    const order = await orderForCustomer(admin, order_id, token, user.id);
    if (!order) return reply(404, { error: 'orderNotFound' });
    if (order.payment_status === 'paid') return reply(409, { error: 'alreadyPaid' });
    if (order.status !== 'awaiting_payment') return reply(409, { error: 'invalidState' });

    const { data: extra } = await admin.from('orders').select('payment_session_id, email, lang').eq('id', order.id).single();

    /* a retry closes the previous session first, so the same order can never be paid twice */
    if (extra?.payment_session_id) {
      try { await stripe(`/checkout/sessions/${extra.payment_session_id}/expire`); } catch { /* already completed/expired */ }
    }

    const session = await stripe('/checkout/sessions', {
      mode: 'payment',
      customer_email: extra?.email,
      client_reference_id: order.id,
      locale: LOCALES[extra?.lang ?? 'en'] ?? 'auto',
      line_items: { 0: { quantity: 1, price_data: { currency: order.currency.toLowerCase(), unit_amount: toMinor(order.total),
        product_data: { name: `Ozone Scents order ${order.id}` } } } },
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id }, description: `Ozone Scents order ${order.id}` },
      success_url: `${SITE_URL}/order/${order.id}?new=1&paid=stripe`,
      cancel_url: `${SITE_URL}/checkout/payment?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60          // Stripe minimum: 30 minutes
    }, { idempotencyKey: `${order.id}-${crypto.randomUUID()}` });

    await admin.from('orders').update({ payment_session_id: session.id, payment_provider: 'stripe' }).eq('id', order.id);
    return reply(200, { url: session.url });
  } catch (e) {
    console.error('stripe-checkout', order_id, (e as Error).message);
    return reply(502, { error: 'paymentProvider' });
  }
});
