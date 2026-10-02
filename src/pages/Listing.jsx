/* Collection / deals / search listing with filters, sort, URL sync and a mobile filter drawer */
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Breadcrumbs, Empty, Check } from '../components/common.jsx';
import { ProductCard, SkeletonCards } from '../components/ProductCard.jsx';
import { Overlay } from '../components/ui.jsx';
import { S, api } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { money, errorText, reducedMotion } from '../lib/format.js';
import { searchProducts } from '../lib/search.js';
import { replaceHash, useTitle } from '../lib/router.js';
import { TYPES, SPACES, FAMILIES, discountPct } from '../data/catalog.js';
import NotFound from './NotFound.jsx';

const SORTS = ['featured', 'price-asc', 'price-desc', 'discount', 'rating', 'newest'];

function listingConfig(kind, key, q) {
  if (kind === 'search') return { title: q.q ? t('search.resultsFor', { q: q.q }) : t('search.title'), base: f => f.q ? searchProducts(f.q) : S.products(), crumbs: t('search.title'), isSearch: true };
  if (kind === 'deals') {
    if (!['aroma', 'crazy'].includes(key)) return null;
    const c = key === 'aroma' ? 'aroma-deals' : 'crazy-deals';
    return { title: t(key === 'aroma' ? 'nav.aromaDeals' : 'nav.crazyDeals'), sub: t(key === 'aroma' ? 'deals.aromaSub' : 'deals.crazySub'), base: () => S.collection(c), deals: key, crumbs: t(key === 'aroma' ? 'nav.aromaDeals' : 'nav.crazyDeals') };
  }
  const map = { diffusers: 'nav.diffusers', oils: 'home.oilsTitle', signature: 'home.oilsTitle', hotel: 'home.hotelTitle', 'home-care': 'nav.homeCare', gifts: 'nav.gifts', bestsellers: 'home.bestTitle' };
  if (!map[key]) return null;
  return { title: t(map[key]), sub: t('coll.' + key + '.sub'), base: () => S.collection(key), crumbs: t(map[key]), gift: key === 'gifts' };
}

const parseFilters = q => {
  const arr = k => (q[k] ? q[k].split(',').filter(Boolean) : []);
  return { type: arr('type'), space: arr('space'), family: arr('family'), min: q.min ? +q.min : null, max: q.max ? +q.max : null, stock: q.stock === '1', sale: q.sale === '1', rating: q.rating ? +q.rating : 0, sort: SORTS.includes(q.sort) ? q.sort : 'featured', q: q.q || '' };
};
const filtersToQuery = f => {
  const o = {};
  if (f.q) o.q = f.q;
  ['type', 'space', 'family'].forEach(k => { if (f[k].length) o[k] = f[k].join(','); });
  if (f.min != null) o.min = f.min; if (f.max != null) o.max = f.max;
  if (f.stock) o.stock = 1; if (f.sale) o.sale = 1; if (f.rating) o.rating = f.rating;
  if (f.sort !== 'featured') o.sort = f.sort;
  const s = new URLSearchParams(o).toString();
  return s ? '?' + s : '';
};

function applyFilters(list, f) {
  let r = list.slice();
  if (f.type.length) r = r.filter(p => f.type.includes(p.type));
  if (f.space.length) r = r.filter(p => p.spaces.some(s => f.space.includes(s)));
  if (f.family.length) r = r.filter(p => f.family.includes(p.family));
  if (f.min != null) r = r.filter(p => p.price >= f.min);
  if (f.max != null) r = r.filter(p => p.price <= f.max);
  if (f.stock) r = r.filter(p => p.stock > 0);
  if (f.sale) r = r.filter(p => discountPct(p) > 0);
  if (f.rating) r = r.filter(p => S.rating(p).avg >= f.rating);
  const by = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, discount: (a, b) => discountPct(b) - discountPct(a), rating: (a, b) => S.rating(b).avg - S.rating(a).avg, newest: (a, b) => (b.isNew - a.isNew) }[f.sort];
  if (by) r.sort(by);
  r.sort((a, b) => (a.stock <= 0) - (b.stock <= 0)); /* sold-out last in every sort */
  return r;
}

