import { useEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { Img } from '../components/common.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money, fmtDate } from '../lib/format.js';
import { useTitle } from '../lib/router.js';
import NotFound from './NotFound.jsx';

const ORDER_FLOW = ['placed', 'processing', 'shipped', 'delivered'];

export function formatAddress(a) {
  if (!a) return null;
  return [`${a.firstName} ${a.lastName}`, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), t('country.' + a.country), a.phone]
    .filter(Boolean).map((l, i, arr) => <span key={i}>{l}{i < arr.length - 1 && <br />}</span>);
}

export function OrderDetail({ o, inAccount }) {
  const days = n => new Date(new Date(o.date).getTime() + n * 864e5);
  const etaFrom = days(o.shippingMethod === 'express' ? 1 : 2), eta = days(o.shippingMethod === 'express' ? 1 : 4);
  const etaText = [etaFrom, eta].map(d => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })).filter((v, i, arr) => arr.indexOf(v) === i).join(' – ');
  const stepIdx = ORDER_FLOW.indexOf(o.status);
  const terminal = ['cancelled', 'refunded'].includes(o.status);
  const gifts = o.items.filter(i => i.gift);
  return (
    <div className="order-detail">
      <div className="od-meta card">
        <div><span className="muted small">{t('order.number')}</span><strong>{o.id}</strong></div>
        <div><span className="muted small">{t('order.date')}</span><strong>{fmtDate(o.date)}</strong></div>
        <div><span className="muted small">{t('order.status')}</span><span className={`status status-${o.status}`}>{t('status.' + o.status)}</span></div>
        <div><span className="muted small">{t('order.payment')}</span><span className={`status pay-${o.payment.status}`}>{t('paystatus.' + o.payment.status)}</span></div>
      </div>
      {terminal ? <div className="alert alert-info"><Icon name="info" /><span>{t('order.terminal.' + o.status)}</span></div> : (<>
        <ol className="track" aria-label={t('order.tracking')}>
          {ORDER_FLOW.map((s, i) => { const ev = o.timeline.find(x => x.status === s); return (
            <li key={s} className={`${i <= stepIdx ? 'done' : ''}${i === stepIdx ? ' current' : ''}`} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="tk-dot">{i <= stepIdx && <Icon name="check" />}</span><span className="tk-l">{t('status.' + s)}</span>
              <span className="tk-d muted small">{ev ? fmtDate(ev.date, { day: 'numeric', month: 'short' }) : ''}</span>
            </li>
          ); })}
        </ol>
        {o.status !== 'delivered' && <p className="eta"><Icon name="truck" /> {t('order.eta')} <strong>{etaText}</strong></p>}
      </>)}
      <div className="od-grid">
        <div className="card">
          <h3 className="card-h">{t('order.items')}</h3>
          <ul className="od-items">{o.items.map((i, k) => { const p = S.product(i.productId); return (
            <li key={k}><Img k={i.img} /><div>
              <a href={`#/product/${i.productId}`}>{p ? pname(p) : i.name}</a>
              <small className="muted">{t('size.ml', { n: i.ml })} · {t('order.qty', { n: i.qty })}</small>
              {i.gift && <small className="gift-l"><Icon name="gift" /> {t('gift.for', { name: i.gift.recipientName })} · {t('gift.wrap.' + i.gift.wrap)}{i.gift.message && <> — “{i.gift.message}”</>}</small>}
            </div><strong>{money(i.price * i.qty)}</strong></li>
          ); })}</ul>
          <dl className="sum-rows">
            <div><dt>{t('cart.subtotal')}</dt><dd>{money(o.totals.subtotal)}</dd></div>
            {o.totals.savings > 0 && <div className="save"><dt>{t('cart.youSaved')}</dt><dd>{money(o.totals.savings)}</dd></div>}
            {o.totals.discount > 0 && <div className="disc"><dt>{t('cart.coupon')} {o.coupon && <span className="code">{o.coupon}</span>}</dt><dd>− {money(o.totals.discount)}</dd></div>}
            {o.totals.giftFee > 0 && <div><dt>{t('cart.giftFee')}</dt><dd>{money(o.totals.giftFee)}</dd></div>}
            <div><dt>{t('cart.shipping')} ({t('ship.' + o.shippingMethod)})</dt><dd>{o.totals.shipping ? money(o.totals.shipping) : t('common.free')}</dd></div>
            <div className="total"><dt>{t('cart.total')}</dt><dd>{money(o.totals.total)}</dd></div>
            <div className="vat"><dt>{t('cart.vatLine', { rate: S.settings().vatRate })}</dt><dd>{money(o.totals.vat)}</dd></div>
          </dl>
        </div>
        <div className="od-side">
          <div className="card"><h3 className="card-h"><Icon name="pin" /> {t('order.shipTo')}</h3><p>{formatAddress(o.shipping)}</p></div>
          <div className="card"><h3 className="card-h"><Icon name={o.payment.method === 'crypto' ? 'crypto' : 'card'} /> {t('order.payment')}</h3>
            <p>{o.payment.method === 'crypto' ? t('pay.cryptoPaid', { coin: o.payment.coin }) : t('pay.cardPaid', { brand: t('pay.brand.' + (o.payment.brand || 'card')), last4: o.payment.last4 })}</p>
            <p className={`status pay-${o.payment.status}`}>{t('paystatus.' + o.payment.status)}</p></div>
          {gifts.length > 0 && <div className="card"><h3 className="card-h"><Icon name="gift" /> {t('order.giftInfo')}</h3>
            {gifts.map((i, k) => <p key={k}><strong>{i.gift.recipientName}</strong>{i.gift.recipientEmail && <><br /><span className="muted">{i.gift.recipientEmail}</span></>}
              {i.gift.deliveryDate && <><br />{t('gift.deliverOn', { date: fmtDate(i.gift.deliveryDate) })}</>}<br />{t('gift.wrap.' + i.gift.wrap)}{i.gift.hidePrices && <> · {t('gift.pricesHidden')}</>}</p>)}
          </div>}
          {!inAccount && <div className="card"><h3 className="card-h"><Icon name="mail" /> {t('order.contact')}</h3><p>{o.email}</p></div>}
        </div>
      </div>
    </div>
  );
}

