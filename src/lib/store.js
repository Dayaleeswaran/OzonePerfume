/* Ozone Scents — client store backed by Supabase.

   Trust model: this file is UI convenience only. Everything security-relevant is enforced by the
   database (row-level security, constraints, SECURITY DEFINER functions):
     * prices/totals/coupons/stock are recomputed by create_order() — client totals are display-only
     * admin rights come from the JWT app_metadata claim set server-side
     * orders, payments, messages can't be written directly by the browser

   Reads are served from an in-memory cache (loaded at boot / on login) so components can render
   synchronously; every mutation goes to Supabase, then refreshes the cache and notifies React. */
import { supabase } from './supabase.js';
import { COLLECTIONS, LANGS, CURRENCIES } from '../data/catalog.js';

const SESSION_KEY = 'oz_session_v3';
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage blocked */ } };
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* Per-browser state: language, currency, cart, guest wishlist, coupon, recently viewed */
let session = Object.assign(
  { lang: 'en', currency: 'AED', cart: [], wishlist: [], coupon: null, announcementClosed: false, recent: [], lastOrder: null, pendingEmail: null },
  read(SESSION_KEY) || {}
);

/* Server data cache */
const cache = {
  ready: false, error: null,
  products: [], settings: null, reviews: [], translations: { en: {}, es: {}, ar: {} },
  auth: null, profile: null, addresses: [], dates: [], wishlist: [], orders: [],
  admin: { loaded: false, orders: [], reviews: [], coupons: [], customers: [], dates: [], products: [] }
};

const listeners = new Set();
let version = 0;
let initPromise = null;
function commit(evt) { version++; write(SESSION_KEY, session); listeners.forEach(fn => fn(evt)); }

/* ---------- error mapping: Supabase/Postgres errors → our i18n error codes ---------- */
const INPUT_ERRORS = ['invalidAddress', 'invalidGift', 'tooManyItems', 'invalidQty', 'invalidSize', 'notGiftable', 'invalidEmail', 'invalidShipping', 'invalidState'];
function mapError(e) {
  if (!e) return { code: 'unknown' };
  if (e.code && typeof e.code === 'string' && /^[a-z]/.test(e.code) && !e.message) return e;
  if (e instanceof TypeError || /fetch|network/i.test(e.message || '') || (typeof navigator !== 'undefined' && !navigator.onLine)) return { code: 'network' };
  const msg = String(e.message || '');
  const authCode = e.code || e.error_code;
  const authMap = {
    user_already_exists: 'exists', email_exists: 'exists', invalid_credentials: 'badLogin', email_not_confirmed: 'notConfirmed',
    otp_expired: 'badCode', weak_password: 'weakPassword', over_email_send_rate_limit: 'rate_limited', over_request_rate_limit: 'rate_limited',
    same_password: 'samePassword', reauthentication_needed: 'badPassword'
  };
  if (authCode && authMap[authCode]) return { code: authMap[authCode] };
  if (/Invalid login credentials/i.test(msg)) return { code: 'badLogin' };
  if (/already registered/i.test(msg)) return { code: 'exists' };
  if (/expired|invalid.*otp|token has expired/i.test(msg)) return { code: 'badCode' };
  const [head, a, b] = msg.split(':');
  if (head === 'stock') return { code: 'stock', max: Number(b) || 0 };
  if (head === 'couponMin') return { code: 'couponMin', min: Number(a) || 0 };
  if (INPUT_ERRORS.includes(head)) return { code: 'invalidInput' };
  if (['couponInvalid', 'couponExpired', 'emptyCart', 'unavailable', 'rate_limited', 'forbidden', 'orderNotFound'].includes(head)) return { code: head };
  if (e.code === '23505') return { code: 'duplicate' };
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) return { code: 'forbidden' };
  if (e.code === '23514') return { code: 'invalidInput' };
  return { code: 'unknown' };
}
const run = async promise => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw { code: 'network' };
  let res;
  try { res = await promise; } catch (e) { throw mapError(e); }
  if (res && res.error) throw mapError(res.error);
  return res ? res.data : undefined;
};

