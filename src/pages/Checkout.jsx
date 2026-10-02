import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Empty, Field, Check, Img } from '../components/common.jsx';
import { Overlay, Button, Alert, Spinner, useUI } from '../components/ui.jsx';
import { Logo } from '../components/Header.jsx';
import { SummaryRows, CouponBox } from './Cart.jsx';
import { formatAddress } from './Order.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money, errorText } from '../lib/format.js';
import { V, card } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { navigate, useTitle } from '../lib/router.js';
import { CRYPTO } from '../data/catalog.js';

const STEPS = ['info', 'shipping', 'payment', 'done'];
const COUNTRIES = ['AE', 'SA', 'OM', 'QA', 'BH', 'KW', 'GB', 'US', 'ES', 'OTHER'];
const CK = 'oz_checkout_v1';
const ck = {
  get() { try { return JSON.parse(sessionStorage.getItem(CK)) || {}; } catch (e) { return {}; } },
  set(patch) { const v = Object.assign(ck.get(), patch); try { sessionStorage.setItem(CK, JSON.stringify(v)); } catch (e) { /* storage blocked */ } return v; },
  clear() { try { sessionStorage.removeItem(CK); } catch (e) { /* storage blocked */ } }
};

export const addrRules = (prefix = '') => ({ [prefix + 'firstName']: [V.required], [prefix + 'lastName']: [V.required], [prefix + 'country']: [V.required], [prefix + 'line1']: [V.required, V.min(4)], [prefix + 'city']: [V.required], [prefix + 'phone']: [V.required, V.phone] });

export function AddressFields({ a = {}, prefix = '', f }) {
  const err = n => f.errors[prefix + n];
  const F = (n, props) => <Field name={prefix + n} error={err(n)} onClear={f.clear} defaultValue={a[n] || ''} {...props} />;
  return (<>
    <div className="grid-2">{F('firstName', { label: t('form.firstName'), required: true, autoComplete: 'given-name' })}{F('lastName', { label: t('form.lastName'), required: true, autoComplete: 'family-name' })}</div>
    <Field name={prefix + 'country'} label={t('form.country')} required defaultValue={a.country || 'AE'} options={COUNTRIES.map(c => ({ value: c, label: t('country.' + c) }))} autoComplete="country" error={err('country')} onClear={f.clear} />
    {F('line1', { label: t('form.line1'), required: true, autoComplete: 'address-line1' })}
    {F('line2', { label: t('form.line2'), autoComplete: 'address-line2' })}
    <div className="grid-2">{F('city', { label: t('form.city'), required: true, autoComplete: 'address-level2' })}{F('state', { label: t('form.state'), autoComplete: 'address-level1' })}</div>
    {F('phone', { label: t('form.phone'), type: 'tel', required: true, autoComplete: 'tel', hint: t('form.phoneHint'), dir: 'ltr' })}
  </>);
}

export const pickAddress = (d, prefix = '') => ({ firstName: d[prefix + 'firstName'].trim(), lastName: d[prefix + 'lastName'].trim(), country: d[prefix + 'country'], line1: d[prefix + 'line1'].trim(), line2: (d[prefix + 'line2'] || '').trim(), city: d[prefix + 'city'].trim(), state: (d[prefix + 'state'] || '').trim(), phone: d[prefix + 'phone'].trim() });

function Stepper({ active }) {
  const idx = STEPS.indexOf(active);
  return (
    <ol className="stepper" aria-label={t('ck.progress')}>
      {STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
        const inner = <><span className="st-n">{state === 'done' ? <Icon name="check" /> : i + 1}</span><span className="st-l">{t('ck.step.' + s)}</span></>;
        return <li key={s} className={`st ${state}`} aria-current={state === 'current' ? 'step' : undefined}>{state === 'done' && s !== 'done' ? <a href={`#/checkout/${s}`}>{inner}</a> : inner}</li>;
      })}
    </ol>
  );
}

