import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Breadcrumbs, Empty, Field, Check, Switch, Img } from '../components/common.jsx';
import { StockLabel } from '../components/ProductCard.jsx';
import { Overlay, Button, Alert, useUI } from '../components/ui.jsx';
import { LocaleControls } from '../components/Header.jsx';
import { OrderDetail, formatAddress } from './Order.jsx';
import { AddressFields, addrRules, pickAddress } from './Checkout.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money, fmtDate, errorText } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { useShopActions } from '../lib/useActions.js';
import { navigate, useTitle } from '../lib/router.js';

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

/* ---------------- wishlist (shared by /wishlist and the account section) ---------------- */
export function WishlistBlock() {
  const ui = useUI();
  const { addToCart } = useShopActions();
  const [busy, setBusy] = useState(null);
  const items = S.wishlist().map(id => S.product(id)).filter(Boolean);
  const u = S.user();
  const toCart = async p => {
    setBusy(p.id);
    const ok = await addToCart(p, null, 1, { openDrawer: false });
    if (ok) { await S.toggleWishlist(p.id); ui.toast(t('wish.moved'), 'success', { label: t('cart.viewCart'), href: '#/cart' }); }
    setBusy(null);
  };
  const allToCart = async () => {
    setBusy('all');
    for (const id of S.wishlist()) { const p = S.product(id); if (p && p.stock > 0) { try { await S.addToCart(id, null, 1); await S.toggleWishlist(id); } catch (e) { /* skip unavailable */ } } }
    setBusy(null);
    ui.toast(t('wish.allMoved'), 'success', { label: t('cart.viewCart'), href: '#/cart' });
  };
  const guestNote = !u && (
    <div className="alert alert-info wish-guest"><Icon name="lock" /><span>{t('wish.guestNote')}</span>
      <a className="btn btn-sm btn-primary" href={`#/login?next=${encodeURIComponent('/wishlist')}&reason=wishlist`}>{t('nav.login')}</a>
      <a className="btn btn-sm btn-outline" href={`#/register?next=${encodeURIComponent('/wishlist')}`}>{t('auth.createAccount')}</a></div>
  );
  if (!items.length) return (<>{guestNote}<Empty ic="heart" title={t('wish.emptyTitle')} text={t('wish.emptyText')}>
    <a className="btn btn-primary" href="#/shop/diffusers">{t('wish.discover')}</a><a className="btn btn-outline" href="#/deals/aroma">{t('home.oilsTitle')}</a></Empty></>);
  return (<>
    {guestNote}
    <div className="wish-bar"><p className="muted">{t('wish.count', { n: items.length })}</p>
      <Button className="btn btn-outline btn-sm" busy={busy === 'all'} busyLabel={t('cart.adding')} onClick={allToCart}><Icon name="bag" /> {t('wish.allToCart')}</Button></div>
    <ul className="wish-list">{items.map(p => (
      <li key={p.id} className="wish-item">
        <a href={`#/product/${p.id}`} className="wi-img"><Img k={p.img} /></a>
        <div className="wi-body"><p className="pcard-type">{t('type.' + p.type)}</p><a className="wi-name" href={`#/product/${p.id}`}>{pname(p)}</a>
          <p className="pcard-price">{p.compareAt > p.price && <s>{money(p.compareAt)}</s>}<strong>{money(p.price)}</strong></p><StockLabel p={p} /></div>
        <div className="wi-actions">
          <Button className="btn btn-teal btn-sm" busy={busy === p.id} busyLabel={t('cart.adding')} disabled={p.stock <= 0} onClick={() => toCart(p)}>{p.stock <= 0 ? t('stock.out') : t('wish.moveToCart')}</Button>
          <button className="link-btn" onClick={() => S.toggleWishlist(p.id).then(() => ui.toast(t('wish.removed'), 'info'))}><Icon name="trash" /> {t('cart.remove')}</button>
        </div>
      </li>
    ))}</ul>
  </>);
}

export function WishlistPage() {
  useTitle(t('nav.wishlist'));
  return (<>
    <Breadcrumbs items={[['#/', t('nav.home')], [null, t('nav.wishlist')]]} />
    <section className="container section-sm"><h1 className="page-title left">{t('nav.wishlist')}</h1><WishlistBlock /></section>
  </>);
}