/* Small async helper kept for purely client-side work (e.g. search) so the UI keeps its loading states */
export const api = (fn, ms = 200) => new Promise((resolve, reject) => setTimeout(() => {
  if (!navigator.onLine) return reject({ code: 'network' });
  try { resolve(fn()); } catch (err) { reject(err && err.code ? err : { code: 'unknown' }); }
}, ms));

/* ---------- row mappers (DB snake_case → UI shapes) ---------- */
const mapProduct = r => ({
  id: r.id, sku: r.sku, type: r.type, line: r.line, family: r.family, spaces: r.spaces, price: Number(r.price), compareAt: Number(r.compare_at),
  stock: r.stock, active: r.active, giftable: r.giftable, bestSeller: r.best_seller, aromaDeal: r.aroma_deal, isNew: r.is_new,
  sizes: r.sizes, features: r.features, specs: r.specs, ideal: r.ideal, notes: r.notes, name: r.name, tagline: r.tagline, desc: r.description,
  img: r.img, gallery: r.gallery || []
});
const unmapProduct = p => ({
  id: p.id, sku: p.sku, type: p.type, line: p.line || '', family: p.family || null, spaces: p.spaces, price: p.price, compare_at: p.compareAt || 0,
  stock: p.stock, active: p.active !== false, giftable: !!p.giftable, best_seller: !!p.bestSeller, aroma_deal: !!p.aromaDeal, is_new: !!p.isNew,
  sizes: p.sizes, features: p.features, specs: p.specs || [], ideal: p.ideal || null, notes: p.notes, name: p.name, tagline: p.tagline || {},
  description: p.desc || {}, img: p.img, gallery: p.gallery || []
});
const mapSettings = r => ({
  freeShippingThreshold: Number(r.free_shipping_threshold), shippingFee: Number(r.shipping_fee), expressFee: Number(r.express_fee),
  vatRate: Number(r.vat_rate), giftWrap: r.gift_wrap, announcement: r.announcement
});
const mapReview = r => ({ id: r.id, productId: r.product_id, userId: r.user_id, name: r.author_name, rating: r.rating, title: r.title, body: r.body, status: r.status, verified: r.verified, date: r.created_at });
const mapAddress = r => ({ id: r.id, label: r.label, firstName: r.first_name, lastName: r.last_name, country: r.country, line1: r.line1, line2: r.line2, city: r.city, state: r.state, phone: r.phone, isDefault: r.is_default });
const unmapAddress = a => ({ label: a.label || 'Address', first_name: a.firstName, last_name: a.lastName, country: a.country, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state || '', phone: a.phone, is_default: !!a.isDefault });
const mapDate = r => ({ id: r.id, occasion: r.occasion, label: r.label, name: r.person_name, date: r.date, reminder: r.reminder, timing: r.timing, method: r.method, note: r.note, userId: r.user_id });
const shipToUi = s => s && ({ firstName: s.first_name, lastName: s.last_name, country: s.country, line1: s.line1, line2: s.line2, city: s.city, state: s.state, phone: s.phone });
const mapOrder = (o, items = [], events = []) => ({
  id: o.id, date: o.created_at, email: o.email, user: o.user_id, status: o.status, currency: o.currency, coupon: o.coupon_code,
  shipping: shipToUi(o.shipping), shippingMethod: o.shipping_method,
  totals: { subtotal: Number(o.subtotal), savings: Number(o.savings), discount: Number(o.discount), giftFee: Number(o.gift_fee), shipping: Number(o.shipping_fee), vat: Number(o.vat), total: Number(o.total) },
  payment: { method: o.payment_provider, status: o.payment_status, ref: o.payment_ref },
  items: items.map(i => ({ productId: i.product_id, sizeId: i.size_id, ml: i.ml, qty: i.qty, price: Number(i.unit_price), compareAt: Number(i.compare_at), name: i.name, img: i.img, gift: i.gift })),
  timeline: events.map(e => ({ status: e.status, date: e.created_at }))
});

