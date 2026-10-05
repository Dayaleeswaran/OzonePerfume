/* Global panels opened through useUI(): mobile menu, search, cart drawer, gift modal */
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Overlay, Alert, Button, Spinner, useUI } from './ui.jsx';
import { Empty, Field, Check, Img, Qty } from './common.jsx';
import { MiniCard } from './ProductCard.jsx';
import { Logo, LocaleControls } from './Header.jsx';
import { S, api } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money, errorText, debounce } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { useShopActions } from '../lib/useActions.js';
import { searchProducts } from '../lib/search.js';
import { navigate } from '../lib/router.js';
import { DIFFUSER_TYPES } from '../data/catalog.js';

/* ---------------- mobile menu ---------------- */
function MobileMenu({ onClose }) {
  const u = S.user();
  const sub = items => <ul>{items.map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}</ul>;
  return (
    <Overlay kind="drawer-start" title={<Logo small />} className="mnav-ov" onClose={onClose}>
      {close => (
        <div onClick={e => { if (e.target.closest('a[href^="/"]')) close(); }}>
          <nav className="mnav" aria-label={t('a11y.mainNav')}>
            <a href="/">{t('nav.home')}</a>
            <details><summary>{t('nav.diffusers')}<Icon name="chevDown" /></summary>{sub([['/shop/diffusers', t('common.viewAll')]].concat(DIFFUSER_TYPES.map(ty => ['/shop/diffusers?type=' + ty, t('type.' + ty + '.plural')])))}</details>
            <a href="/deals/aroma" className="accent">{t('nav.aromaDeals')}</a>
            <a href="/deals/crazy">{t('nav.crazyDeals')} <Icon name="flame" className="spark" /></a>
            <details><summary>{t('nav.homeCare')}<Icon name="chevDown" /></summary>{sub([['/shop/home-care', t('common.viewAll')], ['/shop/home-care?type=tower', t('mega.livingRooms')], ['/shop/home-care?type=wall', t('mega.bedrooms')], ['/shop/home-care?type=portable', t('mega.desks')]])}</details>
            <a href="/shop/gifts">{t('nav.gifts')}</a>
            <a href="/about">{t('nav.about')}</a>
            <a href="/contact">{t('nav.contact')}</a>
          </nav>
          <div className="mnav-acc">
            {u ? <a className="btn btn-outline btn-block" href={u.role === 'admin' ? '/admin' : '/account'}><Icon name="user" /> {t('nav.account')}</a>
              : <><a className="btn btn-primary btn-block" href="/login">{t('nav.login')}</a><a className="btn btn-outline btn-block" href="/register">{t('auth.createAccount')}</a></>}
            <div className="mnav-links">
              <a href="/wishlist"><Icon name="heart" /> {t('nav.wishlist')}</a>
              <a href="/account/orders"><Icon name="box" /> {t('account.orders')}</a>
              <a href="/account/dates"><Icon name="calendar" /> {t('account.dates')}</a>
            </div>
          </div>
          <div className="mnav-locale"><LocaleControls ctx="m" /></div>
        </div>
      )}
    </Overlay>
  );
}

/* ---------------- search ---------------- */
const POPULAR = ['tower', 'oil', 'citrus', 'hotel', 'gift', 'app'];