function FilterPanel({ f, set, base, isSearch }) {
  const [minD, setMinD] = useState(f.min ?? '');
  const [maxD, setMaxD] = useState(f.max ?? '');
  const [qD, setQD] = useState(f.q);
  useEffect(() => { setMinD(f.min ?? ''); setMaxD(f.max ?? ''); }, [f.min, f.max]);
  /* debounce typed values */
  useEffect(() => {
    const h = setTimeout(() => {
      const mn = minD === '' ? null : Math.max(0, +minD), mx = maxD === '' ? null : Math.max(0, +maxD);
      if (mn !== f.min || mx !== f.max) set({ min: mn, max: mx });
    }, 500);
    return () => clearTimeout(h);
  }, [minD, maxD]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isSearch) return; const h = setTimeout(() => { if (qD.trim() !== f.q) set({ q: qD.trim() }); }, 400); return () => clearTimeout(h); }, [qD]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key, v) => set({ [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : f[key].concat(v) });
  const group = (key, values, labelFn, test) => (
    <fieldset className="fgroup"><legend>{t('filter.' + key)}</legend>
      {values.map(v => { const n = base.filter(p => test(p, v)).length; const on = f[key].includes(v); return (
        <Check key={v} name={key} value={v} checked={on} disabled={!n && !on} onChange={() => toggle(key, v)} label={labelFn(v)}><span className="n">{n}</span></Check>
      ); })}
    </fieldset>
  );
  const ranges = [[0, 400], [400, 900], [900, null]];
  return (
    <form className="filters" onSubmit={e => e.preventDefault()} noValidate>
      {isSearch && <div className="fgroup"><label className="flabel" htmlFor="fq">{t('search.label')}</label><div className="search-inline"><Icon name="search" /><input id="fq" type="search" value={qD} onChange={e => setQD(e.target.value)} placeholder={t('search.placeholder')} /></div></div>}
      {group('type', TYPES, v => t('type.' + v + '.plural'), (p, v) => p.type === v)}
      {group('space', SPACES, v => t('space.' + v), (p, v) => p.spaces.includes(v))}
      {group('family', FAMILIES, v => t('family.' + v), (p, v) => p.family === v)}
      <fieldset className="fgroup"><legend>{t('filter.price')} <span className="muted small">(AED)</span></legend>
        <div className="price-inputs">
          <label><span className="sr-only">{t('filter.min')}</span><input type="number" min="0" step="50" placeholder={`${t('filter.min')} (AED)`} value={minD} onChange={e => setMinD(e.target.value)} /></label>
          <span aria-hidden="true">–</span>
          <label><span className="sr-only">{t('filter.max')}</span><input type="number" min="0" step="50" placeholder={`${t('filter.max')} (AED)`} value={maxD} onChange={e => setMaxD(e.target.value)} /></label>
        </div>
        <div className="chips">{ranges.map(([a, b]) => { const on = f.min === a && f.max === b; return (
          <button type="button" key={a} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set(on ? { min: null, max: null } : { min: a, max: b })}>
            {b == null ? t('filter.over', { amount: money(a) }) : t('filter.range', { a: money(a), b: money(b) })}
          </button>
        ); })}</div>
      </fieldset>
      <fieldset className="fgroup"><legend>{t('filter.more')}</legend>
        <Check name="stock" checked={f.stock} onChange={e => set({ stock: e.target.checked })} label={t('filter.inStock')} />
        <Check name="sale" checked={f.sale} onChange={e => set({ sale: e.target.checked })} label={t('filter.onSale')} />
        <label className="flabel" htmlFor="frating">{t('filter.rating')}</label>
        <select id="frating" value={f.rating} onChange={e => set({ rating: +e.target.value })}>
          <option value="0">{t('filter.anyRating')}</option>
          {[4.5, 4.7, 4.8].map(r => <option key={r} value={r}>{t('filter.ratingUp', { n: r })}</option>)}
        </select>
      </fieldset>
      <button type="button" className="btn btn-ghost btn-block" data-action="clear-filters" onClick={() => set({ type: [], space: [], family: [], min: null, max: null, stock: false, sale: false, rating: 0 })}>{t('filter.clear')}</button>
    </form>
  );
}

