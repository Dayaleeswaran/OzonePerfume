import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Img } from './common.jsx';
import { useUI } from './ui.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money } from '../lib/format.js';
import { BRAND, LANGS, CURRENCIES, DIFFUSER_TYPES, SPACES, FAMILIES } from '../data/catalog.js';

export function Logo({ small }) {
  return (
    <a className={`logo${small ? ' logo-sm' : ''}`} href="/" aria-label={`${BRAND.name} — ${t('nav.home')}`}>
      <span className="logo-word">OZONE</span><span className="logo-sub">SCENTS</span>
      {!small && <span className="logo-tag">{t('brand.tagline')}</span>}
    </a>
  );
}

export function LocaleControls({ ctx }) {
  return (<>
    <div className="locale-grp">
      <p className="locale-h" id={`lang-h-${ctx}`}>{t('locale.language')}</p>
      <div className="seg" role="radiogroup" aria-labelledby={`lang-h-${ctx}`}>
        {Object.entries(LANGS).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={k === S.session.lang} className={`seg-btn${k === S.session.lang ? ' on' : ''}`} lang={k} onClick={() => S.setLang(k)}>{l.label}</button>
        ))}
      </div>
    </div>
    <div className="locale-grp">
      <label className="locale-h" htmlFor={`cur-${ctx}`}>{t('locale.currency')}</label>
      <select id={`cur-${ctx}`} value={S.session.currency} onChange={e => S.setCurrency(e.target.value)}>
        {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c} — {t('cur.' + c)}</option>)}
      </select>
      <p className="hint">{t('locale.note')}</p>
    </div>
  </>);
}

function Announcement() {
  if (S.session.announcementClosed || !S.settings().announcement) return null;
  const items = [
    ['truck', t('ann.freeShip', { amount: money(S.settings().freeShippingThreshold) })],
    ['box', t('ann.delivery')],
    S.collection('crazy-deals').length ? ['flame', t('ann.deals')] : null,
    ['gift', t('ann.gift')]
  ].filter(Boolean);
  const row = hidden => (
    <div className="ann-row" aria-hidden={hidden || undefined}>
      {items.map(([i, s], k) => <span key={k} style={{ display: 'contents' }}><span className="ann-item"><Icon name={i} />{s}</span><span className="ann-sep" aria-hidden="true"><Icon name="leaf" /></span></span>)}
    </div>
  );
  return (
    <div className="announce" role="region" aria-label={t('a11y.announcements')}>
      <div className="ann-track">{row(false)}{row(true)}</div>
      <button className="ann-close icon-btn" onClick={() => S.closeAnnouncement()} aria-label={t('a11y.closeAnnouncement')}><Icon name="close" /></button>
    </div>
  );
}

function Mega({ kind }) {
  if (kind === 'diffusers') {
    const feat = ['tower-pro-diffuser', 'box-diffuser'].map(id => S.product(id)).filter(Boolean);
    return (
      <div className="mega">
        <div className="mega-col"><p className="mega-h">{t('mega.byType')}</p><ul>
          {DIFFUSER_TYPES.map(ty => <li key={ty}><a href={`/shop/diffusers?type=${ty}`}>{t('type.' + ty + '.plural')}</a></li>)}
          <li><a className="mega-all" href="/shop/diffusers">{t('common.viewAll')} <Icon name="arrowRight" className="flip" /></a></li>
        </ul></div>
        <div className="mega-col"><p className="mega-h">{t('mega.bySpace')}</p><ul>
          {SPACES.map(s => <li key={s}><a href={`/shop/diffusers?space=${s}`}>{t('space.' + s)}</a></li>)}
        </ul></div>
        <div className="mega-feat"><p className="mega-h">{t('mega.featured')}</p><div className="mega-cards">
          {feat.map(p => <a key={p.id} className="mega-card" href={`/product/${p.id}`}><Img k={p.img} alt={pname(p)} /><span>{pname(p)}</span><strong>{money(p.price)}</strong></a>)}
        </div></div>
      </div>
    );
  }
  return (
    <div className="mega mega-sm">
      <div className="mega-col"><p className="mega-h">{t('mega.forHome')}</p><ul>
        <li><a href="/shop/home-care?type=tower">{t('mega.livingRooms')}</a></li>
        <li><a href="/shop/home-care?type=wall">{t('mega.bedrooms')}</a></li>
        <li><a href="/shop/home-care?type=portable">{t('mega.desks')}</a></li>
        <li><a className="mega-all" href="/shop/home-care">{t('common.viewAll')} <Icon name="arrowRight" className="flip" /></a></li>
      </ul></div>
      <div className="mega-col"><p className="mega-h">{t('mega.byScent')}</p><ul>
        {FAMILIES.map(f => <li key={f}><a href={`/shop/oils?family=${f}`}>{t('family.' + f)}</a></li>)}
      </ul></div>
    </div>
  );
}

