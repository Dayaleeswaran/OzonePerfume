// Integration tests: business rules and security enforced by the database (run: npm run test:db).
// Test names carry the requirement IDs from Ozone_Scents_Production_Requirements_and_Flows.md.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { anon, service, newCustomer, signIn, order, item, stockOf, setStock, orderRow, pay, UAE } from './helpers.mjs';

const visitor = anon();
let admin;
before(async () => { admin = await signIn('admin@ozonescents.com', 'Admin@123'); });

describe('SEC / RLS', () => {
  test('SEC-001: visitors read the catalogue but no private tables', async () => {
    assert.ok((await visitor.from('products').select('id')).data.length > 0);
    for (const t of ['coupons', 'orders', 'order_items', 'profiles', 'addresses', 'special_dates', 'contact_messages', 'audit_log', 'newsletter_subscribers', 'email_outbox']) {
      const r = await visitor.from(t).select('*').limit(1);
      assert.ok(r.error || r.data.length === 0, t);
    }
  });
  test('SEC-003 / AC-ADMIN-001: customers cannot use admin functions or write the catalogue', async () => {
    const c = await newCustomer();
    assert.ok((await c.client.rpc('admin_customers')).error);
    const upd = await c.client.from('products').update({ price: 1 }).eq('id', 'oil-zestora').select();
    assert.ok(upd.error || upd.data.length === 0);
    assert.ok((await c.client.from('shipping_rules').insert({ country: 'AE', method: 'standard', fee: 0 })).error);
  });
  test('SEC-004 / FR-AUTH-012: user metadata cannot grant the admin role', async () => {
    const c = await newCustomer();
    await c.client.auth.updateUser({ data: { role: 'admin' } });
    assert.ok((await c.client.rpc('admin_customers')).error);
  });
});

describe('GAP-001 account-required purchase', () => {
  test('AC-PURCHASE-001 / TEST-CRITICAL-003: visitors cannot create orders', async () => {
    const r = await order(visitor, [item('oil-zestora')]);
    assert.ok(r.error);
  });
  test('FR-ORD-002/010: orders belong to the customer; others cannot read them', async () => {
    const a = await newCustomer('a'), b = await newCustomer('b');
    const r = await order(a.client, [item('oil-zestora')]);
    assert.ifError(r.error);
    const id = r.data[0].order_id;
    assert.equal((await orderRow(id)).user_id, a.id);
    assert.ok((await a.client.rpc('get_order', { p_id: id })).data);
    assert.equal((await b.client.rpc('get_order', { p_id: id })).data, null);
    assert.equal((await b.client.from('orders').select('id').eq('id', id)).data.length, 0);
  });
});

