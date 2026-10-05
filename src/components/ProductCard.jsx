import { useState } from 'react';
import Icon from './Icon.jsx';
import { Img, Stars } from './common.jsx';
import { Spinner } from './ui.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money } from '../lib/format.js';
import { discountPct } from '../data/catalog.js';
import { useShopActions } from '../lib/useActions.js';

export function StockLabel({ p }) {
  const st = S.stockState(p);
  return <span className={`stock stock-${st}`}>{st === 'out' ? t('stock.out') : st === 'low' ? t('stock.low', { n: p.stock }) : t('stock.in')}</span>;
}

export function Badges({ p }) {
  const b = [];
  if (p.stock <= 0) b.push(<span key="out" className="badge badge-muted">{t('stock.out')}</span>);
  else if (p.bestSeller) b.push(<span key="best" className="badge badge-best">{t('badge.best')}</span>);
  else if (p.isNew) b.push(<span key="new" className="badge badge-new">{t('badge.new')}</span>);
  if (p.line === 'hotel') b.push(<span key="hotel" className="badge badge-aroma">{t('badge.hotel')}</span>);
  if (p.aromaDeal) b.push(<span key="aroma" className="badge badge-aroma">{t('badge.aroma')}</span>);
  return b;
}

export function WishButton({ p, className = '' }) {
  const { toggleWish } = useShopActions();
  const [pulse, setPulse] = useState(false);
  const on = S.inWishlist(p.id);
  return (
    <button className={`wish-btn ${className}${on ? ' on' : ''}${pulse ? ' pulse' : ''}`} data-action="wish" data-id={p.id} aria-pressed={on}
      aria-label={t(on ? 'wish.remove' : 'wish.add', { name: pname(p) })}
      onClick={() => { setPulse(true); setTimeout(() => setPulse(false), 450); toggleWish(p); }}>
      <Icon name="heart" />
    </button>
  );
}

export function ProductCard({ p, showSave, gift, style }) {
  const { addToCart, openGift } = useShopActions();
  const [busy, setBusy] = useState(false);
  const r = S.rating(p);
  const off = discountPct(p);
  const name = pname(p);
  const out = p.stock <= 0;
  return (
    <article className={`pcard${out ? ' is-out' : ''}${style ? ' stagger' : ''}`} data-pid={p.id} style={style}>
      <div className="pcard-media">
        <a href={`/product/${p.id}`} className="pcard-img" tabIndex={-1} aria-hidden="true"><Img k={p.img} alt={name} /></a>
        <div className="pcard-badges"><Badges p={p} /></div>
        <WishButton p={p} className="pcard-wish" />
        {gift && p.giftable && !out && (
          <button className="pcard-gift" onClick={() => openGift({ productId: p.id, sizeId: p.sizes[0].id, qty: 1 })}><Icon name="gift" /><span>{t('gift.send')}</span></button>
        )}
      </div>
      <div className="pcard-body">
        <p className="pcard-type">{t('type.' + p.type)} · {p.sizes.map(s => s.ml.toLocaleString('en')).join(' / ')} ml</p>
        <h3 className="pcard-name"><a href={`/product/${p.id}`}>{name}</a></h3>
        {r.count > 0 && <div className="pcard-rating"><Stars rating={r.avg} /><span>{r.avg.toFixed(1)} <span className="muted">({t('reviews.countShort', { n: r.count })})</span></span></div>}
        <div className="pcard-price">
          {p.compareAt > p.price && <s aria-label={t('price.was')}>{money(p.compareAt)}</s>}
          <strong>{p.sizes.length > 1 && <span className="from">{t('price.from')}</span>} {money(p.price)}</strong>
        </div>
        <p className="pcard-meta">
          {off > 0 && <span className="off">{t('price.off', { n: off })}</span>}
          {showSave && off > 0 && <span className="save">{t('price.save', { amount: money(p.compareAt - p.price) })}</span>}
          <StockLabel p={p} />
        </p>
        <button className={`btn btn-outline btn-block pcard-add${busy ? ' is-busy' : ''}`} data-action="add" data-id={p.id} disabled={out || busy} aria-busy={busy || undefined}
          onClick={async () => { setBusy(true); await addToCart(p); setBusy(false); }}>
          {busy ? <><Spinner /><span>{t('cart.adding')}</span></> : out ? t('stock.out') : t('cart.add')}
        </button>
      </div>
    </article>
  );
}

export function SkeletonCards({ n = 4 }) {
  return Array.from({ length: n }, (_, i) => (
    <div key={i} className="pcard sk-card" aria-hidden="true"><div className="sk sk-img" /><div className="pcard-body"><div className="sk sk-line w40" /><div className="sk sk-line w80" /><div className="sk sk-line w60" /><div className="sk sk-btn" /></div></div>
  ));
}

export function MiniCard({ p, onClick }) {
  return (
    <a className="mini-card" href={`/product/${p.id}`} onClick={onClick}>
      <Img k={p.img} />
      <span className="mini-body">
        <span className="mini-type">{t('type.' + p.type)}</span>
        <span className="mini-name">{pname(p)}</span>
        <span className="mini-price">{money(p.price)}{p.compareAt > p.price && <> <s>{money(p.compareAt)}</s></>}</span>
      </span>
    </a>
  );
}