/* ---------------- sections ---------------- */
function Profile() {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const u = S.user();
  const orders = S.myOrders();
  const upcoming = u.dates.filter(d => d.date).map(d => ({ d, next: nextOccurrence(d.date) })).filter(x => x.next).sort((a, b) => a.next - b.next)[0];
  return (<>
    <h2 className="acc-h">{t('account.profile')}</h2>
    <div className="acc-cards">
      <a className="acc-stat card" href="#/account/orders"><Icon name="box" /><strong>{orders.length}</strong><span>{t('account.orders')}</span></a>
      <a className="acc-stat card" href="#/account/wishlist"><Icon name="heart" /><strong>{S.wishlist().length}</strong><span>{t('account.wishlist')}</span></a>
      <a className="acc-stat card" href="#/account/dates"><Icon name="calendar" /><strong>{upcoming ? daysUntil(upcoming.next) : '—'}</strong><span>{upcoming ? t('dates.daysUntil', { name: upcoming.d.name }) : t('dates.noneShort')}</span></a>
    </div>
    <form className="card form-card" noValidate onSubmit={e => {
      e.preventDefault();
      const d = f.validate(e.currentTarget, { name: [V.required, V.min(2)], phone: [V.phone] }); if (!d) return;
      setBusy(true);
      S.updateProfile(d).then(() => { setBusy(false); ui.toast(t('account.saved'), 'success'); }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
    }}>
      <h3 className="card-h">{t('account.details')}</h3>
      {f.alert && <Alert>{f.alert.msg}</Alert>}
      <div className="grid-2">
        <Field name="name" label={t('form.fullName')} required defaultValue={u.name || ''} autoComplete="name" error={f.errors.name} onClear={f.clear} />
        <Field name="phone" label={t('form.phone')} type="tel" defaultValue={u.phone || ''} autoComplete="tel" dir="ltr" error={f.errors.phone} onClear={f.clear} />
      </div>
      <div className="field"><label htmlFor="pf-email">{t('form.email')}</label><div className="control"><input id="pf-email" value={u.email} readOnly aria-describedby="pf-email-h" /></div>
        <p className="hint" id="pf-email-h">{u.verified ? <><Icon name="check" /> {t('account.verified')}</> : t('account.unverifiedShort')}</p></div>
      <div className="btn-row"><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('common.saveChanges')}</Button></div>
    </form>
  </>);
}

function Orders({ sub }) {
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  if (sub) {
    const o = S.order(sub);
    if (!o || !S.canViewOrder(o)) return <Empty ic="box" title={t('order.notFound')}><a className="btn btn-primary" href="#/account/orders">{t('order.back')}</a></Empty>;
    const buyAgain = async () => {
      setBusy(true);
      for (const i of o.items) { try { await S.addToCart(i.productId, i.sizeId, i.qty); } catch (e) { /* skip unavailable */ } }
      setBusy(false); ui.openCart(true);
    };
    return (<>
      <a className="link-arrow back" href="#/account/orders"><Icon name="arrowRight" className="flip rot" /> {t('order.back')}</a>
      <div className="row-between"><h2 className="acc-h">{t('order.title', { id: o.id })}</h2>
        <Button className="btn btn-outline btn-sm" busy={busy} busyLabel={t('cart.adding')} onClick={buyAgain}><Icon name="refresh" /> {t('order.buyAgain')}</Button></div>
      <OrderDetail o={o} inAccount />
      <p className="muted small">{t('order.help')} <a href="#/contact">{t('nav.contact')}</a></p>
    </>);
  }
  const orders = S.myOrders();
  return (<>
    <h2 className="acc-h">{t('account.orders')}</h2>
    {!orders.length ? <Empty ic="box" title={t('order.noneTitle')} text={t('order.noneText')}><a className="btn btn-primary" href="#/shop/diffusers">{t('cart.startShopping')}</a></Empty> : (
      <ul className="order-list">{orders.map(o => (
        <li key={o.id} className="order-row card">
          <div className="or-thumbs">{o.items.slice(0, 3).map((i, k) => <Img key={k} k={i.img} />)}</div>
          <div className="or-info"><strong>{o.id}</strong><span className="muted small">{fmtDate(o.date)} · {t('cart.itemsN', { n: o.items.reduce((a, i) => a + i.qty, 0) })}</span></div>
          <span className={`status status-${o.status}`}>{t('status.' + o.status)}</span>
          <strong className="or-total">{money(o.totals.total)}</strong>
          <a className="btn btn-outline btn-sm" href={`#/account/orders/${o.id}`} aria-label={t('order.viewN', { id: o.id })}>{t('order.details')}</a>
        </li>
      ))}</ul>
    )}
  </>);
}

