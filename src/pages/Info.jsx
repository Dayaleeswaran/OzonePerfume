import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Breadcrumbs, Field, FitImage, SectionHead } from '../components/common.jsx';
import { Button, Alert } from '../components/ui.jsx';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { money, errorText } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { useTitle } from '../lib/router.js';
import { useSeo } from '../lib/seo.js';
import ShippingInfo from '../components/ShippingInfo.jsx';
import { useCaptcha } from '../components/Captcha.jsx';
import { BRAND } from '../data/catalog.js';
import NotFound from './NotFound.jsx';

export function About() {
  useTitle(t('nav.about'));
  useSeo({ path: '/about', title: t('nav.about'), description: t('meta.descAbout') }, [S.session.lang]);
  return (<>
    <Breadcrumbs items={[['/', t('nav.home')], [null, t('nav.about')]]} />
    {/* Split hero: copy on one side, the full product photo on the other, so the image is never cropped */}
    <section className="about-hero">
      <div className="container about-hero-in">
        <div className="about-hero-copy">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h1 className="page-title left">{t('about.title')}</h1>
          <p className="lead">{t('about.lead')}</p>
          <div className="btn-row"><a className="btn btn-teal" href="/shop/diffusers">{t('hero.browse')}</a><a className="btn btn-ghost-dark" href="/contact">{t('about.talk')}</a></div>
        </div>
        <div className="about-hero-media"><FitImage k="o10" eager sizes="(max-width: 900px) 100vw, 50vw" /></div>
      </div>
    </section>
    <section className="section container about-grid">
      <div className="reveal"><h2 className="sec-title left">{t('about.storyTitle')}</h2><p>{t('about.story1')}</p><p>{t('about.story2')}</p></div>
      <div className="about-img reveal" style={{ '--d': '100ms' }}><FitImage k="o3" sizes="(max-width: 900px) 100vw, 50vw" /></div>
    </section>
    <section className="section values-sec"><div className="container">
      <SectionHead title={t('about.valuesTitle')} />
      <ul className="values">{[['leaf', 'v1'], ['app', 'v2'], ['sparkle', 'v3'], ['warranty', 'v4']].map(([ic, k], i) => (
        <li key={k} className="card reveal" style={{ '--d': `${i * 80}ms` }}><Icon name={ic} /><h3>{t('about.' + k + '.t')}</h3><p>{t('about.' + k + '.d')}</p></li>
      ))}</ul>
    </div></section>
    <section className="section container about-grid rev">
      <div className="about-img reveal"><FitImage k="o4" sizes="(max-width: 900px) 100vw, 50vw" /></div>
      <div className="reveal" style={{ '--d': '100ms' }}><h2 className="sec-title left">{t('about.whatTitle')}</h2>
        <ul className="ticks lg">{['about.what1', 'about.what2', 'about.what3', 'about.what4'].map(k => <li key={k}><Icon name="check" />{t(k)}</li>)}</ul>
        <div className="btn-row"><a className="btn btn-primary" href="/shop/diffusers">{t('hero.browse')}</a><a className="btn btn-outline" href="/contact">{t('about.talk')}</a></div>
      </div>
    </section>
    <section className="section company-sec"><div className="container">
      <SectionHead title={t('about.companyTitle')} />
      <dl className="company card reveal">
        <div><dt>{t('about.c.name')}</dt><dd>{BRAND.legalName}</dd></div>
        <div><dt>{t('about.c.license')}</dt><dd dir="ltr">{BRAND.licenseNo}</dd></div>
        <div><dt>{t('about.c.trn')}</dt><dd dir="ltr">{BRAND.trn}</dd></div>
        <div><dt>{t('about.c.business')}</dt><dd>{t('about.c.businessV')}</dd></div>
        <div><dt>{t('about.c.location')}</dt><dd>{t('brand.address')}</dd></div>
        <div><dt>{t('about.c.area')}</dt><dd>{t('about.c.areaV')}</dd></div>
        <div><dt>{t('about.c.web')}</dt><dd><a href={`https://${BRAND.website}`} target="_blank" rel="noopener noreferrer">{BRAND.website}</a></dd></div>
        <div><dt>{t('about.c.contact')}</dt><dd><a href={`tel:${BRAND.phoneRaw}`} dir="ltr">{BRAND.phone}</a> · <a href={`tel:${BRAND.phone2Raw}`} dir="ltr">{BRAND.phone2}</a><br />
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> · <a href={`mailto:${BRAND.salesEmail}`}>{BRAND.salesEmail}</a></dd></div>
      </dl>
    </div></section>
  </>);
}

