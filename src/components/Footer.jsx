import { useState } from 'react';
import Icon from './Icon.jsx';
import { PayMarks } from './common.jsx';
import { Button } from './ui.jsx';
import { Logo, LocaleControls } from './Header.jsx';
import { t } from '../lib/i18n.js';
import { S } from '../lib/store.js';
import { V } from '../lib/validate.js';
import { errorText } from '../lib/format.js';
import { BRAND } from '../data/catalog.js';

function Newsletter() {
  const [state, setState] = useState({ busy: false, msg: '', ok: false, invalid: false });
  const submit = e => {
    e.preventDefault();
    const input = e.currentTarget.elements.email;
    const bad = V.email(input.value);
    if (bad) { setState({ busy: false, msg: t('val.email'), ok: false, invalid: true }); input.focus(); return; }
    setState(s => ({ ...s, busy: true }));
    S.subscribe(input.value.trim()).then(() => { input.value = ''; setState({ busy: false, msg: t('footer.subscribed'), ok: true, invalid: false }); })
      .catch(err => setState({ busy: false, msg: errorText(err), ok: false, invalid: false }));
  };
  return (
    <form className="f-news-form" onSubmit={submit} noValidate>
      <label htmlFor="news-email" className="sr-only">{t('form.email')}</label>
      <input id="news-email" name="email" type="email" autoComplete="email" placeholder={t('form.emailPh')} required aria-describedby="news-msg" aria-invalid={state.invalid || undefined} />
      <Button type="submit" className="btn btn-teal" busy={state.busy}>{t('footer.subscribe')}</Button>
      <p id="news-msg" className={`f-news-msg ${state.ok ? 'ok' : state.msg ? 'err' : ''}`} role="status">{state.msg}</p>
    </form>
  );
}

export default function Footer() {
  const col = (title, links) => (
    <div className="f-col"><h2 className="f-h">{title}</h2><ul>{links.map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}</ul></div>
  );
  return (<>
    <footer className="site-footer">
      <div className="f-news"><div className="container f-news-in">
        <div><h2 className="f-news-h">{t('footer.newsTitle')}</h2><p>{t('footer.newsText')}</p></div>
        <Newsletter />
      </div></div>
      <div className="container f-grid">
        <div className="f-brand"><Logo /><p>{t('footer.about')}</p>
          <div className="socials">
            <a href={`https://wa.me/${BRAND.phoneRaw}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Icon name="instagram" /></a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Icon name="facebook" /></a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><Icon name="tiktok" /></a>
          </div>
        </div>
        {col(t('footer.shop'), [['#/shop/diffusers', t('nav.diffusers')], ['#/deals/aroma', t('nav.aromaDeals')], ['#/deals/crazy', t('nav.crazyDeals')], ['#/shop/home-care', t('nav.homeCare')], ['#/shop/gifts', t('nav.gifts')]])}
        {col(t('footer.customer'), [['#/account', t('nav.account')], ['#/account/orders', t('account.orders')], ['#/wishlist', t('nav.wishlist')], ['#/cart', t('nav.cart')], ['#/account/dates', t('account.dates')]])}
        {col(t('footer.company'), [['#/about', t('nav.about')], ['#/contact', t('nav.contact')], ['#/policies/shipping', t('policy.shipping')], ['#/policies/returns', t('policy.returns')], ['#/policies/privacy', t('policy.privacy')], ['#/policies/terms', t('policy.terms')]])}
        <div className="f-col f-contact"><h2 className="f-h">{t('footer.contact')}</h2>
          <ul>
            <li><Icon name="phone" /><a href={`tel:${BRAND.phoneRaw}`} dir="ltr">{BRAND.phone}</a></li>
            <li><Icon name="phone" /><a href={`tel:${BRAND.phone2Raw}`} dir="ltr">{BRAND.phone2}</a></li>
            <li><Icon name="mail" /><a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></li>
            <li><Icon name="pin" /><span>{t('brand.address')}</span></li>
            <li><Icon name="globe" /><a href={`https://${BRAND.website}`} target="_blank" rel="noopener noreferrer">{BRAND.website}</a></li>
          </ul>
        </div>
      </div>
      <div className="container f-bottom">
        <div className="f-locale"><LocaleControls ctx="f" /></div>
        <PayMarks />
        <p className="small">© {new Date().getFullYear()} {BRAND.legalName}. {t('footer.rights')}</p>
      </div>
    </footer>
    <a className="wa-float" href={`https://wa.me/${BRAND.phoneRaw}`} target="_blank" rel="noopener noreferrer" aria-label={t('a11y.whatsapp')}><Icon name="whatsapp" /></a>
  </>);
}
