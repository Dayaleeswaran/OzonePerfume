// Shared setup for integration tests against the LOCAL Supabase stack (`npx supabase start`).
// Keys are read at runtime from `supabase status` and never printed. Never point these tests at production.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const raw = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const env = Object.fromEntries(raw.split(/\r?\n/).map(l => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map(m => [m[1], m[2]]));
export const API_URL = env.API_URL;
const ANON = env.ANON_KEY, SERVICE = env.SERVICE_ROLE_KEY;
if (!API_URL || !ANON || !SERVICE) throw new Error('Local Supabase is not running (npx supabase start)');
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(API_URL)) throw new Error('Integration tests only run against a local stack');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const anon = () => createClient(API_URL, ANON, opts);
export const service = createClient(API_URL, SERVICE, opts);
export const ANON_KEY = ANON;

/* A fresh, email-confirmed customer for each test that needs one */
export async function newCustomer(tag = 'c') {
  const email = `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = 'Test12345';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Test Customer' } });
  if (error) throw error;
  const client = anon();
  const li = await client.auth.signInWithPassword({ email, password });
  if (li.error) throw li.error;
  return { client, id: data.user.id, email, jwt: li.data.session.access_token };
}

export async function signIn(email, password) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, id: data.user.id, jwt: data.session.access_token };
}

export const UAE = { first_name: 'Test', last_name: 'Buyer', country: 'AE', line1: '12 Test Street', line2: '', city: 'Sharjah', state: '', phone: '+971501234567' };
export const item = (product_id, qty = 1, extra = {}) => ({ product_id, qty, ...extra });

export async function order(client, items, { shipping = UAE, method = 'standard', coupon = null } = {}) {
  return client.rpc('create_order', { p_items: items, p_shipping: shipping, p_shipping_method: method, p_coupon: coupon, p_lang: 'en' });
}
export const stockOf = async id => (await service.from('products').select('stock').eq('id', id).single()).data.stock;
export const setStock = (id, stock) => service.from('products').update({ stock }).eq('id', id);
export const orderRow = async id => (await service.from('orders').select('*').eq('id', id).single()).data;
export const pay = id => orderRow(id).then(o => service.rpc('mark_order_paid', { p_id: id, p_provider: 'test', p_ref: 'it_' + id, p_amount: o.total, p_currency: o.currency }));
