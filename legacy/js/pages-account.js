/* Ozone Perfume — authentication, account area, wishlist, addresses, special dates. */
(function () {
  const { esc, icon, money, $, $$ } = OZ.ui;
  const S = OZ.store, C = OZ.c;
  const t = (k, v) => OZ.t(k, v);
  const P = OZ.pages = OZ.pages || {};
  const V = OZ.ui.V;

  const safeNext = n => (n && /^\/[a-z0-9/_-]*$/i.test(n) && !n.startsWith('//')) ? '#' + n : null;

  function authShell(title, sub, body, aside = '') {
    return `<section class="auth container">
      <div class="auth-card card">
        <h1 class="page-title left sm" tabindex="-1">${esc(title)}</h1>
        ${sub ? `<p class="muted">${sub}</p>` : ''}
        ${body}
      </div>
      <div class="auth-aside" aria-hidden="true">${OZ.ui.img('oil-versace-hotel-2', '', { size: 'lg', sizes: '40vw' })}<div class="auth-aside-copy"><p class="logo-word light">OZONE</p><p class="logo-sub light">SCENTS</p><p>${esc(t('brand.tagline'))}</p></div></div>
      ${aside}
    </section>`;
  }

  /* ---------- password strength ---------- */
  function strength(pw) {
    let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }
  function bindStrength(form) {
    const pw = form.elements.password, meter = form.querySelector('[data-strength]');
    if (!pw || !meter) return;
    pw.addEventListener('input', () => {
      const s = pw.value ? strength(pw.value) : 0;
      meter.dataset.level = s; meter.querySelector('span').textContent = pw.value ? t('pw.s' + s) : '';
    });
  }
  const meterHtml = () => `<div class="strength" data-strength data-level="0" aria-live="polite"><i></i><i></i><i></i><i></i><span></span></div>`;

  /* ---------- LOGIN ---------- */
  P.login = (q) => {
    if (S.user()) return { redirect: safeNext(q.next) || (S.isAdmin() ? '#/admin' : '#/account') };
    const body = `<form data-login novalidate>
        ${q.reason ? `<div class="alert alert-info">${icon('info')}<span>${esc(t('auth.reason.' + q.reason))}</span></div>` : ''}
        ${OZ.ui.field({ name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email', value: q.email || '' })}
        ${OZ.ui.field({ name: 'password', label: t('form.password'), type: 'password', required: true, autocomplete: 'current-password' })}
        <div class="row-between"><span></span><a href="#/reset" class="small">${esc(t('auth.forgot'))}</a></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('nav.login'))}</button>
        <p class="center muted">${esc(t('auth.noAccount'))} <a href="#/register${q.next ? '?next=' + encodeURIComponent(q.next) : ''}">${esc(t('auth.createAccount'))}</a></p>
        <details class="demo-note"><summary>${icon('info')} ${esc(t('auth.demoTitle'))}</summary>
          <p>${esc(t('auth.demoCustomer'))}: <code>demo@ozonescents.com</code> / <code>Demo@123</code></p>
          <p>${esc(t('auth.demoAdmin'))}: <code>admin@ozonescents.com</code> / <code>Admin@123</code></p>
        </details>
      </form>`;
    return {
      title: t('nav.login'), html: authShell(t('auth.welcomeBack'), esc(t('auth.loginSub')), body), focus: '.page-title',
      mount(root) {
        const form = $('[data-login]', root);
        form.addEventListener('submit', e => {
          e.preventDefault();
          const d = OZ.ui.validate(form, { email: [V.required, V.email], password: [V.required] });
          if (!d) return;
          const btn = form.querySelector('[type=submit]');
          OZ.ui.busy(btn, true, t('auth.signingIn'));
          OZ.ui.formAlert(form, '');
          S.login(d.email, d.password).then(u => {
            OZ.ui.toast(t('auth.welcome', { name: u.name || u.email }), 'success');
            location.hash = safeNext(q.next) || (u.role === 'admin' ? '#/admin' : '#/account');
          }).catch(err => {
            OZ.ui.busy(btn, false);
            OZ.ui.formAlert(form, OZ.ui.errorText(err));
            form.elements.password.value = ''; form.elements.password.focus();
          });
        });
      }
    };
  };

  /* ---------- REGISTER ---------- */
  P.register = (q) => {
    if (S.user()) return { redirect: '#/account' };
    const body = `<form data-register novalidate>
        ${OZ.ui.field({ name: 'name', label: t('form.fullName'), required: true, autocomplete: 'name' })}
        ${OZ.ui.field({ name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email', value: q.email || '' })}
        ${OZ.ui.field({ name: 'password', label: t('form.password'), type: 'password', required: true, autocomplete: 'new-password', hint: esc(t('val.passwordHint')) })}
        ${meterHtml()}
        ${OZ.ui.field({ name: 'confirm', label: t('form.confirmPassword'), type: 'password', required: true, autocomplete: 'new-password' })}
        <label class="check"><input type="checkbox" name="terms"><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('auth.agree'))} <a href="#/policies/terms">${esc(t('policy.terms'))}</a> &amp; <a href="#/policies/privacy">${esc(t('policy.privacy'))}</a></span></label>
        <p class="err" role="alert" data-terms-err></p>
        <label class="check"><input type="checkbox" name="newsletter"><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('ck.newsletter'))}</span></label>
        <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('auth.createAccount'))}</button>
        <p class="center muted">${esc(t('auth.haveAccount'))} <a href="#/login${q.next ? '?next=' + encodeURIComponent(q.next) : ''}">${esc(t('nav.login'))}</a></p>
      </form>`;
    return {
      title: t('auth.createAccount'), html: authShell(t('auth.createAccount'), esc(t('auth.registerSub')), body), focus: '.page-title',
      mount(root) {
        const form = $('[data-register]', root);
        bindStrength(form);
        form.addEventListener('submit', e => {
          e.preventDefault();
          const termsErr = form.querySelector('[data-terms-err]');
          const d = OZ.ui.validate(form, { name: [V.required, V.min(2)], email: [V.required, V.email], password: [V.required, V.password], confirm: [V.required, (v, all) => v === all.password ? '' : t('val.match')] });
          termsErr.textContent = form.elements.terms.checked ? '' : t('val.terms');
          if (!d) return;
          if (!form.elements.terms.checked) { form.elements.terms.focus(); return; }
          const btn = form.querySelector('[type=submit]');
          OZ.ui.busy(btn, true, t('auth.creating'));
          OZ.ui.formAlert(form, '');
          S.register({ email: d.email, password: d.password, name: d.name }).then(res => {
            if (d.newsletter) S.updatePrefs({ newsletter: true });
            sessionStorage.setItem('oz_demo_code', res.code);
            OZ.ui.toast(t('auth.created'), 'success');
            location.hash = '#/verify' + (q.next ? '?next=' + encodeURIComponent(q.next) : '');
          }).catch(err => {
            OZ.ui.busy(btn, false);
            OZ.ui.formAlert(form, OZ.ui.errorText(err));
            if (err.code === 'exists') form.elements.email.focus();
          });
        });
      }
    };
  };

  /* ---------- VERIFY ---------- */
  P.verify = (q) => {
    const u = S.user();
    if (!u) return { redirect: '#/login' };
    if (u.verified) return { redirect: safeNext(q.next) || '#/account' };
    const demo = u.verifyCode;
    const body = `<form data-verify novalidate>
        <div class="alert alert-info">${icon('mail')}<span>${esc(t('auth.verifySent', { email: u.email }))}<br><small>${esc(t('auth.demoCode'))} <strong dir="ltr">${esc(demo)}</strong></small></span></div>
        ${OZ.ui.field({ name: 'code', label: t('auth.code'), required: true, autocomplete: 'one-time-code', attrs: 'inputmode="numeric" maxlength="6" dir="ltr" class="code-input"' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('auth.verify'))}</button>
        <div class="row-between"><button type="button" class="link-btn" data-resend>${esc(t('auth.resend'))}</button><a href="${safeNext(q.next) || '#/account'}" class="small">${esc(t('auth.later'))}</a></div>
      </form>`;
    return {
      title: t('auth.verifyTitle'), html: authShell(t('auth.verifyTitle'), esc(t('auth.verifySub')), body), focus: '.page-title',
      mount(root) {
        const form = $('[data-verify]', root);
        form.addEventListener('submit', e => {
          e.preventDefault();
          const d = OZ.ui.validate(form, { code: [V.required, V.code] }); if (!d) return;
          const btn = form.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('auth.verifying'));
          S.verify(d.code).then(() => { OZ.ui.toast(t('auth.verified'), 'success'); location.hash = safeNext(q.next) || '#/account'; })
            .catch(err => { OZ.ui.busy(btn, false); OZ.ui.setError(form.elements.code, OZ.ui.errorText(err)); form.elements.code.focus(); });
        });
        form.querySelector('[data-resend]').addEventListener('click', e => {
          const b = e.currentTarget; OZ.ui.busy(b, true);
          S.resendVerification().then(r => { OZ.ui.busy(b, false); form.querySelector('.alert strong').textContent = r.code; OZ.ui.toast(t('auth.resent'), 'info'); })
            .catch(err => { OZ.ui.busy(b, false); OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
        });
      }
    };
  };

  /* ---------- PASSWORD RESET ---------- */
  P.reset = () => {
    const body = `<div data-reset-host></div>`;
    return {
      title: t('auth.resetTitle'), html: authShell(t('auth.resetTitle'), esc(t('auth.resetSub')), body), focus: '.page-title',
      mount(root) {
        const host = $('[data-reset-host]', root);
        let email = '';
        const step1 = () => {
          host.innerHTML = `<form data-r1 novalidate>${OZ.ui.field({ name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email' })}<button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('auth.sendCode'))}</button><p class="center"><a href="#/login">${esc(t('auth.backToLogin'))}</a></p></form>`;
          const f = host.querySelector('form');
          f.addEventListener('submit', e => {
            e.preventDefault();
            const d = OZ.ui.validate(f, { email: [V.required, V.email] }); if (!d) return;
            const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('auth.sending'));
            S.requestReset(d.email).then(r => { email = d.email; step2(r.code); }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, OZ.ui.errorText(err)); });
          });
        };
        const step2 = (code) => {
          host.innerHTML = `<form data-r2 novalidate>
            <div class="alert alert-success">${icon('mail')}<span>${esc(t('auth.resetSent', { email }))}${code ? `<br><small>${esc(t('auth.demoCode'))} <strong dir="ltr">${esc(code)}</strong></small>` : ''}</span></div>
            ${OZ.ui.field({ name: 'code', label: t('auth.code'), required: true, autocomplete: 'one-time-code', attrs: 'inputmode="numeric" maxlength="6" dir="ltr" class="code-input"' })}
            ${OZ.ui.field({ name: 'password', label: t('auth.newPassword'), type: 'password', required: true, autocomplete: 'new-password', hint: esc(t('val.passwordHint')) })}
            ${meterHtml()}
            ${OZ.ui.field({ name: 'confirm', label: t('form.confirmPassword'), type: 'password', required: true, autocomplete: 'new-password' })}
            <button class="btn btn-primary btn-block btn-lg" type="submit">${esc(t('auth.resetBtn'))}</button>
            <p class="center"><button type="button" class="link-btn" data-restart>${esc(t('auth.useOtherEmail'))}</button></p>
          </form>`;
          const f = host.querySelector('form');
          bindStrength(f);
          f.elements.code.focus();
          f.querySelector('[data-restart]').onclick = step1;
          f.addEventListener('submit', e => {
            e.preventDefault();
            const d = OZ.ui.validate(f, { code: [V.required, V.code], password: [V.required, V.password], confirm: [V.required, (v, all) => v === all.password ? '' : t('val.match')] }); if (!d) return;
            const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
            S.resetPassword(email, d.code, d.password).then(() => {
              host.innerHTML = `<div class="done-state">${icon('check', 'done-ic')}<h2>${esc(t('auth.resetDone'))}</h2><p class="muted">${esc(t('auth.resetDoneText'))}</p><a class="btn btn-primary btn-block" href="#/login?email=${encodeURIComponent(email)}">${esc(t('nav.login'))}</a></div>`;
              OZ.ui.announce(t('auth.resetDone'));
            }).catch(err => { OZ.ui.busy(btn, false); OZ.ui.setError(f.elements.code, OZ.ui.errorText(err)); f.elements.code.focus(); });
          });
        };
        step1();
      }
    };
  };

  /* =====================================================================
     WISHLIST (public page; persisted for logged-in users)
     ===================================================================== */
  function wishlistBlock() {
    const items = S.wishlist().map(S.product).filter(Boolean);
    const u = S.user();
    const guestNote = !u ? `<div class="alert alert-info wish-guest">${icon('lock')}<span>${esc(t('wish.guestNote'))}</span><a class="btn btn-sm btn-primary" href="#/login?next=${encodeURIComponent('/wishlist')}&reason=wishlist">${esc(t('nav.login'))}</a><a class="btn btn-sm btn-outline" href="#/register?next=${encodeURIComponent('/wishlist')}">${esc(t('auth.createAccount'))}</a></div>` : '';
    if (!items.length) return guestNote + C.empty({ ic: 'heart', title: t('wish.emptyTitle'), text: t('wish.emptyText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('wish.discover'))}</a><a class="btn btn-outline" href="#/shop/bestsellers">${esc(t('home.bestTitle'))}</a>` });
    return `${guestNote}<div class="wish-bar"><p class="muted">${esc(t('wish.count', { n: items.length }))}</p><button class="btn btn-outline btn-sm" data-action="wish-all-cart">${icon('bag')} ${esc(t('wish.allToCart'))}</button></div>
      <ul class="wish-list">${items.map(p => `<li class="wish-item">
        <a href="#/product/${p.id}" class="wi-img">${OZ.ui.img(p.img, '')}</a>
        <div class="wi-body"><p class="pcard-type">${esc(t('type.' + p.type))}</p><a class="wi-name" href="#/product/${p.id}">${esc(OZ.pname(p))}</a>
          <p class="pcard-price">${p.compareAt > p.price ? `<s>${money(p.compareAt)}</s>` : ''}<strong>${money(p.price)}</strong></p>${C.stockLabel(p)}</div>
        <div class="wi-actions">
          <button class="btn btn-teal btn-sm" data-action="wish-to-cart" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${esc(p.stock <= 0 ? t('stock.out') : t('wish.moveToCart'))}</button>
          <button class="link-btn" data-action="wish-remove" data-id="${p.id}">${icon('trash')} ${esc(t('cart.remove'))}</button>
        </div>
      </li>`).join('')}</ul>`;
  }
  OZ.bindWishlist = (root, host, render) => {
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.action === 'wish-remove') { OZ.ui.busy(b, true); S.toggleWishlist(id).then(() => OZ.ui.toast(t('wish.removed'), 'info')).catch(err => { OZ.ui.busy(b, false); OZ.ui.toast(OZ.ui.errorText(err), 'error'); }); }
      if (b.dataset.action === 'wish-to-cart') {
        OZ.ui.busy(b, true, t('cart.adding'));
        S.addToCart(id, null, 1).then(() => S.toggleWishlist(id)).then(() => { OZ.ui.toast(t('wish.moved'), 'success', { label: t('cart.viewCart'), href: '#/cart' }); })
          .catch(err => { OZ.ui.busy(b, false); OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
      }
      if (b.dataset.action === 'wish-all-cart') {
        OZ.ui.busy(b, true, t('cart.adding'));
        const ids = S.wishlist().filter(x => (S.product(x) || {}).stock > 0);
        ids.reduce((pr, x) => pr.then(() => S.addToCart(x, null, 1).then(() => S.toggleWishlist(x)).catch(() => { })), Promise.resolve())
          .then(() => { OZ.ui.toast(t('wish.allMoved'), 'success', { label: t('cart.viewCart'), href: '#/cart' }); });
      }
    });
    OZ.onStore(['wishlist', 'cart', 'currency', 'auth'], () => OZ.keepFocus(render));
  };

  P.wishlist = () => ({
    title: t('nav.wishlist'),
    html: `${C.breadcrumb([['#/', t('nav.home')], [null, t('nav.wishlist')]])}<section class="container section-sm"><h1 class="page-title left">${esc(t('nav.wishlist'))}</h1><div data-wish></div></section>`,
    mount(root) { const host = $('[data-wish]', root); const render = () => { host.innerHTML = wishlistBlock(); }; render(); OZ.bindWishlist(root, host, render); }
  });

  /* =====================================================================
     ACCOUNT AREA
     ===================================================================== */
  const SECTIONS = [['profile', 'user'], ['orders', 'box'], ['wishlist', 'heart'], ['addresses', 'pin'], ['dates', 'calendar'], ['settings', 'settings']];

  const OCC_ICON = { birthday: 'gift', anniversary: 'heart', valentine: 'heart', christmas: 'sparkle', newYear: 'sparkle', custom: 'calendar' };
  const FIXED = { valentine: '02-14', christmas: '12-25', newYear: '01-01' };
  function nextOccurrence(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00'); if (isNaN(d)) return null;
    const n = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (n < today) n.setFullYear(today.getFullYear() + 1);
    return n;
  }
  const daysUntil = d => Math.round((d - new Date(new Date().setHours(0, 0, 0, 0))) / 864e5);

  P.account = (section = 'profile', sub) => {
    const u = S.user();
    if (!u) return { redirect: '#/login?next=' + encodeURIComponent('/account' + (section !== 'profile' ? '/' + section : '') + (sub ? '/' + sub : '')) + '&reason=account' };
    if (section === 'logout') { S.logout(); OZ.ui.toast(t('auth.loggedOut'), 'info'); return { redirect: '#/' }; }
    if (!SECTIONS.some(s => s[0] === section)) section = 'profile';

    const nav = `<nav class="acc-nav" aria-label="${esc(t('account.nav'))}"><ul>
      ${SECTIONS.map(([k, ic]) => `<li><a href="#/account${k === 'profile' ? '' : '/' + k}" class="${k === section ? 'on' : ''}" ${k === section ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(t('account.' + k))}</span></a></li>`).join('')}
      ${u.role === 'admin' ? `<li><a href="#/admin">${icon('dashboard')}<span>${esc(t('admin.title'))}</span></a></li>` : ''}
      <li><button data-action="logout">${icon('logout')}<span>${esc(t('nav.logout'))}</span></button></li>
    </ul></nav>`;

    const html = `${C.breadcrumb([['#/', t('nav.home')], ['#/account', t('nav.account')], [null, t('account.' + section)]])}
      <section class="container account">
        <header class="acc-head"><div class="avatar" aria-hidden="true">${esc((u.name || u.email)[0].toUpperCase())}</div><div><p class="muted small">${esc(t('account.hello'))}</p><h1 class="page-title left sm">${esc(u.name || u.email)}</h1></div></header>
        ${!u.verified ? `<div class="alert alert-warn">${icon('mail')}<span>${esc(t('account.unverified'))}</span><a class="btn btn-sm btn-primary" href="#/verify">${esc(t('auth.verify'))}</a></div>` : ''}
        <div class="acc-grid">${nav}<div class="acc-main" data-acc-main></div></div>
      </section>`;

    return {
      title: `${t('account.' + section)} — ${t('nav.account')}`, html,
      mount(root) {
        const main = $('[data-acc-main]', root);
        const renderers = { profile: profileSec, orders: ordersSec, wishlist: wishSec, addresses: addressesSec, dates: datesSec, settings: settingsSec };
        renderers[section](main, sub, root);
      }
    };
  };

  /* ---- profile ---- */
  function profileSec(main) {
    const u = S.user();
    const orders = S.myOrders();
    const upcoming = u.dates.filter(d => d.date).map(d => ({ d, next: nextOccurrence(d.date) })).filter(x => x.next).sort((a, b) => a.next - b.next)[0];
    main.innerHTML = `<h2 class="acc-h">${esc(t('account.profile'))}</h2>
      <div class="acc-cards">
        <a class="acc-stat card" href="#/account/orders">${icon('box')}<strong>${orders.length}</strong><span>${esc(t('account.orders'))}</span></a>
        <a class="acc-stat card" href="#/account/wishlist">${icon('heart')}<strong>${S.wishlist().length}</strong><span>${esc(t('account.wishlist'))}</span></a>
        <a class="acc-stat card" href="#/account/dates">${icon('calendar')}<strong>${upcoming ? daysUntil(upcoming.next) : '—'}</strong><span>${upcoming ? esc(t('dates.daysUntil', { name: upcoming.d.name })) : esc(t('dates.noneShort'))}</span></a>
      </div>
      <form class="card form-card" data-profile novalidate>
        <h3 class="card-h">${esc(t('account.details'))}</h3>
        <div class="grid-2">${OZ.ui.field({ name: 'name', label: t('form.fullName'), required: true, value: u.name || '', autocomplete: 'name' })}
        ${OZ.ui.field({ name: 'phone', label: t('form.phone'), type: 'tel', value: u.phone || '', autocomplete: 'tel', attrs: 'dir="ltr"' })}</div>
        <div class="field"><label for="pf-email">${esc(t('form.email'))}</label><div class="control"><input id="pf-email" value="${esc(u.email)}" readonly aria-describedby="pf-email-h"></div><p class="hint" id="pf-email-h">${u.verified ? `${icon('check')} ${esc(t('account.verified'))}` : esc(t('account.unverifiedShort'))}</p></div>
        <div class="btn-row"><button class="btn btn-primary" type="submit">${esc(t('common.saveChanges'))}</button></div>
      </form>`;
    const f = $('[data-profile]', main);
    f.addEventListener('submit', e => {
      e.preventDefault();
      const d = OZ.ui.validate(f, { name: [V.required, V.min(2)], phone: [V.phone] }); if (!d) return;
      const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
      S.updateProfile(d).then(() => { OZ.ui.busy(btn, false); OZ.ui.toast(t('account.saved'), 'success'); $('.acc-head h1').textContent = d.name; })
        .catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, OZ.ui.errorText(err)); });
    });
  }

  /* ---- orders ---- */
  function ordersSec(main, sub) {
    if (sub) {
      const o = S.order(sub);
      if (!o || !S.canViewOrder(o)) { main.innerHTML = C.empty({ ic: 'box', title: t('order.notFound'), actions: `<a class="btn btn-primary" href="#/account/orders">${esc(t('order.back'))}</a>` }); return; }
      main.innerHTML = `<a class="link-arrow back" href="#/account/orders">${icon('arrowRight', 'flip rot')} ${esc(t('order.back'))}</a>
        <div class="row-between"><h2 class="acc-h">${esc(t('order.title', { id: o.id }))}</h2><button class="btn btn-outline btn-sm" data-buy-again>${icon('refresh')} ${esc(t('order.buyAgain'))}</button></div>
        ${OZ.orderDetail(o, { inAccount: true })}
        <p class="muted small">${esc(t('order.help'))} <a href="#/contact">${esc(t('nav.contact'))}</a></p>`;
      main.querySelector('[data-buy-again]').addEventListener('click', e => {
        const b = e.currentTarget; OZ.ui.busy(b, true, t('cart.adding'));
        o.items.reduce((pr, i) => pr.then(() => S.addToCart(i.productId, i.sizeId, i.qty).catch(() => { })), Promise.resolve())
          .then(() => { OZ.ui.busy(b, false); C.openCart(true); });
      });
      return;
    }
    const orders = S.myOrders();
    if (!orders.length) { main.innerHTML = `<h2 class="acc-h">${esc(t('account.orders'))}</h2>` + C.empty({ ic: 'box', title: t('order.noneTitle'), text: t('order.noneText'), actions: `<a class="btn btn-primary" href="#/shop/diffusers">${esc(t('cart.startShopping'))}</a>` }); return; }
    main.innerHTML = `<h2 class="acc-h">${esc(t('account.orders'))}</h2>
      <ul class="order-list">${orders.map(o => `<li class="order-row card">
        <div class="or-thumbs">${o.items.slice(0, 3).map(i => OZ.ui.img(i.img, '')).join('')}</div>
        <div class="or-info"><strong>${esc(o.id)}</strong><span class="muted small">${OZ.ui.date(o.date)} · ${esc(t('cart.itemsN', { n: o.items.reduce((a, i) => a + i.qty, 0) }))}</span></div>
        <span class="status status-${o.status}">${esc(t('status.' + o.status))}</span>
        <strong class="or-total">${money(o.totals.total)}</strong>
        <a class="btn btn-outline btn-sm" href="#/account/orders/${o.id}" aria-label="${esc(t('order.viewN', { id: o.id }))}">${esc(t('order.details'))}</a>
      </li>`).join('')}</ul>`;
  }

  /* ---- wishlist ---- */
  function wishSec(main, sub, root) {
    main.innerHTML = `<h2 class="acc-h">${esc(t('account.wishlist'))}</h2><div data-wish></div>`;
    const host = $('[data-wish]', main); const render = () => { host.innerHTML = wishlistBlock(); };
    render(); OZ.bindWishlist(root, host, render);
  }

  /* ---- addresses ---- */
  function addressesSec(main) {
    const render = () => {
      const list = S.user().addresses;
      main.innerHTML = `<div class="row-between"><h2 class="acc-h">${esc(t('account.addresses'))}</h2>${list.length ? `<button class="btn btn-primary btn-sm" data-add-addr>${icon('plus')} ${esc(t('addr.add'))}</button>` : ''}</div>
        ${list.length ? `<ul class="addr-grid">${list.map(a => `<li class="card addr${a.isDefault ? ' is-default' : ''}">
          <div class="row-between"><strong>${esc(a.label || t('addr.address'))}</strong>${a.isDefault ? `<span class="badge badge-best">${esc(t('addr.default'))}</span>` : ''}</div>
          <p>${OZ.formatAddress(a)}</p>
          <div class="btn-row">
            <button class="link-btn" data-edit-addr="${a.id}">${icon('edit')} ${esc(t('common.edit'))}</button>
            ${!a.isDefault ? `<button class="link-btn" data-default-addr="${a.id}">${esc(t('addr.makeDefault'))}</button>` : ''}
            <button class="link-btn danger" data-del-addr="${a.id}">${icon('trash')} ${esc(t('common.delete'))}</button>
          </div></li>`).join('')}</ul>`
        : C.empty({ ic: 'pin', title: t('addr.noneTitle'), text: t('addr.noneText'), actions: `<button class="btn btn-primary" data-add-addr>${icon('plus')} ${esc(t('addr.add'))}</button>` })}`;
    };
    const openForm = (a) => {
      OZ.ui.overlay({
        title: esc(t(a ? 'addr.edit' : 'addr.add')), size: 'md',
        body: `<form data-addr-form novalidate>
          ${OZ.ui.field({ name: 'label', label: t('addr.label'), value: a ? a.label : '', placeholder: t('addr.labelPh') })}
          ${OZ.addressFields(a || {})}
          <label class="check"><input type="checkbox" name="isDefault" ${a && a.isDefault ? 'checked' : ''}><span class="box" aria-hidden="true">${icon('check')}</span><span>${esc(t('addr.setDefault'))}</span></label>
          <div class="btn-row end"><button type="button" class="btn btn-ghost" data-ov-close>${esc(t('common.cancel'))}</button><button class="btn btn-primary" type="submit">${esc(t('common.save'))}</button></div>
        </form>`,
        onMount(o) {
          const f = o.el.querySelector('form');
          f.addEventListener('submit', e => {
            e.preventDefault();
            const d = OZ.ui.validate(f, OZ.addrRules()); if (!d) return;
            const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
            const rec = { id: a ? a.id : undefined, label: (d.label || '').trim() || t('addr.address'), firstName: d.firstName.trim(), lastName: d.lastName.trim(), country: d.country, line1: d.line1.trim(), line2: (d.line2 || '').trim(), city: d.city.trim(), state: (d.state || '').trim(), phone: d.phone.trim(), isDefault: !!d.isDefault };
            S.saveAddress(rec).then(() => { o.close(); render(); OZ.ui.toast(t(a ? 'addr.updated' : 'addr.saved'), 'success'); })
              .catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, OZ.ui.errorText(err)); });
          });
        }
      });
    };
    main.addEventListener('click', e => {
      if (e.target.closest('[data-add-addr]')) openForm(null);
      const ed = e.target.closest('[data-edit-addr]'); if (ed) openForm(S.user().addresses.find(a => a.id === ed.dataset.editAddr));
      const df = e.target.closest('[data-default-addr]'); if (df) { OZ.ui.busy(df, true); S.setDefaultAddress(df.dataset.defaultAddr).then(() => { render(); OZ.ui.toast(t('addr.defaultSet'), 'success'); }); }
      const dl = e.target.closest('[data-del-addr]');
      if (dl) OZ.ui.confirm(t('addr.confirmDelete'), { confirmLabel: t('common.delete') }).then(ok => { if (!ok) return; S.deleteAddress(dl.dataset.delAddr).then(() => { render(); OZ.ui.toast(t('addr.deleted'), 'info'); }).catch(err => OZ.ui.toast(OZ.ui.errorText(err), 'error')); });
    });
    render();
  }

  /* ---- special dates ---- */
  function datesSec(main) {
    const render = () => {
      const list = S.user().dates.map(d => ({ d, next: nextOccurrence(d.date) })).sort((a, b) => (a.next || 0) - (b.next || 0));
      main.innerHTML = `<div class="row-between"><h2 class="acc-h">${esc(t('account.dates'))}</h2>${list.length ? `<button class="btn btn-primary btn-sm" data-add-date>${icon('plus')} ${esc(t('dates.add'))}</button>` : ''}</div>
        <p class="muted">${esc(t('dates.intro'))}</p>
        ${list.length ? `<ul class="date-list">${list.map(({ d, next }) => {
          const n = next ? daysUntil(next) : null;
          return `<li class="card date-row${d.reminder ? '' : ' off'}">
            <span class="date-ic">${icon(OCC_ICON[d.occasion] || 'calendar')}</span>
            <div class="date-info"><strong>${esc(d.name)}</strong><span class="muted small">${esc(d.occasion === 'custom' ? (d.label || t('occ.custom')) : t('occ.' + d.occasion))} · ${next ? OZ.ui.date(next, { day: 'numeric', month: 'long' }) : ''}</span>
              <span class="small">${n === 0 ? `<strong class="today">${esc(t('dates.today'))}</strong>` : esc(t('dates.inDays', { n }))}${d.reminder ? ` · ${icon('bell')} ${esc(t('dates.remind', { when: t('dates.timing.' + d.timing) }))} · ${esc(t('dates.via.' + d.method))}` : ''}</span></div>
            <label class="switch"><input type="checkbox" role="switch" data-toggle-rem="${d.id}" ${d.reminder ? 'checked' : ''} aria-label="${esc(t('dates.reminderFor', { name: d.name }))}"><span aria-hidden="true"></span></label>
            <div class="date-acts">
              <a class="link-btn" href="#/shop/gifts">${icon('gift')} ${esc(t('dates.shopGift'))}</a>
              <button class="link-btn" data-edit-date="${d.id}" aria-label="${esc(t('common.edit'))} — ${esc(d.name)}">${icon('edit')}</button>
              <button class="link-btn danger" data-del-date="${d.id}" aria-label="${esc(t('common.delete'))} — ${esc(d.name)}">${icon('trash')}</button>
            </div>
          </li>`;
        }).join('')}</ul>`
        : C.empty({ ic: 'calendar', title: t('dates.noneTitle'), text: t('dates.noneText'), actions: `<button class="btn btn-primary" data-add-date>${icon('plus')} ${esc(t('dates.add'))}</button>` })}`;
    };
    const openForm = (d) => {
      const v = d || { occasion: 'birthday', name: '', date: '', reminder: true, timing: 7, method: 'email', note: '', label: '' };
      OZ.ui.overlay({
        title: esc(t(d ? 'dates.edit' : 'dates.add')), size: 'md',
        body: `<form data-date-form novalidate>
          ${OZ.ui.field({ name: 'occasion', label: t('dates.occasion'), required: true, value: v.occasion, options: ['birthday', 'anniversary', 'valentine', 'christmas', 'newYear', 'custom'].map(o => ({ value: o, label: t('occ.' + o) })) })}
          <div data-custom-label ${v.occasion === 'custom' ? '' : 'hidden'}>${OZ.ui.field({ name: 'label', label: t('dates.customLabel'), value: v.label || '', required: true, placeholder: t('dates.customPh') })}</div>
          <div class="grid-2">
            ${OZ.ui.field({ name: 'name', label: t('dates.person'), required: true, value: v.name, placeholder: t('dates.personPh') })}
            ${OZ.ui.field({ name: 'date', label: t('dates.date'), type: 'date', required: true, value: v.date })}
          </div>
          <fieldset class="fs"><legend>${esc(t('dates.reminders'))}</legend>
            <label class="switch-row"><span>${esc(t('dates.enable'))}</span><span class="switch"><input type="checkbox" role="switch" name="reminder" ${v.reminder ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
            <div data-rem-opts ${v.reminder ? '' : 'hidden'}>
              ${OZ.ui.field({ name: 'timing', label: t('dates.when'), value: v.timing, options: [0, 1, 3, 7, 14].map(n => ({ value: n, label: t('dates.timing.' + n) })) })}
              <fieldset class="fs sub"><legend>${esc(t('dates.method'))}</legend>
                <label class="opt-card sm"><input type="radio" name="method" value="email" ${v.method !== 'whatsapp' ? 'checked' : ''}><span class="oc-body">${icon('mail')}<strong>${esc(t('dates.via.email'))}</strong><small>${esc(S.user().email)}</small></span></label>
                <label class="opt-card sm disabled"><input type="radio" name="method" value="whatsapp" disabled aria-describedby="wa-soon"><span class="oc-body">${icon('whatsapp')}<strong>${esc(t('dates.via.whatsapp'))}</strong><small id="wa-soon">${esc(t('common.comingSoon'))}</small></span></label>
              </fieldset>
            </div>
          </fieldset>
          ${OZ.ui.field({ name: 'note', label: t('dates.note'), type: 'textarea', rows: 2, value: v.note || '', placeholder: t('dates.notePh'), attrs: 'maxlength="200"' })}
          <div class="btn-row end"><button type="button" class="btn btn-ghost" data-ov-close>${esc(t('common.cancel'))}</button><button class="btn btn-primary" type="submit">${esc(t('common.save'))}</button></div>
        </form>`,
        onMount(o) {
          const f = o.el.querySelector('form');
          f.addEventListener('change', e => {
            if (e.target.name === 'occasion') {
              f.querySelector('[data-custom-label]').hidden = e.target.value !== 'custom';
              const fx = FIXED[e.target.value];
              if (fx) { const y = new Date().getFullYear(); let ds = `${y}-${fx}`; if (new Date(ds) < new Date(new Date().toDateString())) ds = `${y + 1}-${fx}`; f.elements.date.value = ds; }
            }
            if (e.target.name === 'reminder') f.querySelector('[data-rem-opts]').hidden = !e.target.checked;
          });
          f.addEventListener('submit', e => {
            e.preventDefault();
            const rules = { name: [V.required, V.max(60)], date: [V.required] };
            if (f.elements.occasion.value === 'custom') rules.label = [V.required, V.max(40)];
            const x = OZ.ui.validate(f, rules); if (!x) return;
            const btn = f.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
            S.saveDate({ id: d ? d.id : undefined, occasion: x.occasion, label: x.occasion === 'custom' ? x.label.trim() : '', name: x.name.trim(), date: x.date, reminder: !!x.reminder, timing: +x.timing || 0, method: x.method || 'email', note: (x.note || '').trim() })
              .then(() => { o.close(); render(); OZ.ui.toast(t(d ? 'dates.updated' : 'dates.saved'), 'success'); })
              .catch(err => { OZ.ui.busy(btn, false); OZ.ui.formAlert(f, OZ.ui.errorText(err)); });
          });
        }
      });
    };
    main.addEventListener('click', e => {
      if (e.target.closest('[data-add-date]')) openForm(null);
      const ed = e.target.closest('[data-edit-date]'); if (ed) openForm(S.user().dates.find(x => x.id === ed.dataset.editDate));
      const dl = e.target.closest('[data-del-date]');
      if (dl) OZ.ui.confirm(t('dates.confirmDelete'), { confirmLabel: t('common.delete') }).then(ok => { if (ok) S.deleteDate(dl.dataset.delDate).then(() => { render(); OZ.ui.toast(t('dates.deleted'), 'info'); }); });
    });
    main.addEventListener('change', e => {
      const tg = e.target.closest('[data-toggle-rem]'); if (!tg) return;
      tg.disabled = true;
      S.toggleReminder(tg.dataset.toggleRem).then(on => { OZ.keepFocus(render); OZ.ui.toast(t(on ? 'dates.remOn' : 'dates.remOff'), 'info'); })
        .catch(err => { tg.disabled = false; tg.checked = !tg.checked; OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
    });
    render();
  }

  /* ---- settings ---- */
  function settingsSec(main) {
    const u = S.user();
    main.innerHTML = `<h2 class="acc-h">${esc(t('account.settings'))}</h2>
      <form class="card form-card" data-prefs>
        <h3 class="card-h">${esc(t('settings.notifications'))}</h3>
        <label class="switch-row"><span>${esc(t('settings.orderEmails'))}<small class="muted">${esc(t('settings.orderEmailsD'))}</small></span><span class="switch"><input type="checkbox" role="switch" name="orderEmails" ${u.prefs.orderEmails ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
        <label class="switch-row"><span>${esc(t('settings.newsletter'))}<small class="muted">${esc(t('settings.newsletterD'))}</small></span><span class="switch"><input type="checkbox" role="switch" name="newsletter" ${u.prefs.newsletter ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
      </form>
      <div class="card form-card"><h3 class="card-h">${esc(t('settings.regional'))}</h3>${C.localeControls('acc')}</div>
      <form class="card form-card" data-pw novalidate>
        <h3 class="card-h">${esc(t('settings.password'))}</h3>
        ${OZ.ui.field({ name: 'current', label: t('settings.currentPw'), type: 'password', required: true, autocomplete: 'current-password' })}
        ${OZ.ui.field({ name: 'password', label: t('auth.newPassword'), type: 'password', required: true, autocomplete: 'new-password', hint: esc(t('val.passwordHint')) })}
        ${meterHtml()}
        <div class="btn-row"><button class="btn btn-primary" type="submit">${esc(t('settings.updatePw'))}</button></div>
      </form>
      <div class="card form-card"><h3 class="card-h">${esc(t('nav.logout'))}</h3><p class="muted">${esc(t('settings.logoutD'))}</p><button class="btn btn-outline" data-action="logout">${icon('logout')} ${esc(t('nav.logout'))}</button></div>`;
    $('[data-prefs]', main).addEventListener('change', e => {
      const el = e.target; el.disabled = true;
      S.updatePrefs({ [el.name]: el.checked }).then(() => { el.disabled = false; OZ.ui.toast(t('account.saved'), 'success'); })
        .catch(err => { el.disabled = false; el.checked = !el.checked; OZ.ui.toast(OZ.ui.errorText(err), 'error'); });
    });
    const pf = $('[data-pw]', main); bindStrength(pf);
    pf.addEventListener('submit', e => {
      e.preventDefault();
      const d = OZ.ui.validate(pf, { current: [V.required], password: [V.required, V.password, (v, all) => v !== all.current ? '' : t('val.samePw')] }); if (!d) return;
      const btn = pf.querySelector('[type=submit]'); OZ.ui.busy(btn, true, t('common.saving'));
      S.changePassword(d.current, d.password).then(() => { OZ.ui.busy(btn, false); pf.reset(); pf.querySelector('[data-strength]').dataset.level = 0; OZ.ui.toast(t('settings.pwChanged'), 'success'); })
        .catch(err => { OZ.ui.busy(btn, false); if (err.code === 'badPassword') { OZ.ui.setError(pf.elements.current, OZ.ui.errorText(err)); pf.elements.current.focus(); } else OZ.ui.formAlert(pf, OZ.ui.errorText(err)); });
    });
  }
})();
