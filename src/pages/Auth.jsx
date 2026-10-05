import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Field, Check, FitImage } from '../components/common.jsx';
import { Button, Alert, useUI } from '../components/ui.jsx';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { errorText } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { navigate, redirectTo, safeNext, useTitle } from '../lib/router.js';
import { useCaptcha } from '../components/Captcha.jsx';

function AuthShell({ title, sub, children }) {
  const h1 = useRef(null);
  useTitle(title);
  useEffect(() => { h1.current && h1.current.focus({ preventScroll: true }); }, []);
  return (
    <section className="auth container">
      <div className="auth-card card">
        <h1 className="page-title left sm" tabIndex={-1} ref={h1}>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
      <div className="auth-aside" aria-hidden="true">
        <FitImage k="oil-versace-hotel-2" sizes="40vw" />
        <div className="auth-aside-copy"><p className="logo-word light">OZONE</p><p className="logo-sub light">SCENTS</p><p>{t('brand.tagline')}</p></div>
      </div>
    </section>
  );
}

/* Redirect helper for pages that shouldn't show to signed-in users */
function useRedirect(to) {
  useEffect(() => { if (to) redirectTo(to); }, [to]);
  return !!to;
}

function strength(pw) {
  let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
function PasswordWithMeter({ f, label, name = 'password' }) {
  const [pw, setPw] = useState('');
  const level = pw ? strength(pw) : 0;
  return (<>
    <Field name={name} label={label} type="password" required autoComplete="new-password" hint={t('val.passwordHint')} error={f.errors[name]} onClear={f.clear} onChange={e => setPw(e.target.value)} />
    <div className="strength" data-level={level} aria-live="polite"><i /><i /><i /><i /><span>{pw ? t('pw.s' + level) : ''}</span></div>
  </>);
}

export function Login({ q }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const cap = useCaptcha('login');
  const redirecting = useRedirect(S.user() ? (safeNext(q.next) || (S.isAdmin() ? '/admin' : '/account')) : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { email: [V.required, V.email], password: [V.required] });
    if (!d) return;
    if (!cap.ready()) { f.setAlert({ type: 'error', msg: t('captcha.wait') }); return; }
    setBusy(true);
    const token = cap.token; cap.reset();
    S.login(d.email, d.password, token).then(u => {
      ui.toast(t('auth.welcome', { name: u.name || u.email }), 'success');
      navigate(safeNext(q.next) || (u.role === 'admin' ? '/admin' : '/account'));
    }).catch(err => {
      setBusy(false);
      if (err.code === 'notConfirmed') { navigate('/verify' + (q.next ? '?next=' + encodeURIComponent(q.next) : '')); return; }
      f.setAlert({ type: 'error', msg: errorText(err) }); form.elements.password.value = ''; form.elements.password.focus();
    });
  };
  return (
    <AuthShell title={t('auth.welcomeBack')} sub={t('auth.loginSub')}>
      <form data-login noValidate onSubmit={submit}>
        {q.reason && <Alert type="info">{t('auth.reason.' + q.reason)}</Alert>}
        {f.alert && <Alert className="form-alert">{f.alert.msg}</Alert>}
        <Field name="email" label={t('form.email')} type="email" required autoComplete="email" defaultValue={q.email || ''} error={f.errors.email} onClear={f.clear} />
        <Field name="password" label={t('form.password')} type="password" required autoComplete="current-password" error={f.errors.password} onClear={f.clear} />
        <div className="row-between"><span /><a href="/reset" className="small">{t('auth.forgot')}</a></div>
        {cap.widget}
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.signingIn')}>{t('nav.login')}</Button>
        <p className="center muted">{t('auth.noAccount')} <a href={`/register${q.next ? '?next=' + encodeURIComponent(q.next) : ''}`}>{t('auth.createAccount')}</a></p>
        {import.meta.env.DEV && <details className="demo-note"><summary><Icon name="info" /> {t('auth.demoTitle')}</summary>
          <p>{t('auth.demoCustomer')}: <code>demo@ozonescents.com</code> / <code>Demo@123</code></p>
          <p>{t('auth.demoAdmin')}: <code>admin@ozonescents.com</code> / <code>Admin@123</code></p>
        </details>}
      </form>
    </AuthShell>
  );
}

