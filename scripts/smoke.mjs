// Post-deploy smoke test: every route must load when opened directly (SPA rewrite), and static files must be served.
// Usage: node scripts/smoke.mjs https://ozone.dayaleeswaran.dev
const base = (process.argv[2] || process.env.SITE_URL || '').replace(/\/+$/, '');
if (!base) { console.error('usage: node scripts/smoke.mjs <site url>'); process.exit(1); }

const PAGES = ['/', '/about', '/contact', '/cart', '/checkout', '/login', '/register', '/verify', '/reset', '/account', '/admin', '/wishlist',
  '/shop/diffusers', '/deals/aroma', '/deals/crazy', '/product/tower-diffuser', '/order/OZ100000', '/policies/shipping', '/does-not-exist'];
const FILES = ['/robots.txt', '/sitemap.xml'];

let failed = 0;
for (const p of PAGES) {
  const r = await fetch(base + p, { redirect: 'manual' });
  const html = r.status === 200 ? await r.text() : '';
  const ok = r.status === 200 && html.includes('<div id="root">');     // the app shell; the router shows the page or its own 404
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', r.status, p);
}
for (const p of FILES) {
  const r = await fetch(base + p);
  const body = await r.text();
  const ok = r.status === 200 && !body.includes('<div id="root">');
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', r.status, p);
}
const h = (await fetch(base + '/')).headers;
for (const name of ['content-security-policy', 'strict-transport-security', 'x-content-type-options']) {
  const ok = !!h.get(name);
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', 'header', name);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
