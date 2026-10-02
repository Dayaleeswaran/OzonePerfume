/* Ozone Perfume — cinematic scroll section.
   A sticky canvas whose frames (the O1–O10 product photographs) advance with scroll position.
   Frames cross-dissolve with a slow push-in; chapter copy is synced to the active frame pair.
   Reduced-motion users get a static, stacked version of the same chapters. */
(function () {
  const { esc, icon, $, $$ } = OZ.ui;
  const t = (k, v) => OZ.t(k, v);

  const CHAPTERS = [
    { key: 'c1', frames: ['o1', 'o8'], href: '#/product/tower-pro-diffuser' },
    { key: 'c2', frames: ['o3', 'o10'], href: '#/shop/home-care' },
    { key: 'c3', frames: ['o4', 'o6'], href: '#/shop/diffusers?type=hvac' },
    { key: 'c4', frames: ['oil-ozone-scent', 'oil-blue-water'], href: '#/deals/aroma' },
    { key: 'c5', frames: ['oil-velvet-bloom-2', 'oil-candle-light-2'], href: '#/shop/gifts' }
  ];
  const FRAMES = CHAPTERS.flatMap(c => c.frames);

  OZ.cinematic = {
    html() {
      return `<section class="cine" id="cinematic" aria-labelledby="cine-h">
        <div class="container cine-intro reveal">
          <p class="eyebrow">${esc(t('cine.eyebrow'))}</p>
          <h2 class="sec-title" id="cine-h">${esc(t('cine.title'))}</h2>
          <p class="sec-sub">${esc(t('cine.sub'))}</p>
          <a class="skip-cine" href="#after-cine" data-skip-cine>${esc(t('cine.skip'))} ${icon('arrowRight', 'rot90')}</a>
        </div>
        <div class="cine-track" data-cine-track>
          <div class="cine-sticky">
            <canvas class="cine-canvas" aria-hidden="true"></canvas>
            <div class="cine-shade" aria-hidden="true"></div>
            <div class="cine-loader" aria-hidden="true"><span class="big-spinner"></span></div>
            <ol class="cine-chapters">
              ${CHAPTERS.map((c, i) => `<li class="cine-ch${i === 0 ? ' on' : ''}" data-ch="${i}">
                <div class="cine-still">${OZ.ui.img(c.frames[0], '', { size: 'lg', sizes: '100vw' })}</div>
                <div class="cine-copy">
                  <p class="cine-n"><span>0${i + 1}</span> / 0${CHAPTERS.length}</p>
                  <h3 class="cine-t">${esc(t('cine.' + c.key + '.t'))}</h3>
                  <p class="cine-d">${esc(t('cine.' + c.key + '.d'))}</p>
                  <a class="btn btn-light" href="${c.href}" ${i ? 'tabindex="-1"' : ''}>${esc(t('cine.' + c.key + '.cta'))} ${icon('arrowRight', 'flip')}</a>
                </div>
              </li>`).join('')}
            </ol>
            <div class="cine-ui">
              <div class="cine-dots" role="group" aria-label="${esc(t('cine.chapters'))}">${CHAPTERS.map((c, i) => `<button class="cine-dot${i === 0 ? ' on' : ''}" data-goto="${i}" aria-label="${esc(t('cine.goto', { n: i + 1, name: t('cine.' + c.key + '.t') }))}" ${i === 0 ? 'aria-current="true"' : ''}><span></span></button>`).join('')}</div>
            </div>
            <div class="cine-progress" aria-hidden="true"><span></span></div>
            <p class="cine-hint" aria-hidden="true"><span class="mouse"><i></i></span>${esc(t('cine.hint'))}</p>
          </div>
        </div>
        <div id="after-cine" tabindex="-1"></div>
      </section>`;
    },

    mount(root) {
      const sec = $('#cinematic', root); if (!sec) return;
      const track = $('[data-cine-track]', sec);
      const canvas = $('canvas', sec), ctx = canvas.getContext('2d');
      const chapters = $$('.cine-ch', sec), dots = $$('.cine-dot', sec);
      const bar = $('.cine-progress span', sec), hint = $('.cine-hint', sec), loader = $('.cine-loader', sec);

      $('[data-skip-cine]', sec).addEventListener('click', e => {
        e.preventDefault();
        const target = $('#after-cine', sec);
        window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 60, behavior: OZ.ui.reducedMotion() ? 'auto' : 'smooth' });
        target.focus({ preventScroll: true });
      });

      const staticMode = () => { sec.classList.add('cine-static'); chapters.forEach(c => { c.classList.add('on'); $$('a', c).forEach(a => a.removeAttribute('tabindex')); }); };
      if (OZ.ui.reducedMotion() || !ctx) { staticMode(); return; }

      let target = 0, current = 0, raf = 0, active = -1, visible = false;
      let W = 0, H = 0, dpr = 1;

      /* ---- frames ---- */
      const small = window.innerWidth < 900;
      const imgs = FRAMES.map(k => { const im = new Image(); im.decoding = 'async'; im.src = `assets/img/${k}${small ? '-sm' : ''}.webp`; return im; });
      let ready = 0;
      const onReady = () => { ready++; if (ready >= 2) loader.classList.add('hide'); draw(true); };
      imgs.forEach(im => { if (im.complete && im.naturalWidth) queueMicrotask(onReady); else { im.onload = onReady; im.onerror = onReady; } });

      /* ---- sizing ---- */
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
        const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        target = progress(); draw(true);
      };

      /* ---- scroll → progress ---- */
      /* The sticky frame pins at the header's bottom edge, so the scrub range is offset by it */
      const hdr = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 0;
      const range = () => track.offsetHeight - window.innerHeight + hdr();
      const progress = () => {
        const r = track.getBoundingClientRect(), total = range();
        return total > 0 ? Math.min(1, Math.max(0, (hdr() - r.top) / total)) : 0;
      };

      const ease = x => x * x * (3 - 2 * x);
      const cover = (im, zoom, panX, panY, alpha) => {
        if (!im || !im.naturalWidth) return;
        const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
        const w = im.naturalWidth * s, h = im.naturalHeight * s;
        ctx.globalAlpha = alpha;
        ctx.drawImage(im, (W - w) / 2 + panX, (H - h) / 2 + panY, w, h);
      };

      function draw(force) {
        const f = current * (FRAMES.length - 1);
        const i = Math.min(FRAMES.length - 2, Math.floor(f));
        const local = f - i;
        const mix = ease(Math.min(1, Math.max(0, (local - 0.62) / 0.3)));
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0E2433'; ctx.fillRect(0, 0, W, H);
        const drift = W < 700 ? 10 : 24;
        cover(imgs[i], 1.06 + local * 0.08, -local * drift, 0, 1);
        if (mix > 0.001) cover(imgs[i + 1], 1.14 - (1 - local) * 0.08 + 0.02, (1 - local) * drift, 0, mix);
        ctx.globalAlpha = 1;

        const ch = Math.min(CHAPTERS.length - 1, Math.floor(current * CHAPTERS.length * 0.9999));
        if (ch !== active || force) {
          active = ch;
          chapters.forEach((c, k) => {
            const on = k === ch; c.classList.toggle('on', on);
            $$('a', c).forEach(a => on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1'));
          });
          dots.forEach((d, k) => { d.classList.toggle('on', k === ch); if (k === ch) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
        }
        bar.style.transform = `scaleX(${current})`;
        hint.classList.toggle('hide', current > 0.015);
      }

      const loop = () => {
        raf = 0;
        const diff = target - current;
        current = Math.abs(diff) < 0.0004 ? target : current + diff * 0.12;
        draw();
        if (current !== target) raf = requestAnimationFrame(loop);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const onScroll = () => { if (!visible) return; target = progress(); kick(); };

      dots.forEach(d => d.addEventListener('click', () => {
        const n = +d.dataset.goto;
        const top = track.getBoundingClientRect().top + scrollY - hdr() + range() * ((n + 0.5) / CHAPTERS.length);
        window.scrollTo({ top, behavior: 'smooth' });
      }));

      const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { target = progress(); kick(); } }, { rootMargin: '100px 0px' });
      io.observe(track);
      const ro = new ResizeObserver(OZ.ui.debounce(resize, 80));
      ro.observe(canvas);
      window.addEventListener('scroll', onScroll, { passive: true });
      resize();

      OZ.onLeave(() => { io.disconnect(); ro.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });
    }
  };
})();
