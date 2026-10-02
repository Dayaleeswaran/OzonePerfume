/* Ozone Perfume — shopping pages: home, listing / deals / search, product detail. */
(function () {
  const { esc, icon, money, $, $$ } = OZ.ui;
  const S = OZ.store, C = OZ.c;
  const t = (k, v) => OZ.t(k, v);
  const P = OZ.pages = OZ.pages || {};

  /* =====================================================================
     HOME
     ===================================================================== */
  P.home = () => {
    const slides = [
      { img: 'o1', title1: t('hero.s1.t1'), title2: t('hero.s1.t2'), text: t('hero.s1.text'), cta: t('hero.s1.cta'), href: '#/shop/diffusers', feats: [['sparkle', 'hero.f.design'], ['app', 'hero.f.tech'], ['tank', 'hero.f.pure'], ['leaf', 'hero.f.nature']] },
      { img: 'oil-ozone-scent', title1: t('hero.s2.t1'), title2: t('hero.s2.t2'), text: t('hero.s2.text'), cta: t('hero.s2.cta'), href: '#/deals/aroma', feats: [['leaf', 'hero.f.plant'], ['tank', 'hero.f.sizes'], ['building', 'hero.f.hotel'], ['sparkle', 'hero.f.custom']] },
      { img: 'oil-candle-light-2', title1: t('hero.s3.t1'), title2: t('hero.s3.t2'), text: t('hero.s3.text'), cta: t('hero.s3.cta'), href: '#/shop/gifts', feats: [['gift', 'hero.f.giftbox'], ['message', 'hero.f.message'], ['truck', 'hero.f.delivery'], ['calendar', 'hero.f.dates']] }
    ];
    const hero = `<section class="hero" aria-roledescription="carousel" aria-label="${esc(t('hero.label'))}">
      <div class="hero-slides">
        ${slides.map((s, i) => `<div class="hero-slide${i === 0 ? ' active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${slides.length}" ${i ? 'aria-hidden="true"' : ''}>
          <div class="hero-media">${OZ.ui.img(s.img, '', { size: 'lg', eager: i === 0, sizes: '(max-width: 900px) 100vw, 62vw' })}</div>
          <div class="container hero-inner">
            <div class="hero-copy">
              <p class="eyebrow">${esc(t('hero.eyebrow'))}</p>
              ${i === 0 ? '<h1' : '<h2'} class="hero-title"><span>${esc(s.title1)}</span><span class="accent">${esc(s.title2)}</span>${i === 0 ? '</h1>' : '</h2>'}
              <p class="hero-text">${esc(s.text)}</p>
              <ul class="hero-feats">${s.feats.map(([ic, k]) => `<li><span class="hf-ic">${icon(ic)}</span><span>${esc(t(k))}</span></li>`).join('')}</ul>
              <div class="btn-row"><a class="btn btn-primary btn-lg" href="${s.href}" ${i ? 'tabindex="-1"' : ''}>${esc(s.cta)} ${icon('arrowRight', 'flip')}</a><a class="btn btn-ghost-dark btn-lg" href="#/shop/diffusers" ${i ? 'tabindex="-1"' : ''}>${esc(t('hero.browse'))}</a></div>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <div class="hero-ctrl container">
        <div class="hero-dots" role="group" aria-label="${esc(t('hero.choose'))}">${slides.map((s, i) => `<button class="hero-dot${i === 0 ? ' on' : ''}" data-slide="${i}" aria-label="${esc(t('hero.goto', { n: i + 1 }))}" aria-current="${i === 0}"><span></span></button>`).join('')}</div>
        <button class="hero-pause icon-btn" data-hero-pause aria-label="${esc(t('hero.pause'))}" aria-pressed="false">${icon('pause')}</button>
      </div>
    </section>`;

    const benefits = `<section class="benefits" aria-label="${esc(t('benefits.label'))}"><div class="container benefits-in">
      ${[['truck', 'benefits.ship', { amount: money(S.settings().freeShippingThreshold) }], ['percent', 'benefits.first', {}], ['shield', 'benefits.secure', {}], ['gift', 'benefits.gift', {}]].map(([ic, k, v]) => `<div class="benefit reveal"><span class="b-ic">${icon(ic)}</span><div><p class="b-t">${esc(t(k + '.t', v))}</p><p class="b-s">${esc(t(k + '.s', v))}</p></div></div>`).join('')}
    </div></section>`;

    const crazy = S.collection('crazy-deals');
    const diffusers = S.collection('diffusers');
    const signature = S.collection('signature');
    const hotel = S.collection('hotel');

    const tiles = [
      { href: '#/shop/diffusers', img: 'o8', t: 'nav.diffusers', s: 'tiles.diffusers' },
      { href: '#/deals/aroma', img: 'oil-prestige', t: 'nav.aromaDeals', s: 'tiles.aroma' },
      { href: '#/shop/home-care', img: 'o2', t: 'nav.homeCare', s: 'tiles.home' },
      { href: '#/shop/gifts', img: 'oil-love-whisper', t: 'nav.gifts', s: 'tiles.gifts' }
    ];

    const finder = `<section class="section finder" id="finder">
      <div class="container">
        ${C.sectionHead(t('finder.title'), { eyebrow: t('finder.eyebrow'), sub: t('finder.sub') })}
        <div class="finder-modes reveal">
          <div class="seg" role="tablist" aria-label="${esc(t('finder.modes'))}">
            <button role="tab" class="seg-btn on" aria-selected="true" data-finder-mode="family" id="fm-family" aria-controls="finder-opts">${esc(t('finder.byScent'))}</button>
            <button role="tab" class="seg-btn" aria-selected="false" data-finder-mode="space" id="fm-space" aria-controls="finder-opts" tabindex="-1">${esc(t('finder.bySpace'))}</button>
          </div>
          <div class="finder-opts" id="finder-opts" role="tabpanel" aria-labelledby="fm-family"></div>
        </div>
        <div class="finder-results" aria-live="polite"></div>
      </div>
    </section>`;

    const reviews = S.db.reviews.filter(r => r.status === 'approved' && r.rating === 5).slice(0, 3);

    const html = `${hero}${benefits}
      ${crazy.length ? `<section class="section" id="crazy-deals">
        <div class="container">${C.sectionHead(t('nav.crazyDeals'), { icon: 'flame', sub: t('home.crazySub'), link: '#/deals/crazy' })}</div>
        <div class="container-wide">${C.carousel('car-crazy', crazy.map(p => C.card(p, { showSave: true })).join(''), t('nav.crazyDeals'))}</div>
      </section>` : ''}

      <section class="section" id="diffusers">
        <div class="container">${C.sectionHead(t('nav.diffusers'), { eyebrow: t('home.diffEyebrow'), sub: t('home.diffSub'), link: '#/shop/diffusers' })}</div>
        <div class="container-wide">${C.carousel('car-diff', diffusers.map(p => C.card(p, { gift: true })).join(''), t('nav.diffusers'))}</div>
      </section>

      <section class="section tiles-sec" aria-label="${esc(t('tiles.label'))}">
        <div class="container tiles">
          ${tiles.map((x, i) => `<a class="tile reveal" style="--d:${i * 80}ms" href="${x.href}">
            ${OZ.ui.img(x.img, '')}
            <span class="tile-shade"></span>
            <span class="tile-copy"><span class="tile-t">${esc(t(x.t))}</span><span class="tile-s">${esc(t(x.s))}</span></span>
            <span class="tile-go" aria-hidden="true">${icon('chevRight', 'flip')}</span>
          </a>`).join('')}
        </div>
      </section>

      ${OZ.cinematic.html()}

      <section class="section" id="signature-oils">
        <div class="container">${C.sectionHead(t('home.oilsTitle'), { eyebrow: t('home.oilsEyebrow'), sub: t('home.oilsSub'), link: '#/deals/aroma' })}</div>
        <div class="container-wide">${C.carousel('car-oils', signature.map(p => C.card(p, { gift: true })).join(''), t('home.oilsTitle'))}</div>
      </section>

      ${hotel.length ? `<section class="section hotel-sec" id="hotel-inspired">
        <div class="container">${C.sectionHead(t('home.hotelTitle'), { eyebrow: t('home.hotelEyebrow'), sub: t('home.hotelSub'), link: '#/shop/hotel' })}</div>
        <div class="container-wide">${C.carousel('car-hotel', hotel.map(p => C.card(p, { gift: true })).join(''), t('home.hotelTitle'))}</div>
      </section>` : ''}

      ${finder}

      <section class="section gift-sec">
        <div class="container gift-grid">
          <div class="gift-card reveal">
            <div class="gift-media">${OZ.ui.img('oil-velvet-bloom-2', '')}</div>
            <div class="gift-copy">
              <p class="eyebrow">${esc(t('home.giftEyebrow'))}</p>
              <h2 class="sec-title">${esc(t('home.giftTitle'))}</h2>
              <p>${esc(t('home.giftText'))}</p>
              <ul class="ticks"><li>${icon('check')}${esc(t('home.giftP1'))}</li><li>${icon('check')}${esc(t('home.giftP2'))}</li><li>${icon('check')}${esc(t('home.giftP3'))}</li></ul>
              <div class="btn-row"><a class="btn btn-primary" href="#/shop/gifts">${icon('gift')} ${esc(t('home.giftCta'))}</a></div>
            </div>
          </div>
          <div class="dates-card reveal" style="--d:120ms">
            <span class="dates-ic">${icon('calendar')}</span>
            <h2 class="sec-title sm">${esc(t('home.datesTitle'))}</h2>
            <p>${esc(t('home.datesText'))}</p>
            <ul class="date-chips">${['birthday', 'anniversary', 'valentine', 'christmas', 'newYear'].map(o => `<li>${esc(t('occ.' + o))}</li>`).join('')}</ul>
            <a class="btn btn-teal" href="#/account/dates">${esc(t('home.datesCta'))} ${icon('arrowRight', 'flip')}</a>
          </div>
        </div>
      </section>

      <section class="section serving">
        <div class="container">${C.sectionHead(t('home.servingTitle'), { sub: t('home.servingSub') })}
          <ul class="serving-row">${[['building', 'serve.hotels'], ['briefcase', 'serve.offices'], ['bag', 'serve.retail'], ['home', 'serve.villas'], ['shield', 'serve.clinics'], ['sparkle', 'serve.spas'], ['users', 'serve.events']].map(([ic, k], i) => `<li class="reveal" style="--d:${i * 60}ms">${icon(ic)}<span>${esc(t(k))}</span></li>`).join('')}</ul>
        </div>
      </section>

      <section class="section brand-sec">
        <div class="container brand-grid">
          <div class="brand-media reveal">${OZ.ui.img('oil-address-hotel-2', '', { size: 'lg', sizes: '(max-width: 900px) 100vw, 50vw' })}</div>
          <div class="brand-copy reveal" style="--d:100ms">
            <p class="eyebrow">${esc(t('home.brandEyebrow'))}</p>
            <h2 class="sec-title left">${esc(t('home.brandTitle'))}</h2>
            <p>${esc(t('home.brandText'))}</p>
            <ul class="brand-points">
              <li>${icon('leaf')}<div><strong>${esc(t('home.bp1.t'))}</strong><span>${esc(t('home.bp1.s'))}</span></div></li>
              <li>${icon('warranty')}<div><strong>${esc(t('home.bp2.t'))}</strong><span>${esc(t('home.bp2.s'))}</span></div></li>
              <li>${icon('users')}<div><strong>${esc(t('home.bp3.t'))}</strong><span>${esc(t('home.bp3.s'))}</span></div></li>
            </ul>
            <a class="btn btn-outline" href="#/about">${esc(t('home.brandCta'))} ${icon('arrowRight', 'flip')}</a>
          </div>
        </div>
      </section>

      ${reviews.length ? `<section class="section quotes-sec"><div class="container">
        ${C.sectionHead(t('home.quotesTitle'))}
        <div class="quotes">${reviews.map((r, i) => { const p = S.product(r.productId); return `<figure class="quote reveal" style="--d:${i * 90}ms">${OZ.ui.stars(r.rating)}<blockquote><p>“${esc(r.body)}”</p></blockquote><figcaption><strong>${esc(r.name)}</strong>${p ? ` · <a href="#/product/${p.id}">${esc(OZ.pname(p))}</a>` : ''}</figcaption></figure>`; }).join('')}</div>
      </div></section>` : ''}

      <section class="section connect">
        <div class="container connect-in reveal">
          <div><p class="eyebrow light">${esc(t('home.connectEyebrow'))}</p><h2 class="sec-title light left">${esc(t('home.connectTitle'))}</h2><p>${esc(t('home.connectText'))}</p></div>
          <div class="connect-actions">
            <a class="c-act" href="https://wa.me/${OZ.BRAND.phoneRaw}" target="_blank" rel="noopener">${icon('whatsapp')}<span><strong>WhatsApp</strong><small dir="ltr">${esc(OZ.BRAND.phone)}</small></span></a>
            <a class="c-act" href="tel:${OZ.BRAND.phoneRaw}">${icon('phone')}<span><strong>${esc(t('contact.call'))}</strong><small dir="ltr">${esc(OZ.BRAND.phone2)}</small></span></a>
            <a class="c-act" href="#/contact">${icon('mail')}<span><strong>${esc(t('contact.formTitle'))}</strong><small>${esc(t('home.connectReply'))}</small></span></a>
          </div>
        </div>
      </section>`;

    return {
      title: t('meta.home'), html,
      mount(root) {
        initHero(root);
        OZ.cinematic.mount(root);
        initFinder(root);
      }
    };
  };

  function initHero(root) {
    const hero = $('.hero', root); if (!hero) return;
    const slides = $$('.hero-slide', hero), dots = $$('.hero-dot', hero), pauseBtn = $('[data-hero-pause]', hero);
    let i = 0, timer = null, paused = OZ.ui.reducedMotion(), hovering = false;
    const go = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => {
        const on = k === i; s.classList.toggle('active', on); s.setAttribute('aria-hidden', on ? 'false' : 'true');
        $$('a', s).forEach(a => on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1'));
      });
      dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i); });
    };
    const tick = () => { clearTimeout(timer); if (!paused && !hovering) timer = setTimeout(() => { go(i + 1); tick(); }, 6500); };
    const setPaused = p => { paused = p; pauseBtn.setAttribute('aria-pressed', p); pauseBtn.innerHTML = icon(p ? 'play' : 'pause'); pauseBtn.setAttribute('aria-label', t(p ? 'hero.play' : 'hero.pause')); hero.classList.toggle('paused', p); tick(); };
    dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.slide); tick(); }));
    pauseBtn.addEventListener('click', () => setPaused(!paused));
    hero.addEventListener('mouseenter', () => { hovering = true; clearTimeout(timer); });
    hero.addEventListener('mouseleave', () => { hovering = false; tick(); });
    hero.addEventListener('focusin', () => { hovering = true; clearTimeout(timer); });
    hero.addEventListener('focusout', () => { hovering = false; tick(); });
    /* swipe */
    let x0 = null;
    hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; const rtl = document.documentElement.dir === 'rtl'; if (Math.abs(dx) > 50) { go(i + ((dx < 0) !== rtl ? 1 : -1)); tick(); } x0 = null; });
    setPaused(paused);
    OZ.onLeave(() => clearTimeout(timer));
  }

  function initFinder(root) {
    const sec = $('#finder', root); if (!sec) return;
    const opts = $('.finder-opts', sec), out = $('.finder-results', sec);
    let mode = 'family', value = 'citrus';
    const icons = { citrus: 'sparkle', floral: 'leaf', fresh: 'tank', woody: 'flame', home: 'home', office: 'briefcase', commercial: 'building', car: 'truck' };
    const render = () => {
      const list = mode === 'family' ? OZ.FAMILIES : OZ.SPACES;
      opts.innerHTML = `<div class="finder-chips" role="radiogroup" aria-label="${esc(t(mode === 'family' ? 'finder.byScent' : 'finder.bySpace'))}">${list.map(v => `<button role="radio" aria-checked="${v === value}" class="fchip${v === value ? ' on' : ''}" data-fv="${v}">${icon(icons[v])}<span><strong>${esc(t((mode === 'family' ? 'family.' : 'space.') + v))}</strong><small>${esc(t((mode === 'family' ? 'family.' : 'space.') + v + '.d'))}</small></span></button>`).join('')}</div>`;
      const res = S.products().filter(p => mode === 'family' ? (p.type === 'oil' && p.family === value) : (p.type !== 'oil' && p.spaces.includes(value)));
      const href = mode === 'family' ? `#/shop/oils?family=${value}` : `#/shop/diffusers?space=${value}`;
      out.innerHTML = `<div class="grid grid-4 fade-in">${res.slice(0, 4).map(p => C.card(p)).join('')}</div>
        <div class="center-row"><a class="btn btn-outline" href="${href}">${esc(t('finder.seeAll', { n: res.length }))} ${icon('arrowRight', 'flip')}</a></div>`;
    };
    sec.addEventListener('click', e => {
      const m = e.target.closest('[data-finder-mode]');
      if (m) {
        mode = m.dataset.finderMode; value = mode === 'family' ? 'citrus' : 'home';
        $$('[data-finder-mode]', sec).forEach(b => { const on = b === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
        opts.setAttribute('aria-labelledby', m.id);
        render();
      }
      const v = e.target.closest('[data-fv]');
      if (v) { value = v.dataset.fv; render(); const b = $(`[data-fv="${value}"]`, sec); b && b.focus(); }
    });
    sec.addEventListener('keydown', e => {
      const tab = e.target.closest('[data-finder-mode]');
      if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const other = $$('[data-finder-mode]', sec).find(b => b !== tab); other.click(); other.focus(); }
    });
    render();
  }

  /* =====================================================================
     LISTING (collections, deals, search)
     ===================================================================== */
  const SORTS = ['featured', 'price-asc', 'price-desc', 'discount', 'rating', 'newest'];

  function listingConfig(kind, key, q) {
    if (kind === 'search') return { title: q.q ? t('search.resultsFor', { q: q.q }) : t('search.title'), sub: '', base: () => q.q ? OZ.search(q.q) : S.products(), crumbs: t('search.title'), isSearch: true };
    if (kind === 'deals') {
      const c = key === 'aroma' ? 'aroma-deals' : 'crazy-deals';
      return { title: t(key === 'aroma' ? 'nav.aromaDeals' : 'nav.crazyDeals'), sub: t(key === 'aroma' ? 'deals.aromaSub' : 'deals.crazySub'), base: () => S.collection(c), deals: key, crumbs: t(key === 'aroma' ? 'nav.aromaDeals' : 'nav.crazyDeals') };
    }
    const map = { diffusers: 'nav.diffusers', oils: 'home.oilsTitle', signature: 'home.oilsTitle', hotel: 'home.hotelTitle', 'home-care': 'nav.homeCare', gifts: 'nav.gifts', bestsellers: 'home.bestTitle' };
    if (!map[key]) return null;
    return { title: t(map[key]), sub: t('coll.' + key + '.sub'), base: () => S.collection(key), crumbs: t(map[key]), gift: key === 'gifts' };
  }

  function applyFilters(list, f) {
    let r = list.slice();
    if (f.type.length) r = r.filter(p => f.type.includes(p.type));
    if (f.space.length) r = r.filter(p => p.spaces.some(s => f.space.includes(s)));
    if (f.family.length) r = r.filter(p => f.family.includes(p.family));
    if (f.min != null) r = r.filter(p => p.price >= f.min);
    if (f.max != null) r = r.filter(p => p.price <= f.max);
    if (f.stock) r = r.filter(p => p.stock > 0);
    if (f.sale) r = r.filter(p => OZ.discountPct(p) > 0);
    if (f.rating) r = r.filter(p => S.rating(p).avg >= f.rating);
    const by = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      discount: (a, b) => OZ.discountPct(b) - OZ.discountPct(a),
      rating: (a, b) => S.rating(b).avg - S.rating(a).avg,
      newest: (a, b) => (b.isNew - a.isNew)
    }[f.sort];
    if (by) r.sort(by);
    /* Keep available products ahead of sold-out ones in every sort */
    r.sort((a, b) => (a.stock <= 0) - (b.stock <= 0));
    return r;
  }

  function parseFilters(q) {
    const arr = k => (q[k] ? q[k].split(',').filter(Boolean) : []);
    return { type: arr('type'), space: arr('space'), family: arr('family'), min: q.min ? +q.min : null, max: q.max ? +q.max : null, stock: q.stock === '1', sale: q.sale === '1', rating: q.rating ? +q.rating : 0, sort: SORTS.includes(q.sort) ? q.sort : 'featured', q: q.q || '' };
  }
  function filtersToQuery(f) {
    const o = {};
    if (f.q) o.q = f.q;
    ['type', 'space', 'family'].forEach(k => { if (f[k].length) o[k] = f[k].join(','); });
    if (f.min != null) o.min = f.min; if (f.max != null) o.max = f.max;
    if (f.stock) o.stock = 1; if (f.sale) o.sale = 1; if (f.rating) o.rating = f.rating;
    if (f.sort !== 'featured') o.sort = f.sort;
    const s = new URLSearchParams(o).toString();
    return s ? '?' + s : '';
  }

  function filterPanel(f, base, cfg) {
    const count = (fn) => base.filter(fn).length;
    const group = (key, values, labelFn, test) => `<fieldset class="fgroup"><legend>${esc(t('filter.' + key))}</legend>
      ${values.map(v => { const n = count(p => test(p, v)); return `<label class="check"><input type="checkbox" name="${key}" value="${v}" ${f[key].includes(v) ? 'checked' : ''} ${!n && !f[key].includes(v) ? 'disabled' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(labelFn(v))}</span><span class="n">${n}</span></label>`; }).join('')}
    </fieldset>`;
    return `<form class="filters" data-filters novalidate>
      ${cfg.isSearch ? `<div class="fgroup"><label class="flabel" for="fq">${esc(t('search.label'))}</label><div class="search-inline">${icon('search')}<input id="fq" type="search" name="q" value="${esc(f.q)}" placeholder="${esc(t('search.placeholder'))}"></div></div>` : ''}
      ${group('type', OZ.TYPES, v => t('type.' + v + '.plural'), (p, v) => p.type === v)}
      ${group('space', OZ.SPACES, v => t('space.' + v), (p, v) => p.spaces.includes(v))}
      ${group('family', OZ.FAMILIES, v => t('family.' + v), (p, v) => p.family === v)}
      <fieldset class="fgroup"><legend>${esc(t('filter.price'))} <span class="muted small">(${esc(S.session.currency === 'AED' ? 'AED' : 'AED → ' + S.session.currency)})</span></legend>
        <div class="price-inputs">
          <label><span class="sr-only">${esc(t('filter.min'))}</span><input type="number" name="min" min="0" step="50" placeholder="${esc(t('filter.min'))} (AED)" value="${f.min != null ? f.min : ''}"></label>
          <span aria-hidden="true">–</span>
          <label><span class="sr-only">${esc(t('filter.max'))}</span><input type="number" name="max" min="0" step="50" placeholder="${esc(t('filter.max'))} (AED)" value="${f.max != null ? f.max : ''}"></label>
        </div>
        <div class="chips">${[[0, 400], [400, 900], [900, null]].map(([a, b]) => `<button type="button" class="chip${f.min === a && f.max === b ? ' on' : ''}" data-price="${a}-${b == null ? '' : b}">${b == null ? esc(t('filter.over', { amount: money(a) })) : esc(t('filter.range', { a: money(a), b: money(b) }))}</button>`).join('')}</div>
      </fieldset>
      <fieldset class="fgroup"><legend>${esc(t('filter.more'))}</legend>
        <label class="check"><input type="checkbox" name="stock" ${f.stock ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('filter.inStock'))}</span></label>
        <label class="check"><input type="checkbox" name="sale" ${f.sale ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('filter.onSale'))}</span></label>
        <label class="flabel" for="frating">${esc(t('filter.rating'))}</label>
        <select id="frating" name="rating"><option value="0">${esc(t('filter.anyRating'))}</option>${[4.5, 4.7, 4.8].map(r => `<option value="${r}" ${f.rating === r ? 'selected' : ''}>${esc(t('filter.ratingUp', { n: r }))}</option>`).join('')}</select>
      </fieldset>
      <button type="button" class="btn btn-ghost btn-block" data-action="clear-filters">${esc(t('filter.clear'))}</button>
    </form>`;
  }

  function activeChips(f) {
    const chips = [];
    ['type', 'space', 'family'].forEach(k => f[k].forEach(v => chips.push([k, v, t(k === 'type' ? 'type.' + v + '.plural' : k + '.' + v)])));
    if (f.min != null || f.max != null) chips.push(['price', '', `${f.min != null ? money(f.min) : '0'} – ${f.max != null ? money(f.max) : '∞'}`]);
    if (f.stock) chips.push(['stock', '', t('filter.inStock')]);
    if (f.sale) chips.push(['sale', '', t('filter.onSale')]);
    if (f.rating) chips.push(['rating', '', t('filter.ratingUp', { n: f.rating })]);
    return chips.map(([k, v, l]) => `<button class="chip on removable" data-rm="${k}" data-v="${v}" aria-label="${esc(t('filter.remove', { name: l }))}">${esc(l)} ${icon('close')}</button>`).join('');
  }

  P.listing = (kind, key, q) => {
    const cfg = listingConfig(kind, key, q);
    if (!cfg) return P.notFound();
    let f = parseFilters(q);
    const base = cfg.base();
    const html = `
      ${C.breadcrumb([['#/', t('nav.home')], [null, cfg.crumbs]])}
      <section class="page-hero${cfg.deals ? ' deals-hero' : ''}">
        <div class="container">
          ${cfg.deals ? `<p class="eyebrow">${icon(cfg.deals === 'crazy' ? 'flame' : 'tank')} ${esc(t(cfg.deals === 'aroma' ? 'home.oilsEyebrow' : 'deals.eyebrow'))}</p>` : ''}
          <h1 class="page-title">${esc(cfg.title)}</h1>
          ${cfg.sub ? `<p class="page-sub">${esc(cfg.sub)}</p>` : ''}
          ${cfg.deals === 'aroma' ? `<p class="deal-note">${icon('gift')} ${esc(t('deals.aromaNote'))}</p>` : ''}
        </div>
      </section>
      <div class="container listing">
        <aside class="filters-side" aria-label="${esc(t('filter.title'))}"><h2 class="side-h">${icon('filter')} ${esc(t('filter.title'))}</h2><div data-filter-host>${filterPanel(f, base, cfg)}</div></aside>
        <div class="listing-main">
          <div class="toolbar">
            <p class="result-count" role="status" aria-live="polite" data-count></p>
            <div class="toolbar-end">
              <button class="btn btn-outline btn-sm only-mobile-tab" data-action="open-filters">${icon('filter')} ${esc(t('filter.title'))} <span class="badge-count show" data-fcount hidden></span></button>
              <label class="sort"><span>${esc(t('sort.label'))}</span><select data-sort>${SORTS.map(s => `<option value="${s}" ${f.sort === s ? 'selected' : ''}>${esc(t('sort.' + s))}</option>`).join('')}</select></label>
            </div>
          </div>
          <div class="active-chips" data-chips></div>
          <div class="grid grid-3" data-grid aria-busy="true">${C.skeletonCards(6)}</div>
        </div>
      </div>`;

    return {
      title: cfg.title, html,
      mount(root) {
        const grid = $('[data-grid]', root), countEl = $('[data-count]', root), chipsEl = $('[data-chips]', root), sortEl = $('[data-sort]', root);
        let filterOv = null;

        const render = (animate) => {
          const pool = base_();
          const list = applyFilters(pool, f);
          countEl.textContent = t('listing.count', { n: list.length });
          chipsEl.innerHTML = activeChips(f);
          const nf = chipsEl.children.length;
          const fc = $('[data-fcount]', root); if (fc) { fc.hidden = !nf; fc.textContent = nf; }
          grid.setAttribute('aria-busy', 'false');
          if (!list.length) {
            grid.innerHTML = `<div class="grid-empty">${C.empty(cfg.isSearch && !pool.length && f.q
              ? { ic: 'search', title: t('search.noResults', { q: f.q }), text: t('search.noResultsHint'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('search.browseAll'))}</a><a class="btn btn-outline" href="#/contact">${esc(t('search.askUs'))}</a>` }
              : pool.length ? { ic: 'filter', title: t('listing.noMatch'), text: t('listing.noMatchHint'), actions: `<button class="btn btn-primary" data-action="clear-filters">${esc(t('filter.clear'))}</button>` }
                : cfg.deals === 'crazy' ? { ic: 'tag', title: t('deals.noneTitle'), text: t('deals.noneText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('nav.diffusers'))}</a><a class="btn btn-outline" href="#/deals/aroma">${esc(t('home.oilsTitle'))}</a>` }
                  : { ic: 'box', title: t('listing.noProducts'), text: t('listing.noProductsHint'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('search.browseAll'))}</a>` })}</div>`;
            return;
          }
          grid.innerHTML = list.map(p => C.card(p, { showSave: !!cfg.deals, gift: cfg.gift })).join('');
          if (animate && !OZ.ui.reducedMotion()) $$('.pcard', grid).forEach((c, i) => { c.style.setProperty('--d', Math.min(i, 8) * 40 + 'ms'); c.classList.add('stagger'); });
        };

        /* repaint=false while the user is typing in a text/number filter so focus is kept */
        const sync = (repaint = true) => {
          const path = location.hash.split('?')[0];
          history.replaceState(null, '', path + filtersToQuery(f));
          render(true);
          if (!repaint) return;
          const host = $('[data-filter-host]', root); if (host) host.innerHTML = filterPanel(f, base_(), cfg);
          if (filterOv && filterOv.el.isConnected) filterOv.body.querySelector('[data-filter-host-m]').innerHTML = filterPanel(f, base_(), cfg);
        };
        const base_ = () => cfg.isSearch ? (f.q ? OZ.search(f.q) : S.products()) : base;

        const readForm = form => {
          const fd = new FormData(form);
          const next = Object.assign({}, f, { type: fd.getAll('type'), space: fd.getAll('space'), family: fd.getAll('family'), stock: fd.has('stock'), sale: fd.has('sale'), rating: +fd.get('rating') || 0 });
          const mn = fd.get('min'), mx = fd.get('max');
          next.min = mn === '' || mn == null ? null : Math.max(0, +mn);
          next.max = mx === '' || mx == null ? null : Math.max(0, +mx);
          if (fd.has('q')) next.q = String(fd.get('q')).trim();
          return next;
        };
        const onFormChange = e => {
          const form = e.target.closest('[data-filters]'); if (!form) return;
          if (e.target.name === 'q' && e.type === 'change') return;
          f = readForm(form); sync(e.target.type !== 'number');
          const again = root.querySelector(`[data-filters] [name="${e.target.name}"]${e.target.type === 'checkbox' && e.target.value ? `[value="${CSS.escape(e.target.value)}"]` : ''}`);
          if (again && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) again.focus();
        };
        const onQ = OZ.ui.debounce(e => { if (e.target.name === 'q') { f.q = e.target.value.trim(); sync(false); } }, 400);
        const numChange = OZ.ui.debounce(onFormChange, 500);

        root.addEventListener('change', e => { if (e.target.closest('[data-filters]') && e.target.type !== 'number') onFormChange(e); });
        root.addEventListener('input', e => { if (e.target.closest('[data-filters]')) { if (e.target.type === 'number') numChange(e); if (e.target.name === 'q') onQ(e); } });
        root.addEventListener('submit', e => { if (e.target.closest('[data-filters]')) e.preventDefault(); });
        root.addEventListener('click', e => {
          const pr = e.target.closest('[data-price]');
          if (pr) { const [a, b] = pr.dataset.price.split('-'); const same = f.min === +a && f.max === (b ? +b : null); f.min = same ? null : +a; f.max = same ? null : (b ? +b : null); sync(); }
          const rm = e.target.closest('[data-rm]');
          if (rm) {
            const k = rm.dataset.rm;
            if (['type', 'space', 'family'].includes(k)) f[k] = f[k].filter(v => v !== rm.dataset.v);
            else if (k === 'price') { f.min = null; f.max = null; } else if (k === 'rating') f.rating = 0; else f[k] = false;
            sync(); (chipsEl.querySelector('.chip') || sortEl).focus();
          }
          if (e.target.closest('[data-action="clear-filters"]')) { f = Object.assign(parseFilters({}), { sort: f.sort, q: f.q }); sync(); }
          if (e.target.closest('[data-action="open-filters"]')) {
            filterOv = OZ.ui.overlay({
              kind: 'drawer-start', title: esc(t('filter.title')), className: 'filter-ov',
              body: `<div data-filter-host-m>${filterPanel(f, base_(), cfg)}</div><div class="drawer-foot sticky"><button class="btn btn-primary btn-block" data-ov-close data-show-results>${esc(t('filter.show', { n: applyFilters(base_(), f).length }))}</button></div>`,
              onMount(ov) {
                ov.el.addEventListener('change', ev => { if (ev.target.closest('[data-filters]') && ev.target.type !== 'number') { f = readForm(ev.target.closest('[data-filters]')); sync(); ov.el.querySelector('[data-show-results]').textContent = t('filter.show', { n: applyFilters(base_(), f).length }); } });
                ov.el.addEventListener('input', OZ.ui.debounce(ev => { if (ev.target.type === 'number') { f = readForm(ev.target.closest('[data-filters]')); sync(false); ov.el.querySelector('[data-show-results]').textContent = t('filter.show', { n: applyFilters(base_(), f).length }); } }, 500));
                ov.el.addEventListener('click', ev => {
                  const pr2 = ev.target.closest('[data-price]');
                  if (pr2) { const [a, b] = pr2.dataset.price.split('-'); f.min = +a; f.max = b ? +b : null; sync(); }
                  if (ev.target.closest('[data-action="clear-filters"]')) { f = Object.assign(parseFilters({}), { sort: f.sort, q: f.q }); sync(); }
                });
              }
            });
          }
        });
        sortEl.addEventListener('change', () => { f.sort = sortEl.value; sync(); });

        /* Simulated product fetch → skeleton first, then results */
        OZ.api(() => true, 380).then(() => render(true)).catch(err => {
          grid.setAttribute('aria-busy', 'false');
          grid.innerHTML = `<div class="grid-empty">${C.empty({ ic: 'alert', title: t('err.loadTitle'), text: OZ.ui.errorText(err), actions: `<button class="btn btn-primary" data-action="reload">${esc(t('common.retry'))}</button>` })}</div>`;
        });
      }
    };
  };

  /* =====================================================================
     PRODUCT DETAIL
     ===================================================================== */
  const NOTE_ICONS = { top: 'sparkle', heart: 'heart', base: 'leaf' };

  P.product = (id, q) => {
    const p = S.product(id);
    if (!p) return P.notFound(t('pdp.notFound'));
    S.trackRecent(p.id);
    const name = OZ.pname(p);
    const r = S.rating(p);
    const out = p.stock <= 0;
    let sizeId = (q.size && p.sizes.some(s => s.id === q.size)) ? q.size : p.sizes[0].id;
    const coll = p.type === 'hvac' ? ['#/shop/diffusers?type=hvac', t('type.hvac.plural')] : ['#/shop/diffusers', t('nav.diffusers')];
    /* Real photos first (main + gallery); pad with detail crops of the main photo up to three views */
    const photos = [p.img].concat(p.gallery || []);
    const views = photos.map(img => ({ img, cls: 'v1' })).concat([{ img: p.img, cls: 'v2' }, { img: p.img, cls: 'v3' }]).slice(0, Math.max(3, photos.length));
    const related = S.products().filter(x => x.id !== p.id && (x.type === p.type || (p.family && x.family === p.family))).concat(S.products().filter(x => x.id !== p.id)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
    const tabs = [['desc', t('pdp.tab.desc')], ['details', t('pdp.tab.details')], ['notes', t('pdp.tab.notes')], ['use', t('pdp.tab.use')], ['reviews', t('pdp.tab.reviews')], ['shipping', t('pdp.tab.shipping')]];
    const set = S.settings();

    const priceBox = () => {
      const price = S.unitPrice(p, sizeId), compare = S.unitCompare(p, sizeId);
      const off = compare > price ? Math.round((1 - price / compare) * 100) : 0;
      return `<div class="price-box">
        <div><span class="pb-l">${esc(t('price.price'))}</span><strong class="pb-p">${money(price)}</strong></div>
        ${compare > price ? `<div class="pb-mrp"><span class="pb-l">${esc(t('price.mrp'))}</span><s>${money(compare)}</s></div><span class="pb-off">${esc(t('price.off', { n: off }))}</span>` : ''}
      </div>
      <p class="muted small">${esc(t('cart.vatIncl'))}${compare > price ? ` · <span class="save-txt">${esc(t('price.save', { amount: money(compare - price) }))}</span>` : ''}</p>`;
    };

    const howTo = p.type === 'oil' ? ['use.oil1', 'use.oil2', 'use.oil3', 'use.oil4']
      : p.type === 'hvac' ? ['use.hvac1', 'use.hvac2', 'use.hvac3', 'use.hvac4']
        : ['use.s1', 'use.s2', 'use.s3', 'use.s4'];
    const hasNotes = ['top', 'heart', 'base'].some(l => p.notes[l] && p.notes[l].length);
    const specLabel = k => { const v = t(k); return v === k ? k : v; };

    const html = `
      ${C.breadcrumb([['#/', t('nav.home')], coll, [null, name]])}
      <section class="container pdp">
        <div class="pdp-gallery">
          <div class="gal-main" data-gal-main>
            ${views.map((v, i) => `<button class="gal-slide ${v.cls}${i === 0 ? ' on' : ''}" data-action="zoom" data-view="${i}" aria-label="${esc(t('pdp.zoom', { n: i + 1 }))}" ${i ? 'tabindex="-1"' : ''}>${OZ.ui.img(v.img, i === 0 ? name : '', { size: 'lg', eager: i === 0 })}</button>`).join('')}
            <div class="gal-badges">${C.badges(p)}</div>
            <span class="gal-zoom-hint" aria-hidden="true">${icon('expand')}</span>
          </div>
          <div class="gal-thumbs" role="group" aria-label="${esc(t('pdp.gallery'))}">
            ${views.map((v, i) => `<button class="gal-thumb ${v.cls}${i === 0 ? ' on' : ''}" data-thumb="${i}" aria-label="${esc(t('pdp.view', { n: i + 1 }))}" aria-pressed="${i === 0}">${OZ.ui.img(v.img, '')}</button>`).join('')}
          </div>
          <div class="gal-dots only-mobile" aria-hidden="true">${views.map((v, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>
        </div>

        <div class="pdp-info">
          <p class="eyebrow">${esc(t('type.' + p.type))}${p.family ? ` · ${esc(t('family.' + p.family))}` : ''}${p.line === 'hotel' ? ` · ${esc(t('badge.hotel'))}` : ''}</p>
          <h1 class="pdp-title">${esc(name)}</h1>
          ${r.count ? `<a class="pdp-rating" href="#reviews" data-jump="reviews">${OZ.ui.stars(r.avg)}<span>${r.avg.toFixed(1)}</span><span class="muted">${esc(t('reviews.count', { n: r.count }))}</span></a>` : `<a class="pdp-rating" href="#reviews" data-jump="reviews"><span class="muted">${esc(t('reviews.noneYet'))}</span></a>`}
          <div data-price-box>${priceBox()}</div>
          <p class="pdp-tagline">${esc(OZ.ptext(p, 'tagline'))}</p>
          <ul class="feat-list">${p.features.map(fk => `<li>${icon(fk)}<span>${esc(t('feat.' + fk))}</span></li>`).join('')}</ul>

          <form class="buy-form" data-buy novalidate>
            ${p.sizes.length > 1 ? `<fieldset class="size-pick"><legend>${esc(t('pdp.size'))}</legend><div class="size-opts">
              ${p.sizes.map(s => `<label class="size-opt"><input type="radio" name="size" value="${s.id}" ${s.id === sizeId ? 'checked' : ''}><span><strong>${esc(t('size.ml', { n: s.ml }))}</strong><small>${money(p.price + s.delta)}</small></span></label>`).join('')}
            </div></fieldset>` : `<p class="size-one"><span class="muted">${esc(t('pdp.size'))}:</span> <strong>${esc(t('size.ml', { n: p.sizes[0].ml }))}</strong></p>`}
            <div class="stock-line">${C.stockLabel(p)}${!out && p.stock <= 10 ? `<span class="muted small">${esc(t('stock.hurry'))}</span>` : ''}</div>
            <div class="buy-row">
              <div><p class="lbl" id="qty-l">${esc(t('cart.quantity'))}</p>${C.qty(1, { max: Math.max(1, p.stock), action: 'pdp', label: t('cart.quantity') })}</div>
              <button type="submit" class="btn btn-teal btn-lg grow" data-add-main ${out ? 'disabled' : ''}>${icon('bag')} ${esc(out ? t('stock.out') : t('cart.add'))}</button>
              ${C.wishBtn(p, 'wish-square')}
              <button type="button" class="icon-btn sq" data-action="share" aria-label="${esc(t('pdp.share'))}">${icon('share')}</button>
            </div>
            <div class="buy-row2">
              <button type="button" class="btn btn-primary btn-lg" data-action="buy-now" ${out ? 'disabled' : ''}>${esc(t('pdp.buyNow'))} ${icon('arrowRight', 'flip')}</button>
              ${p.giftable ? `<button type="button" class="btn btn-outline btn-lg" data-action="gift-pdp" ${out ? 'disabled' : ''}>${icon('gift')} ${esc(t('gift.send'))}</button>` : ''}
            </div>
            ${out ? `<div class="alert alert-info">${icon('info')}<span>${esc(t('pdp.outNote'))} <a href="#/contact">${esc(t('pdp.contactUs'))}</a></span></div>` : ''}
          </form>

          <ul class="assure">
            <li>${icon('truck')}<span>${esc(t('pdp.assureShip', { amount: money(set.freeShippingThreshold) }))}</span></li>
            <li>${icon('refresh')}<span>${esc(t('pdp.assureReturn'))}</span></li>
            <li>${icon('phone')}<span>${esc(t('pdp.assureSupport'))}</span></li>
          </ul>
          <div class="safe-checkout">${icon('lock')}<span>${esc(t('pdp.safeCheckout'))}</span>${C.payMarks()}</div>
        </div>
      </section>

      <nav class="pdp-tabs" aria-label="${esc(t('pdp.sections'))}"><div class="container"><ul>${tabs.map(([k, l], i) => `<li><a href="#${k}" data-jump="${k}" class="${i === 0 ? 'on' : ''}">${esc(l)}${k === 'reviews' ? ` <span class="n">${r.count}</span>` : ''}</a></li>`).join('')}</ul></div></nav>

      <div class="container pdp-sections">
        <section id="desc" class="pdp-sec" aria-labelledby="h-desc"><h2 id="h-desc">${esc(t('pdp.tab.desc'))}</h2>
          <p class="lead">${esc(OZ.ptext(p, 'desc'))}</p>
          <p>${esc(t('pdp.descExtra'))}</p>
        </section>
        <section id="details" class="pdp-sec" aria-labelledby="h-details"><h2 id="h-details">${esc(t('pdp.tab.details'))}</h2>
          <dl class="specs">
            ${[['spec.sku', p.sku], ['spec.type', t('type.' + p.type)]].concat(p.specs || []).concat(p.ideal ? [['spec.idealFor', OZ.ptext(p, 'ideal')]] : []).map(([k, v]) => `<div><dt>${esc(specLabel(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
        </section>
        <section id="notes" class="pdp-sec" aria-labelledby="h-notes"><h2 id="h-notes">${esc(t('pdp.tab.notes'))}</h2>
          ${hasNotes ? `<p class="muted">${esc(p.family ? t('pdp.notesIntro', { family: t('family.' + p.family) }) : t('pdp.notesIntroPlain'))}</p>` : `<div class="alert alert-info">${icon('info')}<span>${esc(t(p.type === 'oil' ? 'pdp.notesPending' : 'pdp.notesDiffuser'))} <a href="#/contact">${esc(t('pdp.contactUs'))}</a></span></div>`}
          ${hasNotes ? `<div class="pyramid">
            ${['top', 'heart', 'base'].map((lvl, i) => `<div class="pyr pyr-${lvl} reveal" style="--d:${i * 100}ms"><span class="pyr-ic">${icon(NOTE_ICONS[lvl])}</span><div><h3>${esc(t('notes.' + lvl))}</h3><p class="muted small">${esc(t('notes.' + lvl + '.d'))}</p><ul class="note-chips">${p.notes[lvl].map(n => `<li>${esc(OZ.noteLabel(n))}</li>`).join('')}</ul></div></div>`).join('')}
          </div>` : ''}
        </section>
        <section id="use" class="pdp-sec" aria-labelledby="h-use"><h2 id="h-use">${esc(t('pdp.tab.use'))}</h2>
          <ol class="steps">${howTo.map((k, i) => `<li><span class="step-n">${i + 1}</span><div><h3>${esc(t(k + '.t'))}</h3><p>${esc(t(k + '.d'))}</p></div></li>`).join('')}</ol>
        </section>
        <section id="reviews" class="pdp-sec" aria-labelledby="h-reviews"><h2 id="h-reviews">${esc(t('pdp.tab.reviews'))}</h2><div data-reviews></div></section>
        <section id="shipping" class="pdp-sec" aria-labelledby="h-shipping"><h2 id="h-shipping">${esc(t('pdp.tab.shipping'))}</h2>
          <div class="ship-grid">
            <div>${icon('truck')}<h3>${esc(t('ship.standard'))}</h3><p>${esc(t('ship.standardD', { fee: money(set.shippingFee), amount: money(set.freeShippingThreshold) }))}</p></div>
            <div>${icon('clock')}<h3>${esc(t('ship.express'))}</h3><p>${esc(t('ship.expressD', { fee: money(set.expressFee) }))}</p></div>
            <div>${icon('refresh')}<h3>${esc(t('policy.returns'))}</h3><p>${esc(t('ship.returnsD'))}</p></div>
          </div>
          <a class="link-arrow" href="#/policies/shipping">${esc(t('ship.full'))} ${icon('arrowRight', 'flip')}</a>
        </section>
      </div>

      <section class="section">
        <div class="container">${C.sectionHead(t('pdp.related'), { eyebrow: t('pdp.relatedEyebrow') })}</div>
        <div class="container-wide">${C.carousel('car-related', related.map(x => C.card(x)).join(''), t('pdp.related'))}</div>
      </section>

      <div class="sticky-buy" data-sticky-buy aria-hidden="true">
        <div class="container sb-in">
          ${OZ.ui.img(p.img, '')}
          <div class="sb-txt"><strong>${esc(name)}</strong><span data-sb-price>${money(S.unitPrice(p, sizeId))}</span></div>
          <button class="btn btn-teal" data-action="sticky-add" ${out ? 'disabled' : ''} tabindex="-1">${esc(out ? t('stock.out') : t('cart.add'))}</button>
        </div>
      </div>`;

    return {
      title: name, html,
      mount(root) {
        const form = $('[data-buy]', root);
        const qtyInput = () => $('[data-qty-input="pdp"]', form);
        const getQty = () => Math.max(1, Math.min(p.stock || 1, parseInt(qtyInput().value, 10) || 1));
        const setQty = n => {
          n = Math.max(1, Math.min(Math.max(1, p.stock), n)); qtyInput().value = n;
          $('[data-action="pdp-dec"]', form).disabled = n <= 1;
          $('[data-action="pdp-inc"]', form).disabled = n >= p.stock;
        };

        /* gallery */
        const main = $('[data-gal-main]', root);
        const showView = i => {
          $$('.gal-slide', main).forEach((s, k) => { s.classList.toggle('on', k === i); s.tabIndex = k === i ? 0 : -1; });
          $$('.gal-thumb', root).forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', k === i); });
          $$('.gal-dots span', root).forEach((d, k) => d.classList.toggle('on', k === i));
        };
        $$('.gal-thumb', root).forEach(b => b.addEventListener('click', () => showView(+b.dataset.thumb)));
        main.addEventListener('mousemove', e => {
          const s = $('.gal-slide.on', main); const rc = main.getBoundingClientRect();
          s.style.setProperty('--zx', ((e.clientX - rc.left) / rc.width * 100) + '%'); s.style.setProperty('--zy', ((e.clientY - rc.top) / rc.height * 100) + '%');
        });
        let gx = null;
        main.addEventListener('touchstart', e => { gx = e.touches[0].clientX; }, { passive: true });
        main.addEventListener('touchend', e => {
          if (gx == null) return; const dx = e.changedTouches[0].clientX - gx; gx = null;
          if (Math.abs(dx) < 40) return;
          const cur = $$('.gal-slide', main).findIndex(s => s.classList.contains('on'));
          const rtl = document.documentElement.dir === 'rtl';
          showView((cur + ((dx < 0) !== rtl ? 1 : -1) + views.length) % views.length);
        });

        form.addEventListener('change', e => {
          if (e.target.name === 'size') {
            sizeId = e.target.value;
            $('[data-price-box]', root).innerHTML = priceBox();
            $('[data-sb-price]', root).textContent = money(S.unitPrice(p, sizeId));
            history.replaceState(null, '', `#/product/${p.id}?size=${sizeId}`);
          }
        });
        form.addEventListener('click', e => {
          if (e.target.closest('[data-action="pdp-dec"]')) setQty(getQty() - 1);
          if (e.target.closest('[data-action="pdp-inc"]')) setQty(getQty() + 1);
        });
        form.addEventListener('input', e => { if (e.target.matches('[data-qty-input]')) { const v = parseInt(e.target.value, 10); if (v > p.stock) setQty(p.stock); } });
        form.addEventListener('focusout', e => { if (e.target.matches('[data-qty-input]')) setQty(getQty()); });

        const add = (btn, then) => {
          OZ.ui.busy(btn, true, t('cart.adding'));
          return S.addToCart(p.id, sizeId, getQty()).then(() => {
            OZ.ui.busy(btn, false);
            if (then) then(); else { C.openCart(true); OZ.ui.announce(t('cart.addedNamed', { name })); }
          }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
        };
        form.addEventListener('submit', e => { e.preventDefault(); add($('[data-add-main]', form)); });
        root.addEventListener('click', e => {
          if (e.target.closest('[data-action="buy-now"]')) add(e.target.closest('button'), () => { location.hash = '#/checkout'; });
          if (e.target.closest('[data-action="sticky-add"]')) add(e.target.closest('button'));
          if (e.target.closest('[data-action="gift-pdp"]')) OZ.gift.open({ productId: p.id, sizeId, qty: getQty() });
          if (e.target.closest('[data-action="share"]')) {
            const url = location.href;
            if (navigator.share) navigator.share({ title: name, url }).catch(() => {});
            else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => OZ.ui.toast(t('pdp.linkCopied'), 'info')).catch(() => OZ.ui.toast(url, 'info'));
          }
          const z = e.target.closest('[data-action="zoom"]');
          if (z) openLightbox(p, views, +z.dataset.view);
        });

        /* section nav: smooth jump + scroll-spy */
        const tabLinks = $$('.pdp-tabs a', root);
        root.addEventListener('click', e => {
          const j = e.target.closest('[data-jump]'); if (!j) return;
          e.preventDefault();
          const sec = document.getElementById(j.dataset.jump); if (!sec) return;
          const off = ($('#site-header') ? $('#site-header').getBoundingClientRect().height : 0) + 70;
          window.scrollTo({ top: sec.getBoundingClientRect().top + scrollY - off + 10, behavior: OZ.ui.reducedMotion() ? 'auto' : 'smooth' });
          sec.setAttribute('tabindex', '-1'); sec.focus({ preventScroll: true });
        });
        const spy = new IntersectionObserver(entries => {
          entries.forEach(en => { if (en.isIntersecting) tabLinks.forEach(a => { const on = a.dataset.jump === en.target.id; a.classList.toggle('on', on); if (on) { a.setAttribute('aria-current', 'true'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else a.removeAttribute('aria-current'); }); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('.pdp-sec', root).forEach(s => spy.observe(s));

        /* mobile sticky add-to-cart */
        const sticky = $('[data-sticky-buy]', root);
        const io = new IntersectionObserver(([en]) => {
          const show = !en.isIntersecting && en.boundingClientRect.top < 0;
          sticky.classList.toggle('show', show); sticky.setAttribute('aria-hidden', !show);
          document.body.classList.toggle('sticky-buy-on', show);
          $('button', sticky).tabIndex = show ? 0 : -1;
        });
        io.observe($('.buy-row', root));
        OZ.onLeave(() => { spy.disconnect(); io.disconnect(); document.body.classList.remove('sticky-buy-on'); });

        OZ.reviews.mount($('[data-reviews]', root), p);
      }
    };
  };

  function openLightbox(p, views, view) {
    let i = view;
    const n = views.length;
    const html = k => `<div class="lb-img ${views[k].cls}">${OZ.ui.img(views[k].img, OZ.pname(p), { size: 'lg', sizes: '100vw' })}</div>`;
    const ov = OZ.ui.overlay({
      kind: 'lightbox', title: esc(OZ.pname(p)), className: 'lb-ov',
      body: `<div class="lb-stage"><button class="car-btn prev" data-lb="-1" aria-label="${esc(t('a11y.prev'))}">${icon('chevLeft', 'flip')}</button><div data-lb-img>${html(i)}</div><button class="car-btn next" data-lb="1" aria-label="${esc(t('a11y.next'))}">${icon('chevRight', 'flip')}</button></div><p class="lb-count" aria-live="polite">${i + 1} / ${n}</p>`,
      onMount(o) {
        const upd = () => { o.el.querySelector('[data-lb-img]').innerHTML = html(i); o.el.querySelector('.lb-count').textContent = `${i + 1} / ${n}`; };
        const step = d => { i = (i + d + n) % n; upd(); };
        o.el.addEventListener('click', e => { const b = e.target.closest('[data-lb]'); if (b) step(+b.dataset.lb); });
        o.el.addEventListener('keydown', e => { const rtl = document.documentElement.dir === 'rtl'; if (e.key === 'ArrowRight') step(rtl ? -1 : 1); if (e.key === 'ArrowLeft') step(rtl ? 1 : -1); });
      }
    });
    return ov;
  }

  /* =====================================================================
     REVIEWS (product page block)
     ===================================================================== */
  OZ.reviews = {
    mount(host, p) {
      let sort = 'recent';
      const render = () => {
        const all = S.reviews(p.id);
        const list = all.slice().sort((a, b) => sort === 'high' ? b.rating - a.rating : sort === 'low' ? a.rating - b.rating : String(b.date).localeCompare(String(a.date)));
        const r = S.rating(p);
        const written = all.filter(x => x.status === 'approved');
        const dist = [5, 4, 3, 2, 1].map(n => [n, written.filter(x => x.rating === n).length]);
        const u = S.user();
        const mine = u && all.find(x => x.email === u.email);
        const canWrite = u && !mine;
        host.innerHTML = `<div class="rev-grid">
          <div class="rev-summary">
            <p class="rev-avg">${r.avg.toFixed(1)}<span>/5</span></p>
            ${OZ.ui.stars(r.avg, 'lg')}
            <p class="muted">${esc(t('reviews.basedOn', { n: r.count }))}</p>
            ${written.length ? `<ul class="rev-dist" aria-label="${esc(t('reviews.dist'))}">${dist.map(([n, c]) => `<li><span>${n}★</span><span class="bar"><span style="width:${written.length ? c / written.length * 100 : 0}%"></span></span><span class="muted">${c}</span></li>`).join('')}</ul><p class="muted small">${esc(t('reviews.distNote', { n: written.length }))}</p>` : ''}
            ${canWrite ? `<button class="btn btn-primary btn-block" data-action="write-review">${icon('edit')} ${esc(t('reviews.write'))}</button>`
              : !u ? `<a class="btn btn-outline btn-block" href="#/login?next=${encodeURIComponent('/product/' + p.id)}">${esc(t('reviews.loginToWrite'))}</a>` : ''}
          </div>
          <div class="rev-list-wrap">
            ${mine && mine.status === 'pending' ? `<div class="alert alert-info">${icon('clock')}<span>${esc(t('reviews.pendingMine'))}</span></div>` : ''}
            <div data-review-form></div>
            ${list.length ? `<div class="rev-tools"><label class="sort"><span>${esc(t('sort.label'))}</span><select data-rev-sort><option value="recent" ${sort === 'recent' ? 'selected' : ''}>${esc(t('reviews.sortRecent'))}</option><option value="high" ${sort === 'high' ? 'selected' : ''}>${esc(t('reviews.sortHigh'))}</option><option value="low" ${sort === 'low' ? 'selected' : ''}>${esc(t('reviews.sortLow'))}</option></select></label></div>
            <ul class="rev-list">${list.map(x => `<li class="rev${x.status === 'pending' ? ' pending' : ''}">
                <div class="rev-head">${OZ.ui.stars(x.rating)}<strong>${esc(x.title)}</strong>${x.status === 'pending' ? `<span class="badge badge-muted">${esc(t('reviews.pending'))}</span>` : ''}</div>
                <p>${esc(x.body)}</p>
                <p class="rev-meta"><span>${esc(x.name)}</span>${x.verified ? `<span class="verified">${icon('check')} ${esc(t('reviews.verified'))}</span>` : ''}<span class="muted">${OZ.ui.date(x.date)}</span></p>
              </li>`).join('')}</ul>`
          : `<div class="empty compact">${icon('message', 'empty-ic')}<h3>${esc(t('reviews.noneTitle'))}</h3><p>${esc(t('reviews.noneText'))}</p>${canWrite ? `<button class="btn btn-primary" data-action="write-review">${esc(t('reviews.beFirst'))}</button>` : ''}</div>`}
          </div>
        </div>`;
      };
      const openForm = () => {
        const fh = host.querySelector('[data-review-form]');
        fh.innerHTML = `<form class="card rev-form" data-rev-form novalidate>
          <h3>${esc(t('reviews.writeFor', { name: OZ.pname(p) }))}</h3>
          <fieldset class="star-input"><legend>${esc(t('reviews.yourRating'))}</legend>
            <div class="star-pick">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="sr${n}" name="rating" value="${n}"><label for="sr${n}" title="${n}">${icon('star')}<span class="sr-only">${esc(t('a11y.rating', { n }))}</span></label>`).join('')}</div>
            <p class="err" role="alert" data-rating-err></p>
          </fieldset>
          ${OZ.ui.field({ name: 'title', label: t('reviews.titleL'), required: true, attrs: 'maxlength="80"' })}
          ${OZ.ui.field({ name: 'body', label: t('reviews.bodyL'), type: 'textarea', required: true, rows: 4, attrs: 'maxlength="1000"', hint: esc(t('reviews.bodyHint')) })}
          <div class="btn-row"><button type="button" class="btn btn-ghost" data-action="cancel-review">${esc(t('common.cancel'))}</button><button class="btn btn-primary" type="submit">${esc(t('reviews.submit'))}</button></div>
        </form>`;
        fh.querySelector('input[name=rating]').focus();
      };
      host.addEventListener('click', e => {
        if (e.target.closest('[data-action="write-review"]')) openForm();
        if (e.target.closest('[data-action="cancel-review"]')) host.querySelector('[data-review-form]').innerHTML = '';
      });
      host.addEventListener('change', e => { if (e.target.matches('[data-rev-sort]')) { sort = e.target.value; render(); } });
      host.addEventListener('submit', e => {
        const form = e.target.closest('[data-rev-form]'); if (!form) return;
        e.preventDefault();
        const rating = +(new FormData(form).get('rating') || 0);
        const rErr = form.querySelector('[data-rating-err]');
        rErr.textContent = rating ? '' : t('reviews.pickRating');
        const data = OZ.ui.validate(form, { title: [OZ.ui.V.required, OZ.ui.V.min(3)], body: [OZ.ui.V.required, OZ.ui.V.min(10)] });
        if (!rating) { form.querySelector('input[name=rating]').focus(); return; }
        if (!data) return;
        const btn = form.querySelector('[type=submit]');
        OZ.ui.busy(btn, true, t('reviews.submitting'));
        S.addReview(p.id, { rating, title: data.title, body: data.body }).then(() => {
          render();
          OZ.ui.toast(t('reviews.thanks'), 'success');
          const note = host.querySelector('.alert-info'); if (note) { note.setAttribute('tabindex', '-1'); note.focus(); }
        }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(form, OZ.ui.errorText(err)); });
      });
      render();
    }
  };
})();
