import { useEffect, useState } from 'react';
import { BRAND } from '../data/catalog.js';

/* Path routing (/shop/diffusers?type=hvac) so every page has a real, crawlable URL (GAP-013 / FR-SEO-003).
   The host rewrites unknown paths to index.html (see vercel.json). */

/* Old links used hash routes (/#/product/x) — move them to the real path once, at startup */
if (typeof location !== 'undefined' && location.hash.startsWith('#/')) {
  history.replaceState(null, '', location.hash.slice(1) || '/');
}

export function parseRoute() {
  const path = decodeURI(location.pathname).replace(/\/+$/, '') || '/';
  return { path, parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(location.search)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener('popstate', on);
    window.addEventListener('oz:nav', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('oz:nav', on); };
  }, []);
  return route;
}

const current = () => location.pathname + location.search;

/* Go to an internal URL ("/cart", "/product/x?size=500") */
export function navigate(to, { replace = false } = {}) {
  if (!to || to === current()) { window.dispatchEvent(new Event('oz:nav')); return; }
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new Event('oz:nav'));
}

/* Redirect without leaving a history entry (guards: login required, already signed in, …) */
export const redirectTo = to => navigate(to, { replace: true });

/* Update the URL (listing filters, selected size) without a new history entry */
export const replaceUrl = to => { if (to !== current()) { history.replaceState(null, '', to); window.dispatchEvent(new Event('oz:nav')); } };

/* Accept only internal paths like "/wishlist" for ?next= redirects (no protocol, no "//host") */
export const safeNext = n => (n && /^\/[a-z0-9/_-]*$/i.test(n) && !n.startsWith('//')) ? n : null;

/* Intercept clicks on internal links so navigation stays inside the app */
export function handleLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('//')) return;
  e.preventDefault();
  navigate(href);
}

/* Set the document title for the current page */
export function useTitle(title) {
  useEffect(() => { document.title = `${title} | ${BRAND.name}`; }, [title]);
}
