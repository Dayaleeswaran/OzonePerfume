/* Ozone Perfume — about, contact, policies, not-found. */
(function () {
  const { esc, icon, $ } = OZ.ui;
  const S = OZ.store, C = OZ.c;
  const t = (k, v) => OZ.t(k, v);
  const P = OZ.pages = OZ.pages || {};
  const B = OZ.BRAND;

  P.about = () => ({
    title: t('nav.about'),
    html: `${C.breadcrumb([['#/', t('nav.home')], [null, t('nav.about')]])}
      <section class="about-hero">
        <div class="about-media">${OZ.ui.img('o10', '', { size: 'lg', eager: true, sizes: '100vw' })}</div>
        <div class="container about-hero-in"><p class="eyebrow">${esc(t('about.eyebrow'))}</p><h1 class="page-title left">${esc(t('about.title'))}</h1><p class="lead">${esc(t('about.lead'))}</p></div>
      </section>
      <section class="section container about-grid">
        <div class="reveal"><h2 class="sec-title left">${esc(t('about.storyTitle'))}</h2><p>${esc(t('about.story1'))}</p><p>${esc(t('about.story2'))}</p></div>
        <div class="about-img reveal" style="--d:100ms">${OZ.ui.img('o3', '')}</div>
      </section>
      <section class="section values-sec"><div class="container">
        ${C.sectionHead(t('about.valuesTitle'))}
        <ul class="values">${[['leaf', 'v1'], ['app', 'v2'], ['users', 'v3'], ['warranty', 'v4']].map(([ic, k], i) => `<li class="card reveal" style="--d:${i * 80}ms">${icon(ic)}<h3>${esc(t('about.' + k + '.t'))}</h3><p>${esc(t('about.' + k + '.d'))}</p></li>`).join('')}</ul>
      </div></section>
      <section class="section container about-grid rev">
        <div class="about-img reveal">${OZ.ui.img('o4', '')}</div>
        <div class="reveal" style="--d:100ms"><h2 class="sec-title left">${esc(t('about.whatTitle'))}</h2>
          <ul class="ticks lg"><li>${icon('check')}${esc(t('about.what1'))}</li><li>${icon('check')}${esc(t('about.what2'))}</li><li>${icon('check')}${esc(t('about.what3'))}</li><li>${icon('check')}${esc(t('about.what4'))}</li></ul>
          <div class="btn-row"><a class="btn btn-primary" href="#/shop/diffusers">${esc(t('hero.browse'))}</a><a class="btn btn-outline" href="#/contact">${esc(t('about.talk'))}</a></div>
        </div>
      </section>
      <section class="section company-sec"><div class="container">
        ${C.sectionHead(t('about.companyTitle'))}
        <dl class="company card reveal">
          <div><dt>${esc(t('about.c.name'))}</dt><dd>${esc(B.legalName)}</dd></div>
          <div><dt>${esc(t('about.c.business'))}</dt><dd>${esc(t('about.c.businessV'))}</dd></div>
          <div><dt>${esc(t('about.c.location'))}</dt><dd>${esc(t('brand.address'))}</dd></div>
          <div><dt>${esc(t('about.c.area'))}</dt><dd>${esc(t('about.c.areaV'))}</dd></div>
          <div><dt>${esc(t('about.c.web'))}</dt><dd><a href="https://${B.website}" target="_blank" rel="noopener">${esc(B.website)}</a></dd></div>
          <div><dt>${esc(t('about.c.contact'))}</dt><dd><a href="tel:${B.phoneRaw}" dir="ltr">${esc(B.phone)}</a> · <a href="tel:${B.phone2Raw}" dir="ltr">${esc(B.phone2)}</a><br><a href="mailto:${B.email}">${esc(B.email)}</a> · <a href="mailto:${B.salesEmail}">${esc(B.salesEmail)}</a></dd></div>
        </dl>
      </div></section>`
  });

  P.contact = () => {
    const bbox = '55.3500,25.2700,55.5300,25.3900';
    const topics = ['general', 'order', 'product', 'business', 'warranty'];
    const form = () => `<form class="card form-card contact-form" data-contact novalidate>
        <h2 class="card-h">${esc(t('contact.formTitle'))}</h2>
        <p class="muted small">${esc(t('contact.formSub'))}</p>
        <div class="grid-2">${OZ.ui.field({ name: 'name', label: t('form.fullName'), required: true, autocomplete: 'name', value: (S.user() || {}).name || '' })}
        ${OZ.ui.field({ name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email', value: (S.user() || {}).email || '' })}</div>
        <div class="grid-2">${OZ.ui.field({ name: 'phone', label: t('form.phone'), type: 'tel', autocomplete: 'tel', attrs: 'dir="ltr"' })}
        ${OZ.ui.field({ name: 'topic', label: t('contact.topic'), value: 'general', options: topics.map(x => ({ value: x, label: t('contact.topic.' + x) })) })}</div>
        ${OZ.ui.field({ name: 'message', label: t('contact.message'), type: 'textarea', required: true, rows: 5, attrs: 'maxlength="2000"' })}
        <button class="btn btn-primary btn-lg" type="submit">${icon('mail')} ${esc(t('contact.send'))}</button>
      </form>`;
    return {
      title: t('nav.contact'),
      html: `${C.breadcrumb([['#/', t('nav.home')], [null, t('nav.contact')]])}
        <section class="page-hero"><div class="container"><h1 class="page-title">${esc(t('contact.title'))}</h1><p class="page-sub">${esc(t('contact.sub'))}</p></div></section>
        <section class="container contact-grid">
          <div class="contact-info">
            <a class="c-card card" href="tel:${B.phoneRaw}">${icon('phone')}<span><strong>${esc(t('contact.call'))}</strong><span dir="ltr">${esc(B.phone)} · ${esc(B.phone2)}</span></span></a>
            <a class="c-card card" href="https://wa.me/${B.phoneRaw}" target="_blank" rel="noopener">${icon('whatsapp')}<span><strong>WhatsApp</strong><span>${esc(t('contact.waText'))}</span></span></a>
            <a class="c-card card" href="mailto:${B.email}">${icon('mail')}<span><strong>${esc(t('contact.email'))}</strong><span>${esc(B.email)}</span></span></a>
            <div class="c-card card">${icon('pin')}<span><strong>${esc(t('contact.visit'))}</strong><span>${esc(t('brand.address'))}</span></span></div>
            <a class="c-card card" href="mailto:${B.salesEmail}">${icon('briefcase')}<span><strong>${esc(t('contact.sales'))}</strong><span>${esc(B.salesEmail)}</span></span></a>
            <div class="socials big">${['instagram', 'facebook', 'tiktok'].map(s => `<a href="https://${s}.com" target="_blank" rel="noopener" aria-label="${s}">${icon(s)}</a>`).join('')}</div>
          </div>
          <div data-contact-host>${form()}</div>
        </section>
        <section class="container section-sm"><div class="map card">
          <iframe title="${esc(t('contact.mapTitle'))}" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik"></iframe>
          <a class="map-link" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(B.mapQuery)}" target="_blank" rel="noopener">${icon('pin')} ${esc(t('contact.openMap'))}</a>
        </div></section>`,
      mount(root) {
        const host = $('[data-contact-host]', root);
        const bind = () => {
          const f = $('[data-contact]', host);
          f.addEventListener('submit', e => {
            e.preventDefault();
            const d = OZ.ui.validate(f, { name: [OZ.ui.V.required, OZ.ui.V.min(2)], email: [OZ.ui.V.required, OZ.ui.V.email], phone: [OZ.ui.V.phone], message: [OZ.ui.V.required, OZ.ui.V.min(10)] });
            if (!d) return;
            const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('contact.sending'));
            OZ.ui.formAlert(f, '');
            S.sendMessage(d).then(() => {
              host.innerHTML = `<div class="card done-state" tabindex="-1">${icon('check', 'done-ic')}<h2>${esc(t('contact.successTitle'))}</h2><p>${esc(t('contact.successText', { email: d.email }))}</p><div class="btn-row center"><button class="btn btn-outline" data-again>${esc(t('contact.again'))}</button><a class="btn btn-primary" href="#/shop/diffusers">${esc(t('cart.continue'))}</a></div></div>`;
              host.firstElementChild.focus();
              OZ.ui.announce(t('contact.successTitle'));
              host.querySelector('[data-again]').onclick = () => { host.innerHTML = form(); bind(); };
            }).catch(err => {
              OZ.ui.busy(btn, false);
              OZ.ui.formAlert(f, t('contact.error') + ' ' + OZ.ui.errorText(err));
            });
          });
        };
        bind();
      }
    };
  };

  P.policy = (key) => {
    const keys = ['shipping', 'returns', 'privacy', 'terms'];
    if (!keys.includes(key)) return P.notFound();
    return {
      title: t('policy.' + key),
      html: `${C.breadcrumb([['#/', t('nav.home')], [null, t('policy.' + key)]])}
        <section class="container policy">
          <nav class="policy-nav" aria-label="${esc(t('policy.nav'))}"><ul>${keys.map(k => `<li><a href="#/policies/${k}" ${k === key ? 'aria-current="page" class="on"' : ''}>${esc(t('policy.' + k))}</a></li>`).join('')}</ul></nav>
          <article class="policy-body"><h1 class="page-title left">${esc(t('policy.' + key))}</h1>
            ${[1, 2, 3].map(i => `<h2>${esc(t(`pol.${key}.h${i}`, { fee: OZ.ui.money(S.settings().shippingFee), amount: OZ.ui.money(S.settings().freeShippingThreshold), express: OZ.ui.money(S.settings().expressFee) }))}</h2><p>${esc(t(`pol.${key}.p${i}`, { fee: OZ.ui.money(S.settings().shippingFee), amount: OZ.ui.money(S.settings().freeShippingThreshold), express: OZ.ui.money(S.settings().expressFee), email: B.email }))}</p>`).join('')}
            <p class="muted small">${esc(t('policy.questions'))} <a href="#/contact">${esc(t('nav.contact'))}</a></p>
          </article>
        </section>`
    };
  };

  P.notFound = (msg) => ({
    title: t('nf.title'),
    html: `<section class="container section">${C.empty({ ic: 'search', title: msg || t('nf.title'), text: t('nf.text'), actions: `<a class="btn btn-primary" href="#/">${esc(t('nav.home'))}</a><button class="btn btn-outline" data-action="open-search">${icon('search')} ${esc(t('search.open'))}</button>` })}</section>`
  });
})();
