import { CURRENCIES, LANGS } from '../data/catalog.js';
import { S } from './store.js';
import { t } from './i18n.js';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function money(aed, opts = {}) {
  const cur = opts.currency || S.session.currency;
  const loc = LANGS[S.session.lang].locale;
  const v = aed * CURRENCIES[cur].rate;
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency: cur, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).replace(/ /g, ' ');
  } catch (e) { return cur + ' ' + v.toFixed(2); }
}

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  try { return new Intl.DateTimeFormat(LANGS[S.session.lang].locale, opts).format(new Date(d)); } catch (e) { return String(d).slice(0, 10); }
}

export function errorText(err) {
  const code = (err && err.code) || 'unknown';
  const key = 'err.' + code;
  const vars = Object.assign({}, err, err && err.min != null ? { min: money(err.min) } : {});
  const txt = t(key, vars);
  return txt === key ? t('err.unknown') : txt;
}

/* Country name in the visitor's language (any ISO code, so new shipping countries need no code change) */
export function countryName(code) {
  const key = 'country.' + code, v = t(key);
  if (v !== key) return v;
  try { return new Intl.DisplayNames([LANGS[S.session.lang].locale], { type: 'region' }).of(code); } catch (e) { return code; }
}

export const debounce = (fn, ms = 250) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

/* Image paths for the optimised WebP set in public/assets/img (or a data:/http URL from admin uploads) */
export function imgSrc(key, size = 'sm') {
  if (/^data:|^https?:|\//.test(key)) return { src: key, srcSet: undefined };
  const small = `/assets/img/${key}-sm.webp`, large = `/assets/img/${key}.webp`;
  return { src: size === 'lg' ? large : small, srcSet: `${small} 640w, ${large} 1200w` };
}