function Aside({ tt, shippingMethod }) {
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 900px)').matches);
  return (
    <aside className="summary card ck-aside" aria-labelledby="ck-sum-h">
      <details className="ck-sum-toggle" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
        <summary><h2 id="ck-sum-h" className="sum-h">{t('ck.summary')}</h2><span className="muted">{money(tt.total)}</span><Icon name="chevDown" /></summary>
        <ul className="ck-items">{tt.lines.map(v => (
          <li key={v.line.id}><span className="ck-img"><Img k={v.product.img} /><span className="ck-q">{v.line.qty}</span></span>
            <span className="ck-name">{pname(v.product)}<small>{t('size.ml', { n: v.size.ml })}{v.line.gift && <> · <Icon name="gift" /> {t('gift.for', { name: v.line.gift.recipientName })}</>}</small>
              {v.compare > v.price && <small className="save-txt">{t('price.save', { amount: money((v.compare - v.price) * v.line.qty) })}</small>}</span>
            <span className="ck-price">{money(v.total)}</span></li>
        ))}</ul>
        <CouponBox tt={tt} />
        <SummaryRows tt={tt} estimated={!shippingMethod} />
      </details>
    </aside>
  );
}

function InfoStep() {
  const ui = useUI();
  const f = useForm();
  const st = ck.get();
  const u = S.user();
  const [create, setCreate] = useState(!!(st.contact || {}).createAccount);
  const [busy, setBusy] = useState(false);
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    if (S.user()) { ck.set({ contact: { email: S.user().email, newsletter: form.elements.newsletter.checked } }); navigate('#/checkout/shipping'); return; }
    const d = f.validate(form, Object.assign({ email: [V.required, V.email] }, create ? { password: [V.required, V.password] } : {}));
    if (!d) return;
    ck.set({ contact: { email: d.email.trim(), newsletter: !!d.newsletter, createAccount: create } });
    if (!create) { navigate('#/checkout/shipping'); return; }
    setBusy(true);
    S.register({ email: d.email, password: d.password, name: '' }).then(res => {
      ui.toast(t('auth.createdVerify', { code: res.code }), 'success');
      navigate('#/checkout/shipping');
    }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: err.code === 'exists' ? t('err.existsCheckout') : errorText(err) }); });
  };
  return (
    <form className="ck-form" data-ck="info" noValidate onSubmit={submit}>
      <h2 className="ck-h">{t('ck.step.info')}</h2>
      {f.alert && <Alert>{f.alert.msg}</Alert>}
      {u ? (
        <div className="signed-in card"><Icon name="user" /><div><p>{t('ck.signedInAs')}</p><strong>{u.email}</strong></div><button type="button" className="link-btn" onClick={() => S.logout()}>{t('nav.logout')}</button></div>
      ) : (<>
        <p className="muted">{t('ck.haveAccount')} <a href={`#/login?next=${encodeURIComponent('/checkout')}`}>{t('nav.login')}</a></p>
        <Field name="email" label={t('form.email')} type="email" required defaultValue={(st.contact || {}).email || ''} autoComplete="email" hint={t('ck.emailHint')} error={f.errors.email} onClear={f.clear} />
        <Check name="createAccount" checked={create} onChange={e => setCreate(e.target.checked)} label={t('ck.createAccount')} />
        {create && <Field name="password" label={t('form.password')} type="password" required autoComplete="new-password" hint={t('val.passwordHint')} error={f.errors.password} onClear={f.clear} />}
      </>)}
      <Check name="newsletter" defaultChecked={!!(st.contact || {}).newsletter} label={t('ck.newsletter')} />
      <div className="ck-nav"><a className="link-arrow back" href="#/cart"><Icon name="arrowRight" className="flip rot" /> {t('ck.backCart')}</a>
        <Button type="submit" className="btn btn-primary btn-lg" busy={busy} busyLabel={t('auth.creating')}>{t('ck.toShipping')} <Icon name="arrowRight" className="flip" /></Button></div>
    </form>
  );
}

