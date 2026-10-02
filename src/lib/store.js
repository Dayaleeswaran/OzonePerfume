/* Ozone Scents — client-side store.
   `db` stands in for the server (products, users, orders…); `session` is per-browser state.
   Every mutating call that would hit a real API goes through api() so the UI always
   has loading / error states to show. Swap api() for fetch() calls when a backend exists.
   React subscribes through useStore() (lib/useStore.js), which re-renders on every commit. */
import { SEED_PRODUCTS, SEED_COUPONS, SEED_REVIEWS, SEED_SETTINGS, COLLECTIONS, LANGS, CURRENCIES } from '../data/catalog.js';

  const DB_KEY = 'oz_db_v1';
  const SESSION_KEY = 'oz_session_v1';

  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
  const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full / blocked */ } };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  /* Non-cryptographic hash — fine for a local prototype, replace with server-side bcrypt/argon2. */
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const pwHash = (email, pw) => hash('oz$' + email.toLowerCase() + '$' + pw);

  function seed() {
    const now = new Date();
    const iso = d => d.toISOString();
    const daysAgo = n => iso(new Date(now.getTime() - n * 864e5));
    const demoOrder = {
      id: 'OZ100231', date: daysAgo(12), email: 'demo@ozonescents.com', user: 'demo@ozonescents.com',
      items: [{ productId: 'max-diffuser', sizeId: '600', qty: 1, price: 680, compareAt: 0, name: 'Ozone Max Diffuser', img: 'o9', ml: 600, gift: null }],
      totals: { subtotal: 680, savings: 0, discount: 0, giftFee: 0, shipping: 0, vat: 32.38, total: 680 },
      shipping: { firstName: 'Layla', lastName: 'Hassan', line1: 'Villa 12, Street 4', line2: '', city: 'Sharjah', state: 'Al Majaz', country: 'AE', phone: '+971 50 123 4567' },
      shippingMethod: 'standard', payment: { method: 'card', brand: 'visa', last4: '4242', status: 'paid' },
      status: 'delivered',
      timeline: [{ status: 'placed', date: daysAgo(12) }, { status: 'processing', date: daysAgo(12) }, { status: 'shipped', date: daysAgo(10) }, { status: 'delivered', date: daysAgo(8) }]
    };
    return {
      version: 2,
      products: clone(SEED_PRODUCTS),
      coupons: clone(SEED_COUPONS),
      reviews: clone(SEED_REVIEWS),
      settings: clone(SEED_SETTINGS),
      translations: { en: {}, es: {}, ar: {} },
      orderSeq: 100232,
      orders: [demoOrder],
      messages: [],
      users: {
        'admin@ozonescents.com': { email: 'admin@ozonescents.com', name: 'Store Admin', role: 'admin', verified: true, pw: pwHash('admin@ozonescents.com', 'Admin@123'), created: daysAgo(90), wishlist: [], addresses: [], dates: [], prefs: { newsletter: false, orderEmails: true } },
        'demo@ozonescents.com': {
          email: 'demo@ozonescents.com', name: 'Layla Hassan', phone: '+971 50 123 4567', role: 'customer', verified: true, pw: pwHash('demo@ozonescents.com', 'Demo@123'), created: daysAgo(40),
          wishlist: ['oil-zestora', 'tower-diffuser'],
          addresses: [{ id: 'a1', label: 'Home', firstName: 'Layla', lastName: 'Hassan', line1: 'Villa 12, Street 4', line2: '', city: 'Sharjah', state: 'Al Majaz', country: 'AE', phone: '+971 50 123 4567', isDefault: true }],
          dates: [{ id: 'd1', occasion: 'birthday', name: 'Mum', date: '2026-11-18', reminder: true, timing: 7, method: 'email', note: '' }],
          prefs: { newsletter: true, orderEmails: true }
        }
      }
    };
  }

  let db = read(DB_KEY);
  if (!db || db.version !== 2) { db = seed(); write(DB_KEY, db); }
  let session = Object.assign({ lang: 'en', currency: 'AED', user: null, cart: [], wishlist: [], coupon: null, announcementClosed: false, recent: [] }, read(SESSION_KEY) || {});
  if (session.user && !db.users[session.user]) session.user = null;

  const listeners = new Set();
  let version = 0;
  function commit(evt) { version++; write(DB_KEY, db); write(SESSION_KEY, session); listeners.forEach(fn => fn(evt)); }

  /* Keep tabs in sync (cart / login in another tab) */
  window.addEventListener('storage', e => {
    if (e.key === DB_KEY) db = read(DB_KEY) || db;
    if (e.key === SESSION_KEY) session = Object.assign(session, read(SESSION_KEY) || {});
    if (e.key === DB_KEY || e.key === SESSION_KEY) { version++; listeners.forEach(fn => fn('sync')); }
  });

  /* Simulated network call */
  export const api = function (fn, ms = 550) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!navigator.onLine) return reject({ code: 'network' });
        try { resolve(fn()); } catch (err) { reject(err && err.code ? err : { code: 'unknown', detail: err }); }
      }, ms);
    });
  };
  const fail = (code, extra) => { throw Object.assign({ code }, extra || {}); };

  export const S = {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get version() { return version; },
    get session() { return session; },
    get db() { return db; },
    uid,

    /* ---------- preferences ---------- */
    setLang(l) { if (LANGS[l]) { session.lang = l; commit('lang'); } },
    setCurrency(c) { if (CURRENCIES[c]) { session.currency = c; commit('currency'); } },
    closeAnnouncement() { session.announcementClosed = true; commit('announcement'); },
    settings() { return db.settings; },

    /* ---------- catalogue ---------- */
    /* Storefront only sees products the admin has left "available online" */
    products() { return db.products.filter(p => p.active !== false); },
    product(id) { return db.products.find(p => p.id === id && p.active !== false); },
    size(p, sizeId) { return p.sizes.find(s => s.id === sizeId) || p.sizes[0]; },
    unitPrice(p, sizeId) { return p.price + S.size(p, sizeId).delta; },
    unitCompare(p, sizeId) { return p.compareAt ? p.compareAt + S.size(p, sizeId).delta : 0; },
    collection(key) { const c = COLLECTIONS[key]; return c ? S.products().filter(c.match) : []; },
    rating(p) {
      const extra = db.reviews.filter(r => r.productId === p.id && r.status === 'approved' && r.userAdded);
      const count = (p.reviewCount || 0) + extra.length;
      const avg = count ? ((p.rating || 0) * (p.reviewCount || 0) + extra.reduce((a, r) => a + r.rating, 0)) / count : 0;
      return { avg: Math.round(avg * 10) / 10, count };
    },
    stockState(p) { return p.stock <= 0 ? 'out' : p.stock <= 10 ? 'low' : 'in'; },
    trackRecent(id) { session.recent = [id].concat(session.recent.filter(x => x !== id)).slice(0, 8); write(SESSION_KEY, session); },

    /* ---------- user ---------- */
    user() { return session.user ? db.users[session.user] : null; },
    isAdmin() { const u = S.user(); return !!u && u.role === 'admin'; },

    register({ email, password, name }) {
      return api(() => {
        email = email.trim().toLowerCase();
        if (db.users[email]) fail('exists');
        const code = String(Math.floor(100000 + Math.random() * 900000));
        db.users[email] = { email, name: name.trim(), phone: '', role: 'customer', verified: false, verifyCode: code, pw: pwHash(email, password), created: new Date().toISOString(), wishlist: [], addresses: [], dates: [], prefs: { newsletter: false, orderEmails: true } };
        session.user = email;
        S._mergeGuestWishlist();
        commit('auth');
        return { code };
      }, 900);
    },
    verify(code) {
      return api(() => {
        const u = S.user(); if (!u) fail('auth');
        if (String(code).trim() !== u.verifyCode) fail('badCode');
        u.verified = true; delete u.verifyCode; commit('user');
      }, 700);
    },
    resendVerification() {
      return api(() => { const u = S.user(); u.verifyCode = String(Math.floor(100000 + Math.random() * 900000)); commit('user'); return { code: u.verifyCode }; }, 600);
    },
    login(email, password) {
      return api(() => {
        email = email.trim().toLowerCase();
        const u = db.users[email];
        if (!u || u.pw !== pwHash(email, password)) fail('badLogin');
        session.user = email;
        S._mergeGuestWishlist();
        commit('auth');
        return u;
      }, 800);
    },
    logout() { session.user = null; session.coupon = null; commit('auth'); },
    requestReset(email) {
      return api(() => {
        email = email.trim().toLowerCase();
        const u = db.users[email];
        /* Always "succeed" so the UI never reveals which emails are registered */
        if (!u) return { code: null };
        u.resetCode = String(Math.floor(100000 + Math.random() * 900000)); commit('user');
        return { code: u.resetCode };
      }, 800);
    },
    resetPassword(email, code, password) {
      return api(() => {
        email = email.trim().toLowerCase();
        const u = db.users[email];
        if (!u || !u.resetCode || u.resetCode !== String(code).trim()) fail('badCode');
        u.pw = pwHash(email, password); delete u.resetCode; commit('user');
      }, 800);
    },
    updateProfile(data) {
      return api(() => { const u = S.user(); Object.assign(u, { name: data.name.trim(), phone: data.phone.trim() }); commit('user'); });
    },
    changePassword(current, next) {
      return api(() => { const u = S.user(); if (u.pw !== pwHash(u.email, current)) fail('badPassword'); u.pw = pwHash(u.email, next); commit('user'); }, 700);
    },
    updatePrefs(prefs) { return api(() => { Object.assign(S.user().prefs, prefs); commit('user'); }, 400); },

    /* ---------- wishlist ---------- */
    wishlist() { const u = S.user(); return (u ? u.wishlist : session.wishlist).filter(id => S.product(id)); },
    inWishlist(id) { return S.wishlist().includes(id); },
    toggleWishlist(id) {
      return api(() => {
        const list = S.user() ? S.user().wishlist : session.wishlist;
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
        commit('wishlist');
        return i < 0;
      }, 250);
    },
    _mergeGuestWishlist() {
      const u = S.user(); if (!u) return;
      session.wishlist.forEach(id => { if (!u.wishlist.includes(id)) u.wishlist.push(id); });
      session.wishlist = [];
    },

    /* ---------- cart ---------- */
    cart() { return session.cart.filter(l => S.product(l.productId)); },
    cartCount() { return S.cart().reduce((a, l) => a + l.qty, 0); },
    addToCart(productId, sizeId, qty = 1, gift = null) {
      return api(() => {
        const p = S.product(productId);
        if (!p || p.stock <= 0) fail('unavailable');
        sizeId = S.size(p, sizeId).id;
        let line = !gift && session.cart.find(l => l.productId === productId && l.sizeId === sizeId && !l.gift);
        const inCart = session.cart.filter(l => l.productId === productId).reduce((a, l) => a + l.qty, 0);
        if (inCart + qty > p.stock) fail('stock', { max: p.stock });
        if (line) line.qty += qty;
        else { line = { id: uid('l'), productId, sizeId, qty, gift }; session.cart.push(line); }
        commit('cart');
        return line;
      }, 450);
    },
    updateQty(lineId, qty) {
      return api(() => {
        const line = session.cart.find(l => l.id === lineId); if (!line) return;
        const p = S.product(line.productId);
        const others = session.cart.filter(l => l.productId === line.productId && l.id !== lineId).reduce((a, l) => a + l.qty, 0);
        if (qty + others > p.stock) fail('stock', { max: p.stock - others });
        if (qty <= 0) session.cart = session.cart.filter(l => l.id !== lineId); else line.qty = qty;
        commit('cart');
      }, 300);
    },
    removeLine(lineId) { return api(() => { session.cart = session.cart.filter(l => l.id !== lineId); commit('cart'); }, 300); },
    setLineGift(lineId, gift) { return api(() => { const l = session.cart.find(x => x.id === lineId); if (l) { l.gift = gift; commit('cart'); } }, 400); },
    clearCart() { session.cart = []; session.coupon = null; commit('cart'); },

    /* ---------- coupons & totals ---------- */
    applyCoupon(code) {
      return api(() => {
        code = String(code || '').trim().toUpperCase();
        const c = db.coupons.find(x => x.code === code);
        if (!c) fail('couponInvalid');
        if (!c.active) fail('couponExpired');
        const sub = S.totals().subtotal;
        if (sub < c.min) fail('couponMin', { min: c.min });
        session.coupon = c.code; commit('coupon');
        return c;
      }, 600);
    },
    removeCoupon() { session.coupon = null; commit('coupon'); },
    coupon() { return session.coupon ? db.coupons.find(c => c.code === session.coupon && c.active) : null; },

    lineView(l) {
      const p = S.product(l.productId), s = S.size(p, l.sizeId);
      const price = S.unitPrice(p, l.sizeId), compare = S.unitCompare(p, l.sizeId);
      return { line: l, product: p, size: s, price, compare, total: price * l.qty, saving: Math.max(0, compare - price) * l.qty };
    },
    totals(opts = {}) {
      const set = db.settings;
      const lines = (opts.lines || S.cart()).map(S.lineView);
      const subtotal = lines.reduce((a, v) => a + v.total, 0);
      const savings = lines.reduce((a, v) => a + v.saving, 0);
      const c = S.coupon();
      let discount = 0, freeShip = false;
      if (c && subtotal >= c.min) {
        if (c.type === 'percent') discount = Math.round(subtotal * c.value) / 100;
        else if (c.type === 'fixed') discount = Math.min(c.value, subtotal);
        else if (c.type === 'ship') freeShip = true;
      }
      const giftFee = lines.reduce((a, v) => a + (v.line.gift ? (set.giftWrap[v.line.gift.wrap] || 0) : 0), 0);
      const method = opts.shippingMethod || 'standard';
      const afterDiscount = subtotal - discount;
      let shipping = 0;
      if (lines.length) {
        if (method === 'express') shipping = set.expressFee;
        else shipping = (freeShip || afterDiscount >= set.freeShippingThreshold) ? 0 : set.shippingFee;
      }
      const total = Math.max(0, afterDiscount + giftFee + shipping);
      const vat = Math.round(total * set.vatRate / (100 + set.vatRate) * 100) / 100;
      const toFree = Math.max(0, set.freeShippingThreshold - afterDiscount);
      return { lines, subtotal, savings, discount, coupon: c, giftFee, shipping, method, vat, total, toFree, freeShip: freeShip || toFree === 0 };
    },

    /* ---------- orders ---------- */
    placeOrder({ contact, shipping, shippingMethod, payment }) {
      return api(() => {
        const t = S.totals({ shippingMethod });
        if (!t.lines.length) fail('emptyCart');
        for (const v of t.lines) {
          if (v.product.stock < v.line.qty) fail('stock', { name: v.product.name.en, max: v.product.stock });
        }
        t.lines.forEach(v => { v.product.stock -= v.line.qty; });
        const now = new Date().toISOString();
        const order = {
          id: 'OZ' + (db.orderSeq++), date: now, email: contact.email, user: session.user || null,
          items: t.lines.map(v => ({ productId: v.product.id, sizeId: v.size.id, ml: v.size.ml, qty: v.line.qty, price: v.price, compareAt: v.compare, name: v.product.name.en, img: v.product.img, gift: v.line.gift })),
          totals: { subtotal: t.subtotal, savings: t.savings, discount: t.discount, giftFee: t.giftFee, shipping: t.shipping, vat: t.vat, total: t.total },
          coupon: t.coupon ? t.coupon.code : null,
          currency: session.currency,
          shipping: clone(shipping), shippingMethod,
          payment: { method: payment.method, brand: payment.brand || null, last4: payment.last4 || null, coin: payment.coin || null, status: 'paid' },
          status: 'processing',
          timeline: [{ status: 'placed', date: now }, { status: 'processing', date: now }]
        };
        db.orders.unshift(order);
        session.cart = []; session.coupon = null;
        commit('order');
        return order;
      }, 900);
    },
    order(id) { return db.orders.find(o => o.id === id); },
    myOrders() { const u = S.user(); return u ? db.orders.filter(o => o.user === u.email || o.email === u.email) : []; },
    canViewOrder(o) { const u = S.user(); return !!o && (S.isAdmin() || (u && (o.user === u.email || o.email === u.email)) || session.lastOrder === o.id); },
    rememberLastOrder(id) { session.lastOrder = id; write(SESSION_KEY, session); },

    /* ---------- addresses ---------- */
    saveAddress(addr) {
      return api(() => {
        const u = S.user(); const list = u.addresses;
        if (addr.isDefault || !list.length) list.forEach(a => { a.isDefault = false; });
        if (addr.id) { const i = list.findIndex(a => a.id === addr.id); list[i] = Object.assign(list[i], addr); }
        else { addr.id = uid('a'); if (!list.length) addr.isDefault = true; list.push(addr); }
        commit('address');
        return addr;
      });
    },
    deleteAddress(id) {
      return api(() => {
        const u = S.user(); const wasDefault = (u.addresses.find(a => a.id === id) || {}).isDefault;
        u.addresses = u.addresses.filter(a => a.id !== id);
        if (wasDefault && u.addresses[0]) u.addresses[0].isDefault = true;
        commit('address');
      }, 400);
    },
    setDefaultAddress(id) { return api(() => { S.user().addresses.forEach(a => { a.isDefault = a.id === id; }); commit('address'); }, 300); },

    /* ---------- special dates ---------- */
    saveDate(d) {
      return api(() => {
        const list = S.user().dates;
        if (d.id) { const i = list.findIndex(x => x.id === d.id); list[i] = Object.assign(list[i], d); }
        else { d.id = uid('d'); list.push(d); }
        commit('dates');
        return d;
      });
    },
    deleteDate(id) { return api(() => { const u = S.user(); u.dates = u.dates.filter(d => d.id !== id); commit('dates'); }, 400); },
    toggleReminder(id) { return api(() => { const d = S.user().dates.find(x => x.id === id); d.reminder = !d.reminder; commit('dates'); return d.reminder; }, 300); },

    /* ---------- reviews ---------- */
    reviews(productId) {
      const me = session.user;
      return db.reviews.filter(r => r.productId === productId && (r.status === 'approved' || (me && r.email === me)));
    },
    hasPurchased(productId) { return S.myOrders().some(o => o.items.some(i => i.productId === productId)); },
    addReview(productId, { rating, title, body }) {
      return api(() => {
        const u = S.user(); if (!u) fail('auth');
        if (db.reviews.some(r => r.productId === productId && r.email === u.email)) fail('duplicate');
        const r = { id: uid('r'), productId, email: u.email, name: u.name || u.email.split('@')[0], rating, title: title.trim(), body: body.trim(), date: new Date().toISOString().slice(0, 10), verified: S.hasPurchased(productId), status: 'pending', userAdded: true };
        db.reviews.unshift(r); commit('review');
        return r;
      }, 900);
    },

    /* ---------- contact ---------- */
    sendMessage(msg) { return api(() => { db.messages.unshift(Object.assign({ id: uid('m'), date: new Date().toISOString() }, msg)); commit('message'); }, 900); },

    /* ---------- admin ---------- */
    admin: {
      saveProduct(p) {
        return api(() => {
          if (!S.isAdmin()) fail('forbidden');
          const i = db.products.findIndex(x => x.id === p.id);
          if (i >= 0) db.products[i] = p; else db.products.push(p);
          commit('products');
          return p;
        }, 500);
      },
      deleteProduct(id) { return api(() => { if (!S.isAdmin()) fail('forbidden'); db.products = db.products.filter(p => p.id !== id); commit('products'); }, 400); },
      setOrderStatus(id, status) {
        return api(() => {
          if (!S.isAdmin()) fail('forbidden');
          const o = S.order(id); o.status = status; o.timeline.push({ status, date: new Date().toISOString() });
          if (status === 'refunded') o.payment.status = 'refunded';
          commit('orders');
        }, 400);
      },
      saveCoupon(c, originalCode) {
        return api(() => {
          if (!S.isAdmin()) fail('forbidden');
          c.code = c.code.trim().toUpperCase();
          if (c.code !== originalCode && db.coupons.some(x => x.code === c.code)) fail('exists');
          const i = db.coupons.findIndex(x => x.code === originalCode);
          if (i >= 0) db.coupons[i] = c; else db.coupons.push(c);
          commit('coupons');
        }, 400);
      },
      deleteCoupon(code) { return api(() => { db.coupons = db.coupons.filter(c => c.code !== code); commit('coupons'); }, 300); },
      moderateReview(id, status) { return api(() => { const r = db.reviews.find(x => x.id === id); if (status === 'delete') db.reviews = db.reviews.filter(x => x.id !== id); else r.status = status; commit('reviews'); }, 300); },
      saveSettings(s) { return api(() => { Object.assign(db.settings, s); commit('settings'); }, 500); },
      saveTranslation(lang, key, value) {
        return api(() => {
          const map = db.translations[lang] || (db.translations[lang] = {});
          if (value === '' || value == null) delete map[key]; else map[key] = value;
          commit('translations');
        }, 250);
      },
      resetDemo() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); location.hash = '#/'; location.reload(); }
    }
  };

export default S;
