import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Img, FitImage, Stars, SectionHead, Carousel } from '../components/common.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import Cinematic from '../components/Cinematic.jsx';
import { S } from '../lib/store.js';
import { t, pname } from '../lib/i18n.js';
import { money, reducedMotion } from '../lib/format.js';
import { BRAND, FAMILIES, SPACES } from '../data/catalog.js';
import { useTitle } from '../lib/router.js';
import { useSeo, organizationLd } from '../lib/seo.js';

function Hero() {
  const slides = [
    { img: 'o1', key: 's1', href: '/shop/diffusers', feats: [['sparkle', 'hero.f.design'], ['app', 'hero.f.tech'], ['tank', 'hero.f.pure'], ['leaf', 'hero.f.nature']] },
    { img: 'hero-2', pos: 'right', key: 's2', href: '/deals/aroma', feats: [['leaf', 'hero.f.plant'], ['tank', 'hero.f.sizes'], ['building', 'hero.f.hotel'], ['sparkle', 'hero.f.custom']] },
    { img: 'hero-3', pos: 'right', key: 's3', href: '/shop/gifts', feats: [['gift', 'hero.f.giftbox'], ['message', 'hero.f.message'], ['truck', 'hero.f.delivery']].concat(S.feature('special_dates') ? [['calendar', 'hero.f.dates']] : []) }
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(reducedMotion);
  const [hover, setHover] = useState(false);
  const x0 = useRef(null);

  useEffect(() => {
    if (paused || hover) return;
    const h = setTimeout(() => setI(n => (n + 1) % slides.length), 6500);
    return () => clearTimeout(h);
  }, [i, paused, hover, slides.length]);

  const go = n => setI((n + slides.length) % slides.length);
  return (
    <section className={`hero${paused ? ' paused' : ''}`} aria-roledescription="carousel" aria-label={t('hero.label')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      onTouchStart={e => { x0.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; const rtl = document.documentElement.dir === 'rtl'; if (Math.abs(dx) > 50) go(i + ((dx < 0) !== rtl ? 1 : -1)); x0.current = null; }}>
      <div className="hero-slides">
        {slides.map((s, k) => {
          const on = k === i;
          const Title = k === 0 ? 'h1' : 'h2';
          return (
            <div key={s.key} className={`hero-slide${on ? ' active' : ''}${s.pos ? ' pos-' + s.pos : ''}`} role="group" aria-roledescription="slide" aria-label={`${k + 1} / ${slides.length}`} aria-hidden={!on}>
              <div className="hero-media"><Img k={s.img} size="lg" eager={k === 0} sizes="(max-width: 900px) 100vw, 62vw" /></div>
              <div className="container hero-inner">
                <div className="hero-copy">
                  <p className="eyebrow">{t('hero.eyebrow')}</p>
                  <Title className="hero-title"><span>{t(`hero.${s.key}.t1`)}</span><span className="accent">{t(`hero.${s.key}.t2`)}</span></Title>
                  <p className="hero-text">{t(`hero.${s.key}.text`)}</p>
                  <ul className="hero-feats">{s.feats.map(([ic, key]) => <li key={key}><span className="hf-ic"><Icon name={ic} /></span><span>{t(key)}</span></li>)}</ul>
                  <div className="btn-row">
                    <a className="btn btn-primary btn-lg" href={s.href} tabIndex={on ? undefined : -1}>{t(`hero.${s.key}.cta`)} <Icon name="arrowRight" className="flip" /></a>
                    <a className="btn btn-ghost-dark btn-lg" href="/shop/diffusers" tabIndex={on ? undefined : -1}>{t('hero.browse')}</a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero-ctrl container">
        <div className="hero-dots" role="group" aria-label={t('hero.choose')}>
          {slides.map((s, k) => <button key={s.key} className={`hero-dot${k === i ? ' on' : ''}`} onClick={() => go(k)} aria-label={t('hero.goto', { n: k + 1 })} aria-current={k === i}><span key={k === i ? i : 'off'} /></button>)}
        </div>
        <button className="hero-pause icon-btn" onClick={() => setPaused(p => !p)} aria-label={t(paused ? 'hero.play' : 'hero.pause')} aria-pressed={paused}><Icon name={paused ? 'play' : 'pause'} /></button>
      </div>
    </section>
  );
}

function Finder() {
  const [mode, setMode] = useState('family');
  const [value, setValue] = useState('citrus');
  const icons = { citrus: 'sparkle', floral: 'leaf', fresh: 'tank', woody: 'flame', home: 'home', office: 'briefcase', commercial: 'building', car: 'truck' };
  const list = mode === 'family' ? FAMILIES : SPACES;
  const res = S.products().filter(p => mode === 'family' ? (p.type === 'oil' && p.family === value) : (p.type !== 'oil' && p.spaces.includes(value)));
  const href = mode === 'family' ? `/shop/oils?family=${value}` : `/shop/diffusers?space=${value}`;
  const pickMode = m => { setMode(m); setValue(m === 'family' ? 'citrus' : 'home'); };
  const prefix = mode === 'family' ? 'family.' : 'space.';
  return (
    <section className="section finder" id="finder">
      <div className="container">
        <SectionHead title={t('finder.title')} eyebrow={t('finder.eyebrow')} sub={t('finder.sub')} />
        <div className="finder-modes reveal">
          <div className="seg" role="tablist" aria-label={t('finder.modes')}
            onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const m = mode === 'family' ? 'space' : 'family'; pickMode(m); document.getElementById('fm-' + m).focus(); } }}>
            {['family', 'space'].map(m => (
              <button key={m} role="tab" id={'fm-' + m} className={`seg-btn${mode === m ? ' on' : ''}`} aria-selected={mode === m} aria-controls="finder-opts" tabIndex={mode === m ? 0 : -1} onClick={() => pickMode(m)}>
                {t(m === 'family' ? 'finder.byScent' : 'finder.bySpace')}
              </button>
            ))}
          </div>
          <div className="finder-opts" id="finder-opts" role="tabpanel" aria-labelledby={'fm-' + mode}>
            <div className="finder-chips" role="radiogroup" aria-label={t(mode === 'family' ? 'finder.byScent' : 'finder.bySpace')}>
              {list.map(v => (
                <button key={v} role="radio" aria-checked={v === value} className={`fchip${v === value ? ' on' : ''}`} onClick={() => setValue(v)}>
                  <Icon name={icons[v]} /><span><strong>{t(prefix + v)}</strong><small>{t(prefix + v + '.d')}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="finder-results" aria-live="polite">
          <div className="grid grid-4 fade-in" key={mode + value}>{res.slice(0, 4).map(p => <ProductCard key={p.id} p={p} />)}</div>
          <div className="center-row"><a className="btn btn-outline" href={href}>{t('finder.seeAll', { n: res.length })} <Icon name="arrowRight" className="flip" /></a></div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useTitle(t('meta.home'));
  useSeo({ path: '/', title: t('meta.home'), description: t('meta.desc'), image: '/assets/img/o1.webp', jsonLd: organizationLd() }, [S.session.lang]);
  const crazy = S.collection('crazy-deals');
  const diffusers = S.collection('diffusers');
  const signature = S.collection('signature');
  const hotel = S.collection('hotel');
  const reviews = S.approvedReviews().filter(r => r.rating === 5).slice(0, 3);
  const tiles = [
    { href: '/shop/diffusers', img: 'o8', t: 'nav.diffusers', s: 'tiles.diffusers' },
    { href: '/deals/aroma', img: 'oil-prestige', t: 'nav.aromaDeals', s: 'tiles.aroma' },
    { href: '/shop/home-care', img: 'o2', t: 'nav.homeCare', s: 'tiles.home' },
    { href: '/shop/gifts', img: 'oil-love-whisper', t: 'nav.gifts', s: 'tiles.gifts' }
  ];
  const benefits = [['truck', 'benefits.ship', { amount: money(S.settings().freeShippingThreshold) }], ['percent', 'benefits.first', {}], ['shield', 'benefits.secure', {}], ['gift', 'benefits.gift', {}]];

  return (<>
    <Hero />
    <section className="benefits" aria-label={t('benefits.label')}><div className="container benefits-in">
      {benefits.map(([ic, k, v]) => <div key={k} className="benefit"><span className="b-ic"><Icon name={ic} /></span><div><p className="b-t">{t(k + '.t', v)}</p><p className="b-s">{t(k + '.s', v)}</p></div></div>)}
    </div></section>

    {crazy.length > 0 && (
      <section className="section" id="crazy-deals">
        <div className="container"><SectionHead title={t('nav.crazyDeals')} icon="flame" sub={t('home.crazySub')} link="/deals/crazy" /></div>
        <div className="container-wide"><Carousel id="car-crazy" label={t('nav.crazyDeals')}>{crazy.map(p => <ProductCard key={p.id} p={p} showSave />)}</Carousel></div>
      </section>
    )}

    <section className="section" id="diffusers">
      <div className="container"><SectionHead title={t('nav.diffusers')} eyebrow={t('home.diffEyebrow')} sub={t('home.diffSub')} link="/shop/diffusers" /></div>
      <div className="container-wide"><Carousel id="car-diff" label={t('nav.diffusers')}>{diffusers.map(p => <ProductCard key={p.id} p={p} gift />)}</Carousel></div>
    </section>

    <section className="section tiles-sec" aria-label={t('tiles.label')}>
      <div className="container tiles">
        {tiles.map((x, i) => (
          <a key={x.href} className="tile reveal" style={{ '--d': `${i * 80}ms` }} href={x.href}>
            <Img k={x.img} />
            <span className="tile-shade" />
            <span className="tile-copy"><span className="tile-t">{t(x.t)}</span><span className="tile-s">{t(x.s)}</span></span>
            <span className="tile-go" aria-hidden="true"><Icon name="chevRight" className="flip" /></span>
          </a>
        ))}
      </div>
    </section>

    <Cinematic />

    <section className="section" id="signature-oils">
      <div className="container"><SectionHead title={t('home.oilsTitle')} eyebrow={t('home.oilsEyebrow')} sub={t('home.oilsSub')} link="/deals/aroma" /></div>
      <div className="container-wide"><Carousel id="car-oils" label={t('home.oilsTitle')}>{signature.map(p => <ProductCard key={p.id} p={p} gift />)}</Carousel></div>
    </section>

    {hotel.length > 0 && (
      <section className="section hotel-sec" id="hotel-inspired">
        <div className="container"><SectionHead title={t('home.hotelTitle')} eyebrow={t('home.hotelEyebrow')} sub={t('home.hotelSub')} link="/shop/hotel" /></div>
        <div className="container-wide"><Carousel id="car-hotel" label={t('home.hotelTitle')}>{hotel.map(p => <ProductCard key={p.id} p={p} gift />)}</Carousel></div>
      </section>
    )}

    <Finder />

    <section className="section gift-sec">
      <div className={`container gift-grid${S.feature('special_dates') ? '' : ' single'}`}>
        <div className="gift-card reveal">
          <div className="gift-media"><FitImage k="oil-velvet-bloom-2" sizes="(max-width: 600px) 100vw, 40vw" /></div>
          <div className="gift-copy">
            <p className="eyebrow">{t('home.giftEyebrow')}</p>
            <h2 className="sec-title">{t('home.giftTitle')}</h2>
            <p>{t('home.giftText')}</p>
            <ul className="ticks">{['home.giftP1', 'home.giftP2', 'home.giftP3'].map(k => <li key={k}><Icon name="check" />{t(k)}</li>)}</ul>
            <div className="btn-row"><a className="btn btn-primary" href="/shop/gifts"><Icon name="gift" /> {t('home.giftCta')}</a></div>
          </div>
        </div>
        {S.feature('special_dates') && <div className="dates-card reveal" style={{ '--d': '120ms' }}>
          <span className="dates-ic"><Icon name="calendar" /></span>
          <h2 className="sec-title sm">{t('home.datesTitle')}</h2>
          <p>{t('home.datesText')}</p>
          <ul className="date-chips">{['birthday', 'anniversary', 'valentine', 'christmas', 'newYear'].map(o => <li key={o}>{t('occ.' + o)}</li>)}</ul>
          <a className="btn btn-teal" href="/account/dates">{t('home.datesCta')} <Icon name="arrowRight" className="flip" /></a>
        </div>}
      </div>
    </section>

    <section className="section serving">
      <div className="container"><SectionHead title={t('home.servingTitle')} sub={t('home.servingSub')} />
        <ul className="serving-row">{[['building', 'serve.hotels'], ['briefcase', 'serve.offices'], ['bag', 'serve.retail'], ['home', 'serve.villas'], ['shield', 'serve.clinics'], ['sparkle', 'serve.spas'], ['users', 'serve.events']].map(([ic, k], i) => (
          <li key={k} className="reveal" style={{ '--d': `${i * 60}ms` }}><Icon name={ic} /><span>{t(k)}</span></li>
        ))}</ul>
      </div>
    </section>

    <section className="section brand-sec">
      <div className="container brand-grid">
        <div className="brand-media reveal"><FitImage k="oil-address-hotel-2" sizes="(max-width: 900px) 100vw, 50vw" /></div>
        <div className="brand-copy reveal" style={{ '--d': '100ms' }}>
          <p className="eyebrow">{t('home.brandEyebrow')}</p>
          <h2 className="sec-title left">{t('home.brandTitle')}</h2>
          <p>{t('home.brandText')}</p>
          <ul className="brand-points">
            {[['leaf', 'home.bp1'], ['warranty', 'home.bp2'], ['users', 'home.bp3']].map(([ic, k]) => <li key={k}><Icon name={ic} /><div><strong>{t(k + '.t')}</strong><span>{t(k + '.s')}</span></div></li>)}
          </ul>
          <a className="btn btn-outline" href="/about">{t('home.brandCta')} <Icon name="arrowRight" className="flip" /></a>
        </div>
      </div>
    </section>

    {reviews.length > 0 && (
      <section className="section quotes-sec"><div className="container">
        <SectionHead title={t('home.quotesTitle')} />
        <div className="quotes">{reviews.map((r, i) => { const p = S.product(r.productId); return (
          <figure key={r.id} className="quote reveal" style={{ '--d': `${i * 90}ms` }}><Stars rating={r.rating} /><blockquote><p>“{r.body}”</p></blockquote>
            <figcaption><strong>{r.name}</strong>{p && <> · <a href={`/product/${p.id}`}>{pname(p)}</a></>}</figcaption></figure>
        ); })}</div>
      </div></section>
    )}

    <section className="section connect">
      <div className="container connect-in reveal">
        <div><p className="eyebrow light">{t('home.connectEyebrow')}</p><h2 className="sec-title light left">{t('home.connectTitle')}</h2><p>{t('home.connectText')}</p></div>
        <div className="connect-actions">
          <a className="c-act" href={`https://wa.me/${BRAND.phoneRaw}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" /><span><strong>WhatsApp</strong><small dir="ltr">{BRAND.phone}</small></span></a>
          <a className="c-act" href={`tel:${BRAND.phone2Raw}`}><Icon name="phone" /><span><strong>{t('contact.call')}</strong><small dir="ltr">{BRAND.phone2}</small></span></a>
          <a className="c-act" href="/contact"><Icon name="mail" /><span><strong>{t('contact.formTitle')}</strong><small>{t('home.connectReply')}</small></span></a>
        </div>
      </div>
    </section>
  </>);
}
