import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Field, Check, FitImage } from '../components/common.jsx';
import { Button, Alert, useUI } from '../components/ui.jsx';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { errorText } from '../lib/format.js';
import { V } from '../lib/validate.js';
import { useForm } from '../lib/useForm.js';
import { navigate, safeNext, useTitle } from '../lib/router.js';

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
  useEffect(() => { if (to) location.replace(location.href.split('#')[0] + to); }, [to]);
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
  const redirecting = useRedirect(S.user() ? (safeNext(q.next) || (S.isAdmin() ? '#/admin' : '#/account')) : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { email: [V.required, V.email], password: [V.required] });
    if (!d) return;
    setBusy(true);
    S.login(d.email, d.password).then(u => {
      ui.toast(t('auth.welcome', { name: u.name || u.email }), 'success');
      navigate(safeNext(q.next) || (u.role === 'admin' ? '#/admin' : '#/account'));
    }).catch(err => { setBusy(false); f.setAlert({ type: 'error', msg: errorText(err) }); form.elements.password.value = ''; form.elements.password.focus(); });
  };
  return (
    <AuthShell title={t('auth.welcomeBack')} sub={t('auth.loginSub')}>
      <form data-login noValidate onSubmit={submit}>
        {q.reason && <Alert type="info">{t('auth.reason.' + q.reason)}</Alert>}
        {f.alert && <Alert className="form-alert">{f.alert.msg}</Alert>}
        <Field name="email" label={t('form.email')} type="email" required autoComplete="email" defaultValue={q.email || ''} error={f.errors.email} onClear={f.clear} />
        <Field name="password" label={t('form.password')} type="password" required autoComplete="current-password" error={f.errors.password} onClear={f.clear} />
        <div className="row-between"><span /><a href="#/reset" className="small">{t('auth.forgot')}</a></div>
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.signingIn')}>{t('nav.login')}</Button>
        <p className="center muted">{t('auth.noAccount')} <a href={`#/register${q.next ? '?next=' + encodeURIComponent(q.next) : ''}`}>{t('auth.createAccount')}</a></p>
        <details className="demo-note"><summary><Icon name="info" /> {t('auth.demoTitle')}</summary>
          <p>{t('auth.demoCustomer')}: <code>demo@ozonescents.com</code> / <code>Demo@123</code></p>
          <p>{t('auth.demoAdmin')}: <code>admin@ozonescents.com</code> / <code>Admin@123</code></p>
        </details>
      </form>
    </AuthShell>
  );
}