function ShippingStep({ onMethod }) {
  const ui = useUI();
  const f = useForm();
  const st = ck.get();
  const u = S.user();
  const saved = u ? u.addresses : [];
  const [sel, setSel] = useState(st.addressId || (saved.find(a => a.isDefault) || {}).id || (saved[0] || {}).id || 'new');
  const [method, setMethod] = useState(st.shippingMethod || 'standard');
  const [busy, setBusy] = useState(false);
  const set = S.settings();
  const stdFree = S.totals({ shippingMethod: 'standard' }).shipping === 0;
  const prefill = st.shipping && st.addressId === 'new' ? st.shipping : (u ? { firstName: (u.name || '').split(' ')[0], lastName: (u.name || '').split(' ').slice(1).join(' '), phone: u.phone } : {});
  const pick = m => { setMethod(m); ck.set({ shippingMethod: m }); onMethod(m); };

  const submit = e => {
    e.preventDefault();
    if (sel !== 'new') { ck.set({ addressId: sel, shipping: saved.find(x => x.id === sel), shippingMethod: method }); navigate('#/checkout/payment'); return; }
    const d = f.validate(e.currentTarget, addrRules());
    if (!d) return;
    const addr = pickAddress(d);
    ck.set({ addressId: 'new', shipping: addr, shippingMethod: method });
    if (u && d.saveAddress) {
      setBusy(true);
      S.saveAddress({ label: t('addr.address'), ...addr }).then(s => { ck.set({ addressId: s.id }); ui.toast(t('addr.saved'), 'success'); navigate('#/checkout/payment'); })
        .catch(() => navigate('#/checkout/payment'));
    } else navigate('#/checkout/payment');
  };

  return (
    <form className="ck-form" data-ck="shipping" noValidate onSubmit={submit}>
      <h2 className="ck-h">{t('ck.step.shipping')}</h2>
      {S.cart().some(l => l.gift) && <Alert type="info" icon="gift">{t('ck.giftAddress')}</Alert>}
      {saved.length > 0 && (
        <fieldset className="fs"><legend>{t('ck.savedAddresses')}</legend><div className="addr-pick">
          {saved.map(a => <label key={a.id} className="opt-card"><input type="radio" name="addressId" value={a.id} checked={sel === a.id} onChange={() => setSel(a.id)} />
            <span className="oc-body"><strong>{a.label || t('addr.address')}{a.isDefault && <> <span className="badge badge-muted">{t('addr.default')}</span></>}</strong><small>{formatAddress(a)}</small></span></label>)}
          <label className="opt-card"><input type="radio" name="addressId" value="new" checked={sel === 'new'} onChange={() => setSel('new')} /><span className="oc-body"><strong><Icon name="plus" /> {t('ck.newAddress')}</strong></span></label>
        </div></fieldset>
      )}
      {sel === 'new' && <div>
        <AddressFields a={prefill} f={f} />
        {u && <Check name="saveAddress" defaultChecked label={t('ck.saveAddress')} />}
      </div>}
      <fieldset className="fs"><legend>{t('ck.method')}</legend><div className="ship-opts">
        <label className="opt-card"><input type="radio" name="shippingMethod" value="standard" checked={method === 'standard'} onChange={() => pick('standard')} />
          <span className="oc-body"><Icon name="truck" /><strong>{t('ship.standard')}</strong><small>{t('ship.standardEta')}</small><em>{stdFree ? t('common.free') : money(set.shippingFee)}</em></span></label>
        <label className="opt-card"><input type="radio" name="shippingMethod" value="express" checked={method === 'express'} onChange={() => pick('express')} />
          <span className="oc-body"><Icon name="clock" /><strong>{t('ship.express')}</strong><small>{t('ship.expressEta')}</small><em>{money(set.expressFee)}</em></span></label>
      </div></fieldset>
      <div className="ck-nav"><a className="link-arrow back" href="#/checkout/info"><Icon name="arrowRight" className="flip rot" /> {t('ck.back')}</a>
        <Button type="submit" className="btn btn-primary btn-lg" busy={busy} busyLabel={t('common.saving')}>{t('ck.toPayment')} <Icon name="arrowRight" className="flip" /></Button></div>
    </form>
  );
}

