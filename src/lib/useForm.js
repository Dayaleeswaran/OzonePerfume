import { useCallback, useState } from 'react';
import { runRules, focusFirstError } from './validate.js';
import { t } from './i18n.js';

/* Minimal form state for uncontrolled forms: errors map + a top-level alert message */
export function useForm() {
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null); // { type, msg }

  const clear = useCallback(name => setErrors(e => { if (!e[name]) return e; const n = { ...e }; delete n[name]; return n; }), []);

  /* Reads FormData (checkboxes as booleans), runs rules; returns values or null */
  const validate = useCallback((form, rules) => {
    const values = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type=checkbox][name]').forEach(cb => { values[cb.name] = cb.checked; });
    const { errors: errs, ok } = runRules(values, rules);
    setErrors(errs);
    if (!ok) { focusFirstError(form, errs); setAlert({ type: 'error', msg: t('val.fixErrors'), quiet: true }); return null; }
    setAlert(null);
    return values;
  }, []);

  return { errors, setErrors, clear, validate, alert: alert && !alert.quiet ? alert : null, setAlert };
}