function SearchPanel({ initial, onClose }) {
  const [q, setQ] = useState(initial || '');
  const [res, setRes] = useState({ state: initial ? 'loading' : 'idle', items: [] });
  const seq = useRef(0);
  const run = useRef(debounce(term => {
    const my = ++seq.current;
    if (!term.trim()) { setRes({ state: 'idle', items: [] }); return; }
    setRes(r => ({ ...r, state: 'loading' }));
    api(() => searchProducts(term), 280).then(items => { if (my === seq.current) setRes({ state: 'done', items }); })
      .catch(err => { if (my === seq.current) setRes({ state: 'error', items: [], err }); });
  }, 220)).current;
  useEffect(() => { run(q); }, [q, run]);

  const recent = S.session.recent.map(id => S.product(id)).filter(Boolean).slice(0, 4);
  const chips = list => <div className="chips">{list.map(k => <button key={k} className="chip" onClick={() => setQ(t('search.term.' + k))}>{t('search.term.' + k)}</button>)}</div>;
  const status = res.state === 'loading' ? t('search.searching') : res.state === 'done' ? t('search.count', { n: res.items.length, q }) : res.state === 'error' ? errorText(res.err) : '';

  return (
    <Overlay kind="search" title={null} labelledBy="search-label" className="search-ov" onClose={onClose}>
      {close => (
        <div className="container search-box" onClick={e => { if (e.target.closest('a[href^="/"]')) close(); }}>
          <form className="search-form" role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) { navigate('/search?q=' + encodeURIComponent(q.trim())); close(); } }}>
            <label id="search-label" htmlFor="search-input" className="sr-only">{t('search.label')}</label>
            <Icon name="search" />
            <input id="search-input" type="search" name="q" autoComplete="off" placeholder={t('search.placeholder')} value={q} onChange={e => setQ(e.target.value)} autoFocus aria-controls="search-results" aria-describedby="search-status" />
            <button type="button" className="icon-btn" onClick={close} aria-label={t('a11y.closeSearch')}><Icon name="close" /></button>
          </form>
          <p id="search-status" className="search-status" role="status" aria-live="polite">{status}</p>
          <div id="search-results" className="search-results">
            {res.state === 'idle' && (
              <div className="search-idle">
                <p className="eyebrow">{t('search.popular')}</p>{chips(POPULAR)}
                {recent.length > 0 && <><p className="eyebrow">{t('search.recent')}</p><div className="search-grid">{recent.map(p => <MiniCard key={p.id} p={p} />)}</div></>}
              </div>
            )}
            {res.state === 'loading' && <div className="search-loading" aria-hidden="true"><div className="sk sk-row" /><div className="sk sk-row" /><div className="sk sk-row" /></div>}
            {res.state === 'error' && <Alert>{errorText(res.err)}</Alert>}
            {res.state === 'done' && (res.items.length ? (<>
              <div className="search-grid">{res.items.slice(0, 6).map(p => <MiniCard key={p.id} p={p} />)}</div>
              <a className="btn btn-primary" href={'/search?q=' + encodeURIComponent(q)}>{t('search.viewAll', { n: res.items.length })} <Icon name="arrowRight" className="flip" /></a>
            </>) : (
              <div className="empty compact"><Icon name="search" className="empty-ic" /><h3>{t('search.noResults', { q })}</h3><p>{t('search.noResultsHint')}</p>{chips(POPULAR.slice(0, 4))}</div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ---------------- cart pieces (also used by the cart page) ---------------- */
export function FreeShipBar({ tt }) {
  const th = S.settings().freeShippingThreshold;
  if (!tt.freeShip && !tt.toFree) return null;   // no free-shipping rule for this destination
  const pct = tt.freeShip ? 100 : Math.min(100, Math.round((1 - tt.toFree / th) * 100));
  return (
    <div className="ship-bar" aria-live="polite">
      <div className="ship-track"><div className="ship-fill" style={{ width: pct + '%' }} /><span className="ship-truck" style={{ insetInlineStart: pct + '%' }}><Icon name="truck" /></span></div>
      <p>{tt.freeShip ? <><Icon name="check" /> {t('cart.freeShipUnlocked')}</> : t('cart.toFreeShip', { amount: money(tt.toFree) })}</p>
    </div>
  );
}

export function CartLines({ lines, compact }) {
  const { updateQty, removeLine, openGift } = useShopActions();
  const [leaving, setLeaving] = useState(null);
  return (
    <ul className={`clines${compact ? '' : ' big'}`} aria-label={t('cart.items')}>
      {lines.map(v => {
        const p = v.product, l = v.line;
        return (
          <li key={l.id} className={`cline${leaving === l.id ? ' leaving' : ''}`} data-line={l.id}>
            <a href={`/product/${p.id}`} className="cline-img"><Img k={p.img} /></a>
            <div className="cline-body">
              <a className="cline-name" href={`/product/${p.id}`}>{pname(p)}</a>
              <p className="cline-meta">{t('type.' + p.type)} · {t('size.ml', { n: v.size.ml })}</p>
              {l.gift && <p className="cline-gift"><Icon name="gift" /> {t('gift.for', { name: l.gift.recipientName })} · {t('gift.wrap.' + l.gift.wrap)}</p>}
              <p className="cline-price"><strong>{money(v.price)}</strong>{v.compare > v.price && <> <s>{money(v.compare)}</s></>}</p>
              <div className="cline-actions">
                <Qty value={l.qty} max={p.stock} onChange={n => updateQty(l, n)} />
                <button className="link-btn" data-action="remove-line" onClick={() => { setLeaving(l.id); removeLine(l); }}>{t('cart.remove')}</button>
                {!compact && p.giftable && <button className="link-btn" onClick={() => openGift({ productId: p.id, sizeId: l.sizeId, lineId: l.id })}><Icon name="gift" /> {l.gift ? t('gift.edit') : t('gift.makeGift')}</button>}
              </div>
            </div>
            {!compact && <p className="cline-total">{money(v.total)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function CartDrawer({ justAdded, onClose }) {
  const tt = S.totals();
  return (
    <Overlay kind="drawer-end" title={<>{t('cart.title')} <span className="muted">({S.cartCount()})</span></>} className="cart-ov" onClose={onClose}>
      {close => (<div onClick={e => { if (e.target.closest('a[href^="/"]')) close(); }} style={{ display: 'contents' }}>
        {justAdded && <Alert type="success" className="added-note">{t('cart.added')}</Alert>}
        {!tt.lines.length ? (
          <Empty ic="bag" title={t('cart.emptyTitle')} text={t('cart.emptyText')}>
            <a className="btn btn-primary" href="/shop/diffusers">{t('cart.startShopping')}</a>
            <a className="btn btn-outline" href="/deals/aroma">{t('home.oilsTitle')}</a>
          </Empty>
        ) : (<>
          <FreeShipBar tt={tt} />
          <CartLines lines={tt.lines} compact />
          <div className="drawer-foot">
            {tt.savings > 0 && <p className="row save"><span>{t('cart.youSave')}</span><span>{money(tt.savings)}</span></p>}
            <p className="row big"><span>{t('cart.subtotal')}</span><strong>{money(tt.subtotal)}</strong></p>
            <p className="muted small">{t(S.settings().taxMode === 'exclusive' ? 'cart.vatExcl' : 'cart.vatIncl')} · {t('cart.shipAtCheckout')}</p>
            <div className="btn-row"><a className="btn btn-outline" href="/cart">{t('cart.viewCart')}</a><a className="btn btn-primary" href="/checkout">{t('cart.checkout')} <Icon name="lock" /></a></div>
          </div>
        </>)}
      </div>)}
    </Overlay>
  );
}

/* ---------------- gift modal ---------------- */
function GiftModal({ productId, sizeId, qty = 1, lineId, onClose }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const p = S.product(productId);
  const existing = lineId ? (S.cart().find(l => l.id === lineId) || {}).gift : null;
  const g = existing || { recipientName: '', recipientEmail: '', message: '', wrap: 'premium', deliveryDate: '', hidePrices: true };
  const [msgLen, setMsgLen] = useState(g.message.length);
  if (!p) return null;
  const wraps = S.settings().giftWrap;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  return (
    <Overlay title={<><Icon name="gift" /> {t('gift.title')}</>} size="md" className="gift-ov" onClose={onClose}>
      {close => (<>
        <div className="gift-prod"><Img k={p.img} /><div><strong>{pname(p)}</strong><span className="muted">{t('size.ml', { n: S.size(p, sizeId).ml })} · {money(S.unitPrice(p, sizeId))}{lineId ? '' : ` × ${qty}`}</span></div></div>
        <form noValidate onSubmit={e => {
          e.preventDefault();
          const d = f.validate(e.currentTarget, {
            recipientName: [V.required, V.max(60)],
            recipientEmail: [v => v ? V.email(v) : ''],
            deliveryDate: [v => !v || v >= tomorrow ? '' : t('gift.dateErr')]
          });
          if (!d) return;
          const gift = { recipientName: d.recipientName.trim(), recipientEmail: (d.recipientEmail || '').trim(), message: (d.message || '').trim(), wrap: d.wrap || 'standard', deliveryDate: d.deliveryDate || '', hidePrices: !!d.hidePrices };
          setBusy(true);
          (lineId ? S.setLineGift(lineId, gift) : S.addToCart(productId, sizeId, qty, gift)).then(() => {
            close();
            ui.toast(lineId ? t('gift.updated') : t('gift.added', { name: gift.recipientName }), 'success');
            if (!lineId) navigate('/cart');
          }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
        }}>
          {f.alert && <Alert type={f.alert.type}>{f.alert.msg}</Alert>}
          <fieldset className="fs"><legend>{t('gift.recipient')}</legend>
            <div className="grid-2">
              <Field name="recipientName" label={t('gift.recipientName')} required defaultValue={g.recipientName} autoComplete="off" error={f.errors.recipientName} onClear={f.clear} />
              <Field name="recipientEmail" label={t('gift.recipientEmail')} type="email" defaultValue={g.recipientEmail} hint={t('gift.recipientEmailHint')} error={f.errors.recipientEmail} onClear={f.clear} />
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="gift-msg">{t('gift.message')} <span className="opt">{t('common.optional')}</span></label>
            <div className="control"><textarea id="gift-msg" name="message" rows="3" maxLength={250} aria-describedby="gift-msg-count" placeholder={t('gift.messagePh')} defaultValue={g.message} onChange={e => setMsgLen(e.target.value.length)} /></div>
            <p className="hint" id="gift-msg-count" aria-live="polite">{t('gift.chars', { n: 250 - msgLen })}</p>
          </div>
          <fieldset className="fs"><legend>{t('gift.packaging')}</legend>
            <div className="wrap-opts">{['standard', 'premium', 'luxury'].map(w => (
              <label key={w} className="opt-card"><input type="radio" name="wrap" value={w} defaultChecked={g.wrap === w} />
                <span className="oc-body"><strong>{t('gift.wrap.' + w)}</strong><small>{t('gift.wrap.' + w + '.d')}</small><em>{wraps[w] ? '+ ' + money(wraps[w]) : t('common.free')}</em></span></label>
            ))}</div>
          </fieldset>
          <div className="grid-2">
            <Field name="deliveryDate" label={t('gift.deliveryDate')} type="date" defaultValue={g.deliveryDate} min={tomorrow} hint={t('gift.deliveryHint')} error={f.errors.deliveryDate} onClear={f.clear} />
            <Check name="hidePrices" defaultChecked={g.hidePrices} label={t('gift.hidePrices')} className="self-end" />
          </div>
          <p className="muted small"><Icon name="info" /> {t('gift.addressNote')}</p>
          <div className="btn-row end">
            {existing
              ? <Button className="btn btn-ghost" busy={busy && false} onClick={() => S.setLineGift(lineId, null).then(() => { close(); ui.toast(t('gift.removed'), 'info'); }).catch(err => f.setAlert({ type: 'error', msg: errorText(err) }))}>{t('gift.remove')}</Button>
              : <button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button>}
            <Button type="submit" busy={busy} busyLabel={t('common.saving')}>{existing ? t('gift.save') : t('gift.addToCart')}</Button>
          </div>
        </form>
      </>)}
    </Overlay>
  );
}

export default function Panels() {
  const ui = useUI();
  const p = ui.panel;
  if (!p) return null;
  const close = ui.closePanel;
  if (p.kind === 'menu') return <MobileMenu onClose={close} />;
  if (p.kind === 'search') return <SearchPanel initial={p.initial} onClose={close} />;
  if (p.kind === 'cart') return <CartDrawer justAdded={p.justAdded} onClose={close} />;
  if (p.kind === 'gift') return <GiftModal {...p} onClose={close} />;
  return null;
}

