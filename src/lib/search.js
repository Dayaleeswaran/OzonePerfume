import { S } from './store.js';
import { t, noteLabel } from './i18n.js';
import en from '../i18n/en.js';

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/* Weighted product search across names (all languages), type, family, line, spaces, notes and copy */
export function searchProducts(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const L = ['en', 'es', 'ar'];
  return S.products().map(p => {
    const fields = [
      [L.map(l => p.name[l]).join(' '), 6],
      [[p.type, t('type.' + p.type), en['type.' + p.type]].join(' '), 4],
      [[p.family || '', p.family ? t('family.' + p.family) : '', p.line || '', p.line === 'hotel' ? t('badge.hotel') + ' hotel' : ''].concat(p.spaces.map(s => t('space.' + s))).join(' '), 3],
      [[].concat(p.notes.top, p.notes.heart, p.notes.base).map(n => noteLabel(n) + ' ' + (en['note.' + n] || n)).join(' '), 3],
      [L.map(l => ((p.tagline || {})[l] || '') + ' ' + ((p.desc || {})[l] || '')).join(' ') + ' ' + p.sku + ' ' + p.features.map(f => t('feat.' + f)).join(' '), 1]
    ].map(([txt, w]) => [norm(txt), w]);
    let score = 0;
    for (const term of terms) {
      const hit = fields.reduce((a, [txt, w]) => a + (txt.includes(term) ? w : 0), 0);
      if (!hit) return null;
      score += hit;
    }
    return { p, score: score + (p.bestSeller ? 0.5 : 0) };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.p);
}
