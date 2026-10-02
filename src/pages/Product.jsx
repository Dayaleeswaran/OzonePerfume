import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Img, Stars, Qty, Breadcrumbs, SectionHead, Carousel, PayMarks, Field } from '../components/common.jsx';
import { ProductCard, Badges, StockLabel, WishButton } from '../components/ProductCard.jsx';
import { Overlay, Alert, Button, useUI } from '../components/ui.jsx';
import { S } from '../lib/store.js';
import { t, pname, ptext, noteLabel } from '../lib/i18n.js';
import { money, fmtDate, errorText, reducedMotion } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { useShopActions } from '../lib/useActions.js';
import { navigate, replaceHash, useTitle } from '../lib/router.js';
import NotFound from './NotFound.jsx';

const NOTE_ICONS = { top: 'sparkle', heart: 'heart', base: 'leaf' };

function Lightbox({ p, views, start, onClose }) {
  const [i, setI] = useState(start);
  const n = views.length;
  const step = d => setI(x => (x + d + n) % n);
  return (
    <Overlay kind="lightbox" title={pname(p)} className="lb-ov" onClose={onClose}>
      <div className="lb-stage" onKeyDown={e => { const rtl = document.documentElement.dir === 'rtl'; if (e.key === 'ArrowRight') step(rtl ? -1 : 1); if (e.key === 'ArrowLeft') step(rtl ? 1 : -1); }}>
        <button className="car-btn prev" onClick={() => step(-1)} aria-label={t('a11y.prev')}><Icon name="chevLeft" className="flip" /></button>
        <div data-lb-img><div className={`lb-img ${views[i].cls}`}><Img k={views[i].img} alt={pname(p)} size="lg" sizes="100vw" /></div></div>
        <button className="car-btn next" onClick={() => step(1)} aria-label={t('a11y.next')}><Icon name="chevRight" className="flip" /></button>
      </div>
      <p className="lb-count" aria-live="polite">{i + 1} / {n}</p>
    </Overlay>
  );
}

function Gallery({ p, name }) {
  const photos = [p.img].concat(p.gallery || []);
  const views = photos.map(img => ({ img, cls: 'v1' })).concat([{ img: p.img, cls: 'v2' }, { img: p.img, cls: 'v3' }]).slice(0, Math.max(3, photos.length));
  const [cur, setCur] = useState(0);
  const [lb, setLb] = useState(null);
  const [zoom, setZoom] = useState({ x: '50%', y: '50%' });
  const x0 = useRef(null);
  return (
    <div className="pdp-gallery">
      <div className="gal-main"
        onMouseMove={e => { const rc = e.currentTarget.getBoundingClientRect(); setZoom({ x: (e.clientX - rc.left) / rc.width * 100 + '%', y: (e.clientY - rc.top) / rc.height * 100 + '%' }); }}
        onTouchStart={e => { x0.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(dx) < 40) return; const rtl = document.documentElement.dir === 'rtl'; setCur(c => (c + ((dx < 0) !== rtl ? 1 : -1) + views.length) % views.length); }}>
        {views.map((v, i) => (
          <button key={i} className={`gal-slide ${v.cls}${i === cur ? ' on' : ''}`} tabIndex={i === cur ? 0 : -1} aria-label={t('pdp.zoom', { n: i + 1 })} onClick={() => setLb(i)}
            style={i === cur ? { '--zx': zoom.x, '--zy': zoom.y } : undefined}>
            <Img k={v.img} alt={i === 0 ? name : ''} size="lg" eager={i === 0} />
          </button>
        ))}
        <div className="gal-badges"><Badges p={p} /></div>
        <span className="gal-zoom-hint" aria-hidden="true"><Icon name="expand" /></span>
      </div>
      <div className="gal-thumbs" role="group" aria-label={t('pdp.gallery')}>
        {views.map((v, i) => <button key={i} className={`gal-thumb ${v.cls}${i === cur ? ' on' : ''}`} aria-label={t('pdp.view', { n: i + 1 })} aria-pressed={i === cur} onClick={() => setCur(i)}><Img k={v.img} /></button>)}
      </div>
      <div className="gal-dots only-mobile" aria-hidden="true">{views.map((v, i) => <span key={i} className={i === cur ? 'on' : ''} />)}</div>
      {lb != null && <Lightbox p={p} views={views} start={lb} onClose={() => setLb(null)} />}
    </div>
  );
}