function AddressForm({ a, onClose }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  return (
    <Overlay title={t(a ? 'addr.edit' : 'addr.add')} size="md" onClose={onClose}>
      {close => (
        <form noValidate onSubmit={e => {
          e.preventDefault();
          const d = f.validate(e.currentTarget, addrRules()); if (!d) return;
          setBusy(true);
          S.saveAddress({ id: a ? a.id : undefined, label: (d.label || '').trim() || t('addr.address'), ...pickAddress(d), isDefault: !!d.isDefault })
            .then(() => { close(); ui.toast(t(a ? 'addr.updated' : 'addr.saved'), 'success'); })
            .catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
        }}>
          {f.alert && <Alert>{f.alert.msg}</Alert>}
          <Field name="label" label={t('addr.label')} defaultValue={a ? a.label : ''} placeholder={t('addr.labelPh')} />
          <AddressFields a={a || {}} f={f} />
          <Check name="isDefault" defaultChecked={!!(a && a.isDefault)} label={t('addr.setDefault')} />
          <div className="btn-row end"><button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('common.save')}</Button></div>
        </form>
      )}
    </Overlay>
  );
}

function Addresses() {
  const ui = useUI();
  const [editing, setEditing] = useState(null); // null | 'new' | address
  const list = S.user().addresses;
  const del = async a => {
    if (!(await ui.confirm(t('addr.confirmDelete'), { confirmLabel: t('common.delete') }))) return;
    S.deleteAddress(a.id).then(() => ui.toast(t('addr.deleted'), 'info')).catch(err => ui.toast(errorText(err), 'error'));
  };
  return (<>
    <div className="row-between"><h2 className="acc-h">{t('account.addresses')}</h2>{list.length > 0 && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" /> {t('addr.add')}</button>}</div>
    {list.length ? (
      <ul className="addr-grid">{list.map(a => (
        <li key={a.id} className={`card addr${a.isDefault ? ' is-default' : ''}`}>
          <div className="row-between"><strong>{a.label || t('addr.address')}</strong>{a.isDefault && <span className="badge badge-best">{t('addr.default')}</span>}</div>
          <p>{formatAddress(a)}</p>
          <div className="btn-row">
            <button className="link-btn" onClick={() => setEditing(a)}><Icon name="edit" /> {t('common.edit')}</button>
            {!a.isDefault && <button className="link-btn" onClick={() => S.setDefaultAddress(a.id).then(() => ui.toast(t('addr.defaultSet'), 'success'))}>{t('addr.makeDefault')}</button>}
            <button className="link-btn danger" onClick={() => del(a)}><Icon name="trash" /> {t('common.delete')}</button>
          </div>
        </li>
      ))}</ul>
    ) : <Empty ic="pin" title={t('addr.noneTitle')} text={t('addr.noneText')}><button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" /> {t('addr.add')}</button></Empty>}
    {editing && <AddressForm a={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
  </>);
}

function DateForm({ d, onClose }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const v = d || { occasion: 'birthday', name: '', date: '', reminder: true, timing: 7, method: 'email', note: '', label: '' };
  const [occ, setOcc] = useState(v.occasion);
  const [rem, setRem] = useState(v.reminder);
  const [dateVal, setDateVal] = useState(v.date);
  return (
    <Overlay title={t(d ? 'dates.edit' : 'dates.add')} size="md" onClose={onClose}>
      {close => (
        <form noValidate onSubmit={e => {
          e.preventDefault();
          const rules = { name: [V.required, V.max(60)], date: [V.required] };
          if (occ === 'custom') rules.label = [V.required, V.max(40)];
          const x = f.validate(e.currentTarget, rules); if (!x) return;
          setBusy(true);
          S.saveDate({ id: d ? d.id : undefined, occasion: occ, label: occ === 'custom' ? x.label.trim() : '', name: x.name.trim(), date: x.date, reminder: rem, timing: +x.timing || 0, method: x.method || 'email', note: (x.note || '').trim() })
            .then(() => { close(); ui.toast(t(d ? 'dates.updated' : 'dates.saved'), 'success'); })
            .catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
        }}>
          {f.alert && <Alert>{f.alert.msg}</Alert>}
          <Field name="occasion" label={t('dates.occasion')} required defaultValue={v.occasion} options={['birthday', 'anniversary', 'valentine', 'christmas', 'newYear', 'custom'].map(o => ({ value: o, label: t('occ.' + o) }))}
            onChange={e => {
              const o = e.target.value; setOcc(o);
              const fx = FIXED[o];
              if (fx) { const y = new Date().getFullYear(); let ds = `${y}-${fx}`; if (new Date(ds) < new Date(new Date().toDateString())) ds = `${y + 1}-${fx}`; setDateVal(ds); }
            }} />
          {occ === 'custom' && <Field name="label" label={t('dates.customLabel')} required defaultValue={v.label || ''} placeholder={t('dates.customPh')} error={f.errors.label} onClear={f.clear} />}
          <div className="grid-2">
            <Field name="name" label={t('dates.person')} required defaultValue={v.name} placeholder={t('dates.personPh')} error={f.errors.name} onClear={f.clear} />
            <div className={`field${f.errors.date ? ' invalid' : ''}`}><label htmlFor="date-in">{t('dates.date')}</label>
              <div className="control"><input id="date-in" type="date" name="date" required value={dateVal} onChange={e => { setDateVal(e.target.value); f.clear('date'); }} aria-invalid={f.errors.date ? 'true' : 'false'} aria-describedby="date-err" /></div>
              <p className="err" id="date-err" role="alert">{f.errors.date || ''}</p></div>
          </div>
          <fieldset className="fs"><legend>{t('dates.reminders')}</legend>
            <label className="switch-row"><span>{t('dates.enable')}</span><Switch name="reminder" checked={rem} onChange={e => setRem(e.target.checked)} label={t('dates.enable')} /></label>
            {rem && <div>
              <Field name="timing" label={t('dates.when')} defaultValue={v.timing} options={[0, 1, 3, 7, 14].map(n => ({ value: n, label: t('dates.timing.' + n) }))} />
              <fieldset className="fs sub"><legend>{t('dates.method')}</legend>
                <label className="opt-card sm"><input type="radio" name="method" value="email" defaultChecked={v.method !== 'whatsapp'} /><span className="oc-body"><Icon name="mail" /><strong>{t('dates.via.email')}</strong><small>{S.user().email}</small></span></label>
                <label className="opt-card sm disabled"><input type="radio" name="method" value="whatsapp" disabled aria-describedby="wa-soon" /><span className="oc-body"><Icon name="whatsapp" /><strong>{t('dates.via.whatsapp')}</strong><small id="wa-soon">{t('common.comingSoon')}</small></span></label>
              </fieldset>
            </div>}
          </fieldset>
          <Field name="note" label={t('dates.note')} type="textarea" rows={2} defaultValue={v.note || ''} placeholder={t('dates.notePh')} maxLength={200} />
          <div className="btn-row end"><button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('common.save')}</Button></div>
        </form>
      )}
    </Overlay>
  );
}

function Dates() {
  const ui = useUI();
  const [editing, setEditing] = useState(null);
  const list = S.user().dates.map(d => ({ d, next: nextOccurrence(d.date) })).sort((a, b) => (a.next || 0) - (b.next || 0));
  const del = async d => { if (await ui.confirm(t('dates.confirmDelete'), { confirmLabel: t('common.delete') })) S.deleteDate(d.id).then(() => ui.toast(t('dates.deleted'), 'info')); };
  const toggle = d => S.toggleReminder(d.id).then(on => ui.toast(t(on ? 'dates.remOn' : 'dates.remOff'), 'info')).catch(err => ui.toast(errorText(err), 'error'));
  return (<>
    <div className="row-between"><h2 className="acc-h">{t('account.dates')}</h2>{list.length > 0 && <button className="btn btn-primary btn-sm" data-add-date onClick={() => setEditing('new')}><Icon name="plus" /> {t('dates.add')}</button>}</div>
    <p className="muted">{t('dates.intro')}</p>
    {list.length ? (
      <ul className="date-list">{list.map(({ d, next }) => { const n = next ? daysUntil(next) : null; return (
        <li key={d.id} className={`card date-row${d.reminder ? '' : ' off'}`}>
          <span className="date-ic"><Icon name={OCC_ICON[d.occasion] || 'calendar'} /></span>
          <div className="date-info"><strong>{d.name}</strong>
            <span className="muted small">{d.occasion === 'custom' ? (d.label || t('occ.custom')) : t('occ.' + d.occasion)} · {next ? fmtDate(next, { day: 'numeric', month: 'long' }) : ''}</span>
            <span className="small">{n === 0 ? <strong className="today">{t('dates.today')}</strong> : t('dates.inDays', { n })}{d.reminder && <> · <Icon name="bell" /> {t('dates.remind', { when: t('dates.timing.' + d.timing) })} · {t('dates.via.' + d.method)}</>}</span></div>
          <Switch checked={d.reminder} onChange={() => toggle(d)} label={t('dates.reminderFor', { name: d.name })} />
          <div className="date-acts">
            <a className="link-btn" href="#/shop/gifts"><Icon name="gift" /> {t('dates.shopGift')}</a>
            <button className="link-btn" onClick={() => setEditing(d)} aria-label={`${t('common.edit')} — ${d.name}`}><Icon name="edit" /></button>
            <button className="link-btn danger" onClick={() => del(d)} aria-label={`${t('common.delete')} — ${d.name}`}><Icon name="trash" /></button>
          </div>
        </li>
      ); })}</ul>
    ) : <Empty ic="calendar" title={t('dates.noneTitle')} text={t('dates.noneText')}><button className="btn btn-primary" data-add-date onClick={() => setEditing('new')}><Icon name="plus" /> {t('dates.add')}</button></Empty>}
    {editing && <DateForm d={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
  </>);
}

const WishlistSection = () => <><h2 className="acc-h">{t('account.wishlist')}</h2><WishlistBlock /></>;

function Settings() {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const u = S.user();
  const pref = (key, val) => S.updatePrefs({ [key]: val }).then(() => ui.toast(t('account.saved'), 'success')).catch(err => ui.toast(errorText(err), 'error'));
  return (<>
    <h2 className="acc-h">{t('account.settings')}</h2>
    <div className="card form-card">
      <h3 className="card-h">{t('settings.notifications')}</h3>
      <label className="switch-row"><span>{t('settings.orderEmails')}<small className="muted">{t('settings.orderEmailsD')}</small></span><Switch checked={u.prefs.orderEmails} onChange={e => pref('orderEmails', e.target.checked)} label={t('settings.orderEmails')} /></label>
      <label className="switch-row"><span>{t('settings.newsletter')}<small className="muted">{t('settings.newsletterD')}</small></span><Switch checked={u.prefs.newsletter} onChange={e => pref('newsletter', e.target.checked)} label={t('settings.newsletter')} /></label>
    </div>
    <div className="card form-card"><h3 className="card-h">{t('settings.regional')}</h3><LocaleControls ctx="acc" /></div>
    <form className="card form-card" noValidate onSubmit={e => {
      e.preventDefault();
      const form = e.currentTarget;
      const d = f.validate(form, { current: [V.required], password: [V.required, V.password, (v, all) => v !== all.current ? '' : t('val.samePw')] }); if (!d) return;
      setBusy(true);
      S.changePassword(d.current, d.password).then(() => { setBusy(false); form.reset(); setLevel(0); ui.toast(t('settings.pwChanged'), 'success'); })
        .catch(err => { setBusy(false); if (err.code === 'badPassword') { f.setErrors({ current: errorText(err) }); form.elements.current.focus(); } else f.setAlert({ type: 'error', msg: errorText(err) }); });
    }}>
      <h3 className="card-h">{t('settings.password')}</h3>
      {f.alert && <Alert>{f.alert.msg}</Alert>}
      <Field name="current" label={t('settings.currentPw')} type="password" required autoComplete="current-password" error={f.errors.current} onClear={f.clear} />
      <Field name="password" label={t('auth.newPassword')} type="password" required autoComplete="new-password" hint={t('val.passwordHint')} error={f.errors.password} onClear={f.clear}
        onChange={e => { const pw = e.target.value; let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; setLevel(pw ? Math.min(4, s) : 0); }} />
      <div className="strength" data-level={level} aria-live="polite"><i /><i /><i /><i /><span>{level ? t('pw.s' + level) : ''}</span></div>
      <div className="btn-row"><Button type="submit" busy={busy} busyLabel={t('common.saving')}>{t('settings.updatePw')}</Button></div>
    </form>
    <div className="card form-card"><h3 className="card-h">{t('nav.logout')}</h3><p className="muted">{t('settings.logoutD')}</p>
      <button className="btn btn-outline" onClick={() => { S.logout(); ui.toast(t('auth.loggedOut'), 'info'); navigate('#/'); }}><Icon name="logout" /> {t('nav.logout')}</button></div>
  </>);
}

export default function Account({ section = 'profile', sub }) {
  const ui = useUI();
  const u = S.user();
  if (!SECTIONS.some(s => s[0] === section) && section !== 'logout') section = 'profile';
  useTitle(`${t('account.' + (section === 'logout' ? 'profile' : section))} — ${t('nav.account')}`);
  const redirect = !u ? '#/login?next=' + encodeURIComponent('/account' + (section !== 'profile' ? '/' + section : '') + (sub ? '/' + sub : '')) + '&reason=account' : null;
  useEffect(() => {
    if (redirect) location.replace(location.href.split('#')[0] + redirect);
    else if (section === 'logout') { S.logout(); ui.toast(t('auth.loggedOut'), 'info'); location.replace(location.href.split('#')[0] + '#/'); }
  }, [redirect, section]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!u || section === 'logout') return null;

  const Sec = { profile: Profile, orders: Orders, wishlist: WishlistSection, addresses: Addresses, dates: Dates, settings: Settings }[section];
  return (<>
    <Breadcrumbs items={[['#/', t('nav.home')], ['#/account', t('nav.account')], [null, t('account.' + section)]]} />
    <section className="container account">
      <header className="acc-head"><div className="avatar" aria-hidden="true">{(u.name || u.email)[0].toUpperCase()}</div><div><p className="muted small">{t('account.hello')}</p><h1 className="page-title left sm">{u.name || u.email}</h1></div></header>
      {!u.verified && <div className="alert alert-warn"><Icon name="mail" /><span>{t('account.unverified')}</span><a className="btn btn-sm btn-primary" href="#/verify">{t('auth.verify')}</a></div>}
      <div className="acc-grid">
        <nav className="acc-nav" aria-label={t('account.nav')}><ul>
          {SECTIONS.map(([k, ic]) => <li key={k}><a href={`#/account${k === 'profile' ? '' : '/' + k}`} className={k === section ? 'on' : ''} aria-current={k === section ? 'page' : undefined}><Icon name={ic} /><span>{t('account.' + k)}</span></a></li>)}
          {u.role === 'admin' && <li><a href="#/admin"><Icon name="dashboard" /><span>{t('admin.title')}</span></a></li>}
          <li><button onClick={() => { S.logout(); ui.toast(t('auth.loggedOut'), 'info'); navigate('#/'); }}><Icon name="logout" /><span>{t('nav.logout')}</span></button></li>
        </ul></nav>
        <div className="acc-main"><Sec sub={sub} /></div>
      </div>
    </section>
  </>);
}
