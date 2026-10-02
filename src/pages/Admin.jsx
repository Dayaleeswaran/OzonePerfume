/* Protected admin interface */
import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Empty, Field, Check, Switch, Stars, Img } from '../components/common.jsx';
import { Overlay, Button, Alert, Spinner, useUI } from '../components/ui.jsx';
import { Logo, LocaleControls } from '../components/Header.jsx';
import { OrderDetail } from './Order.jsx';
import { S } from '../lib/store.js';
import { t, DICTS } from '../lib/i18n.js';
import { money, fmtDate, errorText } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { navigate, useTitle } from '../lib/router.js';
import { TYPES, FAMILIES, SPACES, FEATURES, IMAGE_LIBRARY, LANGS, discountPct } from '../data/catalog.js';

const NAV = [['dashboard', 'dashboard'], ['products', 'box'], ['categories', 'layers'], ['orders', 'bag'], ['customers', 'users'], ['inventory', 'grid'], ['payments', 'card'], ['coupons', 'tag'], ['reviews', 'star'], ['gifts', 'gift'], ['dates', 'calendar'], ['translations', 'globe'], ['settings', 'settings']];
const STATUSES = ['processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const aed = n => money(n, { currency: 'AED' });
const en = DICTS.en;

function Table({ cols, rows, empty, caption }) {
  if (!rows.length) return <Empty ic="box" title={empty || t('admin.nothing')} />;
  return (
    <div className="tbl-wrap"><table className="tbl">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr>{cols.map((c, i) => <th key={i} scope="col" className={c.cls || ''}>{c.label}</th>)}</tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
  );
}
const StatusPill = ({ s }) => <span className={`status status-${s}`}>{t('status.' + s)}</span>;
const Tile = ({ label, value, sub, ic }) => <div className="tile-stat card"><Icon name={ic} /><p className="ts-label">{label}</p><p className="ts-value">{value}</p>{sub && <p className="ts-sub muted small">{sub}</p>}</div>;

/* ---------- dashboard ---------- */
function Dashboard() {
  const orders = S.db.orders.filter(o => o.payment.status === 'paid' && !['cancelled', 'refunded'].includes(o.status));
  const revenue = orders.reduce((a, o) => a + o.totals.total, 0);
  const customers = S.db.customers.length;
  const low = S.db.products.filter(p => p.stock <= 10);
  const pending = S.db.reviews.filter(r => r.status === 'pending');
  return (<>
    <div className="tiles-stat">
      <Tile label={t('admin.revenue')} value={aed(revenue)} sub={t('admin.revenueSub', { n: orders.length })} ic="card" />
      <Tile label={t('admin.orders')} value={orders.length} sub={t('admin.toFulfil', { n: S.db.orders.filter(o => o.status === 'processing').length })} ic="bag" />
      <Tile label={t('admin.aov')} value={aed(orders.length ? revenue / orders.length : 0)} ic="percent" />
      <Tile label={t('admin.customers')} value={customers} ic="users" />
      <Tile label={t('admin.lowStock')} value={low.length} sub={t('admin.lowStockSub')} ic="alert" />
      <Tile label={t('admin.pendingReviews')} value={pending.length} ic="star" />
    </div>
    <div className="adm-cols">
      <section className="card"><div className="row-between"><h2 className="card-h">{t('admin.recentOrders')}</h2><a href="#/admin/orders" className="link-arrow">{t('common.viewAll')} <Icon name="arrowRight" className="flip" /></a></div>
        <Table cols={[{ label: t('order.number') }, { label: t('order.date') }, { label: t('admin.customer') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }]} empty={t('order.noneTitle')}
          rows={S.db.orders.slice(0, 6).map(o => <tr key={o.id}><td><a href={`#/admin/orders/${o.id}`}>{o.id}</a></td><td>{fmtDate(o.date)}</td><td>{o.email}</td><td><StatusPill s={o.status} /></td><td className="num">{aed(o.totals.total)}</td></tr>)} />
      </section>
      <section className="card"><div className="row-between"><h2 className="card-h">{t('admin.lowStock')}</h2><a href="#/admin/inventory" className="link-arrow">{t('admin.inventory')} <Icon name="arrowRight" className="flip" /></a></div>
        {low.length ? <ul className="adm-list">{low.map(p => <li key={p.id}><Img k={p.img} /><span>{p.name.en}</span>{p.stock <= 0 ? <span className="status status-cancelled">{t('stock.out')}</span> : <span className="status status-processing">{t('admin.unitsLeft', { n: p.stock })}</span>}</li>)}</ul> : <p className="muted">{t('admin.allStocked')}</p>}
      </section>
    </div>
  </>);
}

/* ---------- products ---------- */
function downscale(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject({ code: 'imageType' });
    if (file.size > 8 * 1024 * 1024) return reject({ code: 'imageSize' });
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const scale = Math.min(1, 1000 / im.width);
        const c = document.createElement('canvas'); c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/webp', 0.8); if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.82);
        resolve(url);
      };
      im.onerror = () => reject({ code: 'imageType' });
      im.src = fr.result;
    };
    fr.onerror = () => reject({ code: 'imageType' });
    fr.readAsDataURL(file);
  });
}

const specKeys = Object.keys(en).filter(k => k.startsWith('spec.'));
const specToLine = ([k, val]) => `${en[k] || k}: ${val}`;
const lineToSpec = line => { const i = line.indexOf(':'); const label = line.slice(0, i).trim(); const key = specKeys.find(k => en[k].toLowerCase() === label.toLowerCase()); return [key || label, line.slice(i + 1).trim()]; };