export function Contact() {
  useTitle(t('nav.contact'));
  useSeo({ path: '/contact', title: t('nav.contact'), description: t('contact.sub') }, [S.session.lang]);
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const cap = useCaptcha('contact');
  const doneRef = useRef(null);
  const u = S.user() || {};
  const topics = ['general', 'order', 'product', 'business', 'warranty'];
  const submit = e => {
    e.preventDefault();
    const d = f.validate(e.currentTarget, { name: [V.required, V.min(2)], email: [V.required, V.email], phone: [V.phone], message: [V.required, V.min(10)] });
    if (!d) return;
    if (!cap.ready()) { f.setAlert({ type: 'error', msg: t('captcha.wait') }); return; }
    setBusy(true);
    const token = cap.token; cap.reset();
    S.sendMessage(d, token).then(() => { setBusy(false); setSent(d.email); setTimeout(() => doneRef.current && doneRef.current.focus(), 30); })
      .catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: t('contact.error') + ' ' + errorText(err) }); });
  };
  return (<>
    <Breadcrumbs items={[['/', t('nav.home')], [null, t('nav.contact')]]} />
    <section className="page-hero"><div className="container"><h1 className="page-title">{t('contact.title')}</h1><p className="page-sub">{t('contact.sub')}</p></div></section>
    <section className="container contact-grid">
      <div className="contact-info">
        <a className="c-card card" href={`tel:${BRAND.phoneRaw}`}><Icon name="phone" /><span><strong>{t('contact.call')}</strong><span dir="ltr">{BRAND.phone} · {BRAND.phone2}</span></span></a>
        <a className="c-card card" href={`https://wa.me/${BRAND.phoneRaw}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /><span><strong>WhatsApp</strong><span>{t('contact.waText')}</span></span></a>
        <a className="c-card card" href={`mailto:${BRAND.email}`}><Icon name="mail" /><span><strong>{t('contact.email')}</strong><span>{BRAND.email}</span></span></a>
        <a className="c-card card" href={`mailto:${BRAND.salesEmail}`}><Icon name="briefcase" /><span><strong>{t('contact.sales')}</strong><span>{BRAND.salesEmail}</span></span></a>
        <div className="c-card card"><Icon name="pin" /><span><strong>{t('contact.visit')}</strong><span>{t('brand.address')}</span></span></div>
        <div className="socials big">{Object.entries(BRAND.socials).filter(([, url]) => url).map(([s, url]) => <a key={s} href={url} target="_blank" rel="noopener noreferrer" aria-label={s}><Icon name={s} /></a>)}</div>
      </div>
      <div>
        {sent ? (
          <div className="card done-state" tabIndex={-1} ref={doneRef}><Icon name="check" className="done-ic" /><h2>{t('contact.successTitle')}</h2><p>{t('contact.successText', { email: sent })}</p>
            <div className="btn-row center"><button className="btn btn-outline" onClick={() => setSent(null)}>{t('contact.again')}</button><a className="btn btn-primary" href="/shop/diffusers">{t('cart.continue')}</a></div></div>
        ) : (
          <form className="card form-card contact-form" data-contact noValidate onSubmit={submit}>
            <h2 className="card-h">{t('contact.formTitle')}</h2>
            <p className="muted small">{t('contact.formSub')}</p>
            {f.alert && <Alert>{f.alert.msg}</Alert>}
            <div className="grid-2">
              <Field name="name" label={t('form.fullName')} required autoComplete="name" defaultValue={u.name || ''} error={f.errors.name} onClear={f.clear} />
              <Field name="email" label={t('form.email')} type="email" required autoComplete="email" defaultValue={u.email || ''} error={f.errors.email} onClear={f.clear} />
            </div>
            <div className="grid-2">
              <Field name="phone" label={t('form.phone')} type="tel" autoComplete="tel" dir="ltr" error={f.errors.phone} onClear={f.clear} />
              <Field name="topic" label={t('contact.topic')} defaultValue="general" options={topics.map(x => ({ value: x, label: t('contact.topic.' + x) }))} />
            </div>
            <Field name="message" label={t('contact.message')} type="textarea" required rows={5} maxLength={2000} error={f.errors.message} onClear={f.clear} />
            {cap.widget}
            <Button type="submit" className="btn btn-primary btn-lg" busy={busy} busyLabel={t('contact.sending')}><Icon name="mail" /> {t('contact.send')}</Button>
          </form>
        )}
      </div>
    </section>
    <section className="container section-sm"><div className="map card map-plain">
      <p><Icon name="pin" /> {t('brand.address')}</p>
      <a className="map-link" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(BRAND.mapQuery)}`} target="_blank" rel="noopener noreferrer"><Icon name="pin" /> {t('contact.openMap')}</a>
    </div></section>
  </>);
}

export function Policy({ k }) {
  const keys = ['shipping', 'returns', 'privacy', 'terms'];
  useTitle(keys.includes(k) ? t('policy.' + k) : t('nf.title'));
  if (!keys.includes(k)) return <NotFound />;
  const s = S.settings();
  const vars = { amount: money(s.freeShippingThreshold), email: BRAND.email, vat: s.vatRate,
    taxNote: t(s.taxMode === 'exclusive' ? 'pol.terms.vatExclusive' : 'pol.terms.vatInclusive', { rate: s.vatRate }) };
  /* OD-008: returns/refunds and terms wording is not yet approved by the client */
  const pending = k === 'returns' || k === 'terms';
  return (<>
    <Breadcrumbs items={[['/', t('nav.home')], [null, t('policy.' + k)]]} />
    <section className="container policy">
      <nav className="policy-nav" aria-label={t('policy.nav')}><ul>{keys.map(x => <li key={x}><a href={`/policies/${x}`} className={x === k ? 'on' : ''} aria-current={x === k ? 'page' : undefined}>{t('policy.' + x)}</a></li>)}</ul></nav>
      <article className="policy-body"><h1 className="page-title left">{t('policy.' + k)}</h1>
        {pending && <Alert type="info">{t('policy.pending', { email: BRAND.email })}</Alert>}
        {k === 'shipping' && <ShippingInfo />}
        {[1, 2, 3].map(i => <div key={i}><h2>{t(`pol.${k}.h${i}`, vars)}</h2><p>{t(`pol.${k}.p${i}`, vars)}</p></div>)}
        <p className="muted small">{t('policy.questions')} <a href="/contact">{t('nav.contact')}</a></p>
      </article>
    </section>
  </>);
}
