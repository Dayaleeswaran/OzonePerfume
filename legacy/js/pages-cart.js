/* Ozone Perfume — cart, gifting, checkout, payment and order confirmation. */
(function () {
  const { esc, icon, money, $, $$ } = OZ.ui;
  const S = OZ.store, C = OZ.c;
  const t = (k, v) => OZ.t(k, v);
  const P = OZ.pages = OZ.pages || {};

  const COUNTRIES = ['AE', 'SA', 'OM', 'QA', 'BH', 'KW', 'GB', 'US', 'ES', 'OTHER'];

  /* =====================================================================
     GIFT FLOW
     ===================================================================== */
  OZ.gift = {
    open({ productId, sizeId, qty = 1, lineId }) {
      const p = S.product(productId); if (!p) return;
      const existing = lineId ? (S.cart().find(l => l.id === lineId) || {}).gift : null;
      const g = existing || { recipientName: '', recipientEmail: '', message: '', wrap: 'premium', deliveryDate: '', hidePrices: true };
      const wraps = S.settings().giftWrap;
      const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      const ov = OZ.ui.overlay({
        title: `${icon('gift')} ${esc(t('gift.title'))}`, size: 'md', className: 'gift-ov',
        body: `<div class="gift-prod">${OZ.ui.img(p.img, '')}<div><strong>${esc(OZ.pname(p))}</strong><span class="muted">${esc(t('size.ml', { n: S.size(p, sizeId).ml }))} · ${money(S.unitPrice(p, sizeId))}${lineId ? '' : ` × ${qty}`}</span></div></div>
          <form data-gift-form novalidate>
            <fieldset class="fs"><legend>${esc(t('gift.recipient'))}</legend>
              <div class="grid-2">${OZ.ui.field({ name: 'recipientName', label: t('gift.recipientName'), required: true, value: g.recipientName, autocomplete: 'off' })}
              ${OZ.ui.field({ name: 'recipientEmail', label: t('gift.recipientEmail'), type: 'email', value: g.recipientEmail, hint: esc(t('gift.recipientEmailHint')) })}</div>
            </fieldset>
            <div class="field">
              <label for="gift-msg">${esc(t('gift.message'))} <span class="opt">${esc(t('common.optional'))}</span></label>
              <div class="control"><textarea id="gift-msg" name="message" rows="3" maxlength="250" aria-describedby="gift-msg-count" placeholder="${esc(t('gift.messagePh'))}">${esc(g.message)}</textarea></div>
              <p class="hint" id="gift-msg-count" aria-live="polite">${esc(t('gift.chars', { n: 250 - g.message.length }))}</p>
            </div>
            <fieldset class="fs"><legend>${esc(t('gift.packaging'))}</legend>
              <div class="wrap-opts">${['standard', 'premium', 'luxury'].map(w => `<label class="opt-card"><input type="radio" name="wrap" value="${w}" ${g.wrap === w ? 'checked' : ''}><span class="oc-body"><strong>${esc(t('gift.wrap.' + w))}</strong><small>${esc(t('gift.wrap.' + w + '.d'))}</small><em>${wraps[w] ? '+ ' + money(wraps[w]) : esc(t('common.free'))}</em></span></label>`).join('')}</div>
            </fieldset>
            <div class="grid-2">
              ${OZ.ui.field({ name: 'deliveryDate', label: t('gift.deliveryDate'), type: 'date', value: g.deliveryDate, attrs: `min="${tomorrow}"`, hint: esc(t('gift.deliveryHint')) })}
              <label class="check self-end"><input type="checkbox" name="hidePrices" ${g.hidePrices ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('gift.hidePrices'))}</span></label>
            </div>
            <p class="muted small">${icon('info')} ${esc(t('gift.addressNote'))}</p>
            <div class="btn-row end">
              ${existing ? `<button type="button" class="btn btn-ghost" data-remove-gift>${esc(t('gift.remove'))}</button>` : `<button type="button" class="btn btn-ghost" data-ov-close>${esc(t('common.cancel'))}</button>`}
              <button type="submit" class="btn btn-primary">${esc(existing ? t('gift.save') : t('gift.addToCart'))}</button>
            </div>
          </form>`,
        onMount(o) {
          const form = o.el.querySelector('[data-gift-form]');
          const msg = form.elements.message, cnt = o.el.querySelector('#gift-msg-count');
          msg.addEventListener('input', () => { cnt.textContent = t('gift.chars', { n: 250 - msg.value.length }); });
          const rm = o.el.querySelector('[data-remove-gift]');
          if (rm) rm.addEventListener('click', () => { OZ.ui.busy(rm, true); S.setLineGift(lineId, null).then(() => { o.close(); OZ.ui.toast(t('gift.removed'), 'info'); }).catch(err => { OZ.ui.busy(rm, false); OZ.ui.formAlert(form, OZ.ui.errorText(err)); }); });
          form.addEventListener('submit', e => {
            e.preventDefault();
            const d = OZ.ui.validate(form, {
              recipientName: [OZ.ui.V.required, OZ.ui.V.max(60)],
              recipientEmail: [v => v ? OZ.ui.V.email(v) : ''],
              deliveryDate: [v => !v || v >= tomorrow ? '' : t('gift.dateErr')]
            });
            if (!d) return;
            const gift = { recipientName: d.recipientName.trim(), recipientEmail: (d.recipientEmail || '').trim(), message: (d.message || '').trim(), wrap: d.wrap || 'standard', deliveryDate: d.deliveryDate || '', hidePrices: !!d.hidePrices };
            const btn = form.querySelector('[type=submit]');
            OZ.ui.busy(btn, true, t('common.saving'));
            (lineId ? S.setLineGift(lineId, gift) : S.addToCart(productId, sizeId, qty, gift)).then(() => {
              o.close();
              OZ.ui.toast(lineId ? t('gift.updated') : t('gift.added', { name: gift.recipientName }), 'success');
              if (!lineId) location.hash = '#/cart';
            }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(form, OZ.ui.errorText(err)); });
          });
        }
      });
      return ov;
    }
  };

  /* =====================================================================
     CART PAGE
     ===================================================================== */
  function summaryRows(tt, { showShipping = true, estimated = true } = {}) {
    return `<dl class="sum-rows">
      <div><dt>${esc(t('cart.subtotal'))} <span class="muted">(${esc(t('cart.itemsN', { n: tt.lines.reduce((a, v) => a + v.line.qty, 0) }))})</span></dt><dd>${money(tt.subtotal)}</dd></div>
      ${tt.savings ? `<div class="save"><dt>${esc(t('cart.youSave'))}</dt><dd>${money(tt.savings)}</dd></div>` : ''}
      ${tt.discount ? `<div class="disc"><dt>${esc(t('cart.coupon'))} <span class="code">${esc(tt.coupon.code)}</span></dt><dd>− ${money(tt.discount)}</dd></div>` : ''}
      ${tt.giftFee ? `<div><dt>${esc(t('cart.giftFee'))}</dt><dd>${money(tt.giftFee)}</dd></div>` : ''}
      ${showShipping ? `<div><dt>${esc(t(estimated ? 'cart.shippingEst' : 'cart.shipping'))}</dt><dd>${tt.shipping ? money(tt.shipping) : `<span class="free">${esc(t('common.free'))}</span>`}</dd></div>` : ''}
      <div class="total"><dt>${esc(t('cart.total'))}</dt><dd>${money(tt.total)}</dd></div>
      <div class="vat"><dt>${esc(t('cart.vatLine', { rate: S.settings().vatRate }))}</dt><dd>${money(tt.vat)}</dd></div>
    </dl>`;
  }
  OZ.summaryRows = summaryRows;

  function couponBox(tt) {
    if (tt.coupon) return `<div class="coupon-applied">${icon('tag')}<span>${esc(t('coupon.applied', { code: tt.coupon.code }))}<small>${esc(tt.coupon.note || '')}</small></span><button class="link-btn" data-action="remove-coupon">${esc(t('cart.remove'))}</button></div>`;
    return `<form class="coupon-form" data-coupon novalidate>
      <label for="coupon-in">${esc(t('coupon.label'))}</label>
      <div class="coupon-row"><input id="coupon-in" name="code" autocomplete="off" placeholder="${esc(t('coupon.ph'))}" aria-describedby="coupon-err"><button class="btn btn-dark" type="submit">${esc(t('coupon.apply'))}</button></div>
      <p class="err" id="coupon-err" role="alert"></p>
      <p class="hint">${esc(t('coupon.hint'))}</p>
    </form>`;
  }
  OZ.couponBox = couponBox;

  OZ.bindCoupon = (root) => {
    root.addEventListener('submit', e => {
      const form = e.target.closest('[data-coupon]'); if (!form) return;
      e.preventDefault();
      const input = form.elements.code, err = form.querySelector('.err');
      if (!input.value.trim()) { err.textContent = t('coupon.empty'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      const btn = form.querySelector('button');
      OZ.ui.busy(btn, true, t('coupon.checking'));
      S.applyCoupon(input.value).then(c => { OZ.ui.toast(t('coupon.success', { code: c.code }), 'success'); })
        .catch(e2 => { OZ.ui.busy(btn, false); input.setAttribute('aria-invalid', 'true'); err.textContent = OZ.ui.errorText(Object.assign({}, e2, e2.min ? { min: money(e2.min) } : {})); input.focus(); });
    });
  };

  P.cart = () => {
    const html = `${C.breadcrumb([['#/', t('nav.home')], [null, t('cart.title')]])}
      <section class="container cart-page"><h1 class="page-title left">${esc(t('cart.title'))}</h1><div data-cart-page></div></section>
      <section class="section" data-cart-recs></section>`;
    return {
      title: t('cart.title'), html,
      mount(root) {
        const host = $('[data-cart-page]', root);
        const render = () => {
          const tt = S.totals();
          if (!tt.lines.length) {
            host.innerHTML = C.empty({ ic: 'bag', title: t('cart.emptyTitle'), text: t('cart.emptyText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('cart.startShopping'))}</a><a class="btn btn-outline" href="#/wishlist">${icon('heart')} ${esc(t('nav.wishlist'))}</a>` });
            return;
          }
          const hasOut = tt.lines.some(v => v.product.stock < v.line.qty);
          host.innerHTML = `<div class="cart-grid">
            <div>
              ${C.freeShipBar(tt)}
              ${hasOut ? `<div class="alert alert-error">${icon('alert')}<span>${esc(t('cart.stockIssue'))}</span></div>` : ''}
              <ul class="clines big" aria-label="${esc(t('cart.items'))}">${C.cartLines(tt.lines, false)}</ul>
              <a class="link-arrow back" href="#/shop/diffusers">${icon('arrowRight', 'flip rot')} ${esc(t('cart.continue'))}</a>
            </div>
            <aside class="summary card" aria-labelledby="sum-h">
              <h2 id="sum-h" class="sum-h">${esc(t('cart.summary'))}</h2>
              ${couponBox(tt)}
              ${summaryRows(tt)}
              <a class="btn btn-primary btn-block btn-lg${hasOut ? ' disabled' : ''}" href="#/checkout" ${hasOut ? 'aria-disabled="true" tabindex="-1"' : ''}>${icon('lock')} ${esc(t('cart.checkout'))}</a>
              <a class="btn btn-ghost btn-block" href="#/shop/diffusers">${esc(t('cart.continue'))}</a>
              <div class="sum-trust">${C.payMarks()}<p class="muted small">${icon('shield')} ${esc(t('cart.secure'))}</p></div>
            </aside>
          </div>`;
        };
        render();
        OZ.bindCoupon(root);
        const recs = S.collection('bestsellers').filter(p => !S.cart().some(l => l.productId === p.id));
        if (recs.length) $('[data-cart-recs]', root).innerHTML = `<div class="container">${C.sectionHead(t('cart.recs'))}</div><div class="container-wide">${C.carousel('car-cartrec', recs.map(p => C.card(p)).join(''), t('cart.recs'))}</div>`;
        OZ.onStore(['cart', 'coupon', 'currency'], () => OZ.keepFocus(render));
      }
    };
  };

  /* =====================================================================
     CHECKOUT
     ===================================================================== */
  const CK = 'oz_checkout_v1';
  const ck = {
    get() { try { return JSON.parse(sessionStorage.getItem(CK)) || {}; } catch (e) { return {}; } },
    set(patch) { const v = Object.assign(ck.get(), patch); try { sessionStorage.setItem(CK, JSON.stringify(v)); } catch (e) { } return v; },
    clear() { try { sessionStorage.removeItem(CK); } catch (e) { } }
  };

  const STEPS = ['info', 'shipping', 'payment', 'done'];

  function stepper(active) {
    return `<ol class="stepper" aria-label="${esc(t('ck.progress'))}">${STEPS.map((s, i) => {
      const idx = STEPS.indexOf(active);
      const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
      const inner = `<span class="st-n">${state === 'done' ? icon('check') : i + 1}</span><span class="st-l">${esc(t('ck.step.' + s))}</span>`;
      return `<li class="st ${state}" ${state === 'current' ? 'aria-current="step"' : ''}>${state === 'done' && s !== 'done' ? `<a href="#/checkout/${s}">${inner}</a>` : inner}</li>`;
    }).join('')}</ol>`;
  }

  function orderAside(tt, shippingMethod) {
    return `<aside class="summary card ck-aside" aria-labelledby="ck-sum-h">
      <details class="ck-sum-toggle" open><summary><h2 id="ck-sum-h" class="sum-h">${esc(t('ck.summary'))}</h2><span class="muted">${money(tt.total)}</span>${icon('chevDown')}</summary>
      <ul class="ck-items">${tt.lines.map(v => `<li><span class="ck-img">${OZ.ui.img(v.product.img, '')}<span class="ck-q">${v.line.qty}</span></span><span class="ck-name">${esc(OZ.pname(v.product))}<small>${esc(t('size.ml', { n: v.size.ml }))}${v.line.gift ? ` · ${icon('gift')} ${esc(t('gift.for', { name: v.line.gift.recipientName }))}` : ''}</small>${v.compare > v.price ? `<small class="save-txt">${esc(t('price.save', { amount: money((v.compare - v.price) * v.line.qty) }))}</small>` : ''}</span><span class="ck-price">${money(v.total)}</span></li>`).join('')}</ul>
      ${couponBox(tt)}
      ${summaryRows(tt, { estimated: !shippingMethod })}
      </details>
    </aside>`;
  }

  const countryOpts = v => COUNTRIES.map(c => ({ value: c, label: t('country.' + c) })).map(o => Object.assign(o, { selected: o.value === v }));

  function addressFields(a = {}, prefix = '') {
    return `<div class="grid-2">
      ${OZ.ui.field({ name: prefix + 'firstName', label: t('form.firstName'), required: true, value: a.firstName || '', autocomplete: 'given-name' })}
      ${OZ.ui.field({ name: prefix + 'lastName', label: t('form.lastName'), required: true, value: a.lastName || '', autocomplete: 'family-name' })}
    </div>
    ${OZ.ui.field({ name: prefix + 'country', label: t('form.country'), required: true, value: a.country || 'AE', options: countryOpts(a.country || 'AE'), autocomplete: 'country' })}
    ${OZ.ui.field({ name: prefix + 'line1', label: t('form.line1'), required: true, value: a.line1 || '', autocomplete: 'address-line1' })}
    ${OZ.ui.field({ name: prefix + 'line2', label: t('form.line2'), value: a.line2 || '', autocomplete: 'address-line2' })}
    <div class="grid-2">
      ${OZ.ui.field({ name: prefix + 'city', label: t('form.city'), required: true, value: a.city || '', autocomplete: 'address-level2' })}
      ${OZ.ui.field({ name: prefix + 'state', label: t('form.state'), value: a.state || '', autocomplete: 'address-level1' })}
    </div>
    ${OZ.ui.field({ name: prefix + 'phone', label: t('form.phone'), type: 'tel', required: true, value: a.phone || '', autocomplete: 'tel', hint: esc(t('form.phoneHint')), attrs: 'dir="ltr"' })}`;
  }
  OZ.addressFields = addressFields;
  const addrRules = (prefix = '') => ({ [prefix + 'firstName']: [OZ.ui.V.required], [prefix + 'lastName']: [OZ.ui.V.required], [prefix + 'country']: [OZ.ui.V.required], [prefix + 'line1']: [OZ.ui.V.required, OZ.ui.V.min(4)], [prefix + 'city']: [OZ.ui.V.required], [prefix + 'phone']: [OZ.ui.V.required, OZ.ui.V.phone] });
  OZ.addrRules = addrRules;
  OZ.formatAddress = a => a ? [`${a.firstName} ${a.lastName}`, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), t('country.' + a.country), a.phone].filter(Boolean).map(esc).join('<br>') : '';

  P.checkout = (step) => {
    step = STEPS.includes(step) && step !== 'done' ? step : 'info';
    const tt0 = S.totals();
    if (!tt0.lines.length) {
      return { title: t('ck.title'), html: `<section class="container section">${C.empty({ ic: 'bag', title: t('ck.emptyTitle'), text: t('ck.emptyText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('cart.startShopping'))}</a>` })}</section>` };
    }
    const st = ck.get();
    const u = S.user();
    if (step !== 'info' && !(u || (st.contact && st.contact.email))) return { redirect: '#/checkout/info' };
    if (step === 'payment' && !st.shipping) return { redirect: '#/checkout/shipping' };
    const tt = S.totals({ shippingMethod: step === 'info' ? undefined : st.shippingMethod });

    let main = '';
    if (step === 'info') {
      main = `<form class="ck-form" data-ck="info" novalidate>
        <h2 class="ck-h">${esc(t('ck.step.info'))}</h2>
        ${u ? `<div class="signed-in card">${icon('user')}<div><p>${esc(t('ck.signedInAs'))}</p><strong>${esc(u.email)}</strong></div><button type="button" class="link-btn" data-action="logout">${esc(t('nav.logout'))}</button></div>`
          : `<p class="muted">${esc(t('ck.haveAccount'))} <a href="#/login?next=${encodeURIComponent('/checkout')}">${esc(t('nav.login'))}</a></p>
          ${OZ.ui.field({ name: 'email', label: t('form.email'), type: 'email', required: true, value: (st.contact || {}).email || '', autocomplete: 'email', hint: esc(t('ck.emailHint')) })}
          <label class="check"><input type="checkbox" name="createAccount" data-toggle-pw ${(st.contact || {}).createAccount ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('ck.createAccount'))}</span></label>
          <div data-pw-wrap ${(st.contact || {}).createAccount ? '' : 'hidden'}>${OZ.ui.field({ name: 'password', label: t('form.password'), type: 'password', autocomplete: 'new-password', required: true, hint: esc(t('val.passwordHint')) })}</div>`}
        <label class="check"><input type="checkbox" name="newsletter" ${(st.contact || {}).newsletter ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('ck.newsletter'))}</span></label>
        <div class="ck-nav"><a class="link-arrow back" href="#/cart">${icon('arrowRight', 'flip rot')} ${esc(t('ck.backCart'))}</a><button class="btn btn-primary btn-lg" type="submit">${esc(t('ck.toShipping'))} ${icon('arrowRight', 'flip')}</button></div>
      </form>`;
    } else if (step === 'shipping') {
      const saved = u ? u.addresses : [];
      const selId = st.addressId || (saved.find(a => a.isDefault) || {}).id || (saved[0] || {}).id || 'new';
      const set = S.settings();
      const stdFree = S.totals({ shippingMethod: 'standard' }).shipping === 0;
      main = `<form class="ck-form" data-ck="shipping" novalidate>
        <h2 class="ck-h">${esc(t('ck.step.shipping'))}</h2>
        ${tt.lines.some(v => v.line.gift) ? `<div class="alert alert-info">${icon('gift')}<span>${esc(t('ck.giftAddress'))}</span></div>` : ''}
        ${saved.length ? `<fieldset class="fs"><legend>${esc(t('ck.savedAddresses'))}</legend><div class="addr-pick">
          ${saved.map(a => `<label class="opt-card"><input type="radio" name="addressId" value="${a.id}" ${a.id === selId ? 'checked' : ''}><span class="oc-body"><strong>${esc(a.label || t('addr.address'))}${a.isDefault ? ` <span class="badge badge-muted">${esc(t('addr.default'))}</span>` : ''}</strong><small>${OZ.formatAddress(a)}</small></span></label>`).join('')}
          <label class="opt-card"><input type="radio" name="addressId" value="new" ${selId === 'new' ? 'checked' : ''}><span class="oc-body"><strong>${icon('plus')} ${esc(t('ck.newAddress'))}</strong></span></label>
        </div></fieldset>` : ''}
        <div data-new-addr ${saved.length && selId !== 'new' ? 'hidden' : ''}>
          ${addressFields(st.shipping && st.addressId === 'new' ? st.shipping : (u ? { firstName: (u.name || '').split(' ')[0], lastName: (u.name || '').split(' ').slice(1).join(' '), phone: u.phone } : {}))}
          ${u ? `<label class="check"><input type="checkbox" name="saveAddress" checked><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('ck.saveAddress'))}</span></label>` : ''}
        </div>
        <fieldset class="fs"><legend>${esc(t('ck.method'))}</legend><div class="ship-opts">
          <label class="opt-card"><input type="radio" name="shippingMethod" value="standard" ${st.shippingMethod !== 'express' ? 'checked' : ''}><span class="oc-body">${icon('truck')}<strong>${esc(t('ship.standard'))}</strong><small>${esc(t('ship.standardEta'))}</small><em>${stdFree ? esc(t('common.free')) : money(set.shippingFee)}</em></span></label>
          <label class="opt-card"><input type="radio" name="shippingMethod" value="express" ${st.shippingMethod === 'express' ? 'checked' : ''}><span class="oc-body">${icon('clock')}<strong>${esc(t('ship.express'))}</strong><small>${esc(t('ship.expressEta'))}</small><em>${money(set.expressFee)}</em></span></label>
        </div></fieldset>
        <div class="ck-nav"><a class="link-arrow back" href="#/checkout/info">${icon('arrowRight', 'flip rot')} ${esc(t('ck.back'))}</a><button class="btn btn-primary btn-lg" type="submit">${esc(t('ck.toPayment'))} ${icon('arrowRight', 'flip')}</button></div>
      </form>`;
    } else {
      const cryptoOn = S.settings().cryptoEnabled;
      const email = u ? u.email : st.contact.email;
      main = `<div class="ck-form" data-ck="payment">
        <h2 class="ck-h">${esc(t('ck.review'))}</h2>
        <div class="review-box card">
          <div class="rb-row"><span class="rb-l">${esc(t('ck.contact'))}</span><span>${esc(email)}</span><a href="#/checkout/info" class="link-btn">${esc(t('common.change'))}</a></div>
          <div class="rb-row"><span class="rb-l">${esc(t('ck.shipTo'))}</span><span>${OZ.formatAddress(st.shipping)}</span><a href="#/checkout/shipping" class="link-btn">${esc(t('common.change'))}</a></div>
          <div class="rb-row"><span class="rb-l">${esc(t('ck.method'))}</span><span>${esc(t('ship.' + (st.shippingMethod || 'standard')))} · ${tt.shipping ? money(tt.shipping) : esc(t('common.free'))}</span><a href="#/checkout/shipping" class="link-btn">${esc(t('common.change'))}</a></div>
        </div>

        <h2 class="ck-h">${esc(t('ck.step.payment'))}</h2>
        <p class="muted small">${icon('lock')} ${esc(t('pay.secureNote'))}</p>
        <div class="pay-methods" role="radiogroup" aria-label="${esc(t('pay.method'))}">
          <div class="pay-m">
            <label class="pay-head"><input type="radio" name="pm" value="card" checked><span>${icon('card')} ${esc(t('pay.card'))}</span><span class="pm-marks"><span class="pm pm-visa">VISA</span><span class="pm pm-mc"><i></i><i></i></span><span class="pm pm-amex">AMEX</span></span></label>
            <form class="pay-body" data-card-form novalidate autocomplete="on">
              ${OZ.ui.field({ name: 'ccname', label: t('pay.nameOnCard'), required: true, autocomplete: 'cc-name' })}
              <div class="field card-num">
                <label for="ccnum">${esc(t('pay.cardNumber'))}</label>
                <div class="control"><input id="ccnum" name="ccnum" inputmode="numeric" autocomplete="cc-number" required aria-required="true" aria-describedby="ccnum-err ccnum-brand" dir="ltr" placeholder="1234 1234 1234 1234"><span class="cc-brand" id="ccnum-brand" aria-live="polite"></span></div>
                <p class="err" id="ccnum-err" role="alert"></p>
              </div>
              <div class="grid-2">
                ${OZ.ui.field({ name: 'ccexp', label: t('pay.expiry'), required: true, autocomplete: 'cc-exp', placeholder: 'MM / YY', attrs: 'inputmode="numeric" dir="ltr" maxlength="7"' })}
                ${OZ.ui.field({ name: 'cccvc', label: t('pay.cvc'), required: true, autocomplete: 'cc-csc', placeholder: '123', attrs: 'inputmode="numeric" dir="ltr" maxlength="4"', hint: esc(t('pay.cvcHint')) })}
              </div>
              <label class="check"><input type="checkbox" name="billingSame" checked data-billing-toggle><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('pay.billingSame'))}</span></label>
              <div data-billing hidden>${addressFields({}, 'b_')}</div>
              <details class="demo-note"><summary>${icon('info')} ${esc(t('pay.demoTitle'))}</summary><p>${esc(t('pay.demoText'))}</p><ul><li><code dir="ltr">4242 4242 4242 4242</code> — ${esc(t('pay.demoOk'))}</li><li><code dir="ltr">4000 0000 0000 0002</code> — ${esc(t('pay.demoDecline'))}</li><li><code dir="ltr">5555 5555 5555 4444</code> — Mastercard</li></ul></details>
            </form>
          </div>
          ${cryptoOn ? `<div class="pay-m">
            <label class="pay-head"><input type="radio" name="pm" value="crypto"><span>${icon('crypto')} ${esc(t('pay.crypto'))}</span><span class="pm-marks muted small">USDT · BTC · ETH</span></label>
            <div class="pay-body" data-crypto hidden>
              <fieldset class="fs"><legend>${esc(t('pay.coin'))}</legend><div class="coin-opts">${Object.entries(OZ.CRYPTO).map(([k, c], i) => `<label class="opt-card sm"><input type="radio" name="coin" value="${k}" ${i === 0 ? 'checked' : ''}><span class="oc-body"><strong>${k}</strong><small>${esc(c.network)}</small></span></label>`).join('')}</div></fieldset>
              <div data-coin-info></div>
            </div>
          </div>` : ''}
        </div>
        <p class="muted small terms">${esc(t('ck.terms'))} <a href="#/policies/terms">${esc(t('policy.terms'))}</a> · <a href="#/policies/privacy">${esc(t('policy.privacy'))}</a></p>
        <div class="ck-nav"><a class="link-arrow back" href="#/checkout/shipping">${icon('arrowRight', 'flip rot')} ${esc(t('ck.back'))}</a><button class="btn btn-teal btn-lg" data-action="pay">${icon('lock')} ${esc(t('pay.payNow', { amount: money(tt.total) }))}</button></div>
      </div>`;
    }

    const html = `<section class="container ck-page">
        <div class="ck-top">${C.logo(true)}<p class="muted small">${icon('lock')} ${esc(t('ck.secure'))}</p></div>
        ${stepper(step)}
        <div class="ck-grid"><div class="ck-main" data-ck-main>${main}</div><div data-ck-aside>${orderAside(tt, step === 'info' ? null : st.shippingMethod)}</div></div>
      </section>`;

    return {
      title: `${t('ck.title')} — ${t('ck.step.' + step)}`, html, bare: true,
      mount(root) {
        OZ.bindCoupon(root);
        const refreshAside = () => { const a = $('[data-ck-aside]', root); if (a) a.innerHTML = orderAside(S.totals({ shippingMethod: step === 'info' ? undefined : ck.get().shippingMethod }), step === 'info' ? null : ck.get().shippingMethod); };
        OZ.onStore(['coupon', 'currency', 'cart'], () => { if (!S.cart().length) return OZ.router.render(); refreshAside(); const pb = $('[data-action="pay"]', root); if (pb && !pb.disabled) pb.innerHTML = `${icon('lock')} ${esc(t('pay.payNow', { amount: money(S.totals({ shippingMethod: ck.get().shippingMethod }).total) }))}`; });
        if (window.matchMedia('(max-width: 900px)').matches) { const d = $('.ck-sum-toggle', root); if (d) d.open = false; }

        /* ---- step 1 ---- */
        const infoForm = $('[data-ck="info"]', root);
        if (infoForm) {
          const tog = infoForm.querySelector('[data-toggle-pw]');
          if (tog) tog.addEventListener('change', () => { infoForm.querySelector('[data-pw-wrap]').hidden = !tog.checked; });
          infoForm.addEventListener('submit', e => {
            e.preventDefault();
            if (S.user()) { ck.set({ contact: { email: S.user().email, newsletter: infoForm.elements.newsletter.checked } }); location.hash = '#/checkout/shipping'; return; }
            const create = infoForm.elements.createAccount.checked;
            const d = OZ.ui.validate(infoForm, Object.assign({ email: [OZ.ui.V.required, OZ.ui.V.email] }, create ? { password: [OZ.ui.V.required, OZ.ui.V.password] } : {}));
            if (!d) return;
            const btn = infoForm.querySelector('[type=submit]');
            ck.set({ contact: { email: d.email.trim(), newsletter: !!d.newsletter, createAccount: create } });
            if (!create) { location.hash = '#/checkout/shipping'; return; }
            OZ.ui.busy(btn, true, t('auth.creating'));
            S.register({ email: d.email, password: d.password, name: '' }).then(res => {
              OZ.ui.toast(t('auth.createdVerify', { code: res.code }), 'success');
              location.hash = '#/checkout/shipping';
            }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(infoForm, err.code === 'exists' ? t('err.existsCheckout') : OZ.ui.errorText(err)); });
          });
        }

        /* ---- step 2 ---- */
        const shipForm = $('[data-ck="shipping"]', root);
        if (shipForm) {
          const newWrap = shipForm.querySelector('[data-new-addr]');
          shipForm.addEventListener('change', e => {
            if (e.target.name === 'addressId') { newWrap.hidden = e.target.value !== 'new'; if (!newWrap.hidden) newWrap.querySelector('input').focus(); }
            if (e.target.name === 'shippingMethod') { ck.set({ shippingMethod: e.target.value }); const a = $('[data-ck-aside]', root); a.innerHTML = orderAside(S.totals({ shippingMethod: e.target.value }), e.target.value); }
          });
          shipForm.addEventListener('submit', e => {
            e.preventDefault();
            const fd = new FormData(shipForm);
            const addressId = fd.get('addressId') || 'new';
            const method = fd.get('shippingMethod') || 'standard';
            const u2 = S.user();
            if (addressId !== 'new') {
              const a = u2.addresses.find(x => x.id === addressId);
              ck.set({ addressId, shipping: a, shippingMethod: method });
              location.hash = '#/checkout/payment'; return;
            }
            const d = OZ.ui.validate(shipForm, addrRules());
            if (!d) return;
            const addr = { firstName: d.firstName.trim(), lastName: d.lastName.trim(), country: d.country, line1: d.line1.trim(), line2: (d.line2 || '').trim(), city: d.city.trim(), state: (d.state || '').trim(), phone: d.phone.trim() };
            ck.set({ addressId: 'new', shipping: addr, shippingMethod: method });
            if (u2 && d.saveAddress) {
              const btn = shipForm.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
              S.saveAddress(Object.assign({ label: t('addr.address') }, addr)).then(saved => { ck.set({ addressId: saved.id }); OZ.ui.toast(t('addr.saved'), 'success'); location.hash = '#/checkout/payment'; })
                .catch(() => { location.hash = '#/checkout/payment'; });
            } else location.hash = '#/checkout/payment';
          });
        }

        /* ---- step 3 ---- */
        const payWrap = $('[data-ck="payment"]', root);
        if (payWrap) mountPayment(root, payWrap, ck);
      }
    };
  };

  /* ---------- payment ---------- */
  function mountPayment(root, wrap, ckStore) {
    const cardForm = $('[data-card-form]', wrap), cryptoBox = $('[data-crypto]', wrap);
    const num = cardForm.elements.ccnum, exp = cardForm.elements.ccexp, cvc = cardForm.elements.cccvc, brandEl = $('#ccnum-brand', wrap);
    const method = () => (wrap.querySelector('input[name=pm]:checked') || {}).value || 'card';

    const setMethod = () => {
      const m = method();
      cardForm.hidden = m !== 'card'; if (cryptoBox) cryptoBox.hidden = m !== 'crypto';
      $$('.pay-m', wrap).forEach(el => el.classList.toggle('on', el.querySelector('input[name=pm]').checked));
      if (m === 'crypto') coinInfo();
      const pb = $('[data-action="pay"]', wrap);
      pb.innerHTML = `${icon(m === 'crypto' ? 'crypto' : 'lock')} ${esc(m === 'crypto' ? t('pay.cryptoContinue') : t('pay.payNow', { amount: money(S.totals({ shippingMethod: ckStore.get().shippingMethod }).total) }))}`;
    };
    const coinInfo = () => {
      const coin = (wrap.querySelector('input[name=coin]:checked') || {}).value || 'USDT';
      const c = OZ.CRYPTO[coin], tt = S.totals({ shippingMethod: ckStore.get().shippingMethod });
      const amt = (tt.total / c.aedPerCoin).toFixed(coin === 'USDT' ? 2 : 6);
      $('[data-coin-info]', wrap).innerHTML = `<div class="coin-box">
        <p><span class="muted">${esc(t('pay.cryptoAmount'))}</span><strong dir="ltr">${amt} ${coin}</strong><small class="muted">≈ ${money(tt.total)} · ${esc(t('pay.cryptoRate'))}</small></p>
        <p class="muted small">${esc(t('pay.cryptoHow', { network: c.network }))}</p>
      </div>`;
    };
    wrap.addEventListener('change', e => { if (e.target.name === 'pm') setMethod(); if (e.target.name === 'coin') coinInfo(); if (e.target.matches('[data-billing-toggle]')) { const b = $('[data-billing]', wrap); b.hidden = e.target.checked; } });

    num.addEventListener('input', () => {
      const pos = num.selectionStart, before = num.value.length;
      num.value = OZ.ui.card.format(num.value);
      const d = num.value.length - before; try { num.setSelectionRange(pos + d, pos + d); } catch (e) { }
      const b = OZ.ui.card.brand(num.value);
      brandEl.textContent = b ? t('pay.brand.' + b) : '';
      brandEl.className = 'cc-brand ' + (b || '');
    });
    exp.addEventListener('input', e => {
      let v = exp.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + ' / ' + v.slice(2);
      else if (v.length === 2 && e.inputType !== 'deleteContentBackward') v = v + ' / ';
      exp.value = v;
    });
    cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });

    const validateCard = () => {
      const V = OZ.ui.V;
      const rules = {
        ccname: [V.required, V.min(2)],
        ccnum: [V.required, v => OZ.ui.card.luhn(v) ? '' : t('pay.errNumber')],
        ccexp: [V.required, v => OZ.ui.card.expiryOk(v) ? '' : t('pay.errExpiry')],
        cccvc: [V.required, v => new RegExp(OZ.ui.card.brand(num.value) === 'amex' ? '^\\d{4}$' : '^\\d{3}$').test(v) ? '' : t('pay.errCvc')]
      };
      if (!cardForm.elements.billingSame.checked) Object.assign(rules, addrRules('b_'));
      return OZ.ui.validate(cardForm, rules);
    };

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="pay"]'); if (!btn) return;
      if (!navigator.onLine) { OZ.ui.toast(t('err.network'), 'error'); return; }
      const m = method();
      if (m === 'card') {
        const d = validateCard(); if (!d) return;
        const digits = d.ccnum.replace(/\D/g, '');
        const payment = { method: 'card', brand: OZ.ui.card.brand(digits), last4: digits.slice(-4) };
        /* Wipe sensitive values from the DOM as soon as they're read */
        const outcome = digits.endsWith('0002') ? 'declined' : digits.endsWith('9995') ? 'insufficient' : 'ok';
        num.value = ''; cvc.value = ''; brandEl.textContent = '';
        runPayment(payment, outcome);
      } else {
        const coin = (wrap.querySelector('input[name=coin]:checked') || {}).value || 'USDT';
        openCrypto(coin);
      }
    });

    function openCrypto(coin) {
      const c = OZ.CRYPTO[coin], tt = S.totals({ shippingMethod: ckStore.get().shippingMethod });
      const amt = (tt.total / c.aedPerCoin).toFixed(coin === 'USDT' ? 2 : 6);
      let left = 15 * 60, timer;
      const ov = OZ.ui.overlay({
        title: `${icon('crypto')} ${esc(t('pay.cryptoTitle', { coin }))}`, size: 'md', className: 'crypto-ov',
        body: `<div class="crypto-pay">
          <div class="qr" aria-hidden="true">${qrArt(c.address)}</div>
          <div class="crypto-det">
            <p class="muted small">${esc(t('pay.sendExactly'))}</p>
            <p class="c-amt" dir="ltr">${amt} ${coin}</p>
            <p class="muted small">${esc(t('pay.network'))}: <strong>${esc(c.network)}</strong></p>
            <label class="muted small" for="c-addr">${esc(t('pay.toAddress'))}</label>
            <div class="copy-row"><input id="c-addr" readonly value="${esc(c.address)}" dir="ltr"><button class="btn btn-outline btn-sm" data-copy>${icon('copy')} ${esc(t('common.copy'))}</button></div>
            <p class="c-timer" aria-live="off">${icon('clock')} <span data-timer>15:00</span> ${esc(t('pay.cryptoExpires'))}</p>
            <div class="alert alert-info">${icon('info')}<span>${esc(t('pay.cryptoDemo'))}</span></div>
          </div>
        </div>
        <div class="btn-row end"><button class="btn btn-ghost" data-cancel>${esc(t('pay.cancel'))}</button><button class="btn btn-teal" data-sent>${esc(t('pay.cryptoSent'))}</button></div>`,
        onMount(o) {
          const tEl = o.el.querySelector('[data-timer]');
          timer = setInterval(() => { left--; tEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { clearInterval(timer); o.close(); showResult('cancelled', { method: 'crypto', coin }, t('pay.cryptoExpired')); } }, 1000);
          o.el.querySelector('[data-copy]').onclick = () => { const i = o.el.querySelector('#c-addr'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => OZ.ui.toast(t('common.copied'), 'info')).catch(() => document.execCommand && document.execCommand('copy')); };
          o.el.querySelector('[data-cancel]').onclick = () => { clearInterval(timer); o.close(); showResult('cancelled', { method: 'crypto', coin }); };
          o.el.querySelector('[data-sent]').onclick = () => { clearInterval(timer); o.close(); runPayment({ method: 'crypto', coin }, 'ok', true); };
        },
        onClose: () => clearInterval(timer)
      });
    }

    let payOv = null;
    function runPayment(payment, outcome, isCrypto) {
      let cancelled = false, timer;
      const body = (state, extra = '') => {
        const map = {
          processing: `<div class="pay-state"><span class="big-spinner" aria-hidden="true"></span><h3>${esc(t(isCrypto ? 'pay.cryptoWaiting' : 'pay.processing'))}</h3><p class="muted">${esc(t('pay.dontClose'))}</p>${extra}<button class="btn btn-ghost" data-pcancel>${esc(t('pay.cancel'))}</button></div>`,
          submitting: `<div class="pay-state"><span class="big-spinner" aria-hidden="true"></span><h3>${esc(t('pay.submitting'))}</h3><p class="muted">${esc(t('pay.paidCreating'))}</p></div>`
        };
        return map[state];
      };
      payOv = OZ.ui.overlay({ title: esc(t('pay.statusTitle')), size: 'sm', className: 'pay-ov', body: body('processing') });
      payOv.el.querySelector('.ov-x').hidden = true;
      payOv.el.querySelector('.ov-backdrop').removeAttribute('data-ov-close');
      OZ.ui.announce(t('pay.processing'));
      payOv.el.addEventListener('click', e => { if (e.target.closest('[data-pcancel]')) { cancelled = true; clearTimeout(timer); payOv.close(); showResult('cancelled', payment); } });
      timer = setTimeout(() => {
        if (cancelled) return;
        if (outcome !== 'ok') { payOv.close(); showResult('failed', payment, t(outcome === 'insufficient' ? 'pay.errFunds' : 'pay.errDeclined')); return; }
        payOv.setBody(body('submitting'));
        placeOrder(payment);
      }, isCrypto ? 3000 : 2200);
    }

    function placeOrder(payment) {
      const st = ckStore.get(); const u = S.user();
      S.placeOrder({ contact: { email: u ? u.email : st.contact.email }, shipping: st.shipping, shippingMethod: st.shippingMethod || 'standard', payment })
        .then(order => {
          if (payOv) payOv.close();
          ckStore.clear();
          S.rememberLastOrder(order.id);
          location.hash = `#/order/${order.id}?new=1`;
        })
        .catch(err => {
          if (payOv) payOv.close();
          showResult('orderFailed', payment, OZ.ui.errorText(err));
        });
    }

    function showResult(kind, payment, reason) {
      const conf = {
        failed: { ic: 'alert', cls: 'err', title: t('pay.failedTitle'), text: reason || t('pay.errDeclined'), next: t('pay.failedNext') },
        cancelled: { ic: 'info', cls: 'info', title: t('pay.cancelledTitle'), text: reason || t('pay.cancelledText'), next: '' },
        orderFailed: { ic: 'alert', cls: 'err', title: t('pay.orderFailedTitle'), text: reason, next: t('pay.orderFailedNext') }
      }[kind];
      OZ.ui.announce(conf.title);
      const o = OZ.ui.overlay({
        title: esc(t('pay.statusTitle')), size: 'sm', className: 'pay-ov',
        body: `<div class="pay-state ${conf.cls}"><span class="ps-ic">${icon(conf.ic)}</span><h3>${esc(conf.title)}</h3><p>${esc(conf.text)}</p>${conf.next ? `<p class="muted small">${esc(conf.next)}</p>` : ''}
          <div class="btn-row center">${kind === 'orderFailed' ? `<button class="btn btn-primary" data-retry-order>${esc(t('common.retry'))}</button>` : `<button class="btn btn-primary" data-ov-close>${esc(t('pay.tryAgain'))}</button><button class="btn btn-outline" data-other>${esc(t('pay.otherMethod'))}</button>`}</div></div>`,
        onMount(ov) {
          const r = ov.el.querySelector('[data-retry-order]');
          if (r) r.onclick = () => { ov.close(); payOv = OZ.ui.overlay({ title: esc(t('pay.statusTitle')), size: 'sm', className: 'pay-ov', body: `<div class="pay-state"><span class="big-spinner" aria-hidden="true"></span><h3>${esc(t('pay.submitting'))}</h3></div>` }); placeOrder(payment); };
          const oth = ov.el.querySelector('[data-other]');
          if (oth) oth.onclick = () => { ov.close(); const other = wrap.querySelector(`input[name=pm]:not([value="${payment.method}"])`); if (other) { other.checked = true; setMethod(); other.focus(); } };
        }
      });
      return o;
    }
    setMethod();
  }

  /* Decorative QR-style pattern derived from the address (demo only — not scannable) */
  function qrArt(seed) {
    let h = 7; const cells = [];
    for (let i = 0; i < 21 * 21; i++) { h = (h * 31 + seed.charCodeAt(i % seed.length)) % 9973; cells.push(h % 3 === 0); }
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="none" stroke="currentColor"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    let r = '';
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if (!inFinder(x, y) && cells[y * 21 + x]) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    return `<svg viewBox="-1 -1 23 23" fill="currentColor">${finder(0.5, 0.5)}${finder(13.5, 0.5)}${finder(0.5, 13.5)}${r}</svg>`;
  }

  /* =====================================================================
     ORDER CONFIRMATION / ORDER DETAIL
     ===================================================================== */
  const ORDER_FLOW = ['placed', 'processing', 'shipped', 'delivered'];

  OZ.orderDetail = (o, { inAccount = false } = {}) => {
    const eta = new Date(new Date(o.date).getTime() + (o.shippingMethod === 'express' ? 1 : 4) * 864e5);
    const etaFrom = new Date(new Date(o.date).getTime() + (o.shippingMethod === 'express' ? 1 : 2) * 864e5);
    const stepIdx = ORDER_FLOW.indexOf(o.status);
    const terminal = ['cancelled', 'refunded'].includes(o.status);
    const gifts = o.items.filter(i => i.gift);
    return `<div class="order-detail">
      <div class="od-meta card">
        <div><span class="muted small">${esc(t('order.number'))}</span><strong>${esc(o.id)}</strong></div>
        <div><span class="muted small">${esc(t('order.date'))}</span><strong>${OZ.ui.date(o.date)}</strong></div>
        <div><span class="muted small">${esc(t('order.status'))}</span><span class="status status-${o.status}">${esc(t('status.' + o.status))}</span></div>
        <div><span class="muted small">${esc(t('order.payment'))}</span><span class="status pay-${o.payment.status}">${esc(t('paystatus.' + o.payment.status))}</span></div>
      </div>
      ${terminal ? `<div class="alert alert-info">${icon('info')}<span>${esc(t('order.terminal.' + o.status))}</span></div>` : `
      <ol class="track" aria-label="${esc(t('order.tracking'))}">${ORDER_FLOW.map((s, i) => { const ev = o.timeline.find(x => x.status === s); return `<li class="${i <= stepIdx ? 'done' : ''}${i === stepIdx ? ' current' : ''}" ${i === stepIdx ? 'aria-current="step"' : ''}><span class="tk-dot">${i <= stepIdx ? icon('check') : ''}</span><span class="tk-l">${esc(t('status.' + s))}</span><span class="tk-d muted small">${ev ? OZ.ui.date(ev.date, { day: 'numeric', month: 'short' }) : ''}</span></li>`; }).join('')}</ol>
      ${o.status !== 'delivered' ? `<p class="eta">${icon('truck')} ${esc(t('order.eta'))} <strong>${[etaFrom, eta].map(d => OZ.ui.date(d, { weekday: 'short', day: 'numeric', month: 'short' })).filter((v, i, arr) => arr.indexOf(v) === i).join(' – ')}</strong></p>` : ''}`}
      <div class="od-grid">
        <div class="card">
          <h3 class="card-h">${esc(t('order.items'))}</h3>
          <ul class="od-items">${o.items.map(i => { const p = S.product(i.productId); return `<li>${OZ.ui.img(i.img, '')}<div><a href="#/product/${i.productId}">${esc(p ? OZ.pname(p) : i.name)}</a><small class="muted">${esc(t('size.ml', { n: i.ml }))} · ${esc(t('order.qty', { n: i.qty }))}</small>${i.gift ? `<small class="gift-l">${icon('gift')} ${esc(t('gift.for', { name: i.gift.recipientName }))} · ${esc(t('gift.wrap.' + i.gift.wrap))}${i.gift.message ? ` — “${esc(i.gift.message)}”` : ''}</small>` : ''}</div><strong>${money(i.price * i.qty)}</strong></li>`; }).join('')}</ul>
          <dl class="sum-rows">
            <div><dt>${esc(t('cart.subtotal'))}</dt><dd>${money(o.totals.subtotal)}</dd></div>
            ${o.totals.savings ? `<div class="save"><dt>${esc(t('cart.youSaved'))}</dt><dd>${money(o.totals.savings)}</dd></div>` : ''}
            ${o.totals.discount ? `<div class="disc"><dt>${esc(t('cart.coupon'))} ${o.coupon ? `<span class="code">${esc(o.coupon)}</span>` : ''}</dt><dd>− ${money(o.totals.discount)}</dd></div>` : ''}
            ${o.totals.giftFee ? `<div><dt>${esc(t('cart.giftFee'))}</dt><dd>${money(o.totals.giftFee)}</dd></div>` : ''}
            <div><dt>${esc(t('cart.shipping'))} (${esc(t('ship.' + o.shippingMethod))})</dt><dd>${o.totals.shipping ? money(o.totals.shipping) : esc(t('common.free'))}</dd></div>
            <div class="total"><dt>${esc(t('cart.total'))}</dt><dd>${money(o.totals.total)}</dd></div>
            <div class="vat"><dt>${esc(t('cart.vatLine', { rate: S.settings().vatRate }))}</dt><dd>${money(o.totals.vat)}</dd></div>
          </dl>
        </div>
        <div class="od-side">
          <div class="card"><h3 class="card-h">${icon('pin')} ${esc(t('order.shipTo'))}</h3><p>${OZ.formatAddress(o.shipping)}</p></div>
          <div class="card"><h3 class="card-h">${icon(o.payment.method === 'crypto' ? 'crypto' : 'card')} ${esc(t('order.payment'))}</h3>
            <p>${o.payment.method === 'crypto' ? esc(t('pay.cryptoPaid', { coin: o.payment.coin })) : esc(t('pay.cardPaid', { brand: t('pay.brand.' + (o.payment.brand || 'card')), last4: o.payment.last4 }))}</p>
            <p class="status pay-${o.payment.status}">${esc(t('paystatus.' + o.payment.status))}</p></div>
          ${gifts.length ? `<div class="card"><h3 class="card-h">${icon('gift')} ${esc(t('order.giftInfo'))}</h3>${gifts.map(i => `<p><strong>${esc(i.gift.recipientName)}</strong>${i.gift.recipientEmail ? `<br><span class="muted">${esc(i.gift.recipientEmail)}</span>` : ''}${i.gift.deliveryDate ? `<br>${esc(t('gift.deliverOn', { date: OZ.ui.date(i.gift.deliveryDate) }))}` : ''}<br>${esc(t('gift.wrap.' + i.gift.wrap))}${i.gift.hidePrices ? ` · ${esc(t('gift.pricesHidden'))}` : ''}</p>`).join('')}</div>` : ''}
          ${inAccount ? '' : `<div class="card"><h3 class="card-h">${icon('mail')} ${esc(t('order.contact'))}</h3><p>${esc(o.email)}</p></div>`}
        </div>
      </div>
    </div>`;
  };

  P.order = (id, q) => {
    const o = S.order(id);
    if (!o || !S.canViewOrder(o)) return P.notFound(t('order.notFound'));
    const u = S.user();
    const isNew = q.new === '1';
    const html = `<section class="container confirm">
      ${isNew ? `<div class="confirm-hero">
        <span class="confirm-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="m15 27 7 7 15-15"/></svg></span>
        <p class="eyebrow">${esc(t('order.confirmedEyebrow'))}</p>
        <h1 class="page-title" tabindex="-1">${esc(t('order.thanks', { name: (o.shipping.firstName || '').trim() }))}</h1>
        <p>${esc(t('order.confirmText', { email: o.email }))}</p>
        <p class="order-no">${esc(t('order.number'))}: <strong>${esc(o.id)}</strong></p>
      </div>` : `<h1 class="page-title left">${esc(t('order.title', { id: o.id }))}</h1>`}
      ${OZ.orderDetail(o)}
      <div class="btn-row center confirm-actions">
        ${u ? `<a class="btn btn-primary" href="#/account/orders/${o.id}">${esc(t('order.view'))}</a>` : ''}
        <a class="btn btn-outline" href="#/shop/diffusers">${esc(t('cart.continue'))}</a>
        ${u ? `<a class="btn btn-ghost" href="#/account">${esc(t('order.goAccount'))}</a>` : `<a class="btn btn-ghost" href="#/register?email=${encodeURIComponent(o.email)}">${esc(t('order.createAccount'))}</a>`}
      </div>
    </section>`;
    return { title: isNew ? t('order.confirmedEyebrow') : t('order.title', { id: o.id }), html, focus: '.page-title' };
  };
})();