export function Register({ q }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [termsErr, setTermsErr] = useState('');
  const cap = useCaptcha('signup');
  const redirecting = useRedirect(S.user() ? '/account' : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { name: [V.required, V.min(2)], email: [V.required, V.email], password: [V.required, V.password], confirm: [V.required, (v, all) => v === all.password ? '' : t('val.match')] });
    setTermsErr(form.elements.terms.checked ? '' : t('val.terms'));
    if (!d) return;
    if (!form.elements.terms.checked) { form.elements.terms.focus(); return; }
    if (!cap.ready()) { f.setAlert({ type: 'error', msg: t('captcha.wait') }); return; }
    setBusy(true);
    const token = cap.token; cap.reset();
    S.register({ email: d.email, password: d.password, name: d.name, newsletter: !!d.newsletter, captchaToken: token }).then(res => {
      ui.toast(t('auth.created'), 'success');
      navigate(res.needsVerification ? '/verify' + (q.next ? '?next=' + encodeURIComponent(q.next) : '') : (safeNext(q.next) || '/account'));
    }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); if (err.code === 'exists') form.elements.email.focus(); });
  };
  return (
    <AuthShell title={t('auth.createAccount')} sub={t('auth.registerSub')}>
      <form data-register noValidate onSubmit={submit}>
        {f.alert && <Alert className="form-alert">{f.alert.msg}</Alert>}
        <Field name="name" label={t('form.fullName')} required autoComplete="name" error={f.errors.name} onClear={f.clear} />
        <Field name="email" label={t('form.email')} type="email" required autoComplete="email" defaultValue={q.email || ''} error={f.errors.email} onClear={f.clear} />
        <PasswordWithMeter f={f} label={t('form.password')} />
        <Field name="confirm" label={t('form.confirmPassword')} type="password" required autoComplete="new-password" error={f.errors.confirm} onClear={f.clear} />
        <Check name="terms" onChange={() => termsErr && setTermsErr('')}><span>{t('auth.agree')} <a href="/policies/terms">{t('policy.terms')}</a> &amp; <a href="/policies/privacy">{t('policy.privacy')}</a></span></Check>
        <p className="err" role="alert">{termsErr}</p>
        <Check name="newsletter" label={t('ck.newsletter')} />
        {cap.widget}
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.creating')}>{t('auth.createAccount')}</Button>
        <p className="center muted">{t('auth.haveAccount')} <a href={`/login${q.next ? '?next=' + encodeURIComponent(q.next) : ''}`}>{t('nav.login')}</a></p>
      </form>
    </AuthShell>
  );
}

export function Verify({ q }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const cap = useCaptcha('resend');
  const u = S.user();
  const email = (u && u.email) || S.session.pendingEmail;
  const redirecting = useRedirect(u && u.verified ? (safeNext(q.next) || '/account') : !email ? '/login' : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { code: [V.required, V.code] }); if (!d) return;
    setBusy(true);
    S.verify(d.code, email).then(() => { ui.toast(t('auth.verified'), 'success'); navigate(safeNext(q.next) || '/account'); })
      .catch(err => { setBusy(false); f.setErrors({ code: errorText(err) }); form.elements.code.focus(); });
  };
  return (
    <AuthShell title={t('auth.verifyTitle')} sub={t('auth.verifySub')}>
      <form data-verify noValidate onSubmit={submit}>
        <Alert type="info" icon="mail">{t('auth.verifySent', { email })}<br /><small>{t('auth.checkSpam')}</small></Alert>
        {/* until the 6-digit code template is active, the email may contain a link instead */}
        <p className="muted small">{t('auth.verifyLink')} <a href={`/login?email=${encodeURIComponent(email || '')}${q.next ? '&next=' + encodeURIComponent(q.next) : ''}`}>{t('auth.verifyLinkLogin')}</a></p>
        <Field name="code" label={t('auth.code')} required autoComplete="one-time-code" inputMode="numeric" maxLength={6} dir="ltr" className="code-field" error={f.errors.code} onClear={f.clear} />
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.verifying')}>{t('auth.verify')}</Button>
        <div className="row-between">
          <Button className="link-btn" busy={resending} onClick={() => { if (!cap.ready()) { ui.toast(t('captcha.wait'), 'info'); return; } setResending(true); const token = cap.token; cap.reset(); S.resendVerification(email, token).then(() => { setResending(false); ui.toast(t('auth.resent'), 'info'); }).catch(err => { setResending(false); ui.toast(errorText(err), 'error'); }); }}>{t('auth.resend')}</Button>
          {u && <a href={safeNext(q.next) || '/account'} className="small">{t('auth.later')}</a>}
        </div>
        {cap.widget}
      </form>
    </AuthShell>
  );
}

