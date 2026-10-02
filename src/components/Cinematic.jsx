/* Cinematic scroll section: a sticky canvas whose frames (product photographs) advance with
   scroll position, cross-dissolving with a slow push-in; chapter copy is synced to the frame pair.
   Reduced-motion users get a static, stacked version of the same chapters. */
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { FitImage } from './common.jsx';
import { t } from '../lib/i18n.js';
import { reducedMotion, debounce } from '../lib/format.js';

const CHAPTERS = [
  { key: 'c1', frames: ['o1', 'o8'], href: '#/product/tower-pro-diffuser' },
  { key: 'c2', frames: ['o3', 'o10'], href: '#/shop/home-care' },
  { key: 'c3', frames: ['o4', 'o6'], href: '#/shop/diffusers?type=hvac' },
  { key: 'c4', frames: ['oil-ozone-scent', 'oil-blue-water'], href: '#/deals/aroma' },
  { key: 'c5', frames: ['oil-velvet-bloom-2', 'oil-candle-light-2'], href: '#/shop/gifts' }
];
const FRAMES = CHAPTERS.flatMap(c => c.frames);

export default function Cinematic() {
  const trackRef = useRef(null), canvasRef = useRef(null), barRef = useRef(null);
  const [active, setActive] = useState(0);
  const [hintHidden, setHintHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isStatic] = useState(() => reducedMotion());

  useEffect(() => {
    if (isStatic) return;
    const track = trackRef.current, canvas = canvasRef.current, ctx = canvas.getContext('2d');
    if (!ctx) return;
    let target = 0, current = 0, raf = 0, visible = false, W = 0, H = 0, lastCh = -1, lastHint = null, dead = false;
    const small = window.innerWidth < 900;
    const imgs = FRAMES.map(k => { const im = new Image(); im.decoding = 'async'; im.src = `assets/img/${k}${small ? '-sm' : ''}.webp`; return im; });
    let ready = 0;
    const onReady = () => { if (dead) return; ready++; if (ready >= 2) setLoaded(true); draw(true); };
    imgs.forEach(im => { if (im.complete && im.naturalWidth) queueMicrotask(onReady); else { im.onload = onReady; im.onerror = onReady; } });

    const hdr = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 0;
    const range = () => track.offsetHeight - window.innerHeight + hdr();
    const progress = () => { const r = track.getBoundingClientRect(), total = range(); return total > 0 ? Math.min(1, Math.max(0, (hdr() - r.top) / total)) : 0; };
    const ease = x => x * x * (3 - 2 * x);
    const cover = (im, zoom, panX, alpha) => {
      if (!im || !im.naturalWidth) return;
      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (W - w) / 2 + panX, (H - h) / 2, w, h);
    };
    function draw(force) {
      const f = current * (FRAMES.length - 1);
      const i = Math.min(FRAMES.length - 2, Math.floor(f));
      const local = f - i;
      const mix = ease(Math.min(1, Math.max(0, (local - 0.62) / 0.3)));
      ctx.globalAlpha = 1; ctx.fillStyle = '#0B0B0B'; ctx.fillRect(0, 0, W, H);
      const drift = W < 700 ? 10 : 24;
      cover(imgs[i], 1.06 + local * 0.08, -local * drift, 1);
      if (mix > 0.001) cover(imgs[i + 1], 1.14 - (1 - local) * 0.08 + 0.02, (1 - local) * drift, mix);
      ctx.globalAlpha = 1;
      const ch = Math.min(CHAPTERS.length - 1, Math.floor(current * CHAPTERS.length * 0.9999));
      if (ch !== lastCh || force) { lastCh = ch; setActive(ch); }
      if (barRef.current) barRef.current.style.transform = `scaleX(${current})`;
      const hide = current > 0.015;
      if (hide !== lastHint) { lastHint = hide; setHintHidden(hide); }
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
      const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      target = progress(); draw(true);
    };
    const loop = () => { raf = 0; const diff = target - current; current = Math.abs(diff) < 0.0004 ? target : current + diff * 0.12; draw(); if (current !== target) raf = requestAnimationFrame(loop); };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const onScroll = () => { if (!visible) return; target = progress(); kick(); };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { target = progress(); kick(); } }, { rootMargin: '100px 0px' });
    io.observe(track);
    const ro = new ResizeObserver(debounce(resize, 80));
    ro.observe(canvas);
    window.addEventListener('scroll', onScroll, { passive: true });
    resize();
    trackRef.current.__goto = n => {
      const top = track.getBoundingClientRect().top + scrollY - hdr() + range() * ((n + 0.5) / CHAPTERS.length);
      window.scrollTo({ top, behavior: 'smooth' });
    };
    return () => { dead = true; io.disconnect(); ro.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [isStatic]);

  const skip = e => {
    e.preventDefault();
    const target = document.getElementById('after-cine');
    window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 60, behavior: reducedMotion() ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  };

  return (
    <section className={`cine${isStatic ? ' cine-static' : ''}`} id="cinematic" aria-labelledby="cine-h">
      <div className="container cine-intro reveal">
        <p className="eyebrow">{t('cine.eyebrow')}</p>
        <h2 className="sec-title light" id="cine-h">{t('cine.title')}</h2>
        <p className="sec-sub">{t('cine.sub')}</p>
        <a className="skip-cine" href="#after-cine" onClick={skip}>{t('cine.skip')} <Icon name="arrowRight" className="rot90" /></a>
      </div>
      <div className="cine-track" ref={trackRef}>
        <div className="cine-sticky">
          <canvas className="cine-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="cine-shade" aria-hidden="true" />
          <div className={`cine-loader${loaded ? ' hide' : ''}`} aria-hidden="true"><span className="big-spinner" /></div>
          <ol className="cine-chapters">
            {CHAPTERS.map((c, i) => {
              const on = isStatic || i === active;
              return (
                <li key={c.key} className={`cine-ch${on ? ' on' : ''}`}>
                  <div className="cine-still"><FitImage k={c.frames[0]} sizes="(max-width: 900px) 100vw, 50vw" /></div>
                  <div className="cine-copy">
                    <p className="cine-n"><span>0{i + 1}</span> / 0{CHAPTERS.length}</p>
                    <h3 className="cine-t">{t('cine.' + c.key + '.t')}</h3>
                    <p className="cine-d">{t('cine.' + c.key + '.d')}</p>
                    <a className="btn btn-light" href={c.href} tabIndex={on ? undefined : -1}>{t('cine.' + c.key + '.cta')} <Icon name="arrowRight" className="flip" /></a>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="cine-ui">
            <div className="cine-dots" role="group" aria-label={t('cine.chapters')}>
              {CHAPTERS.map((c, i) => (
                <button key={c.key} className={`cine-dot${i === active ? ' on' : ''}`} aria-current={i === active || undefined}
                  aria-label={t('cine.goto', { n: i + 1, name: t('cine.' + c.key + '.t') })} onClick={() => trackRef.current.__goto && trackRef.current.__goto(i)}><span /></button>
              ))}
            </div>
          </div>
          <div className="cine-progress" aria-hidden="true"><span ref={barRef} /></div>
          <p className={`cine-hint${hintHidden ? ' hide' : ''}`} aria-hidden="true"><span className="mouse"><i /></span>{t('cine.hint')}</p>
        </div>
      </div>
      <div id="after-cine" tabIndex={-1} />
    </section>
  );
}