export default function Listing({ kind, collKey, q }) {
  const cfg = useMemo(() => listingConfig(kind, collKey, q), [kind, collKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(() => parseFilters(q));
  const [state, setState] = useState('loading');
  const [drawer, setDrawer] = useState(false);
  const chipsRef = useRef(null);
  useTitle(cfg ? cfg.title : t('nf.title'));

  useEffect(() => { api(() => true, 380).then(() => setState('ready')).catch(err => setState({ err })); }, []);
  /* keep the URL in sync with the filters so results are shareable */
  useEffect(() => {
    const h = location.hash.split('?')[0] + filtersToQuery(f);
    if (h !== location.hash) replaceHash(h);
  }, [f]);
  if (!cfg) return <NotFound />;

  const set = patch => setF(prev => ({ ...prev, ...patch }));
  const base = cfg.base(f);
  const list = applyFilters(base, f);

  const chips = [];
  ['type', 'space', 'family'].forEach(k => f[k].forEach(v => chips.push({ k, v, l: t(k === 'type' ? 'type.' + v + '.plural' : k + '.' + v) })));
  if (f.min != null || f.max != null) chips.push({ k: 'price', l: `${f.min != null ? money(f.min) : '0'} – ${f.max != null ? money(f.max) : '∞'}` });
  if (f.stock) chips.push({ k: 'stock', l: t('filter.inStock') });
  if (f.sale) chips.push({ k: 'sale', l: t('filter.onSale') });
  if (f.rating) chips.push({ k: 'rating', l: t('filter.ratingUp', { n: f.rating }) });
  const removeChip = c => {
    if (['type', 'space', 'family'].includes(c.k)) set({ [c.k]: f[c.k].filter(x => x !== c.v) });
    else if (c.k === 'price') set({ min: null, max: null });
    else if (c.k === 'rating') set({ rating: 0 });
    else set({ [c.k]: false });
  };

  let gridBody;
  if (state === 'loading') gridBody = <SkeletonCards n={6} />;
  else if (state.err) gridBody = <div className="grid-empty"><Empty ic="alert" title={t('err.loadTitle')} text={errorText(state.err)}><button className="btn btn-primary" onClick={() => location.reload()}>{t('common.retry')}</button></Empty></div>;
  else if (!list.length) {
    gridBody = <div className="grid-empty">{
      cfg.isSearch && !base.length && f.q
        ? <Empty ic="search" title={t('search.noResults', { q: f.q })} text={t('search.noResultsHint')}><a className="btn btn-primary" href="#/shop/diffusers">{t('search.browseAll')}</a><a className="btn btn-outline" href="#/contact">{t('search.askUs')}</a></Empty>
        : base.length
          ? <Empty ic="filter" title={t('listing.noMatch')} text={t('listing.noMatchHint')}><button className="btn btn-primary" data-action="clear-filters" onClick={() => set({ type: [], space: [], family: [], min: null, max: null, stock: false, sale: false, rating: 0 })}>{t('filter.clear')}</button></Empty>
          : cfg.deals === 'crazy'
            ? <Empty ic="tag" title={t('deals.noneTitle')} text={t('deals.noneText')}><a className="btn btn-primary" href="#/shop/diffusers">{t('nav.diffusers')}</a><a className="btn btn-outline" href="#/deals/aroma">{t('home.oilsTitle')}</a></Empty>
            : <Empty ic="box" title={t('listing.noProducts')} text={t('listing.noProductsHint')}><a className="btn btn-primary" href="#/shop/diffusers">{t('search.browseAll')}</a></Empty>
    }</div>;
  } else {
    const anim = !reducedMotion();
    gridBody = list.map((p, i) => <ProductCard key={p.id} p={p} showSave={!!cfg.deals} gift={cfg.gift} style={anim ? { '--d': Math.min(i, 8) * 40 + 'ms' } : undefined} />);
  }

  return (<>
    <Breadcrumbs items={[['#/', t('nav.home')], [null, cfg.crumbs]]} />
    <section className={`page-hero${cfg.deals ? ' deals-hero' : ''}`}>
      <div className="container">
        {cfg.deals && <p className="eyebrow"><Icon name={cfg.deals === 'crazy' ? 'flame' : 'tank'} /> {t(cfg.deals === 'aroma' ? 'home.oilsEyebrow' : 'deals.eyebrow')}</p>}
        <h1 className="page-title">{cfg.isSearch ? (f.q ? t('search.resultsFor', { q: f.q }) : t('search.title')) : cfg.title}</h1>
        {cfg.sub && <p className="page-sub">{cfg.sub}</p>}
        {cfg.deals === 'aroma' && <p className="deal-note"><Icon name="gift" /> {t('deals.aromaNote')}</p>}
      </div>
    </section>
    <div className="container listing">
      <aside className="filters-side" aria-label={t('filter.title')}>
        <h2 className="side-h"><Icon name="filter" /> {t('filter.title')}</h2>
        <FilterPanel f={f} set={set} base={base} isSearch={cfg.isSearch} />
      </aside>
      <div className="listing-main">
        <div className="toolbar">
          <p className="result-count" role="status" aria-live="polite">{state === 'ready' ? t('listing.count', { n: list.length }) : ''}</p>
          <div className="toolbar-end">
            <button className="btn btn-outline btn-sm only-mobile-tab" onClick={() => setDrawer(true)}><Icon name="filter" /> {t('filter.title')} {chips.length > 0 && <span className="badge-count show">{chips.length}</span>}</button>
            <label className="sort"><span>{t('sort.label')}</span>
              <select value={f.sort} onChange={e => set({ sort: e.target.value })}>{SORTS.map(s => <option key={s} value={s}>{t('sort.' + s)}</option>)}</select>
            </label>
          </div>
        </div>
        {chips.length > 0 && <div className="active-chips" ref={chipsRef}>
          {chips.map(c => <button key={c.k + (c.v || '')} className="chip on removable" onClick={() => removeChip(c)} aria-label={t('filter.remove', { name: c.l })}>{c.l} <Icon name="close" /></button>)}
        </div>}
        <div className="grid grid-3" data-grid aria-busy={state === 'loading'}>{gridBody}</div>
      </div>
    </div>
    {drawer && (
      <Overlay kind="drawer-start" title={t('filter.title')} className="filter-ov" onClose={() => setDrawer(false)}>
        {close => (<>
          <FilterPanel f={f} set={set} base={base} isSearch={cfg.isSearch} />
          <div className="drawer-foot sticky"><button className="btn btn-primary btn-block" onClick={close}>{t('filter.show', { n: list.length })}</button></div>
        </>)}
      </Overlay>
    )}
  </>);
}