export function Reset() {
  const f = useForm();
  const ui = useUI();
  const [step, setStep] = useState({ n: 1 });
  const [busy, setBusy] = useState(false);
  const cap = useCaptcha('reset');
  const request = e => {
    e.preventDefault();
    const d = f.validate(e.currentTarget, { email: [V.required, V.email] }); if (!d) return;
    if (!cap.ready()) { f.setAlert({ type: 'error', msg: t('captcha.wait') }); return; }
    setBusy(true);
    const token = cap.token; cap.reset();
    S.requestReset(d.email, token).then(() => { setBusy(false); setStep({ n: 2, email: d.email }); })
      .catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); });
  };
  const confirm = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { code: [V.required, V.code], password: [V.required, V.password], confirm: [V.required, (v, all) => v === all.password ? '' : t('val.match')] }); if (!d) return;
    setBusy(true);
    S.resetPassword(step.email, d.code, d.password).then(() => { setBusy(false); setStep({ n: 3, email: step.email }); ui.announce(t('auth.resetDone')); })
      .catch(err => { setBusy(false); f.setErrors({ code: errorText(err) }); form.elements.code.focus(); });
  };
  return (
    <AuthShell title={t('auth.resetTitle')} sub={t('auth.resetSub')}>
      {step.n === 1 && (
        <form noValidate onSubmit={request}>
          {f.alert && <Alert>{f.alert.msg}</Alert>}
          <Field name="email" label={t('form.email')} type="email" required autoComplete="email" error={f.errors.email} onClear={f.clear} />
          {cap.widget}
          <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.sending')}>{t('auth.sendCode')}</Button>
          <p className="center"><a href="/login">{t('auth.backToLogin')}</a></p>
        </form>
      )}
      {step.n === 2 && (
        <form noValidate onSubmit={confirm}>
          <Alert type="success" icon="mail">{t('auth.resetSent', { email: step.email })}<br /><small>{t('auth.checkSpam')}</small></Alert>
          <Field name="code" label={t('auth.code')} required autoComplete="one-time-code" inputMode="numeric" maxLength={6} dir="ltr" className="code-field" error={f.errors.code} onClear={f.clear} autoFocus />
          <PasswordWithMeter f={f} label={t('auth.newPassword')} />
          <Field name="confirm" label={t('form.confirmPassword')} type="password" required autoComplete="new-password" error={f.errors.confirm} onClear={f.clear} />
          <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('common.saving')}>{t('auth.resetBtn')}</Button>
          <p className="center"><button type="button" className="link-btn" onClick={() => setStep({ n: 1 })}>{t('auth.useOtherEmail')}</button></p>
        </form>
      )}
      {step.n === 3 && (
        <div className="done-state"><Icon name="check" className="done-ic" /><h2>{t('auth.resetDone')}</h2><p className="muted">{t('auth.resetDoneText')}</p>
          <a className="btn btn-primary btn-block" href={`/login?email=${encodeURIComponent(step.email)}`}>{t('nav.login')}</a></div>
      )}
    </AuthShell>
  );
}