function ProductForm({ p, onClose }) {
  const ui = useUI();
  const f = useForm();
  const isNew = !p;
  const v = useRef(p ? JSON.parse(JSON.stringify(p)) : { id: 'p' + Date.now().toString(36), sku: '', img: 'o1', type: 'tower', family: null, line: '', gallery: [], spaces: ['home'], price: 0, compareAt: 0, stock: 0, rating: 0, reviewCount: 0, bestSeller: false, giftable: true, aromaDeal: false, isNew: true, active: true, sizes: [{ id: '150', ml: 150, delta: 0 }], features: [], specs: [], ideal: { en: '', es: '', ar: '' }, notes: { top: [], heart: [], base: [] }, name: { en: '', es: '', ar: '' }, tagline: { en: '', es: '', ar: '' }, desc: { en: '', es: '', ar: '' } }).current;
  if (!Array.isArray(v.specs)) v.specs = [];
  if (!v.ideal) v.ideal = { en: '', es: '', ar: '' };
  const [img, setImg] = useState(v.img);
  const [imgErr, setImgErr] = useState('');
  const [busy, setBusy] = useState(false);
  const priceRef = useRef(null), discRef = useRef(null), compRef = useRef(null);
  const num = r => parseFloat(r.current.value) || 0;
  const langTabs = (field, label, type = 'text') => (
    <fieldset className="fs"><legend>{label}</legend><div className="grid-3">
      {['en', 'es', 'ar'].map(l => <Field key={l} name={`${field}_${l}`} label={LANGS[l].label} type={type} rows={3} defaultValue={v[field][l] || ''} required={l === 'en'} dir={l === 'ar' ? 'rtl' : undefined} lang={l} error={f.errors[`${field}_${l}`]} onClear={f.clear} />)}
    </div></fieldset>
  );
  const submit = e => {
    e.preventDefault();
    const sizesOk = val => String(val).split(',').every(s => /^\s*\d+\s*:\s*-?\d+\s*$/.test(s)) ? '' : t('admin.sizesErr');
    const d = f.validate(e.currentTarget, {
      sku: [V.required], name_en: [V.required], tagline_en: [V.required], desc_en: [V.required, V.min(20)],
      price: [V.required, x => +x > 0 ? '' : t('admin.priceErr')], compareAt: [(x, all) => !x || +x >= +all.price ? '' : t('admin.compareErr')],
      stock: [V.required, x => Number.isInteger(+x) && +x >= 0 ? '' : t('admin.stockErr')], sizes: [V.required, sizesOk]
    });
    if (!d) return;
    const L = ['en', 'es', 'ar'];
    const lang = k => Object.fromEntries(L.map(l => [l, (d[`${k}_${l}`] || '').trim()]));
    const rec = Object.assign(v, {
      sku: d.sku.trim(), img, type: d.type, family: d.family || null, line: d.line || '',
      price: +d.price, compareAt: +d.compareAt || 0, stock: +d.stock,
      active: !!d.active, bestSeller: !!d.bestSeller, aromaDeal: !!d.aromaDeal, giftable: !!d.giftable, isNew: !!d.isNew,
      name: lang('name'), tagline: lang('tagline'), desc: lang('desc'), ideal: lang('ideal'),
      notes: Object.fromEntries(['top', 'heart', 'base'].map(l => [l, (d['notes_' + l] || '').split(',').map(s => s.trim()).filter(Boolean)])),
      sizes: d.sizes.split(',').map(s => { const [ml, delta] = s.split(':').map(x => parseInt(x, 10)); return { id: String(ml), ml, delta }; }),
      spaces: SPACES.filter(s => d['space_' + s]),
      features: FEATURES.filter(x => d['feat_' + x]),
      specs: String(d.specs || '').split('\n').map(l => l.trim()).filter(l => l.includes(':')).map(lineToSpec)
    });
    if (!rec.spaces.length) rec.spaces = ['home'];
    setBusy(true);
    S.admin.saveProduct(rec).then(() => { onClose(); ui.toast(t(isNew ? 'admin.productAdded' : 'admin.productSaved'), 'success'); })
      .catch(er => { setBusy(false); f.setAlert({ type: 'error', msg: er.code === 'unknown' ? t('err.storage') : errorText(er) }); });
  };
  return (
    <Overlay title={isNew ? t('admin.addProduct') : t('admin.editProduct')} size="lg" className="adm-ov" onClose={onClose}>
      {close => (
        <form data-pform noValidate onSubmit={submit}>
          {f.alert && <Alert>{f.alert.msg}</Alert>}
          <div className="pform-top">
            <div className="img-edit">
              <div className="img-prev"><Img k={img} /></div>
              <label className="btn btn-outline btn-sm file-btn"><Icon name="upload" /> {t('admin.uploadImage')}
                <input type="file" accept="image/*" className="sr-only" onChange={e => { const file = e.target.files[0]; if (!file) return; setImgErr(''); downscale(file).then(setImg).catch(er => setImgErr(t('err.' + er.code))); }} /></label>
              <Field name="imgKey" label={t('admin.orLibrary')} defaultValue={/^data:/.test(v.img) ? '' : v.img} options={[{ value: '', label: '—' }].concat(IMAGE_LIBRARY.map(k => ({ value: k, label: k })))} onChange={e => e.target.value && setImg(e.target.value)} />
              <p className="err" role="alert">{imgErr}</p>
            </div>
            <div className="pform-main">
              <div className="grid-3">
                <Field name="sku" label="SKU" required defaultValue={v.sku} error={f.errors.sku} onClear={f.clear} />
                <Field name="type" label={t('spec.type')} defaultValue={v.type} options={TYPES.map(x => ({ value: x, label: t('type.' + x) }))} />
                <Field name="family" label={t('filter.family')} defaultValue={v.family || ''} options={[{ value: '', label: '—' }].concat(FAMILIES.map(x => ({ value: x, label: t('family.' + x) })))} />
              </div>
              <div className="grid-4">
                <Field name="compareAt" label={t('admin.origPrice')} type="number" defaultValue={v.compareAt || ''} min="0" step="1" ref={compRef} error={f.errors.compareAt} onClear={f.clear}
                  onInput={() => { if (num(discRef)) priceRef.current.value = Math.round(num(compRef) * (1 - num(discRef) / 100)); }} />
                <Field name="discount" label={t('admin.discountPct')} type="number" defaultValue={discountPct(v) || ''} min="0" max="95" step="1" ref={discRef}
                  onInput={() => { if (num(compRef)) priceRef.current.value = Math.round(num(compRef) * (1 - num(discRef) / 100)); }} />
                <Field name="price" label={t('admin.salePrice')} type="number" required defaultValue={v.price || ''} min="1" step="1" ref={priceRef} error={f.errors.price} onClear={f.clear}
                  onInput={() => { discRef.current.value = num(compRef) > num(priceRef) ? Math.round((1 - num(priceRef) / num(compRef)) * 100) : ''; }} />
                <Field name="stock" label={t('admin.stock')} type="number" required defaultValue={v.stock} min="0" step="1" error={f.errors.stock} onClear={f.clear} />
              </div>
              <div className="flag-row">
                {[['active', t('admin.availableOnline')], ['bestSeller', t('badge.best')], ['aromaDeal', t('nav.aromaDeals')], ['giftable', t('admin.giftable')], ['isNew', t('badge.new')]].map(([k, l]) =>
                  <Check key={k} name={k} defaultChecked={k === 'active' ? v.active !== false : !!v[k]} label={l} />)}
              </div>
            </div>
          </div>
          {langTabs('name', t('admin.name'))}
          {langTabs('tagline', t('admin.tagline'))}
          {langTabs('desc', t('pdp.tab.desc'), 'textarea')}
          {langTabs('ideal', t('spec.idealFor'))}
          <fieldset className="fs"><legend>{t('pdp.tab.notes')}</legend><p className="hint">{t('admin.notesHint')}</p><div className="grid-3">
            {['top', 'heart', 'base'].map(l => <Field key={l} name={'notes_' + l} label={t('notes.' + l)} defaultValue={v.notes[l].join(', ')} />)}
          </div></fieldset>
          <fieldset className="fs"><legend>{t('pdp.tab.details')}</legend>
            <div className="grid-3">
              <Field name="sizes" label={t('admin.sizes')} required defaultValue={v.sizes.map(s => `${s.ml}:${s.delta}`).join(', ')} hint={t('admin.sizesHint')} error={f.errors.sizes} onClear={f.clear} />
              <Field name="line" label={t('admin.line')} defaultValue={v.line || ''} options={[{ value: '', label: '—' }, { value: 'signature', label: t('home.oilsTitle') }, { value: 'hotel', label: t('home.hotelTitle') }]} />
            </div>
            <Field name="specs" label={t('admin.specs')} type="textarea" rows={6} defaultValue={v.specs.map(specToLine).join('\n')} hint={t('admin.specsHint')} />
            <p className="lbl">{t('filter.space')}</p><div className="flag-row">{SPACES.map(s => <Check key={s} name={'space_' + s} defaultChecked={v.spaces.includes(s)} label={t('space.' + s)} />)}</div>
            <p className="lbl">{t('admin.features')}</p><div className="flag-row">{FEATURES.map(x => <Check key={x} name={'feat_' + x} defaultChecked={v.features.includes(x)}><span><Icon name={x} /> {t('feat.' + x)}</span></Check>)}</div>
          </fieldset>
          <div className="btn-row end sticky-actions"><button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('common.save')}</Button></div>
        </form>
      )}
    </Overlay>
  );
}

