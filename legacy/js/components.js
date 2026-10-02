/* Ozone Perfume — shared components: header, footer, product card, carousel, search, cart drawer. */
(function () {
  const { esc, icon, money, $, $$ } = OZ.ui;
  const S = OZ.store;
  const t = (k, v) => OZ.t(k, v);
  const C = OZ.c = {};

  OZ.pname = p => (p.name && (p.name[S.session.lang] || p.name.en)) || '';
  OZ.ptext = (p, f) => (p[f] && (p[f][S.session.lang] || p[f].en)) || '';
  OZ.noteLabel = n => { const k = 'note.' + n, v = t(k); return v === k ? n : v; };

  /* ---------- search ---------- */
  OZ.search = function (q) {
    const terms = String(q || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const L = ['en', 'es', 'ar'];
    return S.products().map(p => {
      const fields = [
        [L.map(l => p.name[l]).join(' '), 6],
        [[p.type, t('type.' + p.type), OZ.I18N.en['type.' + p.type]].join(' '), 4],
        [[p.family || '', p.family ? t('family.' + p.family) : '', p.line || '', p.line === 'hotel' ? t('badge.hotel') : ''].concat(p.spaces.map(s => t('space.' + s))).join(' '), 3],
        [[].concat(p.notes.top, p.notes.heart, p.notes.base).map(n => OZ.noteLabel(n) + ' ' + (OZ.I18N.en['note.' + n] || n)).join(' '), 3],
        [L.map(l => (p.tagline[l] || '') + ' ' + (p.desc[l] || '')).join(' ') + ' ' + p.sku + ' ' + p.features.map(f => t('feat.' + f)).join(' '), 1]
      ].map(([txt, w]) => [txt.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''), w]);
      let score = 0;
      for (const term of terms) {
        const hit = fields.reduce((a, [txt, w]) => a + (txt.includes(term) ? w : 0), 0);
        if (!hit) return null;
        score += hit;
      }
      return { p, score: score + (p.bestSeller ? 0.5 : 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.p);
  };

  /* ---------- logo ---------- */
  C.logo = (small) => `<a class="logo${small ? ' logo-sm' : ''}" href="#/" aria-label="${esc(OZ.BRAND.name)} — ${esc(t('nav.home'))}">
      <span class="logo-word">OZONE</span><span class="logo-sub">SCENTS</span>${small ? '' : `<span class="logo-tag">${esc(t('brand.tagline'))}</span>`}
    </a>`;

  /* ---------- announcement ---------- */
  C.announcement = () => {
    if (S.session.announcementClosed || !S.settings().announcement) return '';
    const items = [
      ['truck', t('ann.freeShip', { amount: money(S.settings().freeShippingThreshold) })],
      ['box', t('ann.delivery')],
      S.collection('crazy-deals').length ? ['flame', t('ann.deals')] : null,
      ['gift', t('ann.gift')]
    ].filter(Boolean);
    const row = items.map(([i, s]) => `<span class="ann-item">${icon(i)}${esc(s)}</span><span class="ann-sep" aria-hidden="true">${icon('leaf')}</span>`).join('');
    return `<div class="announce" role="region" aria-label="${esc(t('a11y.announcements'))}">
      <div class="ann-track"><div class="ann-row">${row}</div><div class="ann-row" aria-hidden="true">${row}</div></div>
      <button class="ann-close icon-btn" data-action="close-ann" aria-label="${esc(t('a11y.closeAnnouncement'))}">${icon('close')}</button>
    </div>`;
  };

  /* ---------- header ---------- */
  const NAV = () => [
    { key: 'home', href: '#/' },
    { key: 'diffusers', href: '#/shop/diffusers', mega: 'diffusers' },
    { key: 'aromaDeals', href: '#/deals/aroma', accent: true },
    { key: 'crazyDeals', href: '#/deals/crazy', spark: true },
    { key: 'homeCare', href: '#/shop/home-care', mega: 'home' },
    { key: 'about', href: '#/about' },
    { key: 'contact', href: '#/contact' }
  ];

  function mega(kind) {
    if (kind === 'diffusers') {
      const types = OZ.DIFFUSER_TYPES.map(ty => `<li><a href="#/shop/diffusers?type=${ty}">${esc(t('type.' + ty + '.plural'))}</a></li>`).join('');
      const feat = ['tower-pro-diffuser', 'box-diffuser'].map(S.product).filter(Boolean).map(p => `<a class="mega-card" href="#/product/${p.id}">${OZ.ui.img(p.img, OZ.pname(p))}<span>${esc(OZ.pname(p))}</span><strong>${money(p.price)}</strong></a>`).join('');
      return `<div class="mega"><div class="mega-col"><p class="mega-h">${esc(t('mega.byType'))}</p><ul>${types}<li><a class="mega-all" href="#/shop/diffusers">${esc(t('common.viewAll'))} ${icon('arrowRight', 'flip')}</a></li></ul></div>
        <div class="mega-col"><p class="mega-h">${esc(t('mega.bySpace'))}</p><ul>${OZ.SPACES.map(s => `<li><a href="#/shop/diffusers?space=${s}">${esc(t('space.' + s))}</a></li>`).join('')}</ul></div>
        <div class="mega-feat"><p class="mega-h">${esc(t('mega.featured'))}</p><div class="mega-cards">${feat}</div></div></div>`;
    }
    const fam = OZ.FAMILIES.map(f => `<li><a href="#/shop/oils?family=${f}">${esc(t('family.' + f))}</a></li>`).join('');
    return `<div class="mega mega-sm"><div class="mega-col"><p class="mega-h">${esc(t('mega.forHome'))}</p><ul>
        <li><a href="#/shop/home-care?type=tower">${esc(t('mega.livingRooms'))}</a></li>
        <li><a href="#/shop/home-care?type=wall">${esc(t('mega.bedrooms'))}</a></li>
        <li><a href="#/shop/home-care?type=portable">${esc(t('mega.desks'))}</a></li>
        <li><a class="mega-all" href="#/shop/home-care">${esc(t('common.viewAll'))} ${icon('arrowRight', 'flip')}</a></li></ul></div>
      <div class="mega-col"><p class="mega-h">${esc(t('mega.byScent'))}</p><ul>${fam}</ul></div></div>`;
  }

  C.header = () => {
    const u = S.user();
    const L = OZ.LANGS[S.session.lang];
    return `${C.announcement()}
    <header class="site-header" id="site-header">
      <div class="hdr-main container">
        <div class="hdr-start">
          <button class="icon-btn only-mobile" data-action="open-menu" aria-label="${esc(t('a11y.openMenu'))}" aria-haspopup="dialog">${icon('menu')}</button>
          <button class="search-pill" data-action="open-search" aria-haspopup="dialog">${icon('search')}<span>${esc(t('search.placeholder'))}</span><kbd aria-hidden="true">/</kbd></button>
          <button class="icon-btn only-mobile" data-action="open-search" aria-label="${esc(t('search.open'))}">${icon('search')}</button>
        </div>
        ${C.logo()}
        <div class="hdr-end">
          <div class="locale">
            <button class="locale-btn" data-action="toggle-locale" aria-expanded="false" aria-controls="locale-pop" aria-label="${esc(t('a11y.localeBtn', { lang: L.label, cur: S.session.currency }))}">
              ${icon('globe')}<span>${esc(L.short)} · ${esc(S.session.currency)}</span>${icon('chevDown', 'chev')}
            </button>
            <div class="locale-pop" id="locale-pop" hidden>${C.localeControls('pop')}</div>
          </div>
          <div class="hdr-icons">
            <a class="icon-btn" href="${u ? (u.role === 'admin' ? '#/admin' : '#/account') : '#/login'}" aria-label="${esc(u ? t('nav.account') : t('nav.login'))}">${icon('user')}${u ? '<span class="dot" aria-hidden="true"></span>' : ''}</a>
            <a class="icon-btn" href="#/wishlist" aria-label="${esc(t('nav.wishlist'))}">${icon('heart')}<span class="badge-count" data-badge="wish"></span></a>
            <button class="icon-btn" data-action="open-cart" aria-label="${esc(t('nav.cart'))}" aria-haspopup="dialog">${icon('bag')}<span class="badge-count" data-badge="cart"></span></button>
          </div>
        </div>
      </div>
      <nav class="main-nav" aria-label="${esc(t('a11y.mainNav'))}">
        <ul class="nav-list container">
          ${NAV().map(n => `<li class="nav-item${n.mega ? ' has-mega' : ''}">
              <a class="nav-link${n.accent ? ' accent' : ''}" href="${n.href}" data-nav="${n.href}">${esc(t('nav.' + n.key))}${n.spark ? icon('flame', 'spark') : ''}</a>
              ${n.mega ? `<button class="nav-caret" aria-expanded="false" aria-label="${esc(t('a11y.submenu', { name: t('nav.' + n.key) }))}" data-action="toggle-mega">${icon('chevDown')}</button><div class="mega-wrap">${mega(n.mega)}</div>` : ''}
            </li>`).join('')}
        </ul>
      </nav>
    </header>`;
  };

  C.localeControls = (ctx) => `
    <div class="locale-grp"><p class="locale-h" id="lang-h-${ctx}">${esc(t('locale.language'))}</p>
      <div class="seg" role="radiogroup" aria-labelledby="lang-h-${ctx}">
        ${Object.entries(OZ.LANGS).map(([k, l]) => `<button type="button" role="radio" aria-checked="${k === S.session.lang}" class="seg-btn${k === S.session.lang ? ' on' : ''}" data-action="set-lang" data-lang="${k}" lang="${k}">${esc(l.label)}</button>`).join('')}
      </div></div>
    <div class="locale-grp"><label class="locale-h" for="cur-${ctx}">${esc(t('locale.currency'))}</label>
      <select id="cur-${ctx}" data-action="set-currency">${Object.keys(OZ.CURRENCIES).map(c => `<option value="${c}"${c === S.session.currency ? ' selected' : ''}>${c} — ${esc(t('cur.' + c))}</option>`).join('')}</select>
      <p class="hint">${esc(t('locale.note'))}</p></div>`;

  C.updateBadges = () => {
    const set = (k, n) => $$(`[data-badge="${k}"]`).forEach(b => {
      const old = b.textContent;
      b.textContent = n ? String(n) : '';
      b.classList.toggle('show', !!n);
      if (old !== b.textContent && n) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    });
    set('cart', S.cartCount());
    set('wish', S.wishlist().length);
    const cartBtn = $('[data-action="open-cart"].icon-btn');
    if (cartBtn) cartBtn.setAttribute('aria-label', t('a11y.cartCount', { n: S.cartCount() }));
    const wishBtn = $('a[href="#/wishlist"].icon-btn');
    if (wishBtn) wishBtn.setAttribute('aria-label', t('a11y.wishCount', { n: S.wishlist().length }));
  };

  C.setActiveNav = (hash) => {
    $$('.nav-link, .mnav a').forEach(a => {
      const h = a.getAttribute('href') || a.dataset.nav;
      const on = h === '#/' ? (hash === '#/' || hash === '') : hash.split('?')[0].startsWith(h);
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };

  /* ---------- mobile menu ---------- */
  C.openMenu = () => {
    const u = S.user();
    const sub = (items) => `<ul>${items.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul>`;
    OZ.ui.overlay({
      kind: 'drawer-start', title: C.logo(true), className: 'mnav-ov',
      body: `<nav class="mnav" aria-label="${esc(t('a11y.mainNav'))}">
        <a href="#/">${esc(t('nav.home'))}</a>
        <details><summary>${esc(t('nav.diffusers'))}${icon('chevDown')}</summary>${sub([['#/shop/diffusers', t('common.viewAll')]].concat(OZ.DIFFUSER_TYPES.map(ty => ['#/shop/diffusers?type=' + ty, t('type.' + ty + '.plural')])))}</details>
        <a href="#/deals/aroma" class="accent">${esc(t('nav.aromaDeals'))}</a>
        <a href="#/deals/crazy">${esc(t('nav.crazyDeals'))} ${icon('flame', 'spark')}</a>
        <details><summary>${esc(t('nav.homeCare'))}${icon('chevDown')}</summary>${sub([['#/shop/home-care', t('common.viewAll')], ['#/shop/home-care?type=tower', t('mega.livingRooms')], ['#/shop/home-care?type=wall', t('mega.bedrooms')], ['#/shop/home-care?type=portable', t('mega.desks')]])}</details>
        <a href="#/shop/gifts">${esc(t('nav.gifts'))}</a>
        <a href="#/about">${esc(t('nav.about'))}</a>
        <a href="#/contact">${esc(t('nav.contact'))}</a>
      </nav>
      <div class="mnav-acc">
        ${u ? `<a class="btn btn-outline btn-block" href="${u.role === 'admin' ? '#/admin' : '#/account'}">${icon('user')} ${esc(t('nav.account'))}</a>`
            : `<a class="btn btn-primary btn-block" href="#/login">${esc(t('nav.login'))}</a><a class="btn btn-outline btn-block" href="#/register">${esc(t('auth.createAccount'))}</a>`}
        <div class="mnav-links"><a href="#/wishlist">${icon('heart')} ${esc(t('nav.wishlist'))}</a><a href="#/account/orders">${icon('box')} ${esc(t('account.orders'))}</a><a href="#/account/dates">${icon('calendar')} ${esc(t('account.dates'))}</a></div>
      </div>
      <div class="mnav-locale">${C.localeControls('m')}</div>`,
      onMount: ov => ov.el.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]')) ov.close(); })
    });
  };

  /* ---------- search overlay ---------- */
  C.openSearch = (initial = '') => {
    const popular = ['tower', 'oil', 'citrus', 'hotel', 'gift', 'app'];
    const ov = OZ.ui.overlay({
      kind: 'search', title: null, labelledBy: 'search-label', className: 'search-ov',
      body: `<div class="container search-box">
        <form class="search-form" role="search" data-search-form>
          <label id="search-label" for="search-input" class="sr-only">${esc(t('search.label'))}</label>
          ${icon('search')}
          <input id="search-input" type="search" name="q" autocomplete="off" placeholder="${esc(t('search.placeholder'))}" value="${esc(initial)}" autofocus aria-controls="search-results" aria-describedby="search-status">
          <button type="button" class="icon-btn" data-ov-close aria-label="${esc(t('a11y.closeSearch'))}">${icon('close')}</button>
        </form>
        <p id="search-status" class="search-status" role="status" aria-live="polite"></p>
        <div id="search-results" class="search-results"></div>
      </div>`,
      onMount(o) {
        const input = o.body.querySelector('input'), out = o.body.querySelector('#search-results'), status = o.body.querySelector('#search-status');
        const idle = () => {
          const recent = S.session.recent.map(S.product).filter(Boolean).slice(0, 4);
          out.innerHTML = `<div class="search-idle"><p class="eyebrow">${esc(t('search.popular'))}</p><div class="chips">${popular.map(k => `<button class="chip" data-q="${esc(t('search.term.' + k))}">${esc(t('search.term.' + k))}</button>`).join('')}</div>
            ${recent.length ? `<p class="eyebrow">${esc(t('search.recent'))}</p><div class="search-grid">${recent.map(C.miniCard).join('')}</div>` : ''}</div>`;
          status.textContent = '';
        };
        let seq = 0;
        const run = OZ.ui.debounce(q => {
          const my = ++seq;
          if (!q.trim()) return idle();
          out.innerHTML = `<div class="search-loading" aria-hidden="true">${'<div class="sk sk-row"></div>'.repeat(3)}</div>`;
          status.textContent = t('search.searching');
          OZ.api(() => OZ.search(q), 280).then(res => {
            if (my !== seq) return;
            status.textContent = t('search.count', { n: res.length, q });
            out.innerHTML = res.length
              ? `<div class="search-grid">${res.slice(0, 6).map(C.miniCard).join('')}</div><a class="btn btn-primary" href="#/search?q=${encodeURIComponent(q)}">${esc(t('search.viewAll', { n: res.length }))} ${icon('arrowRight', 'flip')}</a>`
              : `<div class="empty compact">${icon('search', 'empty-ic')}<h3>${esc(t('search.noResults', { q }))}</h3><p>${esc(t('search.noResultsHint'))}</p><div class="chips">${popular.slice(0, 4).map(k => `<button class="chip" data-q="${esc(t('search.term.' + k))}">${esc(t('search.term.' + k))}</button>`).join('')}</div></div>`;
          }).catch(err => { if (my === seq) { out.innerHTML = `<div class="alert alert-error">${icon('alert')}<span>${esc(OZ.ui.errorText(err))}</span></div>`; status.textContent = OZ.ui.errorText(err); } });
        }, 220);
        input.addEventListener('input', () => run(input.value));
        o.body.querySelector('form').addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) { location.hash = '#/search?q=' + encodeURIComponent(input.value.trim()); o.close(); } });
        o.body.addEventListener('click', e => {
          const chip = e.target.closest('[data-q]'); if (chip) { input.value = chip.dataset.q; run(input.value); input.focus(); }
          if (e.target.closest('a[href^="#/"]')) o.close();
        });
        initial ? run(initial) : idle();
      }
    });
    return ov;
  };

  C.miniCard = p => `<a class="mini-card" href="#/product/${p.id}">${OZ.ui.img(p.img, '')}<span class="mini-body"><span class="mini-type">${esc(t('type.' + p.type))}</span><span class="mini-name">${esc(OZ.pname(p))}</span><span class="mini-price">${money(p.price)}${p.compareAt > p.price ? ` <s>${money(p.compareAt)}</s>` : ''}</span></span></a>`;

  /* ---------- product card ---------- */
  C.stockLabel = p => {
    const st = S.stockState(p);
    return `<span class="stock stock-${st}">${esc(st === 'out' ? t('stock.out') : st === 'low' ? t('stock.low', { n: p.stock }) : t('stock.in'))}</span>`;
  };
  C.badges = p => {
    const b = [];
    if (p.stock <= 0) b.push(`<span class="badge badge-muted">${esc(t('stock.out'))}</span>`);
    else if (p.bestSeller) b.push(`<span class="badge badge-best">${esc(t('badge.best'))}</span>`);
    else if (p.isNew) b.push(`<span class="badge badge-new">${esc(t('badge.new'))}</span>`);
    if (p.line === 'hotel') b.push(`<span class="badge badge-aroma">${esc(t('badge.hotel'))}</span>`);
    if (p.aromaDeal) b.push(`<span class="badge badge-aroma">${esc(t('badge.aroma'))}</span>`);
    return b.join('');
  };
  C.wishBtn = (p, cls = '') => {
    const on = S.inWishlist(p.id);
    return `<button class="wish-btn ${cls}${on ? ' on' : ''}" data-action="wish" data-id="${p.id}" aria-pressed="${on}" aria-label="${esc(t(on ? 'wish.remove' : 'wish.add', { name: OZ.pname(p) }))}">${icon('heart')}</button>`;
  };
  C.card = (p, opts = {}) => {
    const r = S.rating(p);
    const off = OZ.discountPct(p);
    const name = OZ.pname(p);
    const out = p.stock <= 0;
    return `<article class="pcard${out ? ' is-out' : ''}" data-pid="${p.id}">
      <div class="pcard-media">
        <a href="#/product/${p.id}" class="pcard-img" tabindex="-1" aria-hidden="true">${OZ.ui.img(p.img, name)}</a>
        <div class="pcard-badges">${C.badges(p)}</div>
        ${C.wishBtn(p, 'pcard-wish')}
        ${opts.gift && p.giftable && !out ? `<button class="pcard-gift" data-action="gift" data-id="${p.id}">${icon('gift')}<span>${esc(t('gift.send'))}</span></button>` : ''}
      </div>
      <div class="pcard-body">
        <p class="pcard-type">${esc(t('type.' + p.type))} · ${p.sizes.map(s => s.ml.toLocaleString('en')).join(' / ')} ml</p>
        <h3 class="pcard-name"><a href="#/product/${p.id}">${esc(name)}</a></h3>
        ${r.count ? `<div class="pcard-rating">${OZ.ui.stars(r.avg)}<span>${r.avg.toFixed(1)} <span class="muted">(${esc(t('reviews.countShort', { n: r.count }))})</span></span></div>` : ''}
        <div class="pcard-price">
          ${p.compareAt > p.price ? `<s aria-label="${esc(t('price.was'))}">${money(p.compareAt)}</s>` : ''}
          <strong>${p.sizes.length > 1 ? `<span class="from">${esc(t('price.from'))}</span> ` : ''}${money(p.price)}</strong>
        </div>
        <p class="pcard-meta">${off ? `<span class="off">${esc(t('price.off', { n: off }))}</span>` : ''}${opts.showSave && off ? `<span class="save">${esc(t('price.save', { amount: money(p.compareAt - p.price) }))}</span>` : ''}${C.stockLabel(p)}</p>
        <button class="btn btn-outline btn-block pcard-add" data-action="add" data-id="${p.id}" ${out ? 'disabled aria-disabled="true"' : ''}>${esc(out ? t('stock.out') : t('cart.add'))}</button>
      </div>
    </article>`;
  };

  C.skeletonCards = (n = 4) => Array.from({ length: n }, () => `<div class="pcard sk-card" aria-hidden="true"><div class="sk sk-img"></div><div class="pcard-body"><div class="sk sk-line w40"></div><div class="sk sk-line w80"></div><div class="sk sk-line w60"></div><div class="sk sk-btn"></div></div></div>`).join('');

  C.carousel = (id, cardsHtml, label) => `<div class="carousel" data-carousel id="${id}">
      <button class="car-btn prev" data-car="-1" aria-label="${esc(t('a11y.prev'))}" aria-controls="${id}-track">${icon('chevLeft', 'flip')}</button>
      <div class="car-track" id="${id}-track" tabindex="0" role="region" aria-label="${esc(label)}">${cardsHtml}</div>
      <button class="car-btn next" data-car="1" aria-label="${esc(t('a11y.next'))}" aria-controls="${id}-track">${icon('chevRight', 'flip')}</button>
    </div>`;

  C.initCarousels = (root = document) => {
    $$('[data-carousel]', root).forEach(c => {
      const track = c.querySelector('.car-track');
      const prev = c.querySelector('.prev'), next = c.querySelector('.next');
      const update = () => {
        const max = track.scrollWidth - track.clientWidth - 2;
        const x = Math.abs(track.scrollLeft);
        prev.disabled = x <= 2; next.disabled = x >= max;
        c.classList.toggle('no-scroll', max <= 0);
      };
      c.querySelectorAll('[data-car]').forEach(b => b.addEventListener('click', () => {
        const card = track.firstElementChild; const step = card ? card.getBoundingClientRect().width + 24 : 300;
        const rtl = document.documentElement.dir === 'rtl';
        track.scrollBy({ left: +b.dataset.car * step * Math.max(1, Math.floor(track.clientWidth / step)) * (rtl ? -1 : 1), behavior: OZ.ui.reducedMotion() ? 'auto' : 'smooth' });
      }));
      track.addEventListener('scroll', OZ.ui.debounce(update, 60), { passive: true });
      window.addEventListener('resize', OZ.ui.debounce(update, 150));
      update();
    });
  };

  C.sectionHead = (title, opts = {}) => `<div class="sec-head reveal${opts.center === false ? ' left' : ''}">
      ${opts.eyebrow ? `<p class="eyebrow">${esc(opts.eyebrow)}</p>` : ''}
      <h2 class="sec-title">${esc(title)}${opts.icon ? icon(opts.icon, 'sec-ic') : ''}</h2>
      ${opts.sub ? `<p class="sec-sub">${esc(opts.sub)}</p>` : ''}
      ${opts.link ? `<a class="link-arrow" href="${opts.link}">${esc(opts.linkLabel || t('common.viewAll'))} ${icon('arrowRight', 'flip')}</a>` : ''}
    </div>`;

  C.empty = ({ ic = 'box', title, text, actions = '' }) => `<div class="empty">${icon(ic, 'empty-ic')}<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}<div class="btn-row center">${actions}</div></div>`;

  C.breadcrumb = items => `<nav class="crumbs container" aria-label="${esc(t('a11y.breadcrumb'))}"><ol>${items.map((it, i) => i === items.length - 1 ? `<li aria-current="page">${esc(it[1])}</li>` : `<li><a href="${it[0]}">${esc(it[1])}</a></li>`).join('')}</ol></nav>`;

  C.qty = (value, { max = 99, id, label, action = 'qty' }) => `<div class="qty" role="group" aria-label="${esc(label || t('cart.quantity'))}">
      <button type="button" class="qty-btn" data-action="${action}-dec" ${id ? `data-id="${id}"` : ''} aria-label="${esc(t('a11y.decrease'))}" ${value <= 1 && action === 'pdp' ? 'disabled' : ''}>${icon('minus')}</button>
      <input type="number" inputmode="numeric" min="1" max="${max}" value="${value}" aria-label="${esc(t('cart.quantity'))}" data-qty-input="${action}" ${id ? `data-id="${id}"` : ''}>
      <button type="button" class="qty-btn" data-action="${action}-inc" ${id ? `data-id="${id}"` : ''} aria-label="${esc(t('a11y.increase'))}" ${value >= max ? 'disabled' : ''}>${icon('plus')}</button>
    </div>`;

  /* ---------- payment marks ---------- */
  C.payMarks = () => `<span class="paymarks" aria-label="${esc(t('pay.accepted'))}">
      <span class="pm pm-visa" title="Visa">VISA</span>
      <span class="pm pm-mc" title="Mastercard"><i></i><i></i></span>
      <span class="pm pm-amex" title="American Express">AMEX</span>
      <span class="pm pm-crypto" title="${esc(t('pay.crypto'))}">${icon('crypto')}</span>
    </span>`;

  /* ---------- cart drawer ---------- */
  C.cartLines = (lines, compact) => lines.map(v => {
    const p = v.product, l = v.line;
    return `<li class="cline" data-line="${l.id}">
      <a href="#/product/${p.id}" class="cline-img">${OZ.ui.img(p.img, '')}</a>
      <div class="cline-body">
        <a class="cline-name" href="#/product/${p.id}">${esc(OZ.pname(p))}</a>
        <p class="cline-meta">${esc(t('type.' + p.type))} · ${esc(t('size.ml', { n: v.size.ml }))}</p>
        ${l.gift ? `<p class="cline-gift">${icon('gift')} ${esc(t('gift.for', { name: l.gift.recipientName }))} · ${esc(t('gift.wrap.' + l.gift.wrap))}</p>` : ''}
        <p class="cline-price"><strong>${money(v.price)}</strong>${v.compare > v.price ? ` <s>${money(v.compare)}</s>` : ''}</p>
        <div class="cline-actions">
          ${C.qty(l.qty, { max: p.stock, id: l.id, action: 'line' })}
          <button class="link-btn" data-action="remove-line" data-id="${l.id}">${esc(t('cart.remove'))}</button>
          ${!compact && p.giftable ? `<button class="link-btn" data-action="line-gift" data-id="${l.id}">${icon('gift')} ${esc(l.gift ? t('gift.edit') : t('gift.makeGift'))}</button>` : ''}
        </div>
      </div>
      ${!compact ? `<p class="cline-total">${money(v.total)}</p>` : ''}
    </li>`;
  }).join('');

  C.freeShipBar = tt => {
    const th = S.settings().freeShippingThreshold;
    const pct = Math.min(100, Math.round((1 - tt.toFree / th) * 100));
    return `<div class="ship-bar" aria-live="polite">
      <div class="ship-track"><div class="ship-fill" style="width:${tt.freeShip ? 100 : pct}%"></div><span class="ship-truck" style="inset-inline-start:${tt.freeShip ? 100 : pct}%">${icon('truck')}</span></div>
      <p>${tt.freeShip ? `${icon('check')} ${esc(t('cart.freeShipUnlocked'))}` : esc(t('cart.toFreeShip', { amount: money(tt.toFree) }))}</p>
    </div>`;
  };

  C.cartDrawerBody = () => {
    const tt = S.totals();
    if (!tt.lines.length) return C.empty({ ic: 'bag', title: t('cart.emptyTitle'), text: t('cart.emptyText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers" data-ov-close>${esc(t('cart.startShopping'))}</a><a class="btn btn-outline" href="#/deals/crazy" data-ov-close>${esc(t('nav.crazyDeals'))}</a>` });
    return `${C.freeShipBar(tt)}
      <ul class="clines" aria-label="${esc(t('cart.items'))}">${C.cartLines(tt.lines, true)}</ul>
      <div class="drawer-foot">
        ${tt.savings ? `<p class="row save"><span>${esc(t('cart.youSave'))}</span><span>${money(tt.savings)}</span></p>` : ''}
        <p class="row big"><span>${esc(t('cart.subtotal'))}</span><strong>${money(tt.subtotal)}</strong></p>
        <p class="muted small">${esc(t('cart.vatIncl'))} · ${esc(t('cart.shipAtCheckout'))}</p>
        <div class="btn-row"><a class="btn btn-outline" href="#/cart" data-ov-close>${esc(t('cart.viewCart'))}</a><a class="btn btn-primary" href="#/checkout" data-ov-close>${esc(t('cart.checkout'))} ${icon('lock')}</a></div>
      </div>`;
  };

  let cartOv = null;
  C.openCart = (justAdded) => {
    if (cartOv && cartOv.el.isConnected) { C.refreshCartDrawer(justAdded); return; }
    cartOv = OZ.ui.overlay({
      kind: 'drawer-end', title: `${esc(t('cart.title'))} <span class="muted" data-cart-count>(${S.cartCount()})</span>`, className: 'cart-ov',
      body: (justAdded ? `<div class="alert alert-success added-note">${icon('check')}<span>${esc(t('cart.added'))}</span></div>` : '') + `<div data-cart-body>${C.cartDrawerBody()}</div>`,
      onClose: () => { cartOv = null; }
    });
  };
  C.refreshCartDrawer = (justAdded) => {
    if (!cartOv || !cartOv.el.isConnected) return;
    const b = cartOv.el.querySelector('[data-cart-body]'); if (b) b.innerHTML = C.cartDrawerBody();
    const c = cartOv.el.querySelector('[data-cart-count]'); if (c) c.textContent = `(${S.cartCount()})`;
    const n = cartOv.el.querySelector('.added-note');
    if (justAdded && !n) b.insertAdjacentHTML('beforebegin', `<div class="alert alert-success added-note">${icon('check')}<span>${esc(t('cart.added'))}</span></div>`);
  };

  /* ---------- footer ---------- */
  C.footer = () => {
    const B = OZ.BRAND;
    const col = (title, links) => `<div class="f-col"><h2 class="f-h">${esc(title)}</h2><ul>${links.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul></div>`;
    return `<footer class="site-footer">
      <div class="f-news"><div class="container f-news-in">
        <div><h2 class="f-news-h">${esc(t('footer.newsTitle'))}</h2><p>${esc(t('footer.newsText'))}</p></div>
        <form class="f-news-form" data-form="newsletter" novalidate>
          <label for="news-email" class="sr-only">${esc(t('form.email'))}</label>
          <input id="news-email" name="email" type="email" autocomplete="email" placeholder="${esc(t('form.emailPh'))}" required aria-describedby="news-msg">
          <button class="btn btn-teal" type="submit">${esc(t('footer.subscribe'))}</button>
          <p id="news-msg" class="f-news-msg" role="status"></p>
        </form>
      </div></div>
      <div class="container f-grid">
        <div class="f-brand">${C.logo()}<p>${esc(t('footer.about'))}</p>
          <div class="socials">
            <a href="https://wa.me/${B.phoneRaw}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>
            <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a>
            <a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook')}</a>
            <a href="https://tiktok.com" target="_blank" rel="noopener" aria-label="TikTok">${icon('tiktok')}</a>
          </div>
        </div>
        ${col(t('footer.shop'), [['#/shop/diffusers', t('nav.diffusers')], ['#/deals/aroma', t('nav.aromaDeals')], ['#/deals/crazy', t('nav.crazyDeals')], ['#/shop/home-care', t('nav.homeCare')], ['#/shop/gifts', t('nav.gifts')]])}
        ${col(t('footer.customer'), [['#/account', t('nav.account')], ['#/account/orders', t('account.orders')], ['#/wishlist', t('nav.wishlist')], ['#/cart', t('nav.cart')], ['#/account/dates', t('account.dates')]])}
        ${col(t('footer.company'), [['#/about', t('nav.about')], ['#/contact', t('nav.contact')], ['#/policies/shipping', t('policy.shipping')], ['#/policies/returns', t('policy.returns')], ['#/policies/privacy', t('policy.privacy')], ['#/policies/terms', t('policy.terms')]])}
        <div class="f-col f-contact"><h2 class="f-h">${esc(t('footer.contact'))}</h2>
          <ul><li>${icon('phone')}<a href="tel:${B.phoneRaw}" dir="ltr">${esc(B.phone)}</a></li>
          <li>${icon('mail')}<a href="mailto:${B.email}">${esc(B.email)}</a></li>
          <li>${icon('pin')}<span>${esc(t('brand.address'))}</span></li>
          <li>${icon('phone')}<a href="tel:${B.phone2Raw}" dir="ltr">${esc(B.phone2)}</a></li>
          <li>${icon('globe')}<a href="https://${B.website}" target="_blank" rel="noopener">${esc(B.website)}</a></li></ul>
        </div>
      </div>
      <div class="container f-bottom">
        <div class="f-locale">${C.localeControls('f')}</div>
        ${C.payMarks()}
        <p class="small">© ${new Date().getFullYear()} ${esc(B.legalName)}. ${esc(t('footer.rights'))}</p>
      </div>
    </footer>
    <a class="wa-float" href="https://wa.me/${B.phoneRaw}" target="_blank" rel="noopener" aria-label="${esc(t('a11y.whatsapp'))}">${icon('whatsapp')}</a>
    <button class="to-top" data-action="to-top" aria-label="${esc(t('a11y.toTop'))}">${icon('arrowUp')}</button>`;
  };
})();