describe('BR-PRICE / BR-SHIP / BR-GIFT', () => {
  test('BR-PRICE-002: client prices are ignored; server snapshots unit price and SKU', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('oil-zestora', 1, { size_id: '1000', price: 0.01, unit_price: 1 })]);
    assert.ifError(r.error);
    const { data: items } = await service.from('order_items').select('unit_price, sku').eq('order_id', r.data[0].order_id);
    assert.equal(Number(items[0].unit_price), 320);
    assert.ok(items[0].sku);
  });
  test('BR-SHIP-001: UAE standard AED 20 under the threshold', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('oil-zestora')]);                 // 230
    const o = await orderRow(r.data[0].order_id);
    assert.equal(Number(o.shipping_fee), 20);
    assert.equal(Number(o.total), 250);
  });
  test('BR-SHIP-003: free standard shipping strictly over AED 250', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('car-diffuser')]);                // 270
    assert.equal(Number((await orderRow(r.data[0].order_id)).shipping_fee), 0);
  });
  test('BR-SHIP-002/004: express AED 35 and never free automatically', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('tower-diffuser')], { method: 'express' });
    assert.equal(Number((await orderRow(r.data[0].order_id)).shipping_fee), 35);
  });
  test('FR-SHIP-010: unsupported destinations are rejected', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('oil-zestora')], { shipping: { ...UAE, country: 'SA' } });
    assert.match(r.error.message, /shippingUnavailable/);
  });
  test('FR-SHIP-009: country + weight rule added by the admin is applied', async () => {
    const { data: rules } = await admin.client.from('shipping_rules').insert([
      { country: 'OM', method: 'standard', min_weight_kg: 0, max_weight_kg: 1, fee: 40 },
      { country: 'OM', method: 'standard', min_weight_kg: 1, fee: 75 }]).select();
    await service.from('products').update({ weight_kg: 0.6 }).eq('id', 'oil-zestora');
    try {
      const c = await newCustomer();
      const om = { ...UAE, country: 'OM', city: 'Muscat' };
      const one = await order(c.client, [item('oil-zestora', 1)], { shipping: om });
      assert.equal(Number((await orderRow(one.data[0].order_id)).shipping_fee), 40);
      const two = await order(c.client, [item('oil-zestora', 2)], { shipping: om });    // 1.2 kg
      assert.equal(Number((await orderRow(two.data[0].order_id)).shipping_fee), 75);
    } finally {
      await service.from('products').update({ weight_kg: null }).eq('id', 'oil-zestora');
      await admin.client.from('shipping_rules').delete().in('id', rules.map(r => r.id));
    }
  });
  test('BR-GIFT-002..004: wrap fees 10 / 20 / 35; BR-GIFT-001 non-giftable rejected', async () => {
    const c = await newCustomer();
    const g = wrap => ({ recipientName: 'Sam', wrap, message: 'Enjoy' });
    const r = await order(c.client, [item('oil-zestora', 1, { gift: g('standard') }), item('oil-deep-sea', 1, { gift: g('premium') }), item('oil-prestige', 1, { gift: g('luxury') })]);
    assert.ifError(r.error);
    assert.equal(Number((await orderRow(r.data[0].order_id)).gift_fee), 65);
    const bad = await order(c.client, [item('tower-diffuser', 1, { gift: g('standard') })]);
    assert.match(bad.error.message, /notGiftable/);
  });
  test('VAL-GIFT-002: oversized gift message rejected', async () => {
    const c = await newCustomer();
    const r = await order(c.client, [item('oil-zestora', 1, { gift: { recipientName: 'Sam', wrap: 'standard', message: 'x'.repeat(300) } })]);
    assert.match(r.error.message, /invalidGift/);
  });
  test('OD-003: VAT inclusive by default; exclusive adds VAT on top', async () => {
    const c = await newCustomer();
    const incl = await orderRow((await order(c.client, [item('home-diffuser')])).data[0].order_id);   // 690, free shipping
    assert.equal(Number(incl.total), 690);
    assert.equal(Number(incl.vat), 32.86);
    await service.from('settings').update({ tax_mode: 'exclusive' }).eq('id', 1);
    try {
      const excl = await orderRow((await order(c.client, [item('home-diffuser')])).data[0].order_id);
      assert.equal(Number(excl.vat), 34.5);
      assert.equal(Number(excl.total), 724.5);
      assert.equal(excl.tax_mode, 'exclusive');
    } finally { await service.from('settings').update({ tax_mode: 'inclusive' }).eq('id', 1); }
  });
});

describe('BR-PROMO coupons', () => {
  test('AC-COUPON-002: LAUNCH20 only when subtotal is above AED 600', async () => {
    const c = await newCustomer();
    assert.match((await c.client.rpc('validate_coupon', { p_code: 'launch20', p_subtotal: 600 })).error.message, /couponAbove/);
    assert.ifError((await c.client.rpc('validate_coupon', { p_code: 'LAUNCH20', p_subtotal: 600.01 })).error);
    const r = await order(c.client, [item('home-diffuser')], { coupon: 'launch20' });                 // 690
    assert.equal(Number((await orderRow(r.data[0].order_id)).discount), 138);
    const low = await order(c.client, [item('love-diffuser')], { coupon: 'LAUNCH20' });               // 460
    assert.match(low.error.message, /couponAbove/);
  });
  test('AC-COUPON-001: WELCOME10 only on a first purchase (server-side history)', async () => {
    assert.match((await visitor.rpc('validate_coupon', { p_code: 'WELCOME10', p_subtotal: 300 })).error.message, /couponLogin/);
    const c = await newCustomer();
    const first = await order(c.client, [item('car-diffuser')], { coupon: 'WELCOME10' });
    assert.ifError(first.error);
    assert.equal(Number((await orderRow(first.data[0].order_id)).discount), 27);
    // a second unpaid order can't hold the same first-order code
    assert.match((await order(c.client, [item('car-diffuser')], { coupon: 'WELCOME10' })).error.message, /couponFirstOrder/);
    await pay(first.data[0].order_id);
    assert.match((await c.client.rpc('validate_coupon', { p_code: 'WELCOME10', p_subtotal: 300 })).error.message, /couponFirstOrder/);
  });
  test('BR-PROMO-005: inactive / unknown codes do not change totals', async () => {
    const c = await newCustomer();
    assert.match((await order(c.client, [item('car-diffuser')], { coupon: 'NOPE' })).error.message, /couponInvalid/);
    await service.from('coupons').update({ active: false }).eq('code', 'LAUNCH20');
    try { assert.match((await order(c.client, [item('home-diffuser')], { coupon: 'LAUNCH20' })).error.message, /couponExpired/); }
    finally { await service.from('coupons').update({ active: true }).eq('code', 'LAUNCH20'); }
  });
});