/* Decorative QR-style pattern derived from the address (demo only — not scannable) */
function QrArt({ seed }) {
  let h = 7; const cells = [];
  for (let i = 0; i < 21 * 21; i++) { h = (h * 31 + seed.charCodeAt(i % seed.length)) % 9973; cells.push(h % 3 === 0); }
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  const finder = (x, y) => <g key={`${x}${y}`}><rect x={x} y={y} width="7" height="7" fill="none" stroke="currentColor" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>;
  const rects = [];
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if (!inFinder(x, y) && cells[y * 21 + x]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  return <svg viewBox="-1 -1 23 23" fill="currentColor">{finder(0.5, 0.5)}{finder(13.5, 0.5)}{finder(0.5, 13.5)}{rects}</svg>;
}

/* Closes the crypto quote once its timer runs out */
function ExpireWatch({ left, outcome, close }) {
  useEffect(() => { if (left <= 0 && !outcome.current) { outcome.current = 'expired'; close(); } }, [left, outcome, close]);
  return null;
}

function CryptoModal({ coin, onClose, onSent, onCancel }) {
  const ui = useUI();
  const c = CRYPTO[coin], tt = S.totals({ shippingMethod: ck.get().shippingMethod });
  const amt = (tt.total / c.aedPerCoin).toFixed(coin === 'USDT' ? 2 : 6);
  const [left, setLeft] = useState(15 * 60);
  const outcome = useRef(null);
  useEffect(() => { const h = setInterval(() => setLeft(l => l - 1), 1000); return () => clearInterval(h); }, []);
  return (
    <Overlay title={<><Icon name="crypto" /> {t('pay.cryptoTitle', { coin })}</>} size="md" className="crypto-ov" onClose={() => { const o = outcome.current; onClose(); if (o === 'sent') onSent(); else onCancel(o === 'expired' ? t('pay.cryptoExpired') : undefined); }}>
      {close => {
        return (<>
          <ExpireWatch left={left} outcome={outcome} close={close} />
          <div className="crypto-pay">
            <div className="qr" aria-hidden="true"><QrArt seed={c.address} /></div>
            <div className="crypto-det">
              <p className="muted small">{t('pay.sendExactly')}</p>
              <p className="c-amt" dir="ltr">{amt} {coin}</p>
              <p className="muted small">{t('pay.network')}: <strong>{c.network}</strong></p>
              <label className="muted small" htmlFor="c-addr">{t('pay.toAddress')}</label>
              <div className="copy-row"><input id="c-addr" readOnly value={c.address} dir="ltr" onFocus={e => e.target.select()} />
                <button className="btn btn-outline btn-sm" onClick={() => (navigator.clipboard ? navigator.clipboard.writeText(c.address) : Promise.reject()).then(() => ui.toast(t('common.copied'), 'info')).catch(() => {})}><Icon name="copy" /> {t('common.copy')}</button></div>
              <p className="c-timer"><Icon name="clock" /> <span>{String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0')}:{String(Math.max(0, left) % 60).padStart(2, '0')}</span> {t('pay.cryptoExpires')}</p>
              <Alert type="info">{t('pay.cryptoDemo')}</Alert>
            </div>
          </div>
          <div className="btn-row end"><button className="btn btn-ghost" onClick={() => { outcome.current = 'cancel'; close(); }}>{t('pay.cancel')}</button><button className="btn btn-teal" onClick={() => { outcome.current = 'sent'; close(); }}>{t('pay.cryptoSent')}</button></div>
        </>);
      }}
    </Overlay>
  );
}

function PaymentStep() {
  const f = useForm();
  const st = ck.get();
  const u = S.user();
  const [pm, setPm] = useState('card');
  const [coin, setCoin] = useState('USDT');
  const [billingSame, setBillingSame] = useState(true);
  const [brand, setBrand] = useState('');
  const [flow, setFlow] = useState(null); // {stage:'processing'|'submitting'|'result'|'crypto', ...}
  const cardRef = useRef(null);
  const timer = useRef(null);
  const tt = S.totals({ shippingMethod: st.shippingMethod });
  const email = u ? u.email : st.contact.email;
  const cryptoOn = S.settings().cryptoEnabled;
  useEffect(() => () => clearTimeout(timer.current), []);

  const placeOrder = payment => {
    setFlow({ stage: 'submitting', payment });
    S.placeOrder({ contact: { email }, shipping: st.shipping, shippingMethod: st.shippingMethod || 'standard', payment })
      .then(order => { ck.clear(); S.rememberLastOrder(order.id); setFlow(null); navigate(`#/order/${order.id}?new=1`); })
      .catch(err => setFlow({ stage: 'result', kind: 'orderFailed', payment, reason: errorText(err) }));
  };
  const run = (payment, outcome, isCrypto) => {
    setFlow({ stage: 'processing', payment, isCrypto });
    timer.current = setTimeout(() => {
      if (outcome !== 'ok') { setFlow({ stage: 'result', kind: 'failed', payment, reason: t(outcome === 'insufficient' ? 'pay.errFunds' : 'pay.errDeclined') }); return; }
      placeOrder(payment);
    }, isCrypto ? 3000 : 2200);
  };
  const pay = () => {
    if (!navigator.onLine) { f.setAlert({ type: 'error', msg: t('err.network') }); return; }
    if (pm === 'crypto') { setFlow({ stage: 'crypto' }); return; }
    const form = cardRef.current;
    const rules = {
      ccname: [V.required, V.min(2)],
      ccnum: [V.required, v => card.luhn(v) ? '' : t('pay.errNumber')],
      ccexp: [V.required, v => card.expiryOk(v) ? '' : t('pay.errExpiry')],
      cccvc: [V.required, v => new RegExp(card.brand(form.elements.ccnum.value) === 'amex' ? '^\\d{4}$' : '^\\d{3}$').test(v) ? '' : t('pay.errCvc')]
    };
    if (!billingSame) Object.assign(rules, addrRules('b_'));
    const d = f.validate(form, rules);
    if (!d) return;
    const digits = d.ccnum.replace(/\D/g, '');
    const outcome = digits.endsWith('0002') ? 'declined' : digits.endsWith('9995') ? 'insufficient' : 'ok';
    /* wipe sensitive values from the DOM as soon as they're read */
    form.elements.ccnum.value = ''; form.elements.cccvc.value = ''; setBrand('');
    run({ method: 'card', brand: card.brand(digits), last4: digits.slice(-4) }, outcome);
  };

  const cAmt = (tt.total / CRYPTO[coin].aedPerCoin).toFixed(coin === 'USDT' ? 2 : 6);
  const resultConf = flow && flow.stage === 'result' && {
    failed: { ic: 'alert', cls: 'err', title: t('pay.failedTitle'), text: flow.reason, next: t('pay.failedNext') },
    cancelled: { ic: 'info', cls: 'info', title: t('pay.cancelledTitle'), text: flow.reason || t('pay.cancelledText') },
    orderFailed: { ic: 'alert', cls: 'err', title: t('pay.orderFailedTitle'), text: flow.reason, next: t('pay.orderFailedNext') }
  }[flow.kind];

  return (
    <div className="ck-form" data-ck="payment">
      <h2 className="ck-h">{t('ck.review')}</h2>
      <div className="review-box card">
        <div className="rb-row"><span className="rb-l">{t('ck.contact')}</span><span>{email}</span><a href="#/checkout/info" className="link-btn">{t('common.change')}</a></div>
        <div className="rb-row"><span className="rb-l">{t('ck.shipTo')}</span><span>{formatAddress(st.shipping)}</span><a href="#/checkout/shipping" className="link-btn">{t('common.change')}</a></div>
        <div className="rb-row"><span className="rb-l">{t('ck.method')}</span><span>{t('ship.' + (st.shippingMethod || 'standard'))} · {tt.shipping ? money(tt.shipping) : t('common.free')}</span><a href="#/checkout/shipping" className="link-btn">{t('common.change')}</a></div>
      </div>

      <h2 className="ck-h">{t('ck.step.payment')}</h2>
      {f.alert && <Alert>{f.alert.msg}</Alert>}
      <p className="muted small"><Icon name="lock" /> {t('pay.secureNote')}</p>
      <div className="pay-methods" role="radiogroup" aria-label={t('pay.method')}>
        <div className={`pay-m${pm === 'card' ? ' on' : ''}`}>
          <label className="pay-head"><input type="radio" name="pm" value="card" checked={pm === 'card'} onChange={() => setPm('card')} /><span><Icon name="card" /> {t('pay.card')}</span>
            <span className="pm-marks"><span className="pm pm-visa">VISA</span><span className="pm pm-mc"><i /><i /></span><span className="pm pm-amex">AMEX</span></span></label>
          <form className="pay-body" data-card-form noValidate autoComplete="on" ref={cardRef} hidden={pm !== 'card'} onSubmit={e => { e.preventDefault(); pay(); }}>
            <Field name="ccname" label={t('pay.nameOnCard')} required autoComplete="cc-name" error={f.errors.ccname} onClear={f.clear} />
            <div className={`field card-num${f.errors.ccnum ? ' invalid' : ''}`}>
              <label htmlFor="ccnum">{t('pay.cardNumber')}</label>
              <div className="control">
                <input id="ccnum" name="ccnum" inputMode="numeric" autoComplete="cc-number" required aria-required="true" aria-invalid={f.errors.ccnum ? 'true' : 'false'} aria-describedby="ccnum-err ccnum-brand" dir="ltr" placeholder="1234 1234 1234 1234"
                  onInput={e => { const el = e.currentTarget; el.value = card.format(el.value); setBrand(card.brand(el.value)); f.clear('ccnum'); }} />
                <span className={`cc-brand ${brand}`} id="ccnum-brand" aria-live="polite">{brand ? t('pay.brand.' + brand) : ''}</span>
              </div>
              <p className="err" id="ccnum-err" role="alert">{f.errors.ccnum || ''}</p>
            </div>
            <div className="grid-2">
              <Field name="ccexp" label={t('pay.expiry')} required autoComplete="cc-exp" placeholder="MM / YY" inputMode="numeric" dir="ltr" maxLength={7} error={f.errors.ccexp} onClear={f.clear}
                onChange={e => { const el = e.currentTarget; let v = el.value.replace(/\D/g, '').slice(0, 4); if (v.length >= 3) v = v.slice(0, 2) + ' / ' + v.slice(2); else if (v.length === 2 && e.nativeEvent.inputType !== 'deleteContentBackward') v += ' / '; el.value = v; }} />
              <Field name="cccvc" label={t('pay.cvc')} required autoComplete="cc-csc" placeholder="123" inputMode="numeric" dir="ltr" maxLength={4} hint={t('pay.cvcHint')} error={f.errors.cccvc} onClear={f.clear}
                onChange={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 4); }} />
            </div>
            <Check name="billingSame" checked={billingSame} onChange={e => setBillingSame(e.target.checked)} label={t('pay.billingSame')} />
            {!billingSame && <AddressFields prefix="b_" f={f} />}
            <details className="demo-note"><summary><Icon name="info" /> {t('pay.demoTitle')}</summary><p>{t('pay.demoText')}</p>
              <ul><li><code dir="ltr">4242 4242 4242 4242</code> — {t('pay.demoOk')}</li><li><code dir="ltr">4000 0000 0000 0002</code> — {t('pay.demoDecline')}</li><li><code dir="ltr">5555 5555 5555 4444</code> — Mastercard</li></ul></details>
          </form>
        </div>
        {cryptoOn && (
          <div className={`pay-m${pm === 'crypto' ? ' on' : ''}`}>
            <label className="pay-head"><input type="radio" name="pm" value="crypto" checked={pm === 'crypto'} onChange={() => setPm('crypto')} /><span><Icon name="crypto" /> {t('pay.crypto')}</span><span className="pm-marks muted small">USDT · BTC · ETH</span></label>
            {pm === 'crypto' && <div className="pay-body">
              <fieldset className="fs"><legend>{t('pay.coin')}</legend><div className="coin-opts">{Object.entries(CRYPTO).map(([k, c]) => (
                <label key={k} className="opt-card sm"><input type="radio" name="coin" value={k} checked={coin === k} onChange={() => setCoin(k)} /><span className="oc-body"><strong>{k}</strong><small>{c.network}</small></span></label>
              ))}</div></fieldset>
              <div className="coin-box"><p><span className="muted">{t('pay.cryptoAmount')}</span><strong dir="ltr">{cAmt} {coin}</strong><small className="muted">≈ {money(tt.total)} · {t('pay.cryptoRate')}</small></p>
                <p className="muted small">{t('pay.cryptoHow', { network: CRYPTO[coin].network })}</p></div>
            </div>}
          </div>
        )}
      </div>
      <p className="muted small terms">{t('ck.terms')} <a href="#/policies/terms">{t('policy.terms')}</a> · <a href="#/policies/privacy">{t('policy.privacy')}</a></p>
      <div className="ck-nav"><a className="link-arrow back" href="#/checkout/shipping"><Icon name="arrowRight" className="flip rot" /> {t('ck.back')}</a>
        <button className="btn btn-teal btn-lg" data-action="pay" onClick={pay}><Icon name={pm === 'crypto' ? 'crypto' : 'lock'} /> {pm === 'crypto' ? t('pay.cryptoContinue') : t('pay.payNow', { amount: money(tt.total) })}</button></div>

      {flow && flow.stage === 'crypto' && <CryptoModal coin={coin} onClose={() => setFlow(null)} onSent={() => run({ method: 'crypto', coin }, 'ok', true)}
        onCancel={reason => setFlow({ stage: 'result', kind: 'cancelled', payment: { method: 'crypto', coin }, reason })} />}
      {flow && (flow.stage === 'processing' || flow.stage === 'submitting') && (
        <Overlay title={t('pay.statusTitle')} size="sm" className="pay-ov" dismissible={false} onClose={() => {}}>
          <div className="pay-state">
            <Spinner big />
            <h3>{flow.stage === 'submitting' ? t('pay.submitting') : t(flow.isCrypto ? 'pay.cryptoWaiting' : 'pay.processing')}</h3>
            <p className="muted">{flow.stage === 'submitting' ? t('pay.paidCreating') : t('pay.dontClose')}</p>
            {flow.stage === 'processing' && <button className="btn btn-ghost" onClick={() => { clearTimeout(timer.current); setFlow({ stage: 'result', kind: 'cancelled', payment: flow.payment }); }}>{t('pay.cancel')}</button>}
          </div>
        </Overlay>
      )}
      {resultConf && (
        <Overlay title={t('pay.statusTitle')} size="sm" className="pay-ov" onClose={() => setFlow(null)}>
          {close => (
            <div className={`pay-state ${resultConf.cls}`}>
              <span className="ps-ic"><Icon name={resultConf.ic} /></span>
              <h3>{resultConf.title}</h3><p>{resultConf.text}</p>
              {resultConf.next && <p className="muted small">{resultConf.next}</p>}
              <div className="btn-row center">
                {flow.kind === 'orderFailed'
                  ? <button className="btn btn-primary" onClick={() => placeOrder(flow.payment)}>{t('common.retry')}</button>
                  : <><button className="btn btn-primary" data-ov-close onClick={close}>{t('pay.tryAgain')}</button>
                    {cryptoOn && <button className="btn btn-outline" onClick={() => { setPm(flow.payment.method === 'card' ? 'crypto' : 'card'); close(); }}>{t('pay.otherMethod')}</button>}</>}
              </div>
            </div>
          )}
        </Overlay>
      )}
    </div>
  );
}