export function Register({ q }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [termsErr, setTermsErr] = useState('');
  const redirecting = useRedirect(S.user() ? '#/account' : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { name: [V.required, V.min(2)], email: [V.required, V.email], password: [V.required, V.password], confirm: [V.required, (v, all) => v === all.password ? '' : t('val.match')] });
    setTermsErr(form.elements.terms.checked ? '' : t('val.terms'));
    if (!d) return;
    if (!form.elements.terms.checked) { form.elements.terms.focus(); return; }
    setBusy(true);
    S.register({ email: d.email, password: d.password, name: d.name }).then(() => {
      if (d.newsletter) S.updatePrefs({ newsletter: true });
      ui.toast(t('auth.created'), 'success');
      navigate('#/verify' + (q.next ? '?next=' + encodeURIComponent(q.next) : ''));
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
        <Check name="terms" onChange={() => termsErr && setTermsErr('')}><span>{t('auth.agree')} <a href="#/policies/terms">{t('policy.terms')}</a> &amp; <a href="#/policies/privacy">{t('policy.privacy')}</a></span></Check>
        <p className="err" role="alert">{termsErr}</p>
        <Check name="newsletter" label={t('ck.newsletter')} />
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.creating')}>{t('auth.createAccount')}</Button>
        <p className="center muted">{t('auth.haveAccount')} <a href={`#/login${q.next ? '?next=' + encodeURIComponent(q.next) : ''}`}>{t('nav.login')}</a></p>
      </form>
    </AuthShell>
  );
}

export function Verify({ q }) {
  const ui = useUI();
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const u = S.user();
  const redirecting = useRedirect(!u ? '#/login' : u.verified ? (safeNext(q.next) || '#/account') : null);
  if (redirecting) return null;
  const submit = e => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = f.validate(form, { code: [V.required, V.code] }); if (!d) return;
    setBusy(true);
    S.verify(d.code).then(() => { ui.toast(t('auth.verified'), 'success'); navigate(safeNext(q.next) || '#/account'); })
      .catch(err => { setBusy(false); f.setErrors({ code: errorText(err) }); form.elements.code.focus(); });
  };
  return (
    <AuthShell title={t('auth.verifyTitle')} sub={t('auth.verifySub')}>
      <form data-verify noValidate onSubmit={submit}>
        <Alert type="info" icon="mail">{t('auth.verifySent', { email: u.email })}<br /><small>{t('auth.demoCode')} <strong dir="ltr">{u.verifyCode}</strong></small></Alert>
        <Field name="code" label={t('auth.code')} required autoComplete="one-time-code" inputMode="numeric" maxLength={6} dir="ltr" className="code-field" error={f.errors.code} onClear={f.clear} />
        <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.verifying')}>{t('auth.verify')}</Button>
        <div className="row-between">
          <Button className="link-btn" busy={resending} onClick={() => { setResending(true); S.resendVerification().then(() => { setResending(false); ui.toast(t('auth.resent'), 'info'); }).catch(err => { setResending(false); ui.toast(errorText(err), 'error'); }); }}>{t('auth.resend')}</Button>
          <a href={safeNext(q.next) || '#/account'} className="small">{t('auth.later')}</a>
        </div>
      </form>
    </AuthShell>
  );
}

export function Reset() {
  const f = useForm();
  const ui = useUI();
  const [step, setStep] = useState({ n: 1 });
  const [busy, setBusy] = useState(false);
  const request = e => {
    e.preventDefault();
    const d = f.validate(e.currentTarget, { email: [V.required, V.email] }); if (!d) return;
    setBusy(true);
    S.requestReset(d.email).then(r => { setBusy(false); setStep({ n: 2, email: d.email, code: r.code }); })
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
          <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('auth.sending')}>{t('auth.sendCode')}</Button>
          <p className="center"><a href="#/login">{t('auth.backToLogin')}</a></p>
        </form>
      )}
      {step.n === 2 && (
        <form noValidate onSubmit={confirm}>
          <Alert type="success" icon="mail">{t('auth.resetSent', { email: step.email })}{step.code && <><br /><small>{t('auth.demoCode')} <strong dir="ltr">{step.code}</strong></small></>}</Alert>
          <Field name="code" label={t('auth.code')} required autoComplete="one-time-code" inputMode="numeric" maxLength={6} dir="ltr" className="code-field" error={f.errors.code} onClear={f.clear} autoFocus />
          <PasswordWithMeter f={f} label={t('auth.newPassword')} />
          <Field name="confirm" label={t('form.confirmPassword')} type="password" required autoComplete="new-password" error={f.errors.confirm} onClear={f.clear} />
          <Button type="submit" className="btn btn-primary btn-block btn-lg" busy={busy} busyLabel={t('common.saving')}>{t('auth.resetBtn')}</Button>
          <p className="center"><button type="button" className="link-btn" onClick={() => setStep({ n: 1 })}>{t('auth.useOtherEmail')}</button></p>
        </form>
      )}
      {step.n === 3 && (
        <div className="done-state"><Icon name="check" className="done-ic" /><h2>{t('auth.resetDone')}</h2><p className="muted">{t('auth.resetDoneText')}</p>
          <a className="btn btn-primary btn-block" href={`#/login?email=${encodeURIComponent(step.email)}`}>{t('nav.login')}</a></div>
      )}
    </AuthShell>
  );
}
