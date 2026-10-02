/* Ozone Perfume — translation lookup.
   Order: admin override (current lang) → dictionary (current lang) → English override → English → key.
   "{name}" placeholders are interpolated; "one|many" picks a form based on {n}. */
(function () {
  const dict = l => OZ.I18N[l] || {};
  const overrides = l => (OZ.store && OZ.store.db.translations && OZ.store.db.translations[l]) || {};

  function lookup(lang, key) {
    const o = overrides(lang), d = dict(lang);
    if (o[key] != null) return o[key];
    if (d[key] != null) return d[key];
    return null;
  }

  OZ.t = function (key, vars) {
    const lang = (OZ.store && OZ.store.session.lang) || 'en';
    let s = lookup(lang, key);
    if (s == null && lang !== 'en') s = lookup('en', key);
    if (s == null) return key;
    if (vars && s.includes('|') && vars.n != null) {
      const forms = s.split('|');
      s = Number(vars.n) === 1 ? forms[0] : forms[forms.length - 1];
    }
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
  };
  /* Raw text for the translations editor (no interpolation, no fallback) */
  OZ.t.raw = (lang, key) => { const v = lookup(lang, key); return v == null ? '' : v; };
})();