export default function Checkout({ step: rawStep }) {
  const step = STEPS.includes(rawStep) && rawStep !== 'done' ? rawStep : 'info';
  const [method, setMethod] = useState(ck.get().shippingMethod);
  useTitle(`${t('ck.title')} — ${t('ck.step.' + step)}`);
  const st = ck.get();
  const u = S.user();
  const redirect = !S.cart().length ? null
    : step !== 'info' && !(u || (st.contact && st.contact.email)) ? '#/checkout/info'
      : step === 'payment' && !st.shipping ? '#/checkout/shipping' : null;
  useEffect(() => { if (redirect) location.replace(location.href.split('#')[0] + redirect); }, [redirect]);

  if (!S.cart().length) return (
    <section className="container section"><Empty ic="bag" title={t('ck.emptyTitle')} text={t('ck.emptyText')}><a className="btn btn-primary" href="#/shop/diffusers">{t('cart.startShopping')}</a></Empty></section>
  );
  if (redirect) return null;
  const tt = S.totals({ shippingMethod: step === 'info' ? undefined : method });

  return (
    <section className="container ck-page">
      <div className="ck-top"><Logo small /><p className="muted small"><Icon name="lock" /> {t('ck.secure')}</p></div>
      <Stepper active={step} />
      <div className="ck-grid">
        <div className="ck-main">
          {step === 'info' && <InfoStep />}
          {step === 'shipping' && <ShippingStep onMethod={setMethod} />}
          {step === 'payment' && <PaymentStep />}
        </div>
        <div><Aside tt={tt} shippingMethod={step === 'info' ? null : method} /></div>
      </div>
    </section>
  );
}
