import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Breadcrumbs, Empty, PayMarks, SectionHead, Carousel } from '../components/common.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { CartLines, FreeShipBar } from '../components/Panels.jsx';
import { Button, Alert, useUI } from '../components/ui.jsx';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { money, errorText } from '../lib/format.js';
import { useTitle } from '../lib/router.js';

export function SummaryRows({ tt, estimated = true }) {
  return (
    <dl className="sum-rows">
      <div><dt>{t('cart.subtotal')} <span className="muted">({t('cart.itemsN', { n: tt.lines.reduce((a, v) => a + v.line.qty, 0) })})</span></dt><dd>{money(tt.subtotal)}</dd></div>
      {tt.savings > 0 && <div className="save"><dt>{t('cart.youSave')}</dt><dd>{money(tt.savings)}</dd></div>}
      {tt.discount > 0 && <div className="disc"><dt>{t('cart.coupon')} <span className="code">{tt.coupon.code}</span></dt><dd>− {money(tt.discount)}</dd></div>}
      {tt.giftFee > 0 && <div><dt>{t('cart.giftFee')}</dt><dd>{money(tt.giftFee)}</dd></div>}
      <div><dt>{t(estimated ? 'cart.shippingEst' : 'cart.shipping')}</dt><dd>{tt.shipping ? money(tt.shipping) : <span className="free">{t('common.free')}</span>}</dd></div>
      <div className="total"><dt>{t('cart.total')}</dt><dd>{money(tt.total)}</dd></div>
      <div className="vat"><dt>{t('cart.vatLine', { rate: S.settings().vatRate })}</dt><dd>{money(tt.vat)}</dd></div>
    </dl>
  );
}

export function CouponBox({ tt }) {
  const ui = useUI();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (tt.coupon) return (
    <div className="coupon-applied"><Icon name="tag" /><span>{t('coupon.applied', { code: tt.coupon.code })}<small>{tt.coupon.note || ''}</small></span>
      <button className="link-btn" onClick={() => { S.removeCoupon(); ui.toast(t('coupon.removed'), 'info'); }}>{t('cart.remove')}</button></div>
  );
  return (
    <form className="coupon-form" data-coupon noValidate onSubmit={e => {
      e.preventDefault();
      const input = e.currentTarget.elements.code;
      if (!input.value.trim()) { setErr(t('coupon.empty')); input.focus(); return; }
      setBusy(true);
      S.applyCoupon(input.value).then(c => { setBusy(false); setErr(''); ui.toast(t('coupon.success', { code: c.code }), 'success'); })
        .catch(e2 => { setBusy(false); setErr(errorText({ ...e2, ...(e2.min ? { min: money(e2.min) } : {}) })); input.focus(); });
    }}>
      <label htmlFor="coupon-in">{t('coupon.label')}</label>
      <div className="coupon-row">
        <input id="coupon-in" name="code" autoComplete="off" placeholder={t('coupon.ph')} aria-describedby="coupon-err" aria-invalid={err ? 'true' : undefined} onInput={() => err && setErr('')} />
        <Button type="submit" className="btn btn-dark" busy={busy} busyLabel={t('coupon.checking')}>{t('coupon.apply')}</Button>
      </div>
      <p className="err" id="coupon-err" role="alert">{err}</p>
      <p className="hint">{t('coupon.hint')}</p>
    </form>
  );
}

export default function Cart() {
  useTitle(t('cart.title'));
  const tt = S.totals();
  const hasOut = tt.lines.some(v => v.product.stock < v.line.qty);
  const recs = S.collection('signature').filter(p => !S.cart().some(l => l.productId === p.id));
  return (<>
    <Breadcrumbs items={[['#/', t('nav.home')], [null, t('cart.title')]]} />
    <section className="container cart-page">
      <h1 className="page-title left">{t('cart.title')}</h1>
      {!tt.lines.length ? (
        <Empty ic="bag" title={t('cart.emptyTitle')} text={t('cart.emptyText')}>
          <a className="btn btn-primary" href="#/shop/diffusers">{t('cart.startShopping')}</a>
          <a className="btn btn-outline" href="#/wishlist"><Icon name="heart" /> {t('nav.wishlist')}</a>
        </Empty>
      ) : (
        <div className="cart-grid">
          <div>
            <FreeShipBar tt={tt} />
            {hasOut && <Alert>{t('cart.stockIssue')}</Alert>}
            <CartLines lines={tt.lines} />
            <a className="link-arrow back" href="#/shop/diffusers"><Icon name="arrowRight" className="flip rot" /> {t('cart.continue')}</a>
          </div>
          <aside className="summary card" aria-labelledby="sum-h">
            <h2 id="sum-h" className="sum-h">{t('cart.summary')}</h2>
            <CouponBox tt={tt} />
            <SummaryRows tt={tt} />
            <a className={`btn btn-primary btn-block btn-lg${hasOut ? ' disabled' : ''}`} href="#/checkout" aria-disabled={hasOut || undefined} tabIndex={hasOut ? -1 : undefined}><Icon name="lock" /> {t('cart.checkout')}</a>
            <a className="btn btn-ghost btn-block" href="#/shop/diffusers">{t('cart.continue')}</a>
            <div className="sum-trust"><PayMarks /><p className="muted small"><Icon name="shield" /> {t('cart.secure')}</p></div>
          </aside>
        </div>
      )}
    </section>
    {recs.length > 0 && <section className="section">
      <div className="container"><SectionHead title={t('cart.recs')} /></div>
      <div className="container-wide"><Carousel id="car-cartrec" label={t('cart.recs')}>{recs.map(p => <ProductCard key={p.id} p={p} />)}</Carousel></div>
    </section>}
  </>);
}
