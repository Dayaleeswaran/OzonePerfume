/* Client error reporting (OBS-001/002).
   Errors are always logged to the console. To forward them to a monitoring service (e.g. Sentry, once chosen),
   load its browser SDK and assign a reporter: window.__ozReport = (error, context) => Sentry.captureException(error, { extra: context }).
   Only safe context is passed — never form values, tokens or payment data (SEC-016). */
export function reportError(error, context = {}) {
  console.error('[ozone]', context.where || 'error', error);
  try { if (typeof window !== 'undefined' && typeof window.__ozReport === 'function') window.__ozReport(error, { path: location.pathname, ...context }); }
  catch (e) { /* the reporter must never break the page */ }
}

let installed = false;
export function installGlobalHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => reportError(e.error || e.message, { where: 'window.error' }));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, { where: 'unhandledrejection' }));
}
