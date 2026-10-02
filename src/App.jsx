import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Panels from './components/Panels.jsx';
import Icon from './components/Icon.jsx';
import { UIProvider, useUI, Spinner } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Listing from './pages/Listing.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Order from './pages/Order.jsx';
import { Login, Register, Verify, Reset } from './pages/Auth.jsx';
import Account, { WishlistPage } from './pages/Account.jsx';
import { About, Contact, Policy } from './pages/Info.jsx';
/* The admin panel is only needed by staff, so it loads on demand */
const Admin = lazy(() => import('./pages/Admin.jsx'));
import NotFound from './pages/NotFound.jsx';
import { useStore } from './lib/useStore.js';
import { useHashRoute } from './lib/router.js';
import { S } from './lib/store.js';
import { t } from './lib/i18n.js';
import { reducedMotion } from './lib/format.js';
import { LANGS } from './data/catalog.js';

/* Map the hash route to a page element and a shell mode */
function resolve({ parts, q }) {
  const [a, b, c] = parts;
  switch (a) {
    case undefined: return [<Home />];
    case 'shop': return [<Listing kind="shop" collKey={b || 'diffusers'} q={q} />];
    case 'deals': return [<Listing kind="deals" collKey={b} q={q} />];
    case 'search': return [<Listing kind="search" q={q} />];
    case 'product': return [<Product id={b} q={q} />];
    case 'cart': return [<Cart />];
    case 'checkout': return [<Checkout step={b} />, 'bare'];
    case 'order': return [<Order id={b} q={q} />];
    case 'login': return [<Login q={q} />];
    case 'register': return [<Register q={q} />];
    case 'verify': return [<Verify q={q} />];
    case 'reset': return [<Reset />];
    case 'wishlist': return [<WishlistPage />];
    case 'account': return [<Account section={b || 'profile'} sub={c} />];
    case 'admin': return [<Admin section={b || 'dashboard'} sub={c} />, 'admin'];
    case 'about': return [<About />];
    case 'contact': return [<Contact />];
    case 'policies': return [<Policy k={b} />];
    default: return [<NotFound />];
  }
}

/* Fade/slide in .reveal elements as they scroll into view (including ones rendered later) */
function useReveal(root) {
  useEffect(() => {
    const el = root.current; if (!el) return;
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      const all = () => el.querySelectorAll('.reveal:not(.in)').forEach(n => n.classList.add('in'));
      all(); const mo = new MutationObserver(all); mo.observe(el, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    const scan = () => el.querySelectorAll('.reveal:not(.in):not([data-rv])').forEach(n => { n.dataset.rv = '1'; io.observe(n); });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [root]);
}

function Shell() {
  useStore();
  const ui = useUI();
  const route = useHashRoute();
  const [page, mode = 'full'] = resolve(route);
  const mainRef = useRef(null);
  const lastPath = useRef(null);
  const lang = S.session.lang;
  useReveal(mainRef);

  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGS[lang].dir;
  }, [lang]);
  useEffect(() => {
    document.body.classList.toggle('mode-bare', mode !== 'full');
    document.body.dataset.route = route.parts[0] || 'home';
  }, [mode, route.parts]);

  /* new page: close panels, scroll to top, move focus to the heading for screen readers */
  useEffect(() => {
    const prev = lastPath.current;
    lastPath.current = route.path;
    if (prev === null || prev === route.path) return;
    ui.closePanel();
    window.scrollTo({ top: 0, behavior: 'auto' });
    const h = setTimeout(() => {
      const main = mainRef.current; if (!main) return;
      const target = main.querySelector('h1') || main;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      ui.announce(document.title);
    }, 60);
    return () => clearTimeout(h);
  }, [route.path]); // eslint-disable-line react-hooks/exhaustive-deps

  /* sticky elements sit below the live header height */
  useEffect(() => {
    const h = document.getElementById('site-header');
    const set = px => document.documentElement.style.setProperty('--hdr-h', Math.round(px) + 'px');
    if (!h) { set(0); return; }
    const ro = new ResizeObserver(([en]) => set(en.target.offsetHeight));
    ro.observe(h);
    return () => ro.disconnect();
  }, [mode]);

  /* global behaviour: scroll state, "/" opens search, offline notice, in-page anchors */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        document.body.classList.toggle('scrolled', y > 60);
        const top = document.querySelector('.to-top'); if (top) top.classList.toggle('show', y > 700);
        ticking = false;
      });
    };
    const onKey = e => { if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]') && !document.querySelector('.ov.in')) { e.preventDefault(); ui.openSearch(); } };
    const offline = () => ui.toast(t('err.offline'), 'error');
    const online = () => ui.toast(t('err.online'), 'success');
    const onClick = e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]:not([href^="#/"])');
      if (!a || e.defaultPrevented || a.getAttribute('href') === '#') return;
      e.preventDefault();
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) { target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [ui]);

  const hash = location.hash || '#/';
  return (<>
    <a id="skip" className="skip-link" href="#main">{t('a11y.skip')}</a>
    {mode === 'full' && <Header hash={hash} />}
    <main id="main" tabIndex={-1} ref={mainRef}>
      <div className="page page-in" key={route.path}><Suspense fallback={<div className="page-loading"><Spinner big /></div>}>{page}</Suspense></div>
    </main>
    {mode === 'full' && <Footer />}
    {mode === 'full' && <button className="to-top" onClick={() => { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); (document.querySelector('#main h1') || document.getElementById('main')).focus({ preventScroll: true }); }} aria-label={t('a11y.toTop')}><Icon name="arrowUp" /></button>}
    <Panels />
  </>);
}

export default function App() {
  return <UIProvider><Shell /></UIProvider>;
}
