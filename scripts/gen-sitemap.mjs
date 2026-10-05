// Writes dist/sitemap.xml after `vite build` (SEO-005 / FR-SEO-004).
// Product URLs come from the live database (public, active products via the anon key) so the sitemap
// always matches the shop; if the database can't be reached the build falls back to the bundled catalogue.
// Usage: node scripts/gen-sitemap.mjs   (reads VITE_SITE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY from the env or .env files)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SEED_PRODUCTS, COLLECTIONS } from '../src/data/catalog.js';

/* Same precedence as Vite: later files override earlier ones; real environment variables win; empty values are ignored */
function loadEnv() {
  const fromFiles = {};
  for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      const v = m && m[2].replace(/^['"]|['"]$/g, '');
      if (v) fromFiles[m[1]] = v;
    }
  }
  const fromProcess = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v));
  return { ...fromFiles, ...fromProcess };
}

const env = loadEnv();
const SITE = (env.VITE_SITE_URL || 'https://www.ozonescents.com').replace(/\/+$/, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function products() {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    try {
      const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/products?select=id,updated_at&active=eq.true&order=id`, {
        headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(8000)
      });
      if (r.ok) { const rows = await r.json(); if (rows.length) return { source: 'database', rows }; }
    } catch (e) { console.warn("sitemap: database unavailable, using the bundled catalogue (" + e.message + ")"); }
  }
  return { source: 'catalogue', rows: SEED_PRODUCTS.map(p => ({ id: p.id })) };
}

const STATIC = ['/', '/about', '/contact', '/deals/aroma', '/deals/crazy', '/policies/shipping', '/policies/returns', '/policies/privacy', '/policies/terms'];
const shopPaths = Object.keys(COLLECTIONS).filter(k => !['aroma-deals', 'crazy-deals'].includes(k)).map(k => '/shop/' + k);

const { source, rows } = await products();
const urls = [
  ...STATIC.map(p => ({ loc: SITE + p, priority: p === '/' ? '1.0' : '0.6' })),
  ...shopPaths.map(p => ({ loc: SITE + p, priority: '0.8' })),
  ...rows.map(r => ({ loc: `${SITE}/product/${encodeURIComponent(r.id)}`, lastmod: r.updated_at ? r.updated_at.slice(0, 10) : null, priority: '0.7' }))
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
if (!existsSync('dist')) { console.error('dist/ not found — run vite build first'); process.exit(1); }
writeFileSync('dist/sitemap.xml', xml);
console.log(`sitemap.xml: ${urls.length} URLs (products from ${source})`);