export default function Order({ id, q }) {
  const o = S.order(id);
  const ok = o && S.canViewOrder(o);
  const isNew = q.new === '1';
  const h1 = useRef(null);
  useTitle(!ok ? t('order.notFound') : isNew ? t('order.confirmedEyebrow') : t('order.title', { id }));
  useEffect(() => { if (h1.current) h1.current.focus(); }, []);
  if (!ok) return <NotFound msg={t('order.notFound')} />;
  const u = S.user();
  return (
    <section className="container confirm">
      {isNew ? (
        <div className="confirm-hero">
          <span className="confirm-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="m15 27 7 7 15-15" /></svg></span>
          <p className="eyebrow">{t('order.confirmedEyebrow')}</p>
          <h1 className="page-title" tabIndex={-1} ref={h1}>{t('order.thanks', { name: (o.shipping.firstName || '').trim() })}</h1>
          <p>{t('order.confirmText', { email: o.email })}</p>
          <p className="order-no">{t('order.number')}: <strong>{o.id}</strong></p>
        </div>
      ) : <h1 className="page-title left">{t('order.title', { id: o.id })}</h1>}
      <OrderDetail o={o} />
      <div className="btn-row center confirm-actions">
        {u && <a className="btn btn-primary" href={`#/account/orders/${o.id}`}>{t('order.view')}</a>}
        <a className="btn btn-outline" href="#/shop/diffusers">{t('cart.continue')}</a>
        {u ? <a className="btn btn-ghost" href="#/account">{t('order.goAccount')}</a> : <a className="btn btn-ghost" href={`#/register?email=${encodeURIComponent(o.email)}`}>{t('order.createAccount')}</a>}
      </div>
    </section>
  );
}