function Reviews({ p }) {
  const ui = useUI();
  const f = useForm();
  const [sort, setSort] = useState('recent');
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingErr, setRatingErr] = useState('');
  const [busy, setBusy] = useState(false);
  const noteRef = useRef(null);
  const all = S.reviews(p.id);
  const list = all.slice().sort((a, b) => sort === 'high' ? b.rating - a.rating : sort === 'low' ? a.rating - b.rating : String(b.date).localeCompare(String(a.date)));
  const r = S.rating(p);
  const written = all.filter(x => x.status === 'approved');
  const u = S.user();
  const mine = u && all.find(x => x.email === u.email);
  const canWrite = u && !mine;

  const submit = e => {
    e.preventDefault();
    const d = f.validate(e.currentTarget, { title: [V.required, V.min(3)], body: [V.required, V.min(10)] });
    setRatingErr(rating ? '' : t('reviews.pickRating'));
    if (!rating) { e.currentTarget.querySelector('input[name=rating]').focus(); return; }
    if (!d) return;
    setBusy(true);
    S.addReview(p.id, { rating, title: d.title, body: d.body }).then(() => {
      setBusy(false); setWriting(false);
      ui.toast(t('reviews.thanks'), 'success');
      setTimeout(() => noteRef.current && noteRef.current.focus(), 50);
    }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
  };

  return (
    <div className="rev-grid">
      <div className="rev-summary">
        <p className="rev-avg">{r.avg.toFixed(1)}<span>/5</span></p>
        <Stars rating={r.avg} lg />
        <p className="muted">{t('reviews.basedOn', { n: r.count })}</p>
        {written.length > 0 && <>
          <ul className="rev-dist" aria-label={t('reviews.dist')}>{[5, 4, 3, 2, 1].map(n => { const c = written.filter(x => x.rating === n).length; return <li key={n}><span>{n}★</span><span className="bar"><span style={{ width: (c / written.length * 100) + '%' }} /></span><span className="muted">{c}</span></li>; })}</ul>
          <p className="muted small">{t('reviews.distNote', { n: written.length })}</p>
        </>}
        {canWrite && <button className="btn btn-primary btn-block" data-action="write-review" onClick={() => setWriting(true)}><Icon name="edit" /> {t('reviews.write')}</button>}
        {!u && <a className="btn btn-outline btn-block" href={`#/login?next=${encodeURIComponent('/product/' + p.id)}`}>{t('reviews.loginToWrite')}</a>}
      </div>
      <div className="rev-list-wrap">
        {mine && mine.status === 'pending' && <div className="alert alert-info" tabIndex={-1} ref={noteRef}><Icon name="clock" /><span>{t('reviews.pendingMine')}</span></div>}
        {writing && (
          <form className="card rev-form" data-rev-form noValidate onSubmit={submit}>
            <h3>{t('reviews.writeFor', { name: pname(p) })}</h3>
            {f.alert && <Alert>{f.alert.msg}</Alert>}
            <fieldset className="star-input"><legend>{t('reviews.yourRating')}</legend>
              <div className="star-pick">{[5, 4, 3, 2, 1].map(n => (<span key={n} style={{ display: 'contents' }}>
                <input type="radio" id={`sr${n}`} name="rating" value={n} checked={rating === n} onChange={() => { setRating(n); setRatingErr(''); }} autoFocus={n === 5} />
                <label htmlFor={`sr${n}`} title={String(n)}><Icon name="star" /><span className="sr-only">{t('a11y.rating', { n })}</span></label>
              </span>))}</div>
              <p className="err" role="alert">{ratingErr}</p>
            </fieldset>
            <Field name="title" label={t('reviews.titleL')} required maxLength={80} error={f.errors.title} onClear={f.clear} />
            <Field name="body" label={t('reviews.bodyL')} type="textarea" required rows={4} maxLength={1000} hint={t('reviews.bodyHint')} error={f.errors.body} onClear={f.clear} />
            <div className="btn-row"><button type="button" className="btn btn-ghost" onClick={() => setWriting(false)}>{t('common.cancel')}</button><Button type="submit" busy={busy} busyLabel={t('reviews.submitting')}>{t('reviews.submit')}</Button></div>
          </form>
        )}
        {list.length ? (<>
          <div className="rev-tools"><label className="sort"><span>{t('sort.label')}</span>
            <select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">{t('reviews.sortRecent')}</option><option value="high">{t('reviews.sortHigh')}</option><option value="low">{t('reviews.sortLow')}</option></select>
          </label></div>
          <ul className="rev-list">{list.map(x => (
            <li key={x.id} className={`rev${x.status === 'pending' ? ' pending' : ''}`}>
              <div className="rev-head"><Stars rating={x.rating} /><strong>{x.title}</strong>{x.status === 'pending' && <span className="badge badge-muted">{t('reviews.pending')}</span>}</div>
              <p>{x.body}</p>
              <p className="rev-meta"><span>{x.name}</span>{x.verified && <span className="verified"><Icon name="check" /> {t('reviews.verified')}</span>}<span className="muted">{fmtDate(x.date)}</span></p>
            </li>
          ))}</ul>
        </>) : !writing && (
          <div className="empty compact"><Icon name="message" className="empty-ic" /><h3>{t('reviews.noneTitle')}</h3><p>{t('reviews.noneText')}</p>{canWrite && <button className="btn btn-primary" data-action="write-review" onClick={() => setWriting(true)}>{t('reviews.beFirst')}</button>}</div>
        )}
      </div>
    </div>
  );
}