describe('BR-INV inventory', () => {
  test('BR-INV-001: cannot buy above stock', async () => {
    const c = await newCustomer();
    const before = await stockOf('love-diffuser');
    await setStock('love-diffuser', 3);
    try {
      const r = await order(c.client, [item('love-diffuser', 2), item('love-diffuser', 2, { gift: { recipientName: 'A', wrap: 'standard' } })]);
      assert.match(r.error.message, /^stock:/);
      assert.equal(await stockOf('love-diffuser'), 3, 'failed order reserves nothing');
    } finally { await setStock('love-diffuser', before); }
  });
  test('AC-STOCK-001 / TEST-CRITICAL-004: concurrent orders cannot oversell the last unit', async () => {
    const before = await stockOf('handy-diffuser');
    await setStock('handy-diffuser', 1);
    try {
      const [a, b] = await Promise.all([newCustomer('x'), newCustomer('y')]);
      const results = await Promise.all([order(a.client, [item('handy-diffuser')]), order(b.client, [item('handy-diffuser')])]);
      assert.equal(results.filter(r => !r.error).length, 1);
      assert.equal(await stockOf('handy-diffuser'), 0);
    } finally { await setStock('handy-diffuser', before); }
  });
  test('AC-STOCK-002 / FR-INV-008: expired unpaid orders are cancelled and restock exactly once', async () => {
    const c = await newCustomer();
    const before = await stockOf('bath-diffuser');
    const id = (await order(c.client, [item('bath-diffuser', 2)])).data[0].order_id;
    assert.equal(await stockOf('bath-diffuser'), before - 2);
    await service.from('orders').update({ created_at: new Date(Date.now() - 3 * 3600e3).toISOString() }).eq('id', id);
    await service.rpc('release_unpaid_orders', { p_older_than: '2 hours' });
    await service.rpc('mark_order_failed', { p_id: id, p_status: 'cancelled' });          // repeat: no double restock
    assert.equal(await stockOf('bath-diffuser'), before);
    const o = await orderRow(id);
    assert.equal(o.status, 'cancelled');
    assert.equal(o.stock_released, true);
  });
});

describe('BR-PAY payments', () => {
  test('AC-PAY-001 / TEST-CRITICAL-002: customers cannot mark their own order paid', async () => {
    const c = await newCustomer();
    const id = (await order(c.client, [item('oil-zestora')])).data[0].order_id;
    assert.ok((await c.client.rpc('mark_order_paid', { p_id: id, p_provider: 'x', p_ref: 'x', p_amount: 250, p_currency: 'AED' })).error);
    assert.ok((await c.client.from('orders').update({ payment_status: 'paid' }).eq('id', id).select()).error ||
      (await orderRow(id)).payment_status === 'pending');
  });
  test('BR-PAY-003/004: amount and currency must match the order', async () => {
    const c = await newCustomer();
    const id = (await order(c.client, [item('oil-zestora')])).data[0].order_id;
    assert.match((await service.rpc('mark_order_paid', { p_id: id, p_provider: 'x', p_ref: 'x', p_amount: 1, p_currency: 'AED' })).error.message, /amountMismatch/);
    assert.match((await service.rpc('mark_order_paid', { p_id: id, p_provider: 'x', p_ref: 'x', p_amount: 250, p_currency: 'USD' })).error.message, /amountMismatch/);
  });
  test('AC-PAY-002 / BR-PAY-002: duplicate payment notifications are idempotent', async () => {
    const c = await newCustomer();
    const id = (await order(c.client, [item('oil-zestora')])).data[0].order_id;
    await pay(id); await pay(id);
    const { data: ev } = await service.from('order_events').select('status').eq('order_id', id);
    assert.equal(ev.filter(e => e.status === 'processing').length, 1);
    const { data: mails } = await service.from('email_outbox').select('kind').eq('order_id', id);
    assert.deepEqual(mails.map(m => m.kind), ['order_confirmed']);
  });
});