function Products({ sub }) {
  const ui = useUI();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(sub === 'new' ? 'new' : null);
  const list = S.db.products.filter(p => !q || (p.name.en + ' ' + p.sku + ' ' + p.type).toLowerCase().includes(q.toLowerCase()));
  const del = async p => { if (await ui.confirm(t('admin.confirmDeleteProduct', { name: p.name.en }), { confirmLabel: t('common.delete') })) S.admin.deleteProduct(p.id).then(() => ui.toast(t('admin.productDeleted'), 'info')).catch(er => ui.toast(errorText(er), 'error')); };
  return (<>
    <div className="adm-toolbar">
      <label className="search-inline"><Icon name="search" /><span className="sr-only">{t('admin.searchProducts')}</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchProducts')} /></label>
      <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" /> {t('admin.addProduct')}</button>
    </div>
    <Table caption={t('admin.products')} empty={t('listing.noProducts')}
      cols={[{ label: '' }, { label: t('admin.product') }, { label: 'SKU' }, { label: t('spec.type') }, { label: t('price.price'), cls: 'num' }, { label: t('admin.discount'), cls: 'num' }, { label: t('admin.stock'), cls: 'num' }, { label: t('admin.visibility') }, { label: '' }]}
      rows={list.map(p => (
        <tr key={p.id}>
          <td className="thumb"><Img k={p.img} /></td>
          <td><strong>{p.name.en}</strong><br /><span className="muted small">{p.family ? t('family.' + p.family) : t('type.' + p.type)}</span></td>
          <td><code>{p.sku}</code></td><td>{t('type.' + p.type)}</td>
          <td className="num">{aed(p.price)}{p.compareAt > p.price && <><br /><s className="muted small">{aed(p.compareAt)}</s></>}</td>
          <td className="num">{discountPct(p)}%</td>
          <td className={`num ${p.stock <= 0 ? 'neg' : p.stock <= 10 ? 'warn' : ''}`}>{p.stock}</td>
          <td>{p.active === false ? <span className="status status-cancelled">{t('admin.hidden')}</span> : <span className="status status-delivered">{t('admin.live')}</span>}</td>
          <td className="acts">
            <button className="icon-btn" data-edit={p.id} onClick={() => setEditing(p)} aria-label={`${t('common.edit')} ${p.name.en}`}><Icon name="edit" /></button>
            <a className="icon-btn" href={`#/product/${p.id}`} aria-label={`${t('admin.preview')} ${p.name.en}`}><Icon name="eye" /></a>
            <button className="icon-btn danger" onClick={() => del(p)} aria-label={`${t('common.delete')} ${p.name.en}`}><Icon name="trash" /></button>
          </td>
        </tr>
      ))} />
    {editing && <ProductForm p={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
  </>);
}

/* ---------- categories ---------- */
function Categories() {
  const ui = useUI();
  const flags = [['bestSeller', t('home.bestTitle')], ['aromaDeal', t('nav.aromaDeals')], ['giftable', t('nav.gifts')], ['isNew', t('badge.new')], ['active', t('admin.availableOnline')]];
  const toggle = (p, k, val) => S.admin.saveProduct({ ...p, [k]: val }).then(() => ui.toast(t('admin.saved'), 'success')).catch(er => ui.toast(errorText(er), 'error'));
  return (<>
    <div className="tiles-stat">{TYPES.map(ty => <Tile key={ty} label={t('type.' + ty + '.plural')} value={S.db.products.filter(p => p.type === ty).length} ic="layers" />)}</div>
    <div className="card"><h2 className="card-h">{t('admin.collections')}</h2><p className="muted small">{t('admin.collectionsHint')}</p>
      <Table cols={[{ label: t('admin.product') }, { label: t('spec.type') }].concat(flags.map(([, l]) => ({ label: l, cls: 'center' }))).concat([{ label: t('nav.crazyDeals'), cls: 'center' }])}
        rows={S.db.products.map(p => (
          <tr key={p.id}><td>{p.name.en}</td><td>{t('type.' + p.type)}</td>
            {flags.map(([k, l]) => <td key={k} className="center"><Check className="solo" checked={k === 'active' ? p.active !== false : !!p[k]} onChange={e => toggle(p, k, e.target.checked)} aria-label={`${l} — ${p.name.en}`} /></td>)}
            <td className="center">{p.compareAt > p.price ? <Icon name="check" /> : <span className="muted">—</span>}</td></tr>
        ))} />
    </div>
  </>);
}

/* ---------- orders ---------- */
function OrderView({ id }) {
  const ui = useUI();
  const o = S.order(id);
  const [status, setStatus] = useState(o ? o.status : '');
  const [busy, setBusy] = useState(false);
  if (!o) return <Empty ic="box" title={t('order.notFound')}><a className="btn btn-primary" href="#/admin/orders">{t('order.back')}</a></Empty>;
  const cust = !!o.user;
  return (<>
    <a className="link-arrow back" href="#/admin/orders"><Icon name="arrowRight" className="flip rot" /> {t('order.back')}</a>
    <div className="adm-order-head card">
      <form className="status-form" onSubmit={e => { e.preventDefault(); if (status === o.status) return; setBusy(true); S.admin.setOrderStatus(o.id, status).then(() => { setBusy(false); ui.toast(t('admin.statusUpdated', { status: t('status.' + status) }), 'success'); }).catch(er => { setBusy(false); ui.toast(errorText(er), 'error'); }); }}>
        <label htmlFor="ostatus">{t('admin.updateStatus')}</label>
        <select id="ostatus" value={status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{t('status.' + s)}</option>)}</select>
        <Button type="submit" className="btn btn-primary btn-sm" busy={busy}>{t('common.save')}</Button>
      </form>
      <div><p className="muted small">{t('admin.customer')}</p><p><strong>{o.shipping.firstName} {o.shipping.lastName}</strong><br />{o.email}<br /><span dir="ltr">{o.shipping.phone}</span><br />
        {cust ? <span className="status status-delivered">{t('admin.registered')}</span> : <span className="status status-placed">{t('admin.guest')}</span>}</p></div>
    </div>
    <OrderDetail o={o} inAccount />
    <div className="card"><h2 className="card-h">{t('admin.timeline')}</h2><ul className="timeline">{o.timeline.slice().reverse().map((e, i) => <li key={i}><StatusPill s={e.status} /> <span className="muted small">{fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul></div>
  </>);
}

function Orders({ sub }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  if (sub) return <OrderView id={sub} />;
  const list = S.db.orders.filter(o => (filter === 'all' || o.status === filter) && (!q || (o.id + ' ' + o.email + ' ' + o.shipping.firstName + ' ' + o.shipping.lastName).toLowerCase().includes(q.toLowerCase())));
  return (<>
    <div className="adm-toolbar">
      <label className="search-inline"><Icon name="search" /><span className="sr-only">{t('admin.searchOrders')}</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchOrders')} /></label>
      <div className="seg" role="group" aria-label={t('order.status')}>{['all'].concat(STATUSES).map(s => <button key={s} className={`seg-btn${s === filter ? ' on' : ''}`} aria-pressed={s === filter} onClick={() => setFilter(s)}>{s === 'all' ? t('admin.all') : t('status.' + s)}</button>)}</div>
    </div>
    <Table caption={t('admin.orders')} empty={t('order.noneTitle')}
      cols={[{ label: t('order.number') }, { label: t('order.date') }, { label: t('admin.customer') }, { label: t('admin.items'), cls: 'num' }, { label: t('order.payment') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }]}
      rows={list.map(o => <tr key={o.id}><td><a href={`#/admin/orders/${o.id}`}>{o.id}</a>{o.items.some(i => i.gift) && <> <Icon name="gift" className="muted" /></>}</td><td>{fmtDate(o.date)}</td>
        <td>{o.shipping.firstName} {o.shipping.lastName}<br /><span className="muted small">{o.email}</span></td><td className="num">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
        <td><span className={`status pay-${o.payment.status}`}>{t('paystatus.' + o.payment.status)}</span></td><td><StatusPill s={o.status} /></td><td className="num">{aed(o.totals.total)}</td></tr>)} />
  </>);
}

/* ---------- customers / inventory / payments ---------- */
function Customers() {
  const users = S.db.customers;
  return <Table caption={t('admin.customers')} empty={t('admin.noCustomers')}
    cols={[{ label: t('form.fullName') }, { label: t('form.email') }, { label: t('admin.verified') }, { label: t('account.orders'), cls: 'num' }, { label: t('admin.spent'), cls: 'num' }, { label: t('account.addresses'), cls: 'num' }, { label: t('account.dates'), cls: 'num' }, { label: t('admin.joined') }]}
    rows={users.map(u => (
      <tr key={u.id}><td>{u.name || '—'}</td><td>{u.email}</td><td>{u.verified ? <span className="status status-delivered">{t('admin.yes')}</span> : <span className="status status-processing">{t('admin.no')}</span>}</td>
        <td className="num">{u.orders}</td><td className="num">{aed(u.spent)}</td><td className="num">{u.addresses}</td><td className="num">{u.dates}</td><td>{fmtDate(u.created)}</td></tr>
    ))} />;
}

function InventoryRow({ p }) {
  const ui = useUI();
  const [val, setVal] = useState(String(p.stock));
  const [busy, setBusy] = useState(false);
  useEffect(() => setVal(String(p.stock)), [p.stock]);
  const save = n => {
    if (isNaN(n) || n < 0) { ui.toast(t('admin.stockErr'), 'error'); return; }
    setBusy(true);
    S.admin.saveProduct({ ...p, stock: n }).then(() => { setBusy(false); ui.toast(t('admin.stockSaved', { name: p.name.en, n }), 'success'); }).catch(er => { setBusy(false); ui.toast(errorText(er), 'error'); });
  };
  return (
    <tr><td className="thumb"><Img k={p.img} /></td><td>{p.name.en}</td><td><code>{p.sku}</code></td>
      <td>{p.stock <= 0 ? <span className="status status-cancelled">{t('stock.out')}</span> : p.stock <= 10 ? <span className="status status-processing">{t('admin.low')}</span> : <span className="status status-delivered">{t('stock.in')}</span>}</td>
      <td><form className="inv-form" onSubmit={e => { e.preventDefault(); save(parseInt(val, 10)); }}><label className="sr-only" htmlFor={`inv-${p.id}`}>{t('admin.stock')} — {p.name.en}</label>
        <input id={`inv-${p.id}`} type="number" min="0" step="1" value={val} onChange={e => setVal(e.target.value)} /><Button type="submit" className="btn btn-sm btn-outline" busy={busy}>{t('admin.update')}</Button></form></td>
      <td><button className="link-btn" onClick={() => save(p.stock + 25)}>+25</button></td></tr>
  );
}
function Inventory() {
  return (<>
    <p className="muted">{t('admin.inventoryHint')}</p>
    <Table caption={t('admin.inventory')} cols={[{ label: '' }, { label: t('admin.product') }, { label: 'SKU' }, { label: t('admin.state') }, { label: t('admin.stock') }, { label: '' }]}
      rows={S.db.products.slice().sort((a, b) => a.stock - b.stock).map(p => <InventoryRow key={p.id} p={p} />)} />
  </>);
}

function Payments() {
  const os = S.db.orders;
  const paid = os.filter(o => o.payment.status === 'paid');
  return (<>
    <div className="tiles-stat">
      <Tile label={t('paystatus.paid')} value={aed(paid.reduce((a, o) => a + o.totals.total, 0))} sub={t('admin.nPayments', { n: paid.length })} ic="card" />
      <Tile label={t('paystatus.pending')} value={os.filter(o => o.payment.status === 'pending').length} ic="clock" />
      <Tile label={t('paystatus.refunded')} value={os.filter(o => o.payment.status === 'refunded').length} ic="refresh" />
    </div>
    <Alert type="info" icon="shield">{t('admin.paymentsNote')}</Alert>
    <Table caption={t('admin.payments')} cols={[{ label: t('order.number') }, { label: t('order.date') }, { label: t('pay.method') }, { label: t('admin.reference') }, { label: t('order.status') }, { label: t('cart.total'), cls: 'num' }]}
      rows={os.map(o => <tr key={o.id}><td><a href={`#/admin/orders/${o.id}`}>{o.id}</a></td><td>{fmtDate(o.date)}</td>
        <td>{o.payment.method ? t('pay.provider.' + o.payment.method) : '—'}</td>
        <td><code className="small">{o.payment.ref || '—'}</code></td><td><span className={`status pay-${o.payment.status}`}>{t('paystatus.' + o.payment.status)}</span></td><td className="num">{aed(o.totals.total)}</td></tr>)} />
  </>);
}

/* ---------- coupons ---------- */
function CouponForm({ c, onClose }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  return (
    <Overlay title={c ? t('admin.editCoupon') : t('admin.addCoupon')} size="md" onClose={onClose}>
      {close => (
        <form noValidate onSubmit={e => {
          e.preventDefault();
          const d = f.validate(e.currentTarget, { code: [V.required, x => /^[A-Za-z0-9_-]{3,20}$/.test(x.trim()) ? '' : t('admin.codeErr')], value: [(x, all) => all.type === 'ship' || (+x > 0 && (all.type !== 'percent' || +x <= 90)) ? '' : t('admin.valueErr')] });
          if (!d) return;
          setBusy(true);
          S.admin.saveCoupon({ code: d.code, type: d.type, value: +d.value || 0, min: +d.min || 0, note: (d.note || '').trim(), active: !!d.active }, c ? c.code : null)
            .then(() => { close(); ui.toast(t('admin.saved'), 'success'); })
            .catch(er => { setBusy(false); f.setErrors({ code: er.code === 'exists' ? t('admin.codeExists') : errorText(er) }); });
        }}>
          <div className="grid-2">
            <Field name="code" label={t('admin.code')} required defaultValue={c ? c.code : ''} style={{ textTransform: 'uppercase' }} error={f.errors.code} onClear={f.clear} />
            <Field name="type" label={t('admin.ctype')} defaultValue={c ? c.type : 'percent'} options={['percent', 'fixed', 'ship'].map(x => ({ value: x, label: t('admin.ctype.' + x) }))} />
          </div>
          <div className="grid-2">
            <Field name="value" label={t('admin.value')} type="number" defaultValue={c ? c.value : 10} min="0" error={f.errors.value} onClear={f.clear} />
            <Field name="min" label={`${t('admin.minOrder')} (AED)`} type="number" defaultValue={c ? c.min : 0} min="0" />
          </div>
          <Field name="note" label={t('admin.note')} defaultValue={c ? c.note : ''} />
          <Check name="active" defaultChecked={!c || c.active} label={t('admin.active')} />
          <div className="btn-row end"><button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button><Button type="submit" busy={busy}>{t('common.save')}</Button></div>
        </form>
      )}
    </Overlay>
  );
}
function Coupons() {
  const ui = useUI();
  const [editing, setEditing] = useState(null);
  const del = async c => { if (await ui.confirm(t('admin.confirmDeleteCoupon', { code: c.code }), { confirmLabel: t('common.delete') })) S.admin.deleteCoupon(c.code).catch(er => ui.toast(errorText(er), 'error')); };
  return (<>
    <div className="adm-toolbar"><span /><button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" /> {t('admin.addCoupon')}</button></div>
    <Table caption={t('admin.coupons')} cols={[{ label: t('admin.code') }, { label: t('admin.ctype') }, { label: t('admin.value'), cls: 'num' }, { label: t('admin.minOrder'), cls: 'num' }, { label: t('admin.note') }, { label: t('order.status') }, { label: '' }]}
      rows={S.db.coupons.map(c => <tr key={c.code}><td><code>{c.code}</code></td><td>{t('admin.ctype.' + c.type)}</td><td className="num">{c.type === 'percent' ? c.value + '%' : c.type === 'fixed' ? aed(c.value) : '—'}</td>
        <td className="num">{c.min ? aed(c.min) : '—'}</td><td>{c.note || ''}</td><td>{c.active ? <span className="status status-delivered">{t('admin.active')}</span> : <span className="status status-cancelled">{t('admin.inactive')}</span>}</td>
        <td className="acts"><button className="icon-btn" onClick={() => setEditing(c)} aria-label={`${t('common.edit')} ${c.code}`}><Icon name="edit" /></button><button className="icon-btn danger" onClick={() => del(c)} aria-label={`${t('common.delete')} ${c.code}`}><Icon name="trash" /></button></td></tr>)} />
    {editing && <CouponForm c={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
  </>);
}

/* ---------- reviews / gifts / dates ---------- */
function Reviews() {
  const ui = useUI();
  const [filter, setFilter] = useState(() => S.db.reviews.some(r => r.status === 'pending') ? 'pending' : 'all');
  const list = S.db.reviews.filter(r => filter === 'all' || r.status === filter);
  const mod = (r, st) => S.admin.moderateReview(r.id, st).then(() => ui.toast(t('admin.reviewUpdated'), 'success')).catch(er => ui.toast(errorText(er), 'error'));
  return (<>
    <div className="adm-toolbar"><div className="seg" role="group" aria-label={t('order.status')}>
      {['pending', 'approved', 'rejected', 'all'].map(s => <button key={s} className={`seg-btn${s === filter ? ' on' : ''}`} aria-pressed={s === filter} onClick={() => setFilter(s)}>
        {s === 'all' ? t('admin.all') : t('rstatus.' + s)} <span className="muted">({s === 'all' ? S.db.reviews.length : S.db.reviews.filter(r => r.status === s).length})</span></button>)}
    </div></div>
    {list.length ? <ul className="adm-reviews">{list.map(r => { const p = S.db.products.find(x => x.id === r.productId); return (
      <li key={r.id} className="card">
        <div className="row-between"><div><Stars rating={r.rating} /> <strong>{r.title}</strong></div><span className={`status rs-${r.status}`}>{t('rstatus.' + r.status)}</span></div>
        <p>{r.body}</p>
        <p className="muted small">{r.name}{r.email && ` · ${r.email}`} · {p ? p.name.en : r.productId} · {fmtDate(r.date)}{r.verified && ` · ${t('reviews.verified')}`}</p>
        <div className="btn-row">
          {r.status !== 'approved' && <button className="btn btn-sm btn-teal" onClick={() => mod(r, 'approved')}><Icon name="check" /> {t('admin.approve')}</button>}
          {r.status !== 'rejected' && <button className="btn btn-sm btn-outline" onClick={() => mod(r, 'rejected')}>{t('admin.reject')}</button>}
          <button className="btn btn-sm btn-ghost danger" onClick={() => mod(r, 'delete')}><Icon name="trash" /> {t('common.delete')}</button>
        </div>
      </li>
    ); })}</ul> : <Empty ic="star" title={t('admin.noReviews')} />}
  </>);
}

function Gifts() {
  const rows = [];
  S.db.orders.forEach(o => o.items.filter(i => i.gift).forEach((i, k) => rows.push(
    <tr key={o.id + k}><td><a href={`#/admin/orders/${o.id}`}>{o.id}</a></td><td>{i.name}</td><td>{i.gift.recipientName}{i.gift.recipientEmail && <><br /><span className="muted small">{i.gift.recipientEmail}</span></>}</td>
      <td className="wrap-text">{i.gift.message || '—'}</td><td>{t('gift.wrap.' + i.gift.wrap)}{i.gift.hidePrices && <><br /><span className="muted small">{t('gift.pricesHidden')}</span></>}</td>
      <td>{i.gift.deliveryDate ? fmtDate(i.gift.deliveryDate) : '—'}</td><td><StatusPill s={o.status} /></td></tr>
  )));
  return <Table caption={t('admin.gifts')} empty={t('admin.noGifts')} rows={rows}
    cols={[{ label: t('order.number') }, { label: t('admin.product') }, { label: t('gift.recipient') }, { label: t('gift.message') }, { label: t('gift.packaging') }, { label: t('gift.deliveryDate') }, { label: t('order.status') }]} />;
}

function Dates() {
  const today = new Date(new Date().toDateString());
  const rows = [];
  S.db.dates.forEach(d => {
    const dt = new Date(d.date + 'T00:00:00'); const n = new Date(today.getFullYear(), dt.getMonth(), dt.getDate()); if (n < today) n.setFullYear(n.getFullYear() + 1);
    rows.push({ u: { email: d.email }, d, n, days: Math.round((n - today) / 864e5) });
  });
  rows.sort((a, b) => a.n - b.n);
  return (<>
    <div className="tiles-stat">
      <Tile label={t('admin.datesTotal')} value={rows.length} ic="calendar" />
      <Tile label={t('admin.remindersOn')} value={rows.filter(r => r.d.reminder).length} ic="bell" />
      <Tile label={t('admin.dueSoon')} value={rows.filter(r => r.d.reminder && r.days <= 14).length} sub={t('admin.dueSoonSub')} ic="clock" />
    </div>
    <Alert type="info">{t('admin.datesNote')}</Alert>
    <Table caption={t('admin.dates')} empty={t('dates.noneTitle')}
      cols={[{ label: t('admin.customer') }, { label: t('dates.person') }, { label: t('dates.occasion') }, { label: t('admin.nextDate') }, { label: t('dates.reminders') }, { label: t('dates.method') }]}
      rows={rows.map(({ u, d, n, days }) => <tr key={u.email + d.id}><td>{u.email}</td><td>{d.name}</td><td>{d.occasion === 'custom' ? d.label : t('occ.' + d.occasion)}</td>
        <td>{fmtDate(n)} <span className="muted small">({t('dates.inDays', { n: days })})</span></td>
        <td>{d.reminder ? <span className="status status-delivered">{t('dates.timing.' + d.timing)}</span> : <span className="status status-cancelled">{t('admin.off')}</span>}</td><td>{t('dates.via.' + d.method)}</td></tr>)} />
  </>);
}

/* ---------- translations ---------- */
function Translations() {
  const ui = useUI();
  const [q, setQ] = useState('');
  const keys = Object.keys(en).sort();
  const ql = q.toLowerCase();
  const list = keys.filter(k => !ql || k.toLowerCase().includes(ql) || ['en', 'es', 'ar'].some(l => String(t.raw(l, k)).toLowerCase().includes(ql))).slice(0, 60);
  const save = (l, k, value) => {
    const base = DICTS[l][k];
    S.admin.saveTranslation(l, k, value === base ? '' : value).then(() => ui.toast(t('admin.saved'), 'success')).catch(er => ui.toast(errorText(er), 'error'));
  };
  return (<>
    <div className="adm-toolbar"><label className="search-inline"><Icon name="search" /><span className="sr-only">{t('admin.searchKeys')}</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchKeys')} /></label></div>
    <p className="muted small">{t('admin.translationsHint')}</p>
    <p className="muted small">{t('admin.showingN', { n: list.length, total: keys.length })}</p>
    <Table caption={t('admin.translations')} cols={[{ label: t('admin.key') }, { label: 'English' }, { label: 'Español' }, { label: 'العربية' }]}
      rows={list.map(k => <tr key={k}><td><code className="small">{k}</code></td>{['en', 'es', 'ar'].map(l => {
        const over = S.db.translations[l] && S.db.translations[l][k] != null;
        return <td key={l}><label className="sr-only" htmlFor={`tr-${l}-${k}`}>{k} ({l})</label>
          <textarea id={`tr-${l}-${k}`} className={`tr-in${over ? ' overridden' : ''}`} rows={2} dir={l === 'ar' ? 'rtl' : undefined} defaultValue={t.raw(l, k)} onBlur={e => { if (e.target.value !== t.raw(l, k)) save(l, k, e.target.value); }} /></td>;
      })}</tr>)} />
  </>);
}

/* ---------- settings ---------- */
function Settings() {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const s = S.settings();
  const nonNeg = x => x !== '' && +x >= 0 ? '' : t('admin.nonNeg');
  return (<>
    <form className="card form-card" noValidate onSubmit={e => {
      e.preventDefault();
      const d = f.validate(e.currentTarget, { freeShippingThreshold: [nonNeg], shippingFee: [nonNeg], expressFee: [nonNeg], vatRate: [nonNeg], wrap_standard: [nonNeg], wrap_premium: [nonNeg], wrap_luxury: [nonNeg] });
      if (!d) return;
      setBusy(true);
      S.admin.saveSettings({ freeShippingThreshold: +d.freeShippingThreshold, shippingFee: +d.shippingFee, expressFee: +d.expressFee, vatRate: +d.vatRate, giftWrap: { standard: +d.wrap_standard, premium: +d.wrap_premium, luxury: +d.wrap_luxury }, announcement: !!d.announcement })
        .then(() => { setBusy(false); ui.toast(t('admin.saved'), 'success'); }).catch(er => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(er) }); });
    }}>
      <h2 className="card-h">{t('admin.shippingTax')}</h2>
      {f.alert && <Alert>{f.alert.msg}</Alert>}
      <div className="grid-4">
        {[['freeShippingThreshold', 'admin.freeShip'], ['shippingFee', 'admin.shipFee'], ['expressFee', 'admin.expressFee'], ['vatRate', 'admin.vat']].map(([k, l]) => <Field key={k} name={k} label={t(l)} type="number" defaultValue={s[k]} min="0" error={f.errors[k]} onClear={f.clear} />)}
      </div>
      <h2 className="card-h">{t('gift.packaging')} (AED)</h2>
      <div className="grid-3">{['standard', 'premium', 'luxury'].map(w => <Field key={w} name={'wrap_' + w} label={t('gift.wrap.' + w)} type="number" defaultValue={s.giftWrap[w]} min="0" error={f.errors['wrap_' + w]} onClear={f.clear} />)}</div>
      <h2 className="card-h">{t('admin.storefront')}</h2>
      <label className="switch-row"><span>{t('admin.annOn')}</span><Switch name="announcement" defaultChecked={s.announcement} label={t('admin.annOn')} /></label>
      <div className="btn-row"><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('common.saveChanges')}</Button></div>
    </form>
  </>);
}

const SECTIONS = { dashboard: Dashboard, products: Products, categories: Categories, orders: Orders, customers: Customers, inventory: Inventory, payments: Payments, coupons: Coupons, reviews: Reviews, gifts: Gifts, dates: Dates, translations: Translations, settings: Settings };

export default function Admin({ section = 'dashboard', sub }) {
  const ui = useUI();
  const u = S.user();
  if (!SECTIONS[section]) section = 'dashboard';
  const [menu, setMenu] = useState(false);
  const [locale, setLocale] = useState(false);
  const h1 = useRef(null);
  useTitle(`${t('admin.' + section)} — ${t('admin.title')}`);
  const redirect = !u ? '#/login?next=' + encodeURIComponent('/admin') + '&reason=admin' : null;
  useEffect(() => { if (redirect) location.replace(location.href.split('#')[0] + redirect); }, [redirect]);
  useEffect(() => { setMenu(false); if (h1.current) h1.current.focus({ preventScroll: true }); }, [section, sub]);
  const isAdmin = !!u && u.role === 'admin';
  const [loadErr, setLoadErr] = useState(null);
  useEffect(() => { if (isAdmin && !S.adminLoaded) S.admin.load().catch(setLoadErr); }, [isAdmin]);
  if (!u) return null;
  if (!isAdmin) return <section className="container section"><Empty ic="lock" title={t('admin.forbidden')} text={t('admin.forbiddenText')}><a className="btn btn-primary" href="#/">{t('nav.home')}</a></Empty></section>;

  const pending = S.db.reviews.filter(r => r.status === 'pending').length;
  const newOrders = S.db.orders.filter(o => o.status === 'processing').length;
  const Sec = SECTIONS[section];
  return (
    <div className="admin">
      <aside className={`adm-side${menu ? ' open' : ''}`} id="adm-side">
        <div className="adm-brand"><Logo small /><span className="badge badge-muted">{t('admin.badge')}</span></div>
        <nav aria-label={t('admin.nav')}><ul>
          {NAV.map(([k, ic]) => (
            <li key={k}><a href={`#/admin/${k}`} className={k === section ? 'on' : ''} aria-current={k === section ? 'page' : undefined}><Icon name={ic} /><span>{t('admin.' + k)}</span>
              {k === 'reviews' && pending > 0 && <span className="count" aria-label={t('admin.pendingN', { n: pending })}>{pending}</span>}
              {k === 'orders' && newOrders > 0 && <span className="count">{newOrders}</span>}</a></li>
          ))}
        </ul></nav>
        <div className="adm-side-foot"><a href="#/" className="link-btn"><Icon name="home" /> {t('admin.viewStore')}</a><button className="link-btn" onClick={() => { S.logout(); ui.toast(t('auth.loggedOut'), 'info'); navigate('#/'); }}><Icon name="logout" /> {t('nav.logout')}</button></div>
      </aside>
      <div className="adm-main">
        <header className="adm-top">
          <button className="icon-btn only-mobile-tab" onClick={() => setMenu(m => !m)} aria-controls="adm-side" aria-expanded={menu} aria-label={t('a11y.openMenu')}><Icon name="menu" /></button>
          <h1 className="adm-title" tabIndex={-1} ref={h1}>{t('admin.' + section)}</h1>
          <div className="adm-top-end">
            <div className="locale"><button className="locale-btn" aria-expanded={locale} aria-controls="locale-pop" onClick={() => setLocale(l => !l)}><Icon name="globe" /><span>{LANGS[S.session.lang].short}</span></button>
              {locale && <div className="locale-pop" id="locale-pop"><LocaleControls ctx="adm" /></div>}</div>
            <span className="avatar sm" aria-hidden="true">{(u.name || 'A')[0]}</span><span className="adm-user">{u.name}</span>
          </div>
        </header>
        <div className="adm-body" key={section + (sub || '')}>{S.adminLoaded ? <Sec sub={sub} /> : loadErr ? <Alert>{errorText(loadErr)}</Alert> : <div className="page-loading"><Spinner big /></div>}</div>
      </div>
    </div>
  );
}
