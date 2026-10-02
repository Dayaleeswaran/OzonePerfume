/* Translation lookup.
   Order: admin override (current lang) → dictionary (current lang) → English override → English → key.
   "{name}" placeholders are interpolated; "one|many" picks a form based on {n}. */
import en from '../i18n/en.js';
import es from '../i18n/es.js';
import ar from '../i18n/ar.js';
import { S } from './store.js';

export const DICTS = { en, es, ar };

function lookup(lang, key) {
  const o = (S.db.translations && S.db.translations[lang]) || {};
  if (o[key] != null) return o[key];
  const d = DICTS[lang] || {};
  return d[key] != null ? d[key] : null;
}

export function t(key, vars) {
  const lang = S.session.lang || 'en';
  let s = lookup(lang, key);
  if (s == null && lang !== 'en') s = lookup('en', key);
  if (s == null) return key;
  if (vars && s.includes('|') && vars.n != null) {
    const forms = s.split('|');
    s = Number(vars.n) === 1 ? forms[0] : forms[forms.length - 1];
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}

/* Raw text for the translations editor (no interpolation, no fallback) */
t.raw = (lang, key) => { const v = lookup(lang, key); return v == null ? '' : v; };

/* Localised product fields */
export const pname = p => (p && p.name && (p.name[S.session.lang] || p.name.en)) || '';
export const ptext = (p, f) => (p && p[f] && (p[f][S.session.lang] || p[f].en)) || '';
export const noteLabel = n => { const k = 'note.' + n, v = t(k); return v === k ? n : v; };
