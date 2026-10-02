/* Ozone Perfume — router, shell and global interactions. */
(function () {
  const { esc, icon, $, $$ } = OZ.ui;
  const S = OZ.store, C = OZ.c, P = OZ.pages;
  const t = (k, v) => OZ.t(k, v);

  /* ---------- page lifecycle hooks ---------- */
  let leaveFns = [], pageSubs = [];
  OZ.onLeave = fn => leaveFns.push(fn);
  OZ.onStore = (events, fn) => pageSubs.push({ events, fn });
  function leave() { leaveFns.forEach(fn => { try { fn(); } catch (e) { } }); leaveFns = []; pageSubs = []; }

  /* Re-render while keeping keyboard focus on the "same" control */
  OZ.keepFocus = render => {
    const a = document.activeElement;
    const sel = a && a !== document.body ? (a.id ? '#' + CSS.escape(a.id) : a.dataset && a.dataset.action ? `[data-action="${a.dataset.action}"]${a.dataset.id ? `[data-id="${a.dataset.id}"]` : ''}` : a.dataset && a.dataset.qtyInput ? `[data-qty-input="${a.dataset.qtyInput}"][data-id="${a.dataset.id}"]` : null) : null;
    render();
    if (sel) { const el = $(sel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  };

  /* ---------- routing ---------- */
  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { parts, q, path };
  }

  function resolve({ parts, q }) {
    const [a, b, c] = parts;
    switch (a) {
      case undefined: return P.home();
      case 'shop': return P.listing('shop', b || 'diffusers', q);
      case 'deals': return ['aroma', 'crazy'].includes(b) ? P.listing('deals', b, q) : P.notFound();
      case 'search': return P.listing('search', null, q);
      case 'product': return P.product(b, q);
      case 'cart': return P.cart();
      case 'checkout': return P.checkout(b);
      case 'order': return P.order(b, q);
      case 'login': return P.login(q);
      case 'register': return P.register(q);
      case 'verify': return P.verify(q);
      case 'reset': return P.reset();
      case 'wishlist': return P.wishlist();
      case 'account': return P.account(b || 'profile', c);
      case 'admin': return P.admin(b || 'dashboard', c);
      case 'about': return P.about();
      case 'contact': return P.contact();
      case 'policies': return P.policy(b);
      default: return P.notFound();
    }
  }

  let lastPath = null, shellMode = null;
  function render(opts = {}) {
    const route = parse();
    let page;
    try { page = resolve(route); } catch (e) { console.error(e); page = P.notFound(); }
    if (page.redirect) { location.replace(location.href.split('#')[0] + page.redirect); return; }

    leave();
    OZ.ui.closeAllOverlays();
    closeLocale();

    const mode = page.admin ? 'admin' : page.bare ? 'bare' : 'full';
    if (mode !== shellMode || opts.shell) renderShell(mode);

    const main = $('#main');
    const samePath = lastPath === route.path;
    /* A fresh container per render so listeners a page adds to its root die with it */
    const root = document.createElement('div');
    root.className = 'page';
    root.innerHTML = page.html;
    main.classList.remove('page-in');
    main.replaceChildren(root);
    void main.offsetWidth;
    main.classList.add('page-in');
    document.title = `${page.title} | ${OZ.BRAND.name}`;
    document.body.dataset.route = route.parts[0] || 'home';

    if (!samePath && !opts.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
    if (page.mount) { try { page.mount(root); } catch (e) { console.error(e); } }
    C.initCarousels(root);
    reveal(root);
    C.setActiveNav(location.hash || '#/');
    C.updateBadges();

    if (lastPath !== null && !samePath && !opts.keepScroll) {
      const target = (page.focus && $(page.focus, main)) || $('h1', main) || main;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      OZ.ui.announce(page.title);
    }
    lastPath = route.path;
  }
  OZ.router = { render };

  function renderShell(mode) {
    shellMode = mode;
    const L = OZ.LANGS[S.session.lang];
    document.documentElement.lang = S.session.lang;
    document.documentElement.dir = L.dir;
    document.body.classList.toggle('mode-bare', mode !== 'full');
    $('#hdr').innerHTML = mode === 'full' ? C.header() : '';
    $('#ftr').innerHTML = mode === 'full' ? C.footer() : '';
    $('#skip').textContent = t('a11y.skip');
    C.updateBadges();
    watchHeader();
  }

  /* Sticky elements (filters, tabs, summaries) sit just below the live header height */
  let hdrObs;
  function watchHeader() {
    if (hdrObs) hdrObs.disconnect();
    const h = $('#site-header');
    const set = px => document.documentElement.style.setProperty('--hdr-h', Math.round(px) + 'px');
    if (!h) { set(0); return; }
    if (!('ResizeObserver' in window)) { set(h.offsetHeight); return; }
    hdrObs = new ResizeObserver(([en]) => set(en.target.offsetHeight));
    hdrObs.observe(h);
  }

  /* ---------- scroll reveal ---------- */
  let io;
  function reveal(root) {
    const els = $$('.reveal:not(.in)', root);
    if (OZ.ui.reducedMotion() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    if (!io) io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(e => io.observe(e));
  }
  OZ.reveal = reveal;

  /* ---------- store events ---------- */
  S.on(evt => {
    if (evt === 'lang' || evt === 'currency' || evt === 'sync' || evt === 'announcement') { render({ shell: true, keepScroll: true }); return; }
    if (evt === 'auth') { renderShell(shellMode); render({ keepScroll: true }); return; }
    C.updateBadges();
    if (evt === 'cart' || evt === 'coupon') C.refreshCartDrawer();
    if (evt === 'wishlist') syncWishButtons();
    pageSubs.slice().forEach(s => { if (s.events.includes(evt)) s.fn(evt); });
  });

  function syncWishButtons() {
    $$('.wish-btn').forEach(b => {
      const p = S.product(b.dataset.id); if (!p) return;
      const on = S.inWishlist(p.id);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', t(on ? 'wish.remove' : 'wish.add', { name: OZ.pname(p) }));
    });
  }

  /* ---------- locale popover ---------- */
  function closeLocale() {
    const pop = $('#locale-pop'); if (!pop || pop.hidden) return;
    pop.hidden = true; const b = $('[data-action="toggle-locale"]'); if (b) b.setAttribute('aria-expanded', 'false');
  }

  /* ---------- global delegated interactions ---------- */
  document.addEventListener('click', e => {
    /* In-page anchors (#main, #reviews…) must not be treated as routes */
    const anchor = e.target.closest('a[href^="#"]:not([href^="#/"])');
    if (anchor && !e.defaultPrevented) {
      e.preventDefault();
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (target) { target.scrollIntoView({ behavior: OZ.ui.reducedMotion() ? 'auto' : 'smooth', block: 'start' }); if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el) {
      if (!e.target.closest('.locale')) closeLocale();
      if (!e.target.closest('.has-mega')) $$('.nav-item.open').forEach(n => { n.classList.remove('open'); const b = n.querySelector('.nav-caret'); b && b.setAttribute('aria-expanded', 'false'); });
      return;
    }
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case 'add': {
        OZ.ui.busy(el, true, t('cart.adding'));
        const p = S.product(id);
        S.addToCart(id, null, 1).then(() => { OZ.ui.busy(el, false); C.openCart(true); OZ.ui.announce(t('cart.addedNamed', { name: OZ.pname(p) })); })
          .catch(err => { OZ.ui.busy(el, false); OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
        break;
      }
      case 'wish': {
        el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 450);
        S.toggleWishlist(id).then(added => {
          const name = OZ.pname(S.product(id));
          if (added && !S.user()) OZ.ui.toast(t('wish.addedGuest', { name }), 'info', { label: t('nav.login'), href: '#/login?next=%2Fwishlist&reason=wishlist' });
          else OZ.ui.toast(t(added ? 'wish.added' : 'wish.removed', { name }), added ? 'success' : 'info', added ? { label: t('wish.view'), href: '#/wishlist' } : null);
        }).catch(err => OZ.ui.toast(OZ.ui.errorText(err), 'error'));
        break;
      }
      case 'gift': { const p = S.product(id); if (p) OZ.gift.open({ productId: id, sizeId: p.sizes[0].id, qty: 1 }); break; }
      case 'line-gift': { const l = S.cart().find(x => x.id === id); if (l) OZ.gift.open({ productId: l.productId, sizeId: l.sizeId, lineId: l.id }); break; }
      case 'open-cart': C.openCart(); break;
      case 'open-search': OZ.ui.closeAllOverlays(); C.openSearch(); break;
      case 'open-menu': C.openMenu(); break;
      case 'close-ann': S.closeAnnouncement(); break;
      case 'toggle-locale': {
        e.stopPropagation();
        const pop = $('#locale-pop'); const open = pop.hidden;
        pop.hidden = !open; el.setAttribute('aria-expanded', open);
        if (open) { const f = pop.querySelector('.seg-btn.on, select'); f && f.focus(); }
        break;
      }
      case 'set-lang': S.setLang(el.dataset.lang); break;
      case 'to-top': window.scrollTo({ top: 0, behavior: OZ.ui.reducedMotion() ? 'auto' : 'smooth' }); ($('#main h1') || $('#main')).focus({ preventScroll: true }); break;
      case 'logout': S.logout(); OZ.ui.toast(t('auth.loggedOut'), 'info'); location.hash = '#/'; break;
      case 'reload': render({ keepScroll: true }); break;
      case 'toggle-pw': {
        const input = el.parentElement.querySelector('input'); const show = input.type === 'password';
        input.type = show ? 'text' : 'password'; el.setAttribute('aria-pressed', show);
        el.setAttribute('aria-label', t(show ? 'a11y.hidePassword' : 'a11y.showPassword')); el.innerHTML = icon(show ? 'eyeOff' : 'eye');
        break;
      }
      case 'toggle-mega': {
        const item = el.closest('.nav-item'); const open = !item.classList.contains('open');
        $$('.nav-item.open').forEach(n => { n.classList.remove('open'); n.querySelector('.nav-caret').setAttribute('aria-expanded', 'false'); });
        item.classList.toggle('open', open); el.setAttribute('aria-expanded', open);
        if (open) { const l = item.querySelector('.mega a'); l && l.focus(); }
        break;
      }
      case 'line-dec': case 'line-inc': {
        const l = S.cart().find(x => x.id === id); if (!l) break;
        const next = l.qty + (a === 'line-inc' ? 1 : -1);
        if (next < 1) { removeLine(id, el); break; }
        el.disabled = true;
        S.updateQty(id, next).then(() => OZ.ui.announce(t('cart.qtyUpdated', { n: next }))).catch(err => { el.disabled = false; OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
        break;
      }
      case 'remove-line': removeLine(id, el); break;
      case 'remove-coupon': S.removeCoupon(); OZ.ui.toast(t('coupon.removed'), 'info'); break;
    }
  });

  function removeLine(id, el) {
    const row = el.closest('.cline');
    if (row && !OZ.ui.reducedMotion()) row.classList.add('leaving');
    const l = S.cart().find(x => x.id === id);
    S.removeLine(id).then(() => {
      if (!l) return;
      const p = S.product(l.productId);
      OZ.ui.toast(t('cart.removed', { name: OZ.pname(p) }), 'info', { label: t('common.undo'), onClick: () => S.addToCart(l.productId, l.sizeId, l.qty, l.gift).catch(err => OZ.ui.toast(OZ.ui.errorText(err), 'error')) });
    }).catch(err => { row && row.classList.remove('leaving'); OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
  }

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('[data-action="set-currency"]')) S.setCurrency(el.value);
    if (el.matches('[data-qty-input="line"]')) {
      const v = parseInt(el.value, 10);
      if (isNaN(v) || v < 1) { const l = S.cart().find(x => x.id === el.dataset.id); el.value = l ? l.qty : 1; return; }
      S.updateQty(el.dataset.id, v).catch(err => { OZ.ui.toast(OZ.ui.errorText(err), 'error'); const l = S.cart().find(x => x.id === el.dataset.id); if (l) el.value = l.qty; });
    }
  });

  /* Never let a form fall back to a native GET submit (it would put field values in the URL) */
  document.addEventListener('submit', e => e.preventDefault(), true);

  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form="newsletter"]'); if (!f) return;
    const input = f.elements.email, msg = f.querySelector('.f-news-msg');
    if (OZ.ui.V.email(input.value)) { msg.textContent = t('val.email'); msg.className = 'f-news-msg err'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    const btn = f.querySelector('button'); OZ.ui.busy(btn, true);
    OZ.api(() => true, 700).then(() => { OZ.ui.busy(btn, false); input.value = ''; input.removeAttribute('aria-invalid'); msg.className = 'f-news-msg ok'; msg.textContent = t('footer.subscribed'); })
      .catch(err => { OZ.ui.busy(btn, false); msg.className = 'f-news-msg err'; msg.textContent = OZ.ui.errorText(err); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLocale();
      const open = $('.nav-item.open'); if (open) { open.classList.remove('open'); const b = open.querySelector('.nav-caret'); b.setAttribute('aria-expanded', 'false'); b.focus(); }
    }
    if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]') && !document.querySelector('.ov.in')) { e.preventDefault(); C.openSearch(); }
  });

  /* ---------- header behaviour ---------- */
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      document.body.classList.toggle('scrolled', y > 60);
      const top = $('.to-top'); if (top) top.classList.toggle('show', y > 700);
      ticking = false;
    });
  }, { passive: true });

  window.addEventListener('offline', () => OZ.ui.toast(t('err.offline'), 'error'));
  window.addEventListener('online', () => OZ.ui.toast(t('err.online'), 'success'));
  window.addEventListener('hashchange', () => render());

  /* ---------- boot ---------- */
  render({ shell: true });
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
})();
