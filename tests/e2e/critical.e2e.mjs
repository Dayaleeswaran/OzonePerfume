// Critical-path browser tests (section 28 E2E list) against the local stack:
//   npx supabase start; npx supabase functions serve --env-file supabase/functions/.env; npm run dev
//   npm run test:e2e        (E2E_BASE_URL, E2E_BROWSER=path to Chrome/Edge, E2E_HEADED=1 to watch)
// Auth emails are read from the local Mailpit inbox. Screenshots go to tests/e2e/shots/.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const MAIL = process.env.E2E_MAILPIT || 'http://127.0.0.1:54324/api/v1';
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const BROWSERS = [process.env.E2E_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = BROWSERS.find(p => existsSync(p));
if (!executablePath) { console.error('No Chrome/Edge found — set E2E_BROWSER'); process.exit(1); }

async function otpFor(email, after) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAIL}/search?query=${encodeURIComponent('to:' + email)}`)).json();
    const m = (list.messages || []).find(x => new Date(x.Created) > after);
    if (m) {
      const full = await (await fetch(`${MAIL}/message/${m.ID}`)).json();
      const code = (full.Text || full.HTML || '').match(/\b(\d{6})\b/);
      if (code) return code[1];
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('no email for ' + email);
}

const browser = await chromium.launch({ executablePath, headless: !process.env.E2E_HEADED });
const errors = [];
let passed = 0, failed = 0;
const watch = page => {
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|status of 4\d\d|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
};
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const page = await ctx.newPage(); watch(page);
const shot = name => page.screenshot({ path: `${SHOTS}/${name}.png` });
const go = async path => { await page.evaluate(p => { history.pushState(null, '', p); dispatchEvent(new Event('oz:nav')); }, path); await page.waitForTimeout(700); };
const text = sel => page.textContent(sel);
async function step(name, fn) {
  try { await fn(); passed++; console.log('ok    ', name); }
  catch (e) { failed++; console.log('FAIL  ', name, '—', e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '-').slice(0, 60)).catch(() => {}); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
async function login(email, password) {
  await go('/login');
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
  await page.click('[data-login] button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
}
const logout = async () => { await page.evaluate(() => window.OZ.store.logout()); await page.waitForTimeout(600); };
const clearCart = () => page.evaluate(() => window.OZ.store.clearCart());
const addProduct = async (id, opts = {}) => {
  await go('/product/' + id);
  if (opts.size) await page.click(`input[name=size][value="${opts.size}"]`, { force: true });
  await page.click('[data-add-main]'); await page.waitForSelector('.cart-ov.in', { timeout: 8000 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
};

await page.goto(BASE + '/');
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto(BASE + '/');
await page.waitForSelector('.pcard', { timeout: 20000 });

await step('SEO: real URLs, canonical + robots, Product JSON-LD, private pages noindex, legacy #/ links redirect', async () => {
  await page.goto(BASE + '/product/tower-diffuser'); await page.waitForSelector('[data-add-main]');
  expect(await page.getAttribute('link[rel=canonical]', 'href') === 'https://www.ozonescents.com/product/tower-diffuser', 'canonical');
  expect((await page.getAttribute('meta[name=robots]', 'content')).startsWith('index'), 'robots index');
  const ld = JSON.parse(await page.textContent('#page-jsonld'));
  expect(ld['@type'] === 'Product' && ld.offers.priceCurrency === 'AED', 'product json-ld');
  await go('/cart');
  expect((await page.getAttribute('meta[name=robots]', 'content')).startsWith('noindex'), 'cart noindex');
  expect(!(await page.$('link[rel=canonical]')), 'no canonical on private page');
  await page.goto(BASE + '/#/shop/diffusers'); await page.waitForSelector('[data-grid]');
  expect(await page.evaluate(() => location.pathname) === '/shop/diffusers', 'legacy hash redirect');
  const robots = await (await fetch(BASE + '/robots.txt')).text();
  expect(/Disallow: \/admin/.test(robots), 'robots.txt');
});

await step('Navigation: approved primary menu only (section 3)', async () => {
  await go('/');
  const items = await page.$$eval('.main-nav > ul > li > a, .main-nav > ul > li > .nav-link, .main-nav .nav-item > a', as => as.map(a => a.getAttribute('href')));
  const expected = ['/', '/shop/diffusers', '/deals/aroma', '/deals/crazy', '/shop/home-care', '/about', '/contact'];
  expect(expected.every(h => items.includes(h)), 'missing nav items: ' + items.join(','));
  expect(!items.some(h => /rental|journal|collections|new-arrivals/i.test(h || '')), 'unexpected nav item');
});

await step('AC-PURCHASE-001: checkout requires login; cart is kept', async () => {
  await clearCart(); await addProduct('oil-zestora');
  await go('/checkout');
  await page.waitForFunction(() => location.pathname === '/login', null, { timeout: 8000 });
  expect(/checkout/.test(await page.evaluate(() => location.search)), 'next=/checkout');
  expect(await page.evaluate(() => window.OZ.store.cartCount()) === 1, 'cart kept');
  await shot('01-login-required');
});

const email = `e2e.${Date.now()}@example.com`;
await step('UC-AUTH-001/002: register and verify with the emailed code', async () => {
  await go('/register?next=%2Fcheckout');
  await page.fill('input[name=name]', 'Nadia Test'); await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'Secret123'); await page.fill('input[name=confirm]', 'Secret123');
  await page.check('input[name=terms]');
  const t0 = new Date(Date.now() - 2000);
  await page.click('[data-register] button[type=submit]');
  await page.waitForFunction(() => location.pathname === '/verify', null, { timeout: 10000 });
  expect(!/\b\d{6}\b/.test(await text('[data-verify]')), 'code must not be shown on the page');
  await page.fill('input[name=code]', await otpFor(email, t0)); await page.click('[data-verify] button[type=submit]');
  await page.waitForFunction(() => location.pathname === '/checkout', null, { timeout: 10000 });
});

await step('E2E 5: coupons — LAUNCH20 rejected under AED 600, WELCOME10 accepted for a first purchase', async () => {
  await go('/cart');
  await page.fill('#coupon-in', 'launch20'); await page.click('[data-coupon] button'); await page.waitForTimeout(1200);
  expect(/above/i.test(await text('#coupon-err')), 'LAUNCH20 should need > AED 600');
  await page.fill('#coupon-in', 'welcome10'); await page.click('[data-coupon] button'); await page.waitForTimeout(1200);
  expect((await text('.sum-rows')).includes('WELCOME10'), 'WELCOME10 applied');
  await shot('02-cart-coupon');
});

await step('E2E 6/7/8: UAE standard AED 20, express AED 35, free standard over AED 250', async () => {
  await go('/checkout');
  await page.click('[data-ck="info"] button[type=submit]'); await page.waitForSelector('[data-ck="shipping"]');
  const opts = await text('.ship-opts');
  expect(/AED\s*20\.00/.test(opts) && /AED\s*35\.00/.test(opts), 'fees: ' + opts);
  expect(/1–2 business days/.test(opts) && /Same-day/.test(opts), 'delivery messages');
  await page.evaluate(() => window.OZ.store.removeCoupon());
  await addProduct('car-diffuser');                                   // 230 + 270 = 500 > 250
  await go('/checkout/shipping'); await page.waitForSelector('.ship-opts');
  expect(/Free/.test(await text('.ship-opts .opt-card:first-child')), 'standard should be free over AED 250');
  await shot('03-shipping-options');
});

await step('E2E 9/10/11/12: gift line, declined card, retry on the same order, confirmation', async () => {
  await clearCart();
  await go('/product/oil-velvet-bloom'); await page.click('[data-action="gift-pdp"]'); await page.waitForSelector('.gift-ov.in');
  await page.fill('.gift-ov input[name=recipientName]', 'Mona'); await page.fill('.gift-ov textarea', 'Happy birthday!');
  await page.click('.gift-ov input[name=wrap][value=premium]', { force: true });
  await page.click('.gift-ov button[type=submit]'); await page.waitForFunction(() => location.pathname === '/cart', null, { timeout: 8000 });
  expect((await text('.sum-rows')).includes('20.00'), 'premium wrap AED 20');
  await go('/checkout'); await page.click('[data-ck="info"] button[type=submit]'); await page.waitForSelector('[data-ck="shipping"]');
  await page.fill('input[name=firstName]', 'Sara'); await page.fill('input[name=lastName]', 'Ali');
  await page.fill('input[name=line1]', 'Tower 5, Apt 902'); await page.fill('input[name=city]', 'Sharjah'); await page.fill('input[name=phone]', '+971 50 000 0000');
  await page.click('[data-ck="shipping"] button[type=submit]'); await page.waitForSelector('[data-card-form]');
  await page.fill('input[name=ccname]', 'Sara Ali'); await page.fill('#ccnum', '4000000000000002'); await page.fill('input[name=ccexp]', '1230'); await page.fill('input[name=cccvc]', '123');
  await page.click('[data-action="pay"]'); await page.waitForSelector('.pay-state.err', { timeout: 15000 });
  const held = await page.evaluate(() => JSON.parse(sessionStorage.getItem('oz_checkout_v1')).pending.id);
  await page.click('.pay-ov.in [data-ov-close].btn'); await page.waitForTimeout(400);
  await page.fill('#ccnum', '4242424242424242'); await page.fill('input[name=cccvc]', '123');
  await page.click('[data-action="pay"]');
  await page.waitForFunction(() => location.pathname.startsWith('/order/'), null, { timeout: 15000 }); await page.waitForSelector('.order-detail');
  expect(await page.evaluate(() => location.pathname.split('/')[2]) === held, 'retry must reuse the held order');
  const od = await text('.order-detail');
  expect(/Paid/.test(od) && /Processing/.test(od) && /Mona/.test(od), 'paid order with gift');
  expect(!/4242|ending/.test(od), 'no card data');
  await shot('04-confirmation');
});

await step('E2E 13: order history; confirmation email delivered', async () => {
  await go('/account/orders');
  expect((await page.$$('#main a[href^="/account/orders/OZ"]')).length >= 1, 'order in history');
  let got = false;
  for (let i = 0; i < 40 && !got; i++) {
    const r = await (await fetch(`${MAIL}/search?query=${encodeURIComponent('to:' + email + ' subject:confirmed')}`)).json();
    got = r.messages_count > 0; if (!got) await new Promise(r => setTimeout(r, 2000));
  }
  expect(got, 'order confirmation email (needs the dispatcher: Vault secrets + functions serve)');
});

await step('E2E 14: review submitted → pending → approved by admin → public', async () => {
  await go('/product/oil-velvet-bloom'); await page.click('[data-jump="reviews"]'); await page.waitForTimeout(600);
  await page.click('#reviews [data-action="write-review"]'); await page.click('label[for=sr5]');
  await page.fill('[data-rev-form] input[name=title]', 'Lovely'); await page.fill('[data-rev-form] textarea', 'Warm and calming scent all evening long.');
  await page.click('[data-rev-form] button[type=submit]'); await page.waitForTimeout(1500);
  await logout();
  await login('admin@ozonescents.com', 'Admin@123');
  await go('/admin/reviews'); await page.waitForSelector('.adm-reviews');
  await page.click('.adm-reviews li:has-text("Lovely") .btn-teal'); await page.waitForTimeout(1500);
  await logout();
  await go('/product/oil-velvet-bloom'); await page.waitForTimeout(800);
  expect((await text('#reviews')).includes('Lovely'), 'approved review is public');
});

await step('E2E 15/16/17: admin updates product, stock and order status (valid transitions only)', async () => {
  await login('admin@ozonescents.com', 'Admin@123');
  await go('/admin/inventory');
  await page.fill('#inv-love-diffuser', '31'); await page.click('form.inv-form:has(#inv-love-diffuser) button[type=submit]'); await page.waitForTimeout(1500);
  await go('/admin/products'); await page.click('[data-edit="love-diffuser"]'); await page.waitForSelector('[data-pform]');
  expect(await page.inputValue('[data-pform] input[name=stock]') === '31', 'stock saved');
  await page.keyboard.press('Escape');
  await go('/admin/orders'); await page.click('#main table a[href^="/admin/orders/OZ"]'); await page.waitForSelector('#ostatus');
  const options = await page.$$eval('#ostatus option', os => os.map(o => o.value));
  expect(!options.includes('delivered') && options.includes('shipped'), 'processing → shipped/cancelled only, got ' + options);
  await page.selectOption('#ostatus', 'shipped'); await page.click('.status-form button[type=submit]'); await page.waitForTimeout(1500);
  expect(/Shipped/.test(await text('.adm-order-head')), 'status shipped');
  await go('/admin/settings'); await page.waitForSelector('[data-shipping-rules]');
  expect(/AE/.test(await text('[data-shipping-rules]')), 'shipping rules listed');
  await shot('05-admin-settings');
  await logout();
});

await step('AC-ADMIN-001: a customer cannot open the admin', async () => {
  await login('demo@ozonescents.com', 'Demo@123');
  await go('/admin'); await page.waitForTimeout(800);
  expect(!(await page.$('.adm-side')), 'admin shell rendered for a customer');
  await logout();
});

await step('E2E 18/19 / AC-I18N-001: Spanish and Arabic; Arabic is RTL without horizontal overflow', async () => {
  await page.evaluate(() => window.OZ.store.setLang('es')); await go('/'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.lang) === 'es', 'es');
  await page.evaluate(() => window.OZ.store.setLang('ar')); await go('/shop/diffusers'); await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow in RTL');
  await shot('06-arabic');
  await page.evaluate(() => window.OZ.store.setLang('en'));
});

await step('E2E 20: mobile — product to checkout login gate, no horizontal scroll', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await m.newPage(); watch(p);
  await p.goto(BASE + '/product/bath-diffuser'); await p.waitForSelector('[data-add-main]');
  await p.click('[data-add-main]'); await p.waitForSelector('.cart-ov.in');
  await p.click('.cart-ov a[href="/checkout"]');
  await p.waitForFunction(() => location.pathname === '/login', null, { timeout: 8000 });
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile overflow');
  await p.screenshot({ path: `${SHOTS}/07-mobile-login-gate.png` });
  await m.close();
});

await step('GAP-010: special dates hidden until enabled (Phase 2)', async () => {
  await login('demo@ozonescents.com', 'Demo@123');
  await go('/account');
  expect(!(await page.$('.acc-nav a[href="/account/dates"]')), 'dates link visible');
  await logout();
});

console.log(errors.length ? '\nBrowser errors:\n' + [...new Set(errors)].join('\n') : '\nNo browser errors');
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
