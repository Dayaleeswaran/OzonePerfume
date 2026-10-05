/* Per-page SEO: canonical URL, robots, description, Open Graph and JSON-LD (FR-SEO-001..010, SEO-007..012).

   Locale strategy (FR-SEO-009 / SEO-013): one URL per page. English is the indexed default; Spanish and
   Arabic are a visitor preference stored in the browser, so language never creates duplicate URLs. */
import { useEffect } from 'react';
import { BRAND } from '../data/catalog.js';

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.ozonescents.com').replace(/\/+$/, '');

/* Routes that must never be indexed: private, transactional or helper pages */
const PRIVATE = ['account', 'admin', 'cart', 'checkout', 'login', 'register', 'verify', 'reset', 'order', 'wishlist', 'search'];
export const isPrivatePath = path => PRIVATE.includes(path.split('/').filter(Boolean)[0]);

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (content == null) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
}
function setJsonLd(data) {
  let el = document.getElementById('page-jsonld');
  if (!data) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'page-jsonld'; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
}

const absolute = src => !src ? null : /^https?:/.test(src) ? src : SITE_URL + (src.startsWith('/') ? src : '/' + src);

/* Called once per page render. `path` is the route path without query (canonical form). */
export function applySeo({ path, title, description, image, noindex, jsonLd, notFound }) {
  const robots = noindex || notFound || isPrivatePath(path) ? 'noindex, nofollow' : 'index, follow';
  setMeta('name', 'robots', robots);
  setLink('canonical', robots.startsWith('noindex') ? null : SITE_URL + (path === '/' ? '/' : path));
  if (description) setMeta('name', 'description', description.slice(0, 300));
  setMeta('property', 'og:type', jsonLd && jsonLd['@type'] === 'Product' ? 'product' : 'website');
  setMeta('property', 'og:site_name', BRAND.name);
  setMeta('property', 'og:title', title ? `${title} | ${BRAND.name}` : BRAND.name);
  setMeta('property', 'og:description', description ? description.slice(0, 300) : null);
  setMeta('property', 'og:url', SITE_URL + path);
  setMeta('property', 'og:image', absolute(image));
  setJsonLd(robots.startsWith('noindex') ? null : jsonLd || null);
}

export function useSeo(opts, deps) {
  useEffect(() => { applySeo(opts); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/* Structured data builders (only facts we hold in the database; no invented claims — SEO-011) */
export function organizationLd() {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, legalName: BRAND.legalName, url: SITE_URL,
    email: BRAND.email, telephone: BRAND.phone,
    address: { '@type': 'PostalAddress', addressLocality: 'Sharjah', addressRegion: 'Sharjah Media City', addressCountry: 'AE' }
  };
}

export function productLd(p, { name, description, image, price, rating, inStock }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name, sku: p.sku, description, image: [absolute(image)].filter(Boolean),
    brand: { '@type': 'Brand', name: BRAND.name },
    offers: {
      '@type': 'Offer', url: `${SITE_URL}/product/${p.id}`, priceCurrency: 'AED', price: Number(price).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition'
    }
  };
  if (rating && rating.count > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating.avg, reviewCount: rating.count };
  return ld;
}