export default function Product({ id, q }) {
  const ui = useUI();
  const { addToCart, openGift } = useShopActions();
  const p = S.product(id);
  const [sizeId, setSizeId] = useState(() => (p && q.size && p.sizes.some(s => s.id === q.size)) ? q.size : p ? p.sizes[0].id : null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('desc');
  const [sticky, setSticky] = useState(false);
  const buyRowRef = useRef(null);
  useTitle(p ? pname(p) : t('pdp.notFound'));
  useEffect(() => { if (p) S.trackRecent(p.id); }, [p]);

  /* scroll-spy for the section tabs + sticky add-to-cart bar */
  useEffect(() => {
    if (!p) return;
    const spy = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) setTab(en.target.id); }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.pdp-sec').forEach(s => spy.observe(s));
    const io = new IntersectionObserver(([en]) => setSticky(!en.isIntersecting && en.boundingClientRect.top < 0));
    if (buyRowRef.current) io.observe(buyRowRef.current);
    return () => { spy.disconnect(); io.disconnect(); };
  }, [p]);
  useEffect(() => { document.body.classList.toggle('sticky-buy-on', sticky); return () => document.body.classList.remove('sticky-buy-on'); }, [sticky]);

  if (!p) return <NotFound msg={t('pdp.notFound')} />;
  const name = pname(p);
  const r = S.rating(p);
  const out = p.stock <= 0;
  const set = S.settings();
  const price = S.unitPrice(p, sizeId), compare = S.unitCompare(p, sizeId);
  const off = compare > price ? Math.round((1 - price / compare) * 100) : 0;
  const coll = p.type === 'oil' ? ['#/deals/aroma', t('nav.aromaDeals')] : p.type === 'hvac' ? ['#/shop/diffusers?type=hvac', t('type.hvac.plural')] : ['#/shop/diffusers', t('nav.diffusers')];
  const related = S.products().filter(x => x.id !== p.id && (x.type === p.type || (p.family && x.family === p.family))).concat(S.products().filter(x => x.id !== p.id)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
  const tabs = [['desc', t('pdp.tab.desc')], ['details', t('pdp.tab.details')], ['notes', t('pdp.tab.notes')], ['use', t('pdp.tab.use')], ['reviews', t('pdp.tab.reviews')], ['shipping', t('pdp.tab.shipping')]];
  const howTo = p.type === 'oil' ? ['use.oil1', 'use.oil2', 'use.oil3', 'use.oil4'] : p.type === 'hvac' ? ['use.hvac1', 'use.hvac2', 'use.hvac3', 'use.hvac4'] : ['use.s1', 'use.s2', 'use.s3', 'use.s4'];
  const hasNotes = ['top', 'heart', 'base'].some(l => p.notes[l] && p.notes[l].length);
  const specLabel = k => { const v = t(k); return v === k ? k : v; };
  const specs = [['spec.sku', p.sku], ['spec.type', t('type.' + p.type)]].concat(p.specs || []).concat(p.ideal ? [['spec.idealFor', ptext(p, 'ideal')]] : []);

  const add = async (kind, then) => {
    setBusy(kind);
    const ok = await addToCart(p, sizeId, qty, { openDrawer: !then });
    setBusy(null);
    if (ok && then) then();
  };
  const jump = id => {
    const sec = document.getElementById(id); if (!sec) return;
    const off2 = (document.getElementById('site-header') ? document.getElementById('site-header').getBoundingClientRect().height : 0) + 70;
    window.scrollTo({ top: sec.getBoundingClientRect().top + scrollY - off2 + 10, behavior: reducedMotion() ? 'auto' : 'smooth' });
    sec.setAttribute('tabindex', '-1'); sec.focus({ preventScroll: true });
  };
  const share = () => {
    const url = location.href;
    if (navigator.share) navigator.share({ title: name, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => ui.toast(t('pdp.linkCopied'), 'info')).catch(() => ui.toast(url, 'info'));
  };

  return (<>
    <Breadcrumbs items={[['#/', t('nav.home')], coll, [null, name]]} />
    <section className="container pdp">
      <Gallery p={p} name={name} />
      <div className="pdp-info">
        <p className="eyebrow">{t('type.' + p.type)}{p.family && <> · {t('family.' + p.family)}</>}{p.line === 'hotel' && <> · {t('badge.hotel')}</>}</p>
        <h1 className="pdp-title">{name}</h1>
        <a className="pdp-rating" href="#reviews" data-jump="reviews" onClick={e => { e.preventDefault(); jump('reviews'); }}>
          {r.count ? <><Stars rating={r.avg} /><span>{r.avg.toFixed(1)}</span><span className="muted">{t('reviews.count', { n: r.count })}</span></> : <span className="muted">{t('reviews.noneYet')}</span>}
        </a>
        <div className="price-box">
          <div><span className="pb-l">{t('price.price')}</span><strong className="pb-p">{money(price)}</strong></div>
          {compare > price && <><div className="pb-mrp"><span className="pb-l">{t('price.mrp')}</span><s>{money(compare)}</s></div><span className="pb-off">{t('price.off', { n: off })}</span></>}
        </div>
        <p className="muted small">{t('cart.vatIncl')}{compare > price && <> · <span className="save-txt">{t('price.save', { amount: money(compare - price) })}</span></>}</p>
        <p className="pdp-tagline">{ptext(p, 'tagline')}</p>
        <ul className="feat-list">{p.features.map(fk => <li key={fk}><Icon name={fk} /><span>{t('feat.' + fk)}</span></li>)}</ul>

        <form className="buy-form" noValidate onSubmit={e => { e.preventDefault(); add('main'); }}>
          {p.sizes.length > 1 ? (
            <fieldset className="size-pick"><legend>{t('pdp.size')}</legend><div className="size-opts">
              {p.sizes.map(s => (
                <label key={s.id} className="size-opt">
                  <input type="radio" name="size" value={s.id} checked={s.id === sizeId} onChange={() => { setSizeId(s.id); replaceHash(`#/product/${p.id}?size=${s.id}`); }} />
                  <span><strong>{t('size.ml', { n: s.ml })}</strong><small>{money(p.price + s.delta)}</small></span>
                </label>
              ))}
            </div></fieldset>
          ) : <p className="size-one"><span className="muted">{t('pdp.size')}:</span> <strong>{t('size.ml', { n: p.sizes[0].ml })}</strong></p>}
          <div className="stock-line"><StockLabel p={p} />{!out && p.stock <= 10 && <span className="muted small">{t('stock.hurry')}</span>}</div>
          <div className="buy-row" ref={buyRowRef}>
            <div><p className="lbl">{t('cart.quantity')}</p><Qty value={qty} max={Math.max(1, p.stock)} onChange={n => setQty(Math.max(1, Math.min(Math.max(1, p.stock), n)))} disabled={out} /></div>
            <Button type="submit" className="btn btn-teal btn-lg grow" data-add-main busy={busy === 'main'} busyLabel={t('cart.adding')} disabled={out}><Icon name="bag" /> {out ? t('stock.out') : t('cart.add')}</Button>
            <WishButton p={p} className="wish-square" />
            <button type="button" className="icon-btn sq" onClick={share} aria-label={t('pdp.share')}><Icon name="share" /></button>
          </div>
          <div className="buy-row2">
            <Button className="btn btn-primary btn-lg" data-action="buy-now" busy={busy === 'buy'} busyLabel={t('cart.adding')} disabled={out} onClick={() => add('buy', () => navigate('#/checkout'))}>{t('pdp.buyNow')} <Icon name="arrowRight" className="flip" /></Button>
            {p.giftable && <button type="button" className="btn btn-outline btn-lg" data-action="gift-pdp" disabled={out} onClick={() => openGift({ productId: p.id, sizeId, qty })}><Icon name="gift" /> {t('gift.send')}</button>}
          </div>
          {out && <div className="alert alert-info"><Icon name="info" /><span>{t('pdp.outNote')} <a href="#/contact">{t('pdp.contactUs')}</a></span></div>}
        </form>

        <ul className="assure">
          <li><Icon name="truck" /><span>{t('pdp.assureShip', { amount: money(set.freeShippingThreshold) })}</span></li>
          <li><Icon name="refresh" /><span>{t('pdp.assureReturn')}</span></li>
          <li><Icon name="phone" /><span>{t('pdp.assureSupport')}</span></li>
        </ul>
        <div className="safe-checkout"><Icon name="lock" /><span>{t('pdp.safeCheckout')}</span><PayMarks /></div>
      </div>
    </section>

    <nav className="pdp-tabs" aria-label={t('pdp.sections')}><div className="container"><ul>
      {tabs.map(([k, l]) => <li key={k}><a href={`#${k}`} data-jump={k} className={tab === k ? 'on' : ''} aria-current={tab === k || undefined} onClick={e => { e.preventDefault(); jump(k); }}>{l}{k === 'reviews' && <> <span className="n">{r.count}</span></>}</a></li>)}
    </ul></div></nav>

    <div className="container pdp-sections">
      <section id="desc" className="pdp-sec" aria-labelledby="h-desc"><h2 id="h-desc">{t('pdp.tab.desc')}</h2>
        <p className="lead">{ptext(p, 'desc')}</p><p>{t('pdp.descExtra')}</p>
      </section>
      <section id="details" className="pdp-sec" aria-labelledby="h-details"><h2 id="h-details">{t('pdp.tab.details')}</h2>
        <dl className="specs">{specs.map(([k, v]) => <div key={k}><dt>{specLabel(k)}</dt><dd>{v}</dd></div>)}</dl>
      </section>
      <section id="notes" className="pdp-sec" aria-labelledby="h-notes"><h2 id="h-notes">{t('pdp.tab.notes')}</h2>
        {hasNotes ? (<>
          <p className="muted">{p.family ? t('pdp.notesIntro', { family: t('family.' + p.family) }) : t('pdp.notesIntroPlain')}</p>
          <div className="pyramid">{['top', 'heart', 'base'].map((lvl, i) => (
            <div key={lvl} className={`pyr pyr-${lvl} reveal`} style={{ '--d': `${i * 100}ms` }}><span className="pyr-ic"><Icon name={NOTE_ICONS[lvl]} /></span>
              <div><h3>{t('notes.' + lvl)}</h3><p className="muted small">{t('notes.' + lvl + '.d')}</p><ul className="note-chips">{p.notes[lvl].map(n => <li key={n}>{noteLabel(n)}</li>)}</ul></div></div>
          ))}</div>
        </>) : <div className="alert alert-info"><Icon name="info" /><span>{t(p.type === 'oil' ? 'pdp.notesPending' : 'pdp.notesDiffuser')} <a href={p.type === 'oil' ? '#/contact' : '#/deals/aroma'}>{p.type === 'oil' ? t('pdp.contactUs') : t('home.oilsTitle')}</a></span></div>}
      </section>
      <section id="use" className="pdp-sec" aria-labelledby="h-use"><h2 id="h-use">{t('pdp.tab.use')}</h2>
        <ol className="steps">{howTo.map((k, i) => <li key={k}><span className="step-n">{i + 1}</span><div><h3>{t(k + '.t')}</h3><p>{t(k + '.d')}</p></div></li>)}</ol>
      </section>
      <section id="reviews" className="pdp-sec" aria-labelledby="h-reviews"><h2 id="h-reviews">{t('pdp.tab.reviews')}</h2><Reviews p={p} /></section>
      <section id="shipping" className="pdp-sec" aria-labelledby="h-shipping"><h2 id="h-shipping">{t('pdp.tab.shipping')}</h2>
        <div className="ship-grid">
          <div><Icon name="truck" /><h3>{t('ship.standard')}</h3><p>{t('ship.standardD', { fee: money(set.shippingFee), amount: money(set.freeShippingThreshold) })}</p></div>
          <div><Icon name="clock" /><h3>{t('ship.express')}</h3><p>{t('ship.expressD', { fee: money(set.expressFee) })}</p></div>
          <div><Icon name="refresh" /><h3>{t('policy.returns')}</h3><p>{t('ship.returnsD')}</p></div>
        </div>
        <a className="link-arrow" href="#/policies/shipping">{t('ship.full')} <Icon name="arrowRight" className="flip" /></a>
      </section>
    </div>

    <section className="section">
      <div className="container"><SectionHead title={t('pdp.related')} eyebrow={t('pdp.relatedEyebrow')} /></div>
      <div className="container-wide"><Carousel id="car-related" label={t('pdp.related')}>{related.map(x => <ProductCard key={x.id} p={x} />)}</Carousel></div>
    </section>

    <div className={`sticky-buy${sticky ? ' show' : ''}`} aria-hidden={!sticky}>
      <div className="container sb-in">
        <Img k={p.img} />
        <div className="sb-txt"><strong>{name}</strong><span>{money(price)}</span></div>
        <Button className="btn btn-teal" busy={busy === 'sticky'} busyLabel={t('cart.adding')} disabled={out} tabIndex={sticky ? 0 : -1} onClick={() => add('sticky')}>{out ? t('stock.out') : t('cart.add')}</Button>
      </div>
    </div>
  </>);
}