describe('FR-ORD-014 order state machine', () => {
  test('only allowed transitions; refund needs a paid order; cancel restocks once', async () => {
    const c = await newCustomer();
    const before = await stockOf('car-diffuser');
    const id = (await order(c.client, [item('car-diffuser')])).data[0].order_id;
    const set = s => admin.client.rpc('admin_set_order_status', { p_id: id, p_status: s });
    assert.match((await set('delivered')).error.message, /invalidTransition/);
    assert.match((await set('refunded')).error.message, /invalidTransition/);
    await pay(id);
    assert.ifError((await set('shipped')).error);
    assert.match((await set('processing')).error.message, /invalidTransition/);
    assert.ifError((await set('delivered')).error);
    assert.ifError((await set('refunded')).error);
    const o = await orderRow(id);
    assert.equal(o.payment_status, 'refunded');
    assert.equal(await stockOf('car-diffuser'), before - 1, 'refund does not restock automatically');

    const id2 = (await order(c.client, [item('car-diffuser')])).data[0].order_id;
    assert.ifError((await admin.client.rpc('admin_set_order_status', { p_id: id2, p_status: 'cancelled' })).error);
    await service.rpc('mark_order_failed', { p_id: id2, p_status: 'cancelled' });
    assert.equal(await stockOf('car-diffuser'), before - 1);
  });
  test('FR-PROD-016: ordered products cannot be deleted (archive instead)', async () => {
    const r = await admin.client.from('products').delete().eq('id', 'oil-zestora');
    assert.match(r.error.message, /productInUse/);
  });
});

describe('BR-REV reviews', () => {
  test('AC-REV-001/002: reviews start pending; verified purchase is server-derived', async () => {
    const c = await newCustomer();
    const { data, error } = await c.client.from('reviews').insert({ product_id: 'oil-candy-kiss', rating: 5, title: 'Great', body: 'Lovely fragrance overall', author_name: 'T', status: 'approved', verified: true }).select().single();
    assert.ifError(error);
    assert.equal(data.status, 'pending');
    assert.equal(data.verified, false);
    assert.equal((await visitor.from('reviews').select('id').eq('id', data.id)).data.length, 0);
  });
});

describe('PROC-15 transactional email', () => {
  test('EMAIL: paid → confirmation queued once; shipped respects the customer preference', async () => {
    const c = await newCustomer();
    await c.client.from('profiles').update({ order_emails: false }).eq('id', c.id);
    const id = (await order(c.client, [item('oil-zestora')])).data[0].order_id;
    await pay(id);
    await admin.client.rpc('admin_set_order_status', { p_id: id, p_status: 'shipped' });
    const { data } = await service.from('email_outbox').select('kind, to_email, lang').eq('order_id', id);
    assert.deepEqual(data.map(d => d.kind), ['order_confirmed']);
    assert.equal(data[0].to_email, c.email);
  });
  test('abandoned (unpaid) checkouts send nothing', async () => {
    const c = await newCustomer();
    const id = (await order(c.client, [item('oil-zestora')])).data[0].order_id;
    await service.rpc('mark_order_failed', { p_id: id, p_status: 'cancelled' });
    assert.equal((await service.from('email_outbox').select('id').eq('order_id', id)).data.length, 0);
  });
});

after(async () => { /* test customers stay in the local DB; reset with `npx supabase db reset` */ });
