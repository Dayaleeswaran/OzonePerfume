// Stripe webhook tests (SYS-02, AC-PAY-001/002, INT-PAY-006) against the local stack with `functions serve`.
// Events are signed locally with STRIPE_WEBHOOK_SECRET from supabase/functions/.env — exactly how Stripe signs them.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { API_URL, service, newCustomer, order, item, orderRow, stockOf } from './helpers.mjs';

const fnEnv = Object.fromEntries(readFileSync('supabase/functions/.env', 'utf8').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const SECRET = fnEnv.STRIPE_WEBHOOK_SECRET;
const HOOK = `${API_URL}/functions/v1/stripe-webhook`;

function send(event, { secret = SECRET, t = Math.floor(Date.now() / 1000) } = {}) {
  const body = JSON.stringify(event);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body });
}
const session = (o, extra = {}) => ({ id: 'cs_test_' + Math.random().toString(36).slice(2), object: 'checkout.session', payment_status: 'paid', amount_total: Math.round(Number(o.total) * 100),
  currency: o.currency.toLowerCase(), client_reference_id: o.id, metadata: { order_id: o.id }, payment_intent: 'pi_test_' + Math.random().toString(36).slice(2), ...extra });
const evt = (type, object) => ({ id: 'evt_' + Math.random().toString(36).slice(2), type, data: { object } });
async function freshOrder(product = 'oil-zestora') {
  const c = await newCustomer('stripe');
  const r = await order(c.client, [item(product)]);
  assert.ifError(r.error);
  return orderRow(r.data[0].order_id);
}

before(() => { if (!SECRET) throw new Error('STRIPE_WEBHOOK_SECRET missing in supabase/functions/.env'); });

describe('Stripe webhook', () => {
  test('SEC-008: forged, unsigned or stale events are rejected', async () => {
    const o = await freshOrder();
    const ev = evt('checkout.session.completed', session(o));
    assert.equal((await send(ev, { secret: 'whsec_wrong' })).status, 400);
    assert.equal((await fetch(HOOK, { method: 'POST', body: JSON.stringify(ev) })).status, 400);
    assert.equal((await send(ev, { t: Math.floor(Date.now() / 1000) - 3600 })).status, 400);   // replayed hour-old event
    assert.equal((await orderRow(o.id)).payment_status, 'pending');
  });

  test('AC-PURCHASE-002: verified payment marks the order paid once and queues the confirmation email', async () => {
    const o = await freshOrder();
    const s = session(o);
    const r = await send(evt('checkout.session.completed', s));
    assert.equal(r.status, 200);
    const paid = await orderRow(o.id);
    assert.equal(paid.payment_status, 'paid');
    assert.equal(paid.status, 'processing');
    assert.equal(paid.payment_provider, 'stripe');
    assert.equal(paid.payment_ref, s.payment_intent);
    // AC-PAY-002: Stripe retries the same event — nothing changes twice
    assert.equal((await send(evt('checkout.session.completed', s))).status, 200);
    const { data: ev } = await service.from('order_events').select('status').eq('order_id', o.id);
    assert.equal(ev.filter(e => e.status === 'processing').length, 1);
    const { data: mails } = await service.from('email_outbox').select('kind').eq('order_id', o.id);
    assert.deepEqual(mails.map(m => m.kind), ['order_confirmed']);
  });

  test('BR-PAY-003/004: wrong amount or currency never marks the order paid', async () => {
    const o = await freshOrder();
    assert.equal((await send(evt('checkout.session.completed', session(o, { amount_total: 100 })))).status, 200);
    assert.equal((await send(evt('checkout.session.completed', session(o, { currency: 'usd' })))).status, 200);
    assert.equal((await orderRow(o.id)).payment_status, 'pending');
  });

  test('async methods: completed but unpaid waits for async_payment_succeeded', async () => {
    const o = await freshOrder();
    const s = session(o, { payment_status: 'unpaid' });
    await send(evt('checkout.session.completed', s));
    assert.equal((await orderRow(o.id)).payment_status, 'pending');
    await send(evt('checkout.session.async_payment_succeeded', { ...s, payment_status: 'paid' }));
    assert.equal((await orderRow(o.id)).payment_status, 'paid');
  });

  test('FLOW-E2E-003: expiry of the CURRENT session cancels the order and restocks once; a stale session is ignored', async () => {
    const before = await stockOf('oil-deep-sea');
    const o = await freshOrder('oil-deep-sea');
    await service.from('orders').update({ payment_session_id: 'cs_current' }).eq('id', o.id);
    await send(evt('checkout.session.expired', session(o, { id: 'cs_old_retry', payment_status: 'unpaid' })));
    assert.equal((await orderRow(o.id)).status, 'awaiting_payment', 'stale session must not cancel');
    await send(evt('checkout.session.expired', session(o, { id: 'cs_current', payment_status: 'unpaid' })));
    await send(evt('checkout.session.expired', session(o, { id: 'cs_current', payment_status: 'unpaid' })));
    const c = await orderRow(o.id);
    assert.equal(c.status, 'cancelled');
    assert.equal(await stockOf('oil-deep-sea'), before);
  });

  test('payment after the order expired is flagged, not fulfilled', async () => {
    const o = await freshOrder();
    await service.rpc('mark_order_failed', { p_id: o.id, p_status: 'cancelled' });
    const r = await send(evt('checkout.session.completed', session(o)));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { attention: 'refund required' });
    assert.equal((await orderRow(o.id)).status, 'cancelled');
  });

  test('UC-PAY-006: full refund in the Stripe dashboard marks the order refunded', async () => {
    const o = await freshOrder();
    const s = session(o);
    await send(evt('checkout.session.completed', s));
    await send(evt('charge.refunded', { id: 'ch_test_1', object: 'charge', refunded: true, payment_intent: s.payment_intent, metadata: {} }));
    const r = await orderRow(o.id);
    assert.equal(r.payment_status, 'refunded');
    assert.equal(r.status, 'refunded');
    const { data: mails } = await service.from('email_outbox').select('kind').eq('order_id', o.id).order('id');
    assert.deepEqual(mails.map(m => m.kind), ['order_confirmed', 'order_refunded']);
  });

  test('stripe-checkout refuses visitors and works only with a configured key', async () => {
    const r = await fetch(`${API_URL}/functions/v1/stripe-checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.ok([401, 503].includes(r.status), 'status ' + r.status);
  });
});
