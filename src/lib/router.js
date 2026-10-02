import { useEffect, useState } from 'react';
import { BRAND } from '../data/catalog.js';

/* Hash routing (#/path?query) so the built site works on any static host without rewrites */
export function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    window.addEventListener('oz:replace', on);
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('oz:replace', on); };
  }, []);
  return route;
}

export const navigate = hash => { location.hash = hash; };

/* Update the URL (e.g. listing filters) without adding history entries or remounting the page */
export const replaceHash = hash => { history.replaceState(null, '', hash); window.dispatchEvent(new Event('oz:replace')); };

/* Accept only internal paths like "/wishlist" for ?next= redirects */
export const safeNext = n => (n && /^\/[a-z0-9/_-]*$/i.test(n) && !n.startsWith('//')) ? '#' + n : null;

/* Set the document title for the current page */
export function useTitle(title) {
  useEffect(() => { document.title = `${title} | ${BRAND.name}`; }, [title]);
}
