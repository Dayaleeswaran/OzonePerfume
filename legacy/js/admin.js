/* Ozone Perfume — protected admin interface. */
(function () {
  const { esc, icon, money, $, $$ } = OZ.ui;
  const S = OZ.store, C = OZ.c;
  const t = (k, v) => OZ.t(k, v);
  const P = OZ.pages = OZ.pages || {};
  const V = OZ.ui.V;

  const NAV = [['dashboard', 'dashboard'], ['products', 'box'], ['categories', 'layers'], ['orders', 'bag'], ['customers', 'users'], ['inventory', 'grid'], ['payments', 'card'], ['coupons', 'tag'], ['reviews', 'star'], ['gifts', 'gift'], ['dates', 'calendar'], ['translations', 'globe'], ['settings', 'settings']];
  const STATUSES = ['processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const aed = n => OZ.ui.money(n, { currency: 'AED' });

  P.admin = (section = 'dashboard', sub) => {
    const u = S.user();
    if (!u) return { redirect: '#/login?next=' + encodeURIComponent('/admin') + '&reason=admin' };
    if (u.role !== 'admin') {
      return { title: t('admin.forbidden'), html: `<section class="container section">${C.empty({ ic: 'lock', title: t('admin.forbidden'), text: t('admin.forbiddenText'), actions: `<a class="btn btn-primary" href="#/">${esc(t('nav.home'))}</a>` })}</section>` };
    }
    if (!NAV.some(n => n[0] === section)) section = 'dashboard';
    const pending = S.db.reviews.filter(r => r.status === 'pending').length;
    const newOrders = S.db.orders.filter(o => o.status === 'processing').length;

    const html = `<div class="admin">
      <aside class="adm-side" id="adm-side">
        <div class="adm-brand">${C.logo(true)}<span class="badge badge-muted">${esc(t('admin.badge'))}</span></div>
        <nav aria-label="${esc(t('admin.nav'))}"><ul>
          ${NAV.map(([k, ic]) => `<li><a href="#/admin/${k}" class="${k === section ? 'on' : ''}" ${k === section ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(t('admin.' + k))}</span>${k === 'reviews' && pending ? `<span class="count" aria-label="${esc(t('admin.pendingN', { n: pending }))}">${pending}</span>` : ''}${k === 'orders' && newOrders ? `<span class="count">${newOrders}</span>` : ''}</a></li>`).join('')}
        </ul></nav>
        <div class="adm-side-foot"><a href="#/" class="link-btn">${icon('home')} ${esc(t('admin.viewStore'))}</a><button class="link-btn" data-action="logout">${icon('logout')} ${esc(t('nav.logout'))}</button></div>
      </aside>
      <div class="adm-main">
        <header class="adm-top">
          <button class="icon-btn only-mobile-tab" data-adm-menu aria-controls="adm-side" aria-expanded="false" aria-label="${esc(t('a11y.openMenu'))}">${icon('menu')}</button>
          <h1 class="adm-title" tabindex="-1">${esc(t('admin.' + section))}</h1>
          <div class="adm-top-end">
            <div class="locale"><button class="locale-btn" data-action="toggle-locale" aria-expanded="false" aria-controls="locale-pop">${icon('globe')}<span>${esc(OZ.LANGS[S.session.lang].short)}</span></button><div class="locale-pop" id="locale-pop" hidden>${C.localeControls('adm')}</div></div>
            <span class="avatar sm" aria-hidden="true">${esc((u.name || 'A')[0])}</span><span class="adm-user">${esc(u.name)}</span>
          </div>
        </header>
        <div class="adm-body" data-adm-body></div>
      </div>
    </div>`;
    return {
      title: `${t('admin.' + section)} — ${t('admin.title')}`, html, bare: true, admin: true, focus: '.adm-title',
      mount(root) {
        const body = $('[data-adm-body]', root);
        const menuBtn = $('[data-adm-menu]', root), side = $('#adm-side', root);
        menuBtn.addEventListener('click', () => { const open = side.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', open); });
        side.addEventListener('click', e => { if (e.target.closest('a')) { side.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
        SECTIONS[section](body, sub);
      }
    };
  };

  /* ---------- helpers ---------- */
  const table = (cols, rows, { empty, caption } = {}) => rows.length
    ? `<div class="tbl-wrap"><table class="tbl">${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}<thead><tr>${cols.map(c => `<th scope="col" class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : C.empty({ ic: 'box', title: empty || t('admin.nothing') });
  const statusPill = s => `<span class="status status-${s}">${esc(t('status.' + s))}</span>`;
  const tile = (label, value, sub, ic) => `<div class="tile-stat card">${icon(ic)}<p class="ts-label">${esc(label)}</p><p class="ts-value">${value}</p>${sub ? `<p class="ts-sub muted small">${sub}</p>` : ''}</div>`;
  const toolbar = (inner) => `<div class="adm-toolbar">${inner}</div>`;
  const allProducts = () => S.db.products;

  const SECTIONS = {};

  /* ---------- dashboard ---------- */
  SECTIONS.dashboard = body => {
    const orders = S.db.orders.filter(o => !['cancelled', 'refunded'].includes(o.status));
    const revenue = orders.reduce((a, o) => a + o.totals.total, 0);
    const customers = Object.values(S.db.users).filter(u => u.role !== 'admin').length;
    const low = allProducts().filter(p => p.stock <= 10);
    const pending = S.db.reviews.filter(r => r.status === 'pending');
    body.innerHTML = `<div class="tiles-stat">
        ${tile(t('admin.revenue'), aed(revenue), esc(t('admin.revenueSub', { n: orders.length })), 'card')}
        ${tile(t('admin.orders'), orders.length, esc(t('admin.toFulfil', { n: S.db.orders.filter(o => o.status === 'processing').length })), 'bag')}
        ${tile(t('admin.aov'), aed(orders.length ? revenue / orders.length : 0), '', 'percent')}
        ${tile(t('admin.customers'), customers, '', 'users')}
        ${tile(t('admin.lowStock'), low.length, esc(t('admin.lowStockSub')), 'alert')}
        ${tile(t('admin.pendingReviews'), pending.length, '', 'star')}
      </div>
      <div class="adm-cols">
        <section class="card"><div class="row-between"><h2 class="card-h">${esc(t('admin.recentOrders'))}</h2><a href="#/admin/orders" class="link-arrow">${esc(t('common.viewAll'))} ${icon('arrowRight', 'flip')}</a></div>
          ${table([{ label: t('order.number') }, { label: t('order.date') }, { label: t('admin.customer') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }],
            S.db.orders.slice(0, 6).map(o => `<tr><td><a href="#/admin/orders/${o.id}">${esc(o.id)}</a></td><td>${OZ.ui.date(o.date)}</td><td>${esc(o.email)}</td><td>${statusPill(o.status)}</td><td class="num">${aed(o.totals.total)}</td></tr>`), { empty: t('order.noneTitle') })}
        </section>
        <section class="card"><div class="row-between"><h2 class="card-h">${esc(t('admin.lowStock'))}</h2><a href="#/admin/inventory" class="link-arrow">${esc(t('admin.inventory'))} ${icon('arrowRight', 'flip')}</a></div>
          ${low.length ? `<ul class="adm-list">${low.map(p => `<li>${OZ.ui.img(p.img, '')}<span>${esc(p.name.en)}</span>${p.stock <= 0 ? `<span class="status status-cancelled">${esc(t('stock.out'))}</span>` : `<span class="status status-processing">${esc(t('admin.unitsLeft', { n: p.stock }))}</span>`}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('admin.allStocked'))}</p>`}
        </section>
      </div>`;
  };

  /* ---------- products ---------- */
  SECTIONS.products = (body, sub) => {
    let q = '';
    const render = () => {
      const list = allProducts().filter(p => !q || (p.name.en + ' ' + p.sku + ' ' + p.type).toLowerCase().includes(q.toLowerCase()));
      $('[data-plist]', body).innerHTML = table(
        [{ label: '' }, { label: t('admin.product') }, { label: 'SKU' }, { label: t('spec.type') }, { label: t('price.price'), cls: 'num' }, { label: t('admin.discount'), cls: 'num' }, { label: t('admin.stock'), cls: 'num' }, { label: t('admin.visibility') }, { label: '' }],
        list.map(p => `<tr>
          <td class="thumb">${OZ.ui.img(p.img, '')}</td>
          <td><strong>${esc(p.name.en)}</strong><br><span class="muted small">${esc(p.family ? t('family.' + p.family) : t('type.' + p.type))}</span></td>
          <td><code>${esc(p.sku)}</code></td><td>${esc(t('type.' + p.type))}</td>
          <td class="num">${aed(p.price)}${p.compareAt > p.price ? `<br><s class="muted small">${aed(p.compareAt)}</s>` : ''}</td>
          <td class="num">${OZ.discountPct(p)}%</td>
          <td class="num ${p.stock <= 0 ? 'neg' : p.stock <= 10 ? 'warn' : ''}">${p.stock}</td>
          <td>${p.active === false ? `<span class="status status-cancelled">${esc(t('admin.hidden'))}</span>` : `<span class="status status-delivered">${esc(t('admin.live'))}</span>`}</td>
          <td class="acts"><button class="icon-btn" data-edit="${p.id}" aria-label="${esc(t('common.edit'))} ${esc(p.name.en)}">${icon('edit')}</button><a class="icon-btn" href="#/product/${p.id}" aria-label="${esc(t('admin.preview'))} ${esc(p.name.en)}">${icon('eye')}</a><button class="icon-btn danger" data-del="${p.id}" aria-label="${esc(t('common.delete'))} ${esc(p.name.en)}">${icon('trash')}</button></td>
        </tr>`), { empty: t('listing.noProducts'), caption: t('admin.products') });
    };
    body.innerHTML = toolbar(`<label class="search-inline">${icon('search')}<span class="sr-only">${esc(t('admin.searchProducts'))}</span><input type="search" data-pq placeholder="${esc(t('admin.searchProducts'))}"></label><button class="btn btn-primary" data-new>${icon('plus')} ${esc(t('admin.addProduct'))}</button>`) + `<div data-plist></div>`;
    $('[data-pq]', body).addEventListener('input', OZ.ui.debounce(e => { q = e.target.value; render(); }, 200));
    body.addEventListener('click', e => {
      if (e.target.closest('[data-new]')) productForm(null, render);
      const ed = e.target.closest('[data-edit]'); if (ed) productForm(S.db.products.find(p => p.id === ed.dataset.edit), render);
      const dl = e.target.closest('[data-del]');
      if (dl) { const p = S.db.products.find(x => x.id === dl.dataset.del); OZ.ui.confirm(t('admin.confirmDeleteProduct', { name: p.name.en }), { confirmLabel: t('common.delete') }).then(ok => { if (ok) S.admin.deleteProduct(p.id).then(() => { render(); OZ.ui.toast(t('admin.productDeleted'), 'info'); }); }); }
    });
    render();
    if (sub === 'new') productForm(null, render);
  };

  function downscale(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject({ code: 'imageType' });
      if (file.size > 8 * 1024 * 1024) return reject({ code: 'imageSize' });
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const scale = Math.min(1, 1000 / im.width);
          const c = document.createElement('canvas'); c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          let url = c.toDataURL('image/webp', 0.8); if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.82);
          resolve(url);
        };
        im.onerror = () => reject({ code: 'imageType' });
        im.src = fr.result;
      };
      fr.onerror = () => reject({ code: 'imageType' });
      fr.readAsDataURL(file);
    });
  }

  function productForm(p, done) {
    const isNew = !p;
    const v = p ? JSON.parse(JSON.stringify(p)) : { id: 'p' + Date.now().toString(36), sku: '', img: 'o1', type: 'tower', family: null, line: '', gallery: [], spaces: ['home'], price: 0, compareAt: 0, stock: 0, rating: 0, reviewCount: 0, bestSeller: false, giftable: true, aromaDeal: false, isNew: true, active: true, sizes: [{ id: '150', ml: 150, delta: 0 }], features: [], specs: [], ideal: { en: '', es: '', ar: '' }, notes: { top: [], heart: [], base: [] }, name: { en: '', es: '', ar: '' }, tagline: { en: '', es: '', ar: '' }, desc: { en: '', es: '', ar: '' } };
    if (!Array.isArray(v.specs)) v.specs = [];
    if (!v.ideal) v.ideal = { en: '', es: '', ar: '' };
    /* Spec rows are stored as [i18n key or raw label, value]; edit them as 'Label: value' lines */
    const specKeys = Object.keys(OZ.I18N.en).filter(k => k.startsWith('spec.'));
    const specToLine = ([k, val]) => `${OZ.I18N.en[k] || k}: ${val}`;
    const lineToSpec = line => { const i = line.indexOf(':'); const label = line.slice(0, i).trim(); const key = specKeys.find(k => OZ.I18N.en[k].toLowerCase() === label.toLowerCase()); return [key || label, line.slice(i + 1).trim()]; };
    const F = OZ.ui.field;
    const langTabs = (field, label, type = 'text') => `<fieldset class="fs"><legend>${esc(label)}</legend><div class="grid-3">${['en', 'es', 'ar'].map(l => F({ name: `${field}_${l}`, label: OZ.LANGS[l].label, type, value: v[field][l] || '', required: l === 'en', rows: 3, attrs: l === 'ar' ? 'dir="rtl" lang="ar"' : `lang="${l}"` })).join('')}</div></fieldset>`;
    const feats = OZ.FEATURES;
    const ov = OZ.ui.overlay({
      title: esc(isNew ? t('admin.addProduct') : t('admin.editProduct')), size: 'lg', className: 'adm-ov',
      body: `<form data-pform novalidate>
        <div class="pform-top">
          <div class="img-edit"><div class="img-prev" data-img-prev>${OZ.ui.img(v.img, '')}</div>
            <label class="btn btn-outline btn-sm file-btn">${icon('upload')} ${esc(t('admin.uploadImage'))}<input type="file" accept="image/*" data-img-file class="sr-only"></label>
            ${F({ name: 'imgKey', label: t('admin.orLibrary'), value: /^data:/.test(v.img) ? '' : v.img, options: [{ value: '', label: '—' }].concat(OZ.IMAGE_LIBRARY.map(k => ({ value: k, label: k }))) })}
            <p class="err" data-img-err role="alert"></p>
          </div>
          <div class="pform-main">
            <div class="grid-3">
              ${F({ name: 'sku', label: 'SKU', required: true, value: v.sku })}
              ${F({ name: 'type', label: t('spec.type'), value: v.type, options: OZ.TYPES.map(x => ({ value: x, label: t('type.' + x) })) })}
              ${F({ name: 'family', label: t('filter.family'), value: v.family || '', options: [{ value: '', label: '—' }].concat(OZ.FAMILIES.map(x => ({ value: x, label: t('family.' + x) }))) })}
            </div>
            <div class="grid-4">
              ${F({ name: 'compareAt', label: t('admin.origPrice'), type: 'number', value: v.compareAt || '', attrs: 'min="0" step="1"' })}
              ${F({ name: 'discount', label: t('admin.discountPct'), type: 'number', value: OZ.discountPct(v) || '', attrs: 'min="0" max="95" step="1"' })}
              ${F({ name: 'price', label: t('admin.salePrice'), type: 'number', required: true, value: v.price || '', attrs: 'min="1" step="1"' })}
              ${F({ name: 'stock', label: t('admin.stock'), type: 'number', required: true, value: v.stock, attrs: 'min="0" step="1"' })}
            </div>
            <div class="flag-row">
              ${[['active', t('admin.availableOnline')], ['bestSeller', t('badge.best')], ['aromaDeal', t('nav.aromaDeals')], ['giftable', t('admin.giftable')], ['isNew', t('badge.new')]].map(([k, l]) => `<label class="check"><input type="checkbox" name="${k}" ${v[k] !== false && (k === 'active' || v[k]) ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(l)}</span></label>`).join('')}
            </div>
          </div>
        </div>
        ${langTabs('name', t('admin.name'))}
        ${langTabs('tagline', t('admin.tagline'))}
        ${langTabs('desc', t('pdp.tab.desc'), 'textarea')}
        ${langTabs('ideal', t('spec.idealFor'))}
        <fieldset class="fs"><legend>${esc(t('pdp.tab.notes'))}</legend><p class="hint">${esc(t('admin.notesHint'))}</p><div class="grid-3">
          ${['top', 'heart', 'base'].map(l => F({ name: 'notes_' + l, label: t('notes.' + l), value: v.notes[l].join(', ') })).join('')}
        </div></fieldset>
        <fieldset class="fs"><legend>${esc(t('pdp.tab.details'))}</legend><div class="grid-3">
          ${F({ name: 'sizes', label: t('admin.sizes'), value: v.sizes.map(s => `${s.ml}:${s.delta}`).join(', '), hint: esc(t('admin.sizesHint')), required: true })}
          ${F({ name: 'line', label: t('admin.line'), value: v.line || '', options: [{ value: '', label: '—' }, { value: 'signature', label: t('home.oilsTitle') }, { value: 'hotel', label: t('home.hotelTitle') }] })}
        </div>
        ${F({ name: 'specs', label: t('admin.specs'), type: 'textarea', rows: 6, value: v.specs.map(specToLine).join('\n'), hint: esc(t('admin.specsHint')) })}
        <p class="lbl">${esc(t('filter.space'))}</p><div class="flag-row">${OZ.SPACES.map(s => `<label class="check"><input type="checkbox" name="space_${s}" ${v.spaces.includes(s) ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('space.' + s))}</span></label>`).join('')}</div>
        <p class="lbl">${esc(t('admin.features'))}</p><div class="flag-row">${feats.map(f => `<label class="check"><input type="checkbox" name="feat_${f}" ${v.features.includes(f) ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${icon(f)} ${esc(t('feat.' + f))}</span></label>`).join('')}</div>
        </fieldset>
        <div class="btn-row end sticky-actions"><button type="button" class="btn btn-ghost" data-ov-close>${esc(t('common.cancel'))}</button><button class="btn btn-primary" type="submit">${esc(t('common.save'))}</button></div>
      </form>`,
      onMount(o) {
        const f = o.el.querySelector('form');
        const prev = f.querySelector('[data-img-prev]'), err = f.querySelector('[data-img-err]');
        let img = v.img;
        f.querySelector('[data-img-file]').addEventListener('change', e => {
          const file = e.target.files[0]; if (!file) return;
          err.textContent = ''; prev.classList.add('loading');
          downscale(file).then(url => { img = url; prev.innerHTML = `<img src="${url}" alt="">`; f.elements.imgKey.value = ''; })
            .catch(er => { err.textContent = t('err.' + er.code); }).finally(() => prev.classList.remove('loading'));
        });
        f.elements.imgKey.addEventListener('change', e => { if (e.target.value) { img = e.target.value; prev.innerHTML = OZ.ui.img(img, ''); } });
        /* keep price / discount / original price consistent */
        const num = n => parseFloat(f.elements[n].value) || 0;
        f.elements.discount.addEventListener('input', () => { if (num('compareAt')) f.elements.price.value = Math.round(num('compareAt') * (1 - num('discount') / 100)); });
        f.elements.price.addEventListener('input', () => { if (num('compareAt') > num('price')) f.elements.discount.value = Math.round((1 - num('price') / num('compareAt')) * 100); else f.elements.discount.value = ''; });
        f.elements.compareAt.addEventListener('input', () => { if (num('discount')) f.elements.price.value = Math.round(num('compareAt') * (1 - num('discount') / 100)); });

        f.addEventListener('submit', e => {
          e.preventDefault();
          const sizesOk = val => String(val).split(',').every(s => /^\s*\d+\s*:\s*-?\d+\s*$/.test(s)) ? '' : t('admin.sizesErr');
          const d = OZ.ui.validate(f, {
            sku: [V.required], name_en: [V.required], tagline_en: [V.required], desc_en: [V.required, V.min(20)],
            price: [V.required, x => +x > 0 ? '' : t('admin.priceErr')], compareAt: [(x, all) => !x || +x >= +all.price ? '' : t('admin.compareErr')],
            stock: [V.required, x => Number.isInteger(+x) && +x >= 0 ? '' : t('admin.stockErr')], sizes: [V.required, sizesOk]
          });
          if (!d) return;
          const L = ['en', 'es', 'ar'];
          const rec = Object.assign(v, {
            sku: d.sku.trim(), img, type: d.type, family: d.family || null, line: d.line || '',
            price: +d.price, compareAt: +d.compareAt || 0, stock: +d.stock,
            active: !!d.active, bestSeller: !!d.bestSeller, aromaDeal: !!d.aromaDeal, giftable: !!d.giftable, isNew: !!d.isNew,
            name: Object.fromEntries(L.map(l => [l, (d['name_' + l] || '').trim()])),
            tagline: Object.fromEntries(L.map(l => [l, (d['tagline_' + l] || '').trim()])),
            desc: Object.fromEntries(L.map(l => [l, (d['desc_' + l] || '').trim()])),
            ideal: Object.fromEntries(L.map(l => [l, (d['ideal_' + l] || '').trim()])),
            notes: Object.fromEntries(['top', 'heart', 'base'].map(l => [l, (d['notes_' + l] || '').split(',').map(s => s.trim()).filter(Boolean)])),
            sizes: d.sizes.split(',').map(s => { const [ml, delta] = s.split(':').map(x => parseInt(x, 10)); return { id: String(ml), ml, delta }; }),
            spaces: OZ.SPACES.filter(s => d['space_' + s]),
            features: OZ.FEATURES.filter(x => d['feat_' + x]),
            specs: String(d.specs || '').split('\n').map(l => l.trim()).filter(l => l.includes(':')).map(lineToSpec)
          });
          if (!rec.spaces.length) rec.spaces = ['home'];
          const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
          S.admin.saveProduct(rec).then(() => { o.close(); done(); OZ.ui.toast(t(isNew ? 'admin.productAdded' : 'admin.productSaved'), 'success'); })
            .catch(er => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, er.code === 'unknown' ? t('err.storage') : OZ.ui.errorText(er)); });
        });
      }
    });
    return ov;
  }

  /* ---------- categories (collection membership) ---------- */
  SECTIONS.categories = body => {
    const flags = [['bestSeller', t('home.bestTitle')], ['aromaDeal', t('nav.aromaDeals')], ['giftable', t('nav.gifts')], ['isNew', t('badge.new')], ['active', t('admin.availableOnline')]];
    const render = () => {
      body.innerHTML = `<div class="tiles-stat">${OZ.TYPES.map(ty => tile(t('type.' + ty + '.plural'), allProducts().filter(p => p.type === ty).length, '', 'layers')).join('')}</div>
        <div class="card"><h2 class="card-h">${esc(t('admin.collections'))}</h2><p class="muted small">${esc(t('admin.collectionsHint'))}</p>
        ${table([{ label: t('admin.product') }, { label: t('spec.type') }].concat(flags.map(([, l]) => ({ label: l, cls: 'center' }))).concat([{ label: t('nav.crazyDeals'), cls: 'center' }]),
          allProducts().map(p => `<tr><td>${esc(p.name.en)}</td><td>${esc(t('type.' + p.type))}</td>${flags.map(([k, l]) => `<td class="center"><label class="check solo"><input type="checkbox" data-flag="${k}" data-id="${p.id}" ${(k === 'active' ? p.active !== false : p[k]) ? 'checked' : ''} aria-label="${esc(l)} — ${esc(p.name.en)}"><span class="box" aria-hidden="true">${icon('check')}</span></label></td>`).join('')}<td class="center">${OZ.discountPct(p) >= 25 ? icon('check') : '<span class="muted">—</span>'}</td></tr>`))}
        </div>`;
    };
    body.addEventListener('change', e => {
      const cb = e.target.closest('[data-flag]'); if (!cb) return;
      const p = Object.assign({}, S.db.products.find(x => x.id === cb.dataset.id)); p[cb.dataset.flag] = cb.checked;
      cb.disabled = true;
      S.admin.saveProduct(p).then(() => { cb.disabled = false; OZ.ui.toast(t('admin.saved'), 'success'); }).catch(er => { cb.disabled = false; cb.checked = !cb.checked; OZ.ui.toast(OZ.ui.errorText(er), 'error'); });
    });
    render();
  };

  /* ---------- orders ---------- */
  SECTIONS.orders = (body, sub) => {
    if (sub) return orderView(body, sub);
    let filter = 'all', q = '';
    const render = () => {
      const list = S.db.orders.filter(o => (filter === 'all' || o.status === filter) && (!q || (o.id + ' ' + o.email + ' ' + o.shipping.firstName + ' ' + o.shipping.lastName).toLowerCase().includes(q.toLowerCase())));
      $('[data-olist]', body).innerHTML = table([{ label: t('order.number') }, { label: t('order.date') }, { label: t('admin.customer') }, { label: t('admin.items'), cls: 'num' }, { label: t('order.payment') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }],
        list.map(o => `<tr><td><a href="#/admin/orders/${o.id}">${esc(o.id)}</a>${o.items.some(i => i.gift) ? ` ${icon('gift', 'muted')}` : ''}</td><td>${OZ.ui.date(o.date)}</td><td>${esc(o.shipping.firstName + ' ' + o.shipping.lastName)}<br><span class="muted small">${esc(o.email)}</span></td><td class="num">${o.items.reduce((a, i) => a + i.qty, 0)}</td><td><span class="status pay-${o.payment.status}">${esc(t('paystatus.' + o.payment.status))}</span></td><td>${statusPill(o.status)}</td><td class="num">${aed(o.totals.total)}</td></tr>`), { empty: t('order.noneTitle'), caption: t('admin.orders') });
    };
    body.innerHTML = toolbar(`<label class="search-inline">${icon('search')}<span class="sr-only">${esc(t('admin.searchOrders'))}</span><input type="search" data-oq placeholder="${esc(t('admin.searchOrders'))}"></label>
      <div class="seg" role="group" aria-label="${esc(t('order.status'))}">${['all'].concat(STATUSES).map(s => `<button class="seg-btn${s === filter ? ' on' : ''}" data-of="${s}" aria-pressed="${s === filter}">${esc(s === 'all' ? t('admin.all') : t('status.' + s))}</button>`).join('')}</div>`) + `<div data-olist></div>`;
    body.addEventListener('click', e => { const b = e.target.closest('[data-of]'); if (b) { filter = b.dataset.of; $$('[data-of]', body).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); render(); } });
    $('[data-oq]', body).addEventListener('input', OZ.ui.debounce(e => { q = e.target.value; render(); }, 200));
    render();
  };

  function orderView(body, id) {
    const o = S.order(id);
    if (!o) { body.innerHTML = C.empty({ ic: 'box', title: t('order.notFound'), actions: `<a class="btn btn-primary" href="#/admin/orders">${esc(t('order.back'))}</a>` }); return; }
    const cust = S.db.users[o.user || o.email];
    body.innerHTML = `<a class="link-arrow back" href="#/admin/orders">${icon('arrowRight', 'flip rot')} ${esc(t('order.back'))}</a>
      <div class="adm-order-head card">
        <form class="status-form" data-status-form>
          <label for="ostatus">${esc(t('admin.updateStatus'))}</label>
          <select id="ostatus" name="status">${STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${esc(t('status.' + s))}</option>`).join('')}</select>
          <button class="btn btn-primary btn-sm" type="submit">${esc(t('common.save'))}</button>
        </form>
        <div><p class="muted small">${esc(t('admin.customer'))}</p><p><strong>${esc(o.shipping.firstName + ' ' + o.shipping.lastName)}</strong><br>${esc(o.email)}<br><span dir="ltr">${esc(o.shipping.phone)}</span><br>${cust ? `<span class="status status-delivered">${esc(t('admin.registered'))}</span>` : `<span class="status status-placed">${esc(t('admin.guest'))}</span>`}</p></div>
      </div>
      ${OZ.orderDetail(o, { inAccount: true })}
      <div class="card"><h2 class="card-h">${esc(t('admin.timeline'))}</h2><ul class="timeline">${o.timeline.slice().reverse().map(e => `<li>${statusPill(e.status)} <span class="muted small">${OZ.ui.date(e.date, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></li>`).join('')}</ul></div>`;
    $('[data-status-form]', body).addEventListener('submit', e => {
      e.preventDefault();
      const s = e.target.elements.status.value; if (s === o.status) return;
      const btn = e.target.querySelector('button'); OZ.ui.busy(btn, true);
      S.admin.setOrderStatus(o.id, s).then(() => { OZ.ui.toast(t('admin.statusUpdated', { status: t('status.' + s) }), 'success'); orderView(body, id); })
        .catch(er => { OZ.ui.busy(btn, false); OZ.ui.toast(OZ.ui.errorText(er), 'error'); });
    });
  }

  /* ---------- customers ---------- */
  SECTIONS.customers = body => {
    const users = Object.values(S.db.users).filter(u => u.role !== 'admin');
    body.innerHTML = table([{ label: t('form.fullName') }, { label: t('form.email') }, { label: t('admin.verified') }, { label: t('account.orders'), cls: 'num' }, { label: t('admin.spent'), cls: 'num' }, { label: t('account.addresses'), cls: 'num' }, { label: t('account.dates'), cls: 'num' }, { label: t('admin.joined') }],
      users.map(u => { const os = S.db.orders.filter(o => o.user === u.email || o.email === u.email); return `<tr><td>${esc(u.name || '—')}</td><td>${esc(u.email)}</td><td>${u.verified ? `<span class="status status-delivered">${esc(t('admin.yes'))}</span>` : `<span class="status status-processing">${esc(t('admin.no'))}</span>`}</td><td class="num">${os.length}</td><td class="num">${aed(os.reduce((a, o) => a + o.totals.total, 0))}</td><td class="num">${u.addresses.length}</td><td class="num">${u.dates.length}</td><td>${OZ.ui.date(u.created)}</td></tr>`; }),
      { empty: t('admin.noCustomers'), caption: t('admin.customers') });
  };

  /* ---------- inventory ---------- */
  SECTIONS.inventory = body => {
    const render = () => {
      body.innerHTML = `<p class="muted">${esc(t('admin.inventoryHint'))}</p>` + table([{ label: '' }, { label: t('admin.product') }, { label: 'SKU' }, { label: t('admin.state') }, { label: t('admin.stock') }, { label: '' }],
        allProducts().slice().sort((a, b) => a.stock - b.stock).map(p => `<tr><td class="thumb">${OZ.ui.img(p.img, '')}</td><td>${esc(p.name.en)}</td><td><code>${esc(p.sku)}</code></td>
          <td>${p.stock <= 0 ? `<span class="status status-cancelled">${esc(t('stock.out'))}</span>` : p.stock <= 10 ? `<span class="status status-processing">${esc(t('admin.low'))}</span>` : `<span class="status status-delivered">${esc(t('stock.in'))}</span>`}</td>
          <td><form class="inv-form" data-inv="${p.id}"><label class="sr-only" for="inv-${p.id}">${esc(t('admin.stock'))} — ${esc(p.name.en)}</label><input id="inv-${p.id}" type="number" min="0" step="1" name="stock" value="${p.stock}"><button class="btn btn-sm btn-outline" type="submit">${esc(t('admin.update'))}</button></form></td>
          <td><button class="link-btn" data-restock="${p.id}">+25</button></td></tr>`), { caption: t('admin.inventory') });
    };
    const save = (id, stock, btn) => {
      const p = Object.assign({}, S.db.products.find(x => x.id === id), { stock: Math.max(0, stock) });
      OZ.ui.busy(btn, true);
      S.admin.saveProduct(p).then(() => { render(); OZ.ui.toast(t('admin.stockSaved', { name: p.name.en, n: p.stock }), 'success'); const i = $('#inv-' + id, body); i && i.focus(); })
        .catch(er => { OZ.ui.busy(btn, false); OZ.ui.toast(OZ.ui.errorText(er), 'error'); });
    };
    body.addEventListener('submit', e => { const f = e.target.closest('[data-inv]'); if (!f) return; e.preventDefault(); const v = parseInt(f.elements.stock.value, 10); if (isNaN(v) || v < 0) { OZ.ui.toast(t('admin.stockErr'), 'error'); return; } save(f.dataset.inv, v, f.querySelector('button')); });
    body.addEventListener('click', e => { const b = e.target.closest('[data-restock]'); if (b) save(b.dataset.restock, S.db.products.find(x => x.id === b.dataset.restock).stock + 25, b); });
    render();
  };

  /* ---------- payments ---------- */
  SECTIONS.payments = body => {
    const os = S.db.orders;
    const sum = m => os.filter(o => o.payment.method === m && o.payment.status === 'paid').reduce((a, o) => a + o.totals.total, 0);
    body.innerHTML = `<div class="tiles-stat">${tile(t('pay.card'), aed(sum('card')), esc(t('admin.nPayments', { n: os.filter(o => o.payment.method === 'card').length })), 'card')}${tile(t('pay.crypto'), aed(sum('crypto')), esc(t('admin.nPayments', { n: os.filter(o => o.payment.method === 'crypto').length })), 'crypto')}${tile(t('paystatus.refunded'), os.filter(o => o.payment.status === 'refunded').length, '', 'refresh')}</div>
      <div class="alert alert-info">${icon('shield')}<span>${esc(t('admin.paymentsNote'))}</span></div>` +
      table([{ label: t('order.number') }, { label: t('order.date') }, { label: t('pay.method') }, { label: t('admin.reference') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }],
        os.map(o => `<tr><td><a href="#/admin/orders/${o.id}">${esc(o.id)}</a></td><td>${OZ.ui.date(o.date)}</td><td>${icon(o.payment.method === 'crypto' ? 'crypto' : 'card')} ${esc(o.payment.method === 'crypto' ? t('pay.crypto') : t('pay.brand.' + (o.payment.brand || 'card')))}</td><td>${o.payment.method === 'crypto' ? esc(o.payment.coin) : '•••• ' + esc(o.payment.last4)}</td><td><span class="status pay-${o.payment.status}">${esc(t('paystatus.' + o.payment.status))}</span></td><td class="num">${aed(o.totals.total)}</td></tr>`), { caption: t('admin.payments') });
  };

  /* ---------- coupons ---------- */
  SECTIONS.coupons = body => {
    const render = () => {
      body.innerHTML = toolbar(`<span></span><button class="btn btn-primary" data-new-c>${icon('plus')} ${esc(t('admin.addCoupon'))}</button>`) +
        table([{ label: t('admin.code') }, { label: t('admin.ctype') }, { label: t('admin.value'), cls: 'num' }, { label: t('admin.minOrder'), cls: 'num' }, { label: t('admin.note') }, { label: t('order.status') }, { label: '' }],
          S.db.coupons.map(c => `<tr><td><code>${esc(c.code)}</code></td><td>${esc(t('admin.ctype.' + c.type))}</td><td class="num">${c.type === 'percent' ? c.value + '%' : c.type === 'fixed' ? aed(c.value) : '—'}</td><td class="num">${c.min ? aed(c.min) : '—'}</td><td>${esc(c.note || '')}</td><td>${c.active ? `<span class="status status-delivered">${esc(t('admin.active'))}</span>` : `<span class="status status-cancelled">${esc(t('admin.inactive'))}</span>`}</td><td class="acts"><button class="icon-btn" data-edit-c="${esc(c.code)}" aria-label="${esc(t('common.edit'))} ${esc(c.code)}">${icon('edit')}</button><button class="icon-btn danger" data-del-c="${esc(c.code)}" aria-label="${esc(t('common.delete'))} ${esc(c.code)}">${icon('trash')}</button></td></tr>`),
          { caption: t('admin.coupons') });
    };
    const form = c => OZ.ui.overlay({
      title: esc(c ? t('admin.editCoupon') : t('admin.addCoupon')), size: 'md',
      body: `<form novalidate>
        <div class="grid-2">${OZ.ui.field({ name: 'code', label: t('admin.code'), required: true, value: c ? c.code : '', attrs: 'style="text-transform:uppercase"' })}
        ${OZ.ui.field({ name: 'type', label: t('admin.ctype'), value: c ? c.type : 'percent', options: ['percent', 'fixed', 'ship'].map(x => ({ value: x, label: t('admin.ctype.' + x) })) })}</div>
        <div class="grid-2">${OZ.ui.field({ name: 'value', label: t('admin.value'), type: 'number', value: c ? c.value : 10, attrs: 'min="0"' })}
        ${OZ.ui.field({ name: 'min', label: t('admin.minOrder') + ' (AED)', type: 'number', value: c ? c.min : 0, attrs: 'min="0"' })}</div>
        ${OZ.ui.field({ name: 'note', label: t('admin.note'), value: c ? c.note : '' })}
        <label class="check"><input type="checkbox" name="active" ${!c || c.active ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('admin.active'))}</span></label>
        <div class="btn-row end"><button type="button" class="btn btn-ghost" data-ov-close>${esc(t('common.cancel'))}</button><button class="btn btn-primary" type="submit">${esc(t('common.save'))}</button></div>
      </form>`,
      onMount(o) {
        const f = o.el.querySelector('form');
        f.addEventListener('submit', e => {
          e.preventDefault();
          const d = OZ.ui.validate(f, { code: [V.required, x => /^[A-Za-z0-9_-]{3,20}$/.test(x.trim()) ? '' : t('admin.codeErr')], value: [(x, all) => all.type === 'ship' || (+x > 0 && (all.type !== 'percent' || +x <= 90)) ? '' : t('admin.valueErr')] });
          if (!d) return;
          const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true);
          S.admin.saveCoupon({ code: d.code, type: d.type, value: +d.value || 0, min: +d.min || 0, note: (d.note || '').trim(), active: !!d.active }, c ? c.code : null)
            .then(() => { o.close(); render(); OZ.ui.toast(t('admin.saved'), 'success'); })
            .catch(er => { OZ.ui.busy(btn, false); OZ.ui.setError(f.elements.code, er.code === 'exists' ? t('admin.codeExists') : OZ.ui.errorText(er)); });
        });
      }
    });
    body.addEventListener('click', e => {
      if (e.target.closest('[data-new-c]')) form(null);
      const ed = e.target.closest('[data-edit-c]'); if (ed) form(S.db.coupons.find(c => c.code === ed.dataset.editC));
      const dl = e.target.closest('[data-del-c]'); if (dl) OZ.ui.confirm(t('admin.confirmDeleteCoupon', { code: dl.dataset.delC }), { confirmLabel: t('common.delete') }).then(ok => { if (ok) S.admin.deleteCoupon(dl.dataset.delC).then(render); });
    });
    render();
  };

  /* ---------- reviews ---------- */
  SECTIONS.reviews = body => {
    let filter = S.db.reviews.some(r => r.status === 'pending') ? 'pending' : 'all';
    const render = () => {
      const list = S.db.reviews.filter(r => filter === 'all' || r.status === filter);
      body.innerHTML = toolbar(`<div class="seg" role="group" aria-label="${esc(t('order.status'))}">${['pending', 'approved', 'rejected', 'all'].map(s => `<button class="seg-btn${s === filter ? ' on' : ''}" data-rf="${s}" aria-pressed="${s === filter}">${esc(s === 'all' ? t('admin.all') : t('rstatus.' + s))} <span class="muted">(${s === 'all' ? S.db.reviews.length : S.db.reviews.filter(r => r.status === s).length})</span></button>`).join('')}</div>`) +
        (list.length ? `<ul class="adm-reviews">${list.map(r => { const p = S.db.products.find(x => x.id === r.productId); return `<li class="card">
          <div class="row-between"><div>${OZ.ui.stars(r.rating)} <strong>${esc(r.title)}</strong></div><span class="status rs-${r.status}">${esc(t('rstatus.' + r.status))}</span></div>
          <p>${esc(r.body)}</p>
          <p class="muted small">${esc(r.name)}${r.email ? ` · ${esc(r.email)}` : ''} · ${p ? esc(p.name.en) : r.productId} · ${OZ.ui.date(r.date)}${r.verified ? ` · ${esc(t('reviews.verified'))}` : ''}</p>
          <div class="btn-row">${r.status !== 'approved' ? `<button class="btn btn-sm btn-teal" data-mod="approved" data-id="${r.id}">${icon('check')} ${esc(t('admin.approve'))}</button>` : ''}${r.status !== 'rejected' ? `<button class="btn btn-sm btn-outline" data-mod="rejected" data-id="${r.id}">${esc(t('admin.reject'))}</button>` : ''}<button class="btn btn-sm btn-ghost danger" data-mod="delete" data-id="${r.id}">${icon('trash')} ${esc(t('common.delete'))}</button></div>
        </li>`; }).join('')}</ul>` : C.empty({ ic: 'star', title: t('admin.noReviews') }));
    };
    body.addEventListener('click', e => {
      const f = e.target.closest('[data-rf]'); if (f) { filter = f.dataset.rf; render(); }
      const m = e.target.closest('[data-mod]');
      if (m) { OZ.ui.busy(m, true); S.admin.moderateReview(m.dataset.id, m.dataset.mod).then(() => { render(); OZ.ui.toast(t('admin.reviewUpdated'), 'success'); }); }
    });
    render();
  };

  /* ---------- gifts ---------- */
  SECTIONS.gifts = body => {
    const rows = [];
    S.db.orders.forEach(o => o.items.filter(i => i.gift).forEach(i => rows.push({ o, i })));
    body.innerHTML = table([{ label: t('order.number') }, { label: t('admin.product') }, { label: t('gift.recipient') }, { label: t('gift.message') }, { label: t('gift.packaging') }, { label: t('gift.deliveryDate') }, { label: t('order.status') }],
      rows.map(({ o, i }) => `<tr><td><a href="#/admin/orders/${o.id}">${esc(o.id)}</a></td><td>${esc(i.name)}</td><td>${esc(i.gift.recipientName)}${i.gift.recipientEmail ? `<br><span class="muted small">${esc(i.gift.recipientEmail)}</span>` : ''}</td><td class="wrap-text">${esc(i.gift.message || '—')}</td><td>${esc(t('gift.wrap.' + i.gift.wrap))}${i.gift.hidePrices ? `<br><span class="muted small">${esc(t('gift.pricesHidden'))}</span>` : ''}</td><td>${i.gift.deliveryDate ? OZ.ui.date(i.gift.deliveryDate) : '—'}</td><td>${statusPill(o.status)}</td></tr>`),
      { empty: t('admin.noGifts'), caption: t('admin.gifts') });
  };

  /* ---------- special dates ---------- */
  SECTIONS.dates = body => {
    const rows = [];
    const today = new Date(new Date().toDateString());
    Object.values(S.db.users).forEach(u => u.dates.forEach(d => {
      const dt = new Date(d.date + 'T00:00:00'); const n = new Date(today.getFullYear(), dt.getMonth(), dt.getDate()); if (n < today) n.setFullYear(n.getFullYear() + 1);
      rows.push({ u, d, n, days: Math.round((n - today) / 864e5) });
    }));
    rows.sort((a, b) => a.n - b.n);
    const due = rows.filter(r => r.d.reminder && r.days <= 14).length;
    body.innerHTML = `<div class="tiles-stat">${tile(t('admin.datesTotal'), rows.length, '', 'calendar')}${tile(t('admin.remindersOn'), rows.filter(r => r.d.reminder).length, '', 'bell')}${tile(t('admin.dueSoon'), due, esc(t('admin.dueSoonSub')), 'clock')}</div>
      <div class="alert alert-info">${icon('info')}<span>${esc(t('admin.datesNote'))}</span></div>` +
      table([{ label: t('admin.customer') }, { label: t('dates.person') }, { label: t('dates.occasion') }, { label: t('admin.nextDate') }, { label: t('dates.reminders') }, { label: t('dates.method') }],
        rows.map(({ u, d, n, days }) => `<tr><td>${esc(u.email)}</td><td>${esc(d.name)}</td><td>${esc(d.occasion === 'custom' ? d.label : t('occ.' + d.occasion))}</td><td>${OZ.ui.date(n)} <span class="muted small">(${esc(t('dates.inDays', { n: days }))})</span></td><td>${d.reminder ? `<span class="status status-delivered">${esc(t('dates.timing.' + d.timing))}</span>` : `<span class="status status-cancelled">${esc(t('admin.off'))}</span>`}</td><td>${esc(t('dates.via.' + d.method))}</td></tr>`),
        { empty: t('dates.noneTitle'), caption: t('admin.dates') });
  };

  /* ---------- translations ---------- */
  SECTIONS.translations = body => {
    let q = '';
    const keys = Object.keys(OZ.I18N.en).sort();
    const render = () => {
      const list = keys.filter(k => !q || k.toLowerCase().includes(q) || ['en', 'es', 'ar'].some(l => String(OZ.t.raw(l, k)).toLowerCase().includes(q))).slice(0, 60);
      $('[data-tlist]', body).innerHTML = `<p class="muted small">${esc(t('admin.showingN', { n: list.length, total: keys.length }))}</p>` + table([{ label: t('admin.key') }, { label: 'English' }, { label: 'Español' }, { label: 'العربية' }],
        list.map(k => `<tr><td><code class="small">${esc(k)}</code></td>${['en', 'es', 'ar'].map(l => `<td><label class="sr-only" for="tr-${l}-${esc(k)}">${esc(k)} (${l})</label><textarea id="tr-${l}-${esc(k)}" class="tr-in${S.db.translations[l] && S.db.translations[l][k] != null ? ' overridden' : ''}" rows="2" data-tk="${esc(k)}" data-tl="${l}" ${l === 'ar' ? 'dir="rtl"' : ''}>${esc(OZ.t.raw(l, k))}</textarea></td>`).join('')}</tr>`), { caption: t('admin.translations') });
    };
    body.innerHTML = toolbar(`<label class="search-inline">${icon('search')}<span class="sr-only">${esc(t('admin.searchKeys'))}</span><input type="search" data-tq placeholder="${esc(t('admin.searchKeys'))}"></label>`) + `<p class="muted small">${esc(t('admin.translationsHint'))}</p><div data-tlist></div>`;
    $('[data-tq]', body).addEventListener('input', OZ.ui.debounce(e => { q = e.target.value.toLowerCase(); render(); }, 250));
    body.addEventListener('change', e => {
      const ta = e.target.closest('[data-tk]'); if (!ta) return;
      const base = (OZ.I18N[ta.dataset.tl] || {})[ta.dataset.tk];
      const val = ta.value === base ? '' : ta.value;
      S.admin.saveTranslation(ta.dataset.tl, ta.dataset.tk, val).then(() => { ta.classList.toggle('overridden', !!val); OZ.ui.toast(t('admin.saved'), 'success'); });
    });
    render();
  };

  /* ---------- settings ---------- */
  SECTIONS.settings = body => {
    const s = S.settings();
    body.innerHTML = `<form class="card form-card" data-set novalidate>
        <h2 class="card-h">${esc(t('admin.shippingTax'))}</h2>
        <div class="grid-4">
          ${OZ.ui.field({ name: 'freeShippingThreshold', label: t('admin.freeShip'), type: 'number', value: s.freeShippingThreshold, attrs: 'min="0"' })}
          ${OZ.ui.field({ name: 'shippingFee', label: t('admin.shipFee'), type: 'number', value: s.shippingFee, attrs: 'min="0"' })}
          ${OZ.ui.field({ name: 'expressFee', label: t('admin.expressFee'), type: 'number', value: s.expressFee, attrs: 'min="0"' })}
          ${OZ.ui.field({ name: 'vatRate', label: t('admin.vat'), type: 'number', value: s.vatRate, attrs: 'min="0" max="30" step="0.5"' })}
        </div>
        <h2 class="card-h">${esc(t('gift.packaging'))} (AED)</h2>
        <div class="grid-3">${['standard', 'premium', 'luxury'].map(w => OZ.ui.field({ name: 'wrap_' + w, label: t('gift.wrap.' + w), type: 'number', value: s.giftWrap[w], attrs: 'min="0"' })).join('')}</div>
        <h2 class="card-h">${esc(t('admin.storefront'))}</h2>
        <label class="switch-row"><span>${esc(t('admin.cryptoOn'))}</span><span class="switch"><input type="checkbox" role="switch" name="cryptoEnabled" ${s.cryptoEnabled ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
        <label class="switch-row"><span>${esc(t('admin.annOn'))}</span><span class="switch"><input type="checkbox" role="switch" name="announcement" ${s.announcement ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
        <div class="btn-row"><button class="btn btn-primary" type="submit">${esc(t('common.saveChanges'))}</button></div>
      </form>
      <div class="card form-card danger-zone"><h2 class="card-h">${esc(t('admin.demoData'))}</h2><p class="muted">${esc(t('admin.demoDataText'))}</p><button class="btn btn-danger" data-reset>${icon('refresh')} ${esc(t('admin.resetDemo'))}</button></div>`;
    const f = $('[data-set]', body);
    f.addEventListener('submit', e => {
      e.preventDefault();
      const nonNeg = x => x !== '' && +x >= 0 ? '' : t('admin.nonNeg');
      const d = OZ.ui.validate(f, { freeShippingThreshold: [nonNeg], shippingFee: [nonNeg], expressFee: [nonNeg], vatRate: [nonNeg], wrap_standard: [nonNeg], wrap_premium: [nonNeg], wrap_luxury: [nonNeg] });
      if (!d) return;
      const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
      S.admin.saveSettings({ freeShippingThreshold: +d.freeShippingThreshold, shippingFee: +d.shippingFee, expressFee: +d.expressFee, vatRate: +d.vatRate, giftWrap: { standard: +d.wrap_standard, premium: +d.wrap_premium, luxury: +d.wrap_luxury }, cryptoEnabled: !!d.cryptoEnabled, announcement: !!d.announcement })
        .then(() => { OZ.ui.busy(btn, false); OZ.ui.toast(t('admin.saved'), 'success'); })
        .catch(er => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, OZ.ui.errorText(er)); });
    });
    $('[data-reset]', body).addEventListener('click', () => OZ.ui.confirm(t('admin.resetConfirm'), { confirmLabel: t('admin.resetDemo') }).then(ok => { if (ok) S.admin.resetDemo(); }));
  };
})();