async function fetchOrders(filter) {
  let q = supabase.from('orders').select('*, order_items(*), order_events(*)').order('created_at', { ascending: false });
  if (filter) q = filter(q);
  const rows = await run(q);
  return rows.map(o => mapOrder(o, (o.order_items || []).sort((a, b) => a.id - b.id), (o.order_events || []).sort((a, b) => a.id - b.id)));
}

/* ---------- loaders ---------- */
async function loadPublic() {
  const [products, settings, reviews, translations] = await Promise.all([
    run(supabase.from('products').select('*').order('created_at')),
    run(supabase.from('settings').select('*').eq('id', 1).single()),
    run(supabase.from('reviews').select('*').order('created_at', { ascending: false })),
    run(supabase.from('translations').select('*'))
  ]);
  cache.products = products.map(mapProduct);
  cache.settings = mapSettings(settings);
  cache.reviews = reviews.map(mapReview);
  cache.translations = { en: {}, es: {}, ar: {} };
  translations.forEach(r => { cache.translations[r.lang][r.key] = r.value; });
}

async function loadUser() {
  const u = cache.auth;
  if (!u) { Object.assign(cache, { profile: null, addresses: [], dates: [], wishlist: [], orders: [] }); return; }
  const [profile, addresses, dates, wishlist, orders] = await Promise.all([
    run(supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()),
    run(supabase.from('addresses').select('*').eq('user_id', u.id).order('created_at')),
    run(supabase.from('special_dates').select('*').eq('user_id', u.id).order('date')),
    run(supabase.from('wishlist').select('product_id').eq('user_id', u.id)),
    fetchOrders(q => q.eq('user_id', u.id))
  ]);
  cache.profile = profile;
  cache.addresses = addresses.map(mapAddress);
  cache.dates = dates.map(mapDate);
  cache.wishlist = wishlist.map(w => w.product_id);
  cache.orders = orders;
}

async function mergeGuestWishlist() {
  if (!cache.auth || !session.wishlist.length) return;
  const rows = session.wishlist.filter(id => !cache.wishlist.includes(id)).map(product_id => ({ product_id }));
  if (rows.length) await run(supabase.from('wishlist').upsert(rows, { ignoreDuplicates: true }));
  session.wishlist = [];
}

async function setAuth(user) {
  cache.auth = user || null;
  cache.admin.loaded = false;
  await loadUser();
  await mergeGuestWishlist();
  if (cache.auth) cache.wishlist = (await run(supabase.from('wishlist').select('product_id').eq('user_id', cache.auth.id))).map(w => w.product_id);
}

/* ---------- totals (display only; the server recomputes at checkout) ---------- */
function lineView(l) {
  const p = S.product(l.productId), s = S.size(p, l.sizeId);
  const price = S.unitPrice(p, l.sizeId), compare = S.unitCompare(p, l.sizeId);
  return { line: l, product: p, size: s, price, compare, total: price * l.qty, saving: Math.max(0, compare - price) * l.qty };
}