const NAV = [
  { key: 'home', href: '/' },
  { key: 'diffusers', href: '/shop/diffusers', mega: 'diffusers' },
  { key: 'aromaDeals', href: '/deals/aroma', accent: true },
  { key: 'crazyDeals', href: '/deals/crazy', spark: true },
  { key: 'homeCare', href: '/shop/home-care', mega: 'home' },
  { key: 'about', href: '/about' },
  { key: 'contact', href: '/contact' }
];

export const isActive = (href, path) => href === '/' ? path === '/' : path.split('?')[0].startsWith(href.split('?')[0]);

function Count({ n }) {
  return <span key={n} className={`badge-count${n ? ' show pop' : ''}`}>{n || ''}</span>;
}

export default function Header({ hash }) {
  const ui = useUI();
  const u = S.user();
  const L = LANGS[S.session.lang];
  const [openMega, setOpenMega] = useState(null);
  const [localeOpen, setLocaleOpen] = useState(false);
  const localeRef = useRef(null);
  const navRef = useRef(null);
  const cartN = S.cartCount(), wishN = S.wishlist().length;

  useEffect(() => { setOpenMega(null); setLocaleOpen(false); }, [hash]);
  useEffect(() => {
    const onDoc = e => {
      if (localeRef.current && !localeRef.current.contains(e.target)) setLocaleOpen(false);
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMega(null);
    };
    const onKey = e => { if (e.key === 'Escape') { setLocaleOpen(false); setOpenMega(null); } };
    document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  return (<>
    <Announcement />
    <header className="site-header" id="site-header">
      <div className="hdr-main container">
        <div className="hdr-start">
          <button className="icon-btn only-mobile" data-action="open-menu" onClick={ui.openMenu} aria-label={t('a11y.openMenu')} aria-haspopup="dialog"><Icon name="menu" /></button>
          <button className="search-pill" onClick={() => ui.openSearch()} aria-haspopup="dialog"><Icon name="search" /><span>{t('search.placeholder')}</span><kbd aria-hidden="true">/</kbd></button>
          <button className="icon-btn only-mobile" onClick={() => ui.openSearch()} aria-label={t('search.open')}><Icon name="search" /></button>
        </div>
        <Logo />
        <div className="hdr-end">
          <div className="locale" ref={localeRef}>
            <button className="locale-btn" aria-expanded={localeOpen} aria-controls="locale-pop" onClick={() => setLocaleOpen(o => !o)}
              aria-label={t('a11y.localeBtn', { lang: L.label, cur: S.session.currency })}>
              <Icon name="globe" /><span>{L.short} · {S.session.currency}</span><Icon name="chevDown" className="chev" />
            </button>
            {localeOpen && <div className="locale-pop" id="locale-pop"><LocaleControls ctx="pop" /></div>}
          </div>
          <div className="hdr-icons">
            <a className="icon-btn" href={u ? (u.role === 'admin' ? '/admin' : '/account') : '/login'} aria-label={u ? t('nav.account') : t('nav.login')}><Icon name="user" />{u && <span className="dot" aria-hidden="true" />}</a>
            <a className="icon-btn" href="/wishlist" aria-label={t('a11y.wishCount', { n: wishN })}><Icon name="heart" /><Count n={wishN} /></a>
            <button className="icon-btn" data-action="open-cart" onClick={() => ui.openCart()} aria-label={t('a11y.cartCount', { n: cartN })} aria-haspopup="dialog"><Icon name="bag" /><Count n={cartN} /></button>
          </div>
        </div>
      </div>
      <nav className="main-nav" aria-label={t('a11y.mainNav')} ref={navRef}>
        <ul className="nav-list container">
          {NAV.map(n => {
            const active = isActive(n.href, hash);
            return (
              <li key={n.key} className={`nav-item${n.mega ? ' has-mega' : ''}${openMega === n.mega && n.mega ? ' open' : ''}`}>
                <a className={`nav-link${n.accent ? ' accent' : ''}${active ? ' active' : ''}`} href={n.href} aria-current={active ? 'page' : undefined}>
                  {t('nav.' + n.key)}{n.spark && <Icon name="flame" className="spark" />}
                </a>
                {n.mega && <>
                  <button className="nav-caret" aria-expanded={openMega === n.mega} aria-label={t('a11y.submenu', { name: t('nav.' + n.key) })}
                    onClick={() => setOpenMega(o => o === n.mega ? null : n.mega)}><Icon name="chevDown" /></button>
                  <div className="mega-wrap"><Mega kind={n.mega} /></div>
                </>}
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  </>);
}
