/* Cloudflare Turnstile CAPTCHA (SEC-015: bot protection on sign-up, login, password reset, contact, newsletter).

   - Site key: VITE_TURNSTILE_SITE_KEY (public). Without it the widget is not rendered and no token is sent,
     so local development works without Cloudflare.
   - Tokens are single-use: call reset() after every submit, whether it succeeded or not.
   - Verification happens on the server: Supabase Auth (Attack Protection) for auth forms, the public-forms
     Edge Function for contact/newsletter. The browser check here is only UX. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';

export const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const captchaEnabled = !!CAPTCHA_SITE_KEY;

let loader = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { loader = null; reject(new Error('turnstile load failed')); };
    document.head.appendChild(s);
  });
  return loader;
}

const Captcha = forwardRef(function Captcha({ onToken, action }, ref) {
  const box = useRef(null), widget = useRef(null), cb = useRef(onToken);
  const [failed, setFailed] = useState(false);
  cb.current = onToken;
  useImperativeHandle(ref, () => ({
    reset() { cb.current(''); if (widget.current != null && window.turnstile) window.turnstile.reset(widget.current); }
  }), []);
  useEffect(() => {
    if (!captchaEnabled) return undefined;
    let gone = false;
    loadTurnstile().then(ts => {
      if (gone || !box.current) return;
      widget.current = ts.render(box.current, {
        sitekey: CAPTCHA_SITE_KEY, action,
        language: S.session.lang === 'ar' ? 'ar' : S.session.lang === 'es' ? 'es' : 'en',
        appearance: 'interaction-only',               // invisible unless Cloudflare needs the visitor to click
        callback: token => cb.current(token),
        'expired-callback': () => cb.current(''),
        'error-callback': () => { cb.current(''); }
      });
    }).catch(() => !gone && setFailed(true));
    return () => { gone = true; if (widget.current != null && window.turnstile) { try { window.turnstile.remove(widget.current); } catch (e) { /* already gone */ } } widget.current = null; };
  }, [action]);
  if (!captchaEnabled) return null;
  return <div className="captcha">{failed ? <p className="err" role="alert">{t('captcha.loadFailed')}</p> : <div ref={box} />}</div>;
});

/* Form helper: const cap = useCaptcha('login'); … {cap.widget} … if (!cap.ready()) return; S.login(…, cap.token); cap.reset(); */
export function useCaptcha(action) {
  const [token, setToken] = useState('');
  const ref = useRef(null);
  return {
    token,
    widget: <Captcha ref={ref} onToken={setToken} action={action} />,
    ready: () => !captchaEnabled || !!token,
    reset: () => ref.current && ref.current.reset()
  };
}

export default Captcha;