export const S = {
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get version() { return version; },
  get session() { return session; },
  uid,

  /* Boot: public data + current auth session */
  init() { return initPromise || (initPromise = S._boot()); },
  async _boot() {
    try {
      const { data } = await supabase.auth.getSession();
      await loadPublic();
      await setAuth(data.session ? data.session.user : null);
      cache.ready = true; cache.error = null;
    } catch (e) { cache.error = mapError(e); }
    commit('ready');
    supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === 'SIGNED_OUT' || evt === 'SIGNED_IN' || evt === 'USER_UPDATED') {
        const next = sess ? sess.user : null;
        if ((next && next.id) === (cache.auth && cache.auth.id) && evt !== 'USER_UPDATED') return;
        setTimeout(() => setAuth(next).then(() => commit('auth')).catch(() => commit('auth')), 0);
      }
    });
  },
  get ready() { return cache.ready; },
  get loadError() { return cache.error; },
  get adminLoaded() { return cache.admin.loaded; },

  /* Admin views read this; it is filled by S.admin.load() and is protected by RLS on the server */
  get db() {
    return {
      products: cache.admin.loaded ? cache.admin.products : cache.products,
      orders: cache.admin.orders, reviews: cache.admin.reviews, coupons: cache.admin.coupons,
      customers: cache.admin.customers, dates: cache.admin.dates,
      settings: cache.settings, translations: cache.translations
    };
  },

  /* ---------- preferences ---------- */
  setLang(l) { if (LANGS[l]) { session.lang = l; commit('lang'); } },
  setCurrency(c) { if (CURRENCIES[c]) { session.currency = c; commit('currency'); } },
  closeAnnouncement() { session.announcementClosed = true; commit('announcement'); },
  settings() { return cache.settings; },

  /* ---------- catalogue ---------- */
  products() { return cache.products.filter(p => p.active !== false); },
  product(id) { return cache.products.find(p => p.id === id && p.active !== false); },
  size(p, sizeId) { return p.sizes.find(s => s.id === sizeId) || p.sizes[0]; },
  unitPrice(p, sizeId) { return p.price + Number(S.size(p, sizeId).delta || 0); },
  unitCompare(p, sizeId) { return p.compareAt ? p.compareAt + Number(S.size(p, sizeId).delta || 0) : 0; },
  collection(key) { const c = COLLECTIONS[key]; return c ? S.products().filter(c.match) : []; },
  rating(p) {
    const list = cache.reviews.filter(r => r.productId === p.id && r.status === 'approved');
    const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
    return { avg: Math.round(avg * 10) / 10, count: list.length };
  },
  stockState(p) { return p.stock <= 0 ? 'out' : p.stock <= 10 ? 'low' : 'in'; },
  trackRecent(id) { session.recent = [id].concat(session.recent.filter(x => x !== id)).slice(0, 8); write(SESSION_KEY, session); },

  /* ---------- user ---------- */
  user() {
    const a = cache.auth; if (!a) return null;
    const pr = cache.profile || {};
    return {
      id: a.id, email: a.email, name: pr.full_name || '', phone: pr.phone || '',
      role: a.app_metadata && a.app_metadata.role === 'admin' ? 'admin' : 'customer',
      verified: !!a.email_confirmed_at, created: a.created_at,
      wishlist: cache.wishlist, addresses: cache.addresses, dates: cache.dates,
      prefs: { newsletter: !!pr.newsletter, orderEmails: pr.order_emails !== false }
    };
  },
  isAdmin() { const u = S.user(); return !!u && u.role === 'admin'; },

  async register({ email, password, name }) {
    email = email.trim().toLowerCase();
    const data = await run(supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim().slice(0, 100) } } }));
    /* Supabase returns a user with no identities when the email is already registered (anti-enumeration) */
    if (data.user && data.user.identities && data.user.identities.length === 0) throw { code: 'exists' };
    session.pendingEmail = email; commit('auth');
    return { needsVerification: !data.session };
  },
  async verify(code, email = session.pendingEmail) {
    if (!email) throw { code: 'auth' };
    await run(supabase.auth.verifyOtp({ email, token: String(code).trim(), type: 'signup' }));
    session.pendingEmail = null;
    const { data } = await supabase.auth.getUser();
    await setAuth(data.user); commit('auth');
  },
  async resendVerification(email = session.pendingEmail || (cache.auth && cache.auth.email)) {
    if (!email) throw { code: 'auth' };
    await run(supabase.auth.resend({ type: 'signup', email }));
  },
  async login(email, password) {
    email = email.trim().toLowerCase();
    try {
      const data = await run(supabase.auth.signInWithPassword({ email, password }));
      await setAuth(data.user); commit('auth');
      return S.user();
    } catch (e) {
      if (e.code === 'notConfirmed') { session.pendingEmail = email; commit('auth'); }
      throw e;
    }
  },
  async logout() { session.coupon = null; await supabase.auth.signOut(); await setAuth(null); commit('auth'); },
  async requestReset(email) {
    /* Always "succeeds" in the UI so it never reveals which emails are registered */
    try { await run(supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())); } catch (e) { if (e.code === 'network') throw e; }
    return {};
  },
  async resetPassword(email, code, password) {
    await run(supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).trim(), type: 'recovery' }));
    await run(supabase.auth.updateUser({ password }));
    await supabase.auth.signOut(); await setAuth(null); commit('auth');
  },
  async updateProfile(data) {
    await run(supabase.from('profiles').update({ full_name: data.name.trim().slice(0, 100), phone: (data.phone || '').trim() }).eq('id', cache.auth.id));
    await loadUser(); commit('user');
  },
  async changePassword(current, next) {
    /* re-authenticate with the current password before allowing a change */
    try { await run(supabase.auth.signInWithPassword({ email: cache.auth.email, password: current })); } catch (e) { throw e.code === 'network' ? e : { code: 'badPassword' }; }
    await run(supabase.auth.updateUser({ password: next }));
  },
  async updatePrefs(prefs) {
    const row = {};
    if ('newsletter' in prefs) row.newsletter = !!prefs.newsletter;
    if ('orderEmails' in prefs) row.order_emails = !!prefs.orderEmails;
    await run(supabase.from('profiles').update(row).eq('id', cache.auth.id));
    await loadUser(); commit('user');
  },

  /* ---------- wishlist ---------- */
  wishlist() { return (cache.auth ? cache.wishlist : session.wishlist).filter(id => S.product(id)); },
  inWishlist(id) { return S.wishlist().includes(id); },
  async toggleWishlist(id) {
    const on = S.inWishlist(id);
    if (cache.auth) {
      if (on) await run(supabase.from('wishlist').delete().eq('user_id', cache.auth.id).eq('product_id', id));
      else await run(supabase.from('wishlist').insert({ product_id: id }));
      cache.wishlist = on ? cache.wishlist.filter(x => x !== id) : cache.wishlist.concat(id);
    } else {
      session.wishlist = on ? session.wishlist.filter(x => x !== id) : session.wishlist.concat(id);
    }
    commit('wishlist');
    return !on;
  },

  /* ---------- cart (browser-side; prices are re-verified by the server at checkout) ---------- */
  cart() { return session.cart.filter(l => S.product(l.productId)); },
  cartCount() { return S.cart().reduce((a, l) => a + l.qty, 0); },
  async addToCart(productId, sizeId, qty = 1, gift = null) {
    const p = S.product(productId);
    if (!p || p.stock <= 0) throw { code: 'unavailable' };
    sizeId = S.size(p, sizeId).id;
    const inCart = session.cart.filter(l => l.productId === productId).reduce((a, l) => a + l.qty, 0);
    if (inCart + qty > p.stock) throw { code: 'stock', max: p.stock };
    if (inCart + qty > 20) throw { code: 'stock', max: 20 };
    let line = !gift && session.cart.find(l => l.productId === productId && l.sizeId === sizeId && !l.gift);
    if (line) line.qty += qty;
    else { line = { id: uid('l'), productId, sizeId, qty, gift }; session.cart.push(line); }
    commit('cart');
    return line;
  },
  async updateQty(lineId, qty) {
    const line = session.cart.find(l => l.id === lineId); if (!line) return;
    const p = S.product(line.productId);
    const others = session.cart.filter(l => l.productId === line.productId && l.id !== lineId).reduce((a, l) => a + l.qty, 0);
    if (qty + others > Math.min(p.stock, 20)) throw { code: 'stock', max: Math.min(p.stock, 20) - others };
    if (qty <= 0) session.cart = session.cart.filter(l => l.id !== lineId); else line.qty = qty;
    commit('cart');
  },
  async removeLine(lineId) { session.cart = session.cart.filter(l => l.id !== lineId); commit('cart'); },
  async setLineGift(lineId, gift) { const l = session.cart.find(x => x.id === lineId); if (l) { l.gift = gift; commit('cart'); } },
  clearCart() { session.cart = []; session.coupon = null; commit('cart'); },

  /* ---------- coupons & totals ---------- */
  async applyCoupon(code) {
    const rows = await run(supabase.rpc('validate_coupon', { p_code: String(code || ''), p_subtotal: S.totals().subtotal }));
    const c = rows && rows[0]; if (!c) throw { code: 'couponInvalid' };
    session.coupon = { code: c.code, type: c.type, value: Number(c.value), min: Number(c.min_subtotal), note: c.note };
    commit('coupon');
    return session.coupon;
  },
  removeCoupon() { session.coupon = null; commit('coupon'); },
  coupon() { return session.coupon; },
  lineView,
  totals(opts = {}) {
    const set = cache.settings || { freeShippingThreshold: 0, shippingFee: 0, expressFee: 0, vatRate: 0, giftWrap: {} };
    const lines = (opts.lines || S.cart()).map(lineView);
    const subtotal = lines.reduce((a, v) => a + v.total, 0);
    const savings = lines.reduce((a, v) => a + v.saving, 0);
    const c = S.coupon();
    let discount = 0, freeShip = false;
    if (c && subtotal >= c.min) {
      if (c.type === 'percent') discount = Math.round(subtotal * c.value) / 100;
      else if (c.type === 'fixed') discount = Math.min(c.value, subtotal);
      else if (c.type === 'ship') freeShip = true;
    }
    const giftFee = lines.reduce((a, v) => a + (v.line.gift ? Number(set.giftWrap[v.line.gift.wrap] || 0) : 0), 0);
    const method = opts.shippingMethod || 'standard';
    const afterDiscount = subtotal - discount;
    let shipping = 0;
    if (lines.length) shipping = method === 'express' ? set.expressFee : (freeShip || afterDiscount >= set.freeShippingThreshold) ? 0 : set.shippingFee;
    const total = Math.max(0, afterDiscount + giftFee + shipping);
    const vat = Math.round(total * set.vatRate / (100 + set.vatRate) * 100) / 100;
    const toFree = Math.max(0, set.freeShippingThreshold - afterDiscount);
    return { lines, subtotal, savings, discount, coupon: c, giftFee, shipping, method, vat, total, toFree, freeShip: freeShip || toFree === 0 };
  },

  /* ---------- orders ---------- */
  /* Creates the order server-side (status awaiting_payment, stock reserved) and returns {id, token, total} */
  async createOrder({ email, shipping, shippingMethod }) {
    const items = S.cart().map(l => ({ product_id: l.productId, size_id: l.sizeId, qty: l.qty, gift: l.gift || null }));
    const rows = await run(supabase.rpc('create_order', {
      p_items: items, p_email: email, p_shipping_method: shippingMethod, p_coupon: session.coupon ? session.coupon.code : null,
      p_shipping: { first_name: shipping.firstName, last_name: shipping.lastName, country: shipping.country, line1: shipping.line1, line2: shipping.line2 || '', city: shipping.city, state: shipping.state || '', phone: shipping.phone }
    }));
    const r = rows[0];
    session.lastOrder = { id: r.order_id, token: r.access_token };
    write(SESSION_KEY, session);
    await loadPublic();   // stock changed
    return { id: r.order_id, token: r.access_token, total: Number(r.total) };
  },
  /* Sandbox payment (Edge Function). Only the order id, its secret token and the simulated outcome are sent. */
  async payTest({ id, token }, outcome) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw { code: 'network' };
    const { data, error } = await supabase.functions.invoke('payments-test', { body: { order_id: id, token, outcome } });
    if (!error) return data;
    let code = 'unknown';
    try { const b = await error.context.json(); code = b.error === 'disabled' ? 'paymentsUnavailable' : b.error; } catch (e) { if (/fetch|network/i.test(error.message || '')) code = 'network'; }
    throw { code: ['orderNotFound', 'invalidState', 'paymentsUnavailable', 'invalidInput', 'network'].includes(code) ? code : 'unknown' };
  },
  async cancelPayment(pending) { await S.payTest(pending, 'cancel'); await loadPublic(); commit('stock'); },
  /* After a successful payment */
  async completeOrder(id) {
    session.cart = []; session.coupon = null;
    if (cache.auth) await loadUser();
    await S.loadOrder(id);
    commit('order');
  },
  order(id) {
    return cache.orders.find(o => o.id === id) || cache.admin.orders.find(o => o.id === id) || (cache.guestOrder && cache.guestOrder.id === id ? cache.guestOrder : null);
  },
  async loadOrder(id) {
    const token = session.lastOrder && session.lastOrder.id === id ? session.lastOrder.token : null;
    if (!token && !cache.auth) return null;
    const res = await run(supabase.rpc('get_order', { p_id: id, p_token: token || '00000000-0000-0000-0000-000000000000' }));
    if (!res) return null;
    const o = mapOrder(res.order, res.items, res.events);
    if (cache.auth && o.user === cache.auth.id) cache.orders = [o].concat(cache.orders.filter(x => x.id !== o.id));
    else cache.guestOrder = o;
    commit('order');
    return o;
  },
  myOrders() { return cache.orders; },
  canViewOrder(o) { return !!o; },
  rememberLastOrder() { /* kept for API compatibility; createOrder() stores the access token */ },

  /* ---------- addresses ---------- */
  async saveAddress(addr) {
    const row = unmapAddress(addr);
    if (row.is_default || !cache.addresses.length) {
      await run(supabase.from('addresses').update({ is_default: false }).eq('user_id', cache.auth.id));
      row.is_default = true;
    }
    const saved = addr.id
      ? await run(supabase.from('addresses').update(row).eq('id', addr.id).select().single())
      : await run(supabase.from('addresses').insert(row).select().single());
    await loadUser(); commit('address');
    return mapAddress(saved);
  },
  async deleteAddress(id) {
    const wasDefault = (cache.addresses.find(a => a.id === id) || {}).isDefault;
    await run(supabase.from('addresses').delete().eq('id', id));
    await loadUser();
    if (wasDefault && cache.addresses[0]) { await run(supabase.from('addresses').update({ is_default: true }).eq('id', cache.addresses[0].id)); await loadUser(); }
    commit('address');
  },
  async setDefaultAddress(id) {
    await run(supabase.from('addresses').update({ is_default: false }).eq('user_id', cache.auth.id));
    await run(supabase.from('addresses').update({ is_default: true }).eq('id', id));
    await loadUser(); commit('address');
  },

  /* ---------- special dates ---------- */
  async saveDate(d) {
    const row = { occasion: d.occasion, label: d.label || '', person_name: d.name, date: d.date, reminder: !!d.reminder, timing: d.timing, method: 'email', note: d.note || '' };
    if (d.id) await run(supabase.from('special_dates').update(row).eq('id', d.id));
    else await run(supabase.from('special_dates').insert(row));
    await loadUser(); commit('dates');
    return d;
  },
  async deleteDate(id) { await run(supabase.from('special_dates').delete().eq('id', id)); await loadUser(); commit('dates'); },
  async toggleReminder(id) {
    const d = cache.dates.find(x => x.id === id);
    await run(supabase.from('special_dates').update({ reminder: !d.reminder }).eq('id', id));
    await loadUser(); commit('dates');
    return !d.reminder;
  },

  /* ---------- reviews ---------- */
  reviews(productId) {
    const me = cache.auth && cache.auth.id;
    return cache.reviews.filter(r => r.productId === productId && (r.status === 'approved' || (me && r.userId === me)))
      .map(r => Object.assign({}, r, { email: me && r.userId === me ? cache.auth.email : undefined }));
  },
  approvedReviews() { return cache.reviews.filter(r => r.status === 'approved'); },
  hasPurchased(productId) { return cache.orders.some(o => o.payment.status === 'paid' && o.items.some(i => i.productId === productId)); },
  async addReview(productId, { rating, title, body }) {
    const u = S.user(); if (!u) throw { code: 'auth' };
    await run(supabase.from('reviews').insert({ product_id: productId, rating, title: title.trim(), body: body.trim(), author_name: (u.name || u.email.split('@')[0]).slice(0, 60) }));
    cache.reviews = (await run(supabase.from('reviews').select('*').order('created_at', { ascending: false }))).map(mapReview);
    commit('review');
  },

  /* ---------- contact & newsletter ---------- */
  async sendMessage(m) { await run(supabase.rpc('send_message', { p_name: m.name, p_email: m.email, p_phone: m.phone || '', p_topic: m.topic || 'general', p_message: m.message })); },
  async subscribe(email) { await run(supabase.rpc('subscribe_newsletter', { p_email: email })); },

  /* ---------- admin (every call is re-checked by RLS / is_admin() on the server) ---------- */
  admin: {
    async load() {
      const [orders, reviews, coupons, customers, dates, products] = await Promise.all([
        fetchOrders(), run(supabase.from('reviews').select('*').order('created_at', { ascending: false })),
        run(supabase.from('coupons').select('*').order('code')), run(supabase.rpc('admin_customers')),
        run(supabase.from('special_dates').select('*')), run(supabase.from('products').select('*').order('created_at'))
      ]);
      const emails = Object.fromEntries(customers.map(c => [c.id, c.email]));
      cache.admin = {
        loaded: true, orders,
        reviews: reviews.map(r => Object.assign(mapReview(r), { email: emails[r.user_id] || '' })),
        coupons: coupons.map(c => ({ code: c.code, type: c.type, value: Number(c.value), min: Number(c.min_subtotal), active: c.active, note: c.note })),
        customers: customers.map(c => ({ id: c.id, email: c.email, name: c.full_name, verified: c.verified, created: c.created_at, orders: Number(c.orders), spent: Number(c.spent), addresses: Number(c.addresses), dates: Number(c.dates) })),
        dates: dates.map(d => Object.assign(mapDate(d), { email: emails[d.user_id] || '' })),
        products: products.map(mapProduct)
      };
      commit('admin');
    },
    async refresh() { await loadPublic(); await S.admin.load(); },
    async uploadImage(dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${uid('p')}.${ext}`;
      await run(supabase.storage.from('product-images').upload(path, blob, { contentType: blob.type, upsert: false }));
      return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    },
    async saveProduct(p) {
      if (/^data:/.test(p.img)) p.img = await S.admin.uploadImage(p.img);
      await run(supabase.from('products').upsert(unmapProduct(p)));
      await S.admin.refresh();
      return p;
    },
    async deleteProduct(id) { await run(supabase.from('products').delete().eq('id', id)); await S.admin.refresh(); },
    async setOrderStatus(id, status) { await run(supabase.rpc('admin_set_order_status', { p_id: id, p_status: status })); await S.admin.load(); },
    async saveCoupon(c, originalCode) {
      const row = { code: c.code.trim().toUpperCase(), type: c.type, value: c.value, min_subtotal: c.min, active: c.active, note: c.note };
      if (originalCode && originalCode !== row.code) {
        await run(supabase.from('coupons').insert(row));
        await run(supabase.from('coupons').delete().eq('code', originalCode));
      } else if (originalCode) await run(supabase.from('coupons').update(row).eq('code', originalCode));
      else await run(supabase.from('coupons').insert(row));
      await S.admin.load();
    },
    async deleteCoupon(code) { await run(supabase.from('coupons').delete().eq('code', code)); await S.admin.load(); },
    async moderateReview(id, status) {
      if (status === 'delete') await run(supabase.from('reviews').delete().eq('id', id));
      else await run(supabase.from('reviews').update({ status }).eq('id', id));
      await S.admin.refresh();
    },
    async saveSettings(s) {
      await run(supabase.from('settings').update({
        free_shipping_threshold: s.freeShippingThreshold, shipping_fee: s.shippingFee, express_fee: s.expressFee,
        vat_rate: s.vatRate, gift_wrap: s.giftWrap, announcement: s.announcement
      }).eq('id', 1));
      await loadPublic(); commit('settings');
    },
    async saveTranslation(lang, key, value) {
      if (value === '' || value == null) await run(supabase.from('translations').delete().eq('lang', lang).eq('key', key));
      else await run(supabase.from('translations').upsert({ lang, key, value }));
      await loadPublic(); commit('translations');
    }
  }
};

export default S;
