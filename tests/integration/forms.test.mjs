// CAPTCHA-protected public forms (SEC-015, FR-CNT-001..005) against the local stack + `functions serve`.
// Uses Cloudflare's documented Turnstile test secret 1x0000000000000000000000000000000AA (always accepts
// the dummy token below) — set as TURNSTILE_SECRET_KEY in supabase/functions/.env.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { API_URL, ANON_KEY, anon, service, newCustomer } from './helpers.mjs';

const FN = `${API_URL}/functions/v1/public-forms`;
const DUMMY = 'XXXX.DUMMY.TOKEN.XXXX';                       // Cloudflare's test token
const post = (body, headers = {}) => fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, ...headers }, body: JSON.stringify(body) });
const contact = (extra = {}) => ({ kind: 'contact', name: 'Form Tester', email: `form.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`, phone: '', topic: 'general', message: 'Hello, testing the contact form.', ...extra });

describe('public forms', () => {
  test('SEC-015: visitors can no longer call the form functions directly (CAPTCHA can’t be skipped)', async () => {
    const c = anon();
    assert.ok((await c.rpc('send_message', { p_name: 'Bot', p_email: 'bot@example.com', p_phone: '', p_topic: 'general', p_message: 'spam spam spam' })).error);
    assert.ok((await c.rpc('subscribe_newsletter', { p_email: 'bot@example.com' })).error);
  });

  test('contact form without a CAPTCHA token is rejected', async () => {
    const r = await post(contact());
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: 'captcha' });
  });

  test('contact form with a valid CAPTCHA token is saved', async () => {
    const body = contact({ captchaToken: DUMMY });
    const r = await post(body);
    assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
    const { data } = await service.from('contact_messages').select('email').eq('email', body.email);
    assert.equal(data.length, 1);
  });

  test('FR-CNT-002: contact rate limit still applies (3 per email per hour)', async () => {
    const email = `limit.${Date.now()}@example.com`;
    for (let i = 0; i < 3; i++) assert.equal((await post(contact({ email, captchaToken: DUMMY }))).status, 200);
    const r = await post(contact({ email, captchaToken: DUMMY }));
    assert.equal(r.status, 429);
  });

  test('newsletter: CAPTCHA for visitors, none needed for signed-in customers; duplicates are fine', async () => {
    const email = `news.${Date.now()}@example.com`;
    assert.equal((await post({ kind: 'newsletter', email })).status, 400);
    assert.equal((await post({ kind: 'newsletter', email, captchaToken: DUMMY })).status, 200);
    assert.equal((await post({ kind: 'newsletter', email, captchaToken: DUMMY })).status, 200);
    const c = await newCustomer('news');
    assert.equal((await post({ kind: 'newsletter', email: c.email }, { Authorization: `Bearer ${c.jwt}` })).status, 200);
    const { data } = await service.from('newsletter_subscribers').select('email').in('email', [email, c.email]);
    assert.equal(data.length, 2);
  });

  test('invalid input is rejected before touching the database', async () => {
    assert.equal((await post({ kind: 'nope', captchaToken: DUMMY })).status, 400);
    assert.equal((await post({ kind: 'newsletter', email: 'not-an-email', captchaToken: DUMMY })).status, 400);
    assert.equal((await post(contact({ message: 'x'.repeat(5000), captchaToken: DUMMY }))).status, 400);
  });
});
