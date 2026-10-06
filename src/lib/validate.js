import { t } from './i18n.js';

/* Field validators: return '' when valid, otherwise a translated message */
export const V = {
  required: v => String(v ?? '').trim() ? '' : t('val.required'),
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()) ? '' : t('val.email'),
  password: v => (String(v).length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)) ? '' : t('val.password'),
  phone: v => !String(v || '').trim() || /^[+\d][\d\s()-]{6,}$/.test(String(v).trim()) ? '' : t('val.phone'),
  min: n => v => String(v || '').trim().length >= n ? '' : t('val.min', { n }),
  max: n => v => String(v || '').length <= n ? '' : t('val.max', { n }),
  /* email one-time code: 6 digits locally, 8 on Supabase cloud by default — accept whatever length the server sends */
  code: v => /^\d{6,10}$/.test(String(v || '').replace(/\s/g, '')) ? '' : t('val.code')
};

/* rules: { field: [validator, ...] } → { errors, ok } */
export function runRules(values, rules) {
  const errors = {};
  for (const [name, fns] of Object.entries(rules)) {
    const msg = fns.map(fn => fn(values[name], values)).find(Boolean);
    if (msg) errors[name] = msg;
  }
  return { errors, ok: !Object.keys(errors).length };
}

/* Focus the first invalid control inside a form element */
export function focusFirstError(form, errors) {
  const first = Object.keys(errors)[0];
  const el = first && form && form.elements[first];
  if (el && el.focus) el.focus();
}

/* Card helpers — client-side format checks only; card data never leaves the page in this prototype */
export const card = {
  brand(num) {
    const n = String(num).replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
    if (/^35/.test(n)) return 'jcb';
    if (/^(62|81)/.test(n)) return 'unionpay';
    return n.length ? 'card' : '';
  },
  luhn(num) {
    const n = String(num).replace(/\D/g, ''); if (n.length < 12 || n.length > 19) return false;
    let sum = 0, dbl = false;
    for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (dbl) { d *= 2; if (d > 9) d -= 9; } sum += d; dbl = !dbl; }
    return sum % 10 === 0;
  },
  format(num) {
    const n = String(num).replace(/\D/g, '').slice(0, 19);
    return card.brand(n) === 'amex' ? n.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : n.replace(/(\d{4})(?=\d)/g, '$1 ');
  },
  expiryOk(v) {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(v).trim()); if (!m) return false;
    const mo = +m[1], yr = 2000 + +m[2]; if (mo < 1 || mo > 12) return false;
    const now = new Date(); return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1);
  }
};
