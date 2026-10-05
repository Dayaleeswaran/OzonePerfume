/* Stripe webhook (SYS-02, INT-PAY-005/006, FR-PAY-005..012).

   Every event is signature-verified (STRIPE_WEBHOOK_SECRET) before anything happens (SEC-008).
   Paid  : checkout.session.completed (payment_status=paid) / checkout.session.async_payment_succeeded
           → amount + currency checked against the database row, then mark_order_paid (idempotent, BR-PAY-002..004)
   Failed: checkout.session.expired / async_payment_failed → order cancelled + stock released,
           but ONLY if it is the order's current session (a retry's old session can't cancel the order)
   Refund: charge.refunded (full refund) → order marked refunded
   Unknown orders, other events and duplicates are acknowledged with 200 so Stripe stops retrying. */
import { serviceClient } from '../_shared/orders.ts';
import { verifyStripeSignature, toMinor, stripe } from '../_shared/stripe.ts';

const ok = (body: unknown = { received: true }) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get('stripe-signature'), secret))) {
    console.error('stripe-webhook: invalid signature');                    // OBS-003
    return new Response('invalid signature', { status: 400 });
  }

  // deno-lint-ignore no-explicit-any
  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response('bad json', { status: 400 }); }
  const obj = event?.data?.object ?? {};
  const admin = serviceClient();

  const loadOrder = async (id: string | undefined) => {
    if (!id) return null;
    const { data } = await admin.from('orders').select('id, total, currency, status, payment_status, payment_session_id').eq('id', id).maybeSingle();
    return data;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (obj.payment_status !== 'paid') return ok({ ignored: 'not paid yet' });   // async methods confirm later
        const order = await loadOrder(obj.metadata?.order_id ?? obj.client_reference_id);
        if (!order) { console.error('stripe-webhook: unknown order', obj.id); return ok({ ignored: 'unknown order' }); }
        if (order.payment_status === 'paid') return ok({ duplicate: true });
        if (obj.amount_total !== toMinor(order.total) || String(obj.currency).toUpperCase() !== order.currency) {
          console.error('stripe-webhook: amount/currency mismatch', order.id, obj.amount_total, obj.currency);
          return ok({ ignored: 'amount mismatch' });                            // never mark paid; flagged in logs for review
        }
        const ref = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.id;
        const { error } = await admin.rpc('mark_order_paid', { p_id: order.id, p_provider: 'stripe', p_ref: ref, p_amount: order.total, p_currency: order.currency });
        if (error) {
          /* Paid after the order was cancelled/expired (stock already released): never keep money for an order we
             can't fulfil — refund it automatically. Idempotency key = one refund per payment even if Stripe retries. */
          console.error('stripe-webhook: paid on a closed order — refunding', order.id, ref, error.message);
          if (typeof obj.payment_intent === 'string') {
            try {
              await stripe('/refunds', { payment_intent: obj.payment_intent, reason: 'requested_by_customer', metadata: { order_id: order.id, cause: 'order_closed_before_payment' } },
                { idempotencyKey: `refund-closed-${obj.payment_intent}` });
              return ok({ refunded: 'order closed before payment' });
            } catch (e) {
              console.error('stripe-webhook: AUTO-REFUND FAILED — refund manually in Stripe', order.id, (e as Error).message);
            }
          }
          return ok({ attention: 'refund required' });
        }
        return ok({ paid: order.id });
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const order = await loadOrder(obj.metadata?.order_id ?? obj.client_reference_id);
        if (!order || order.payment_session_id !== obj.id) return ok({ ignored: 'stale session' });
        await admin.rpc('mark_order_failed', { p_id: order.id, p_status: event.type.endsWith('failed') ? 'failed' : 'cancelled' });
        return ok({ cancelled: order.id });
      }
      case 'charge.refunded': {
        if (!obj.refunded) return ok({ ignored: 'partial refund' });               // partial refunds are handled manually
        let order = await loadOrder(obj.metadata?.order_id);
        if (!order && typeof obj.payment_intent === 'string') {               // we store the PaymentIntent id as payment_ref
          const { data } = await admin.from('orders').select('id').eq('payment_ref', obj.payment_intent).maybeSingle();
          order = await loadOrder(data?.id);
        }
        if (!order) return ok({ ignored: 'unknown order' });
        const { error } = await admin.rpc('mark_order_refunded', { p_id: order.id, p_ref: obj.id });
        if (error) console.error('stripe-webhook: refund sync failed', order.id, error.message);
        return ok({ refunded: order.id });
      }
      default:
        return ok({ ignored: event.type });
    }
  } catch (e) {
    console.error('stripe-webhook', event?.type, (e as Error).message);
    return new Response('error', { status: 500 });                               // Stripe retries with backoff
  }
});
