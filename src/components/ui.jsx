/* App-wide UI services: toasts, screen-reader announcements, overlays (modal / drawer / search /
   lightbox) with focus trap + Escape + scroll lock, confirm dialogs and the global panels
   (cart drawer, search, mobile menu, gift modal) that any component can open. */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import { reducedMotion } from '../lib/format.js';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [live, setLive] = useState('');
  const [panel, setPanel] = useState(null);      // { kind: 'cart'|'search'|'menu'|'gift', ...props }
  const [dialog, setDialog] = useState(null);    // confirm dialog

  const dismiss = useCallback(id => setToasts(list => list.map(x => x.id === id ? { ...x, leaving: true } : x)), []);
  const toast = useCallback((msg, type = 'success', action) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(list => [...list, { id, msg, type, action }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4200);
  }, [dismiss]);
  const announce = useCallback(msg => { setLive(''); setTimeout(() => setLive(msg), 30); }, []);
  const confirm = useCallback((message, opts = {}) => new Promise(resolve => setDialog({ message, ...opts, resolve })), []);

  const api = useMemo(() => ({
    toast, announce, confirm, dismiss,
    openCart: (justAdded = false) => setPanel({ kind: 'cart', justAdded, key: Date.now() }),
    openSearch: (initial = '') => setPanel({ kind: 'search', initial }),
    openMenu: () => setPanel({ kind: 'menu' }),
    openGift: props => setPanel({ kind: 'gift', ...props }),
    closePanel: () => setPanel(null),
    panel
  }), [toast, announce, confirm, dismiss, panel]);

  return (
    <UICtx.Provider value={api}>
      {children}
      <div id="toasts" className="toasts">
        {toasts.map(x => <Toast key={x.id} toast={x} onDone={() => setToasts(l => l.filter(y => y.id !== x.id))} onClose={() => dismiss(x.id)} />)}
      </div>
      <div id="sr-live" className="sr-only" aria-live="polite" aria-atomic="true">{live}</div>
      {dialog && (
        <Overlay title={t('common.areYouSure')} size="sm" onClose={() => { dialog.resolve(false); setDialog(null); }}>
          {close => (<>
            <p className="muted">{dialog.message}</p>
            <div className="btn-row end">
              <button className="btn btn-ghost" onClick={() => close()}>{t('common.cancel')}</button>
              <button className={`btn ${dialog.danger === false ? 'btn-primary' : 'btn-danger'}`} onClick={() => { dialog.resolve(true); dialog.resolve = () => {}; close(); }}>{dialog.confirmLabel || t('common.confirm')}</button>
            </div>
          </>)}
        </Overlay>
      )}
    </UICtx.Provider>
  );
}

function Toast({ toast: x, onDone, onClose }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);
  useEffect(() => { if (x.leaving) { const h = setTimeout(onDone, 300); return () => clearTimeout(h); } }, [x.leaving, onDone]);
  const ic = x.type === 'error' ? 'alert' : x.type === 'info' ? 'info' : 'check';
  return (
    <div className={`toast toast-${x.type}${shown && !x.leaving ? ' in' : ''}`} role={x.type === 'error' ? 'alert' : 'status'}>
      <span className="toast-ic"><Icon name={ic} /></span>
      <span className="toast-msg">{x.msg}</span>
      {x.action && <a className="toast-act" href={x.action.href || '#'} onClick={e => { if (x.action.onClick) { e.preventDefault(); x.action.onClick(); } onClose(); }}>{x.action.label}</a>}
      <button className="toast-x" aria-label={t('a11y.dismiss')} onClick={onClose}><Icon name="close" /></button>
    </div>
  );
}

/* ---------------- Overlay ---------------- */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const stack = [];
const syncScrollLock = () => document.documentElement.classList.toggle('scroll-locked', stack.length > 0);

/* children may be a node or a render function receiving close() */
export function Overlay({ kind = 'modal', title, size = '', className = '', onClose, labelledBy, dismissible = true, children }) {
  const [shown, setShown] = useState(false);
  const panelRef = useRef(null);
  const closing = useRef(false);
  const token = useRef({});
  const tid = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    setTimeout(() => onCloseRef.current && onCloseRef.current(), reducedMotion() ? 0 : 300);
  }, []);

  useEffect(() => {
    const opener = document.activeElement;
    const me = token.current;
    stack.push(me); syncScrollLock();
    const r = requestAnimationFrame(() => {
      setShown(true);
      const panel = panelRef.current;
      const auto = panel && (panel.querySelector('[autofocus]') || panel.querySelector('.ov-body ' + FOCUSABLE) || panel);
      setTimeout(() => auto && auto.focus({ preventScroll: true }), 60);
    });
    const onKey = e => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape' && dismissible) { e.preventDefault(); close(); }
      if (e.key === 'Tab' && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(r);
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(me); if (i >= 0) stack.splice(i, 1);
      syncScrollLock();
      if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [close, dismissible]);

  const body = typeof children === 'function' ? children(close) : children;
  return createPortal(
    <OverlayCtx.Provider value={close}>
      <div className={`ov ov-${kind} ${className}${shown ? ' in' : ''}`}>
        <div className="ov-backdrop" onClick={() => dismissible && close()} />
        <div className={`ov-panel ${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || tid} tabIndex={-1} ref={panelRef}>
          {title != null && (
            <header className="ov-head">
              <h2 id={tid} className="ov-title">{title}</h2>
              {dismissible && <button className="icon-btn ov-x" onClick={close} aria-label={t('a11y.close')}><Icon name="close" /></button>}
            </header>
          )}
          <div className="ov-body">{body}</div>
        </div>
      </div>
    </OverlayCtx.Provider>,
    document.body
  );
}
const OverlayCtx = createContext(() => {});
export const useOverlayClose = () => useContext(OverlayCtx);

/* ---------------- small building blocks ---------------- */
export const Spinner = ({ big }) => <span className={big ? 'big-spinner' : 'spinner'} aria-hidden="true" />;

/* Button that shows a spinner + label while `busy` */
export function Button({ busy, busyLabel, children, className = 'btn btn-primary', type = 'button', disabled, ...rest }) {
  return (
    <button type={type} className={`${className}${busy ? ' is-busy' : ''}`} disabled={busy || disabled} aria-busy={busy || undefined} {...rest}>
      {busy ? <><Spinner /><span>{busyLabel || t('common.loading')}</span></> : children}
    </button>
  );
}

export function Alert({ type = 'error', icon, children, className = '' }) {
  return (
    <div className={`alert alert-${type} ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={icon || (type === 'error' ? 'alert' : type === 'info' ? 'info' : type === 'warn' ? 'mail' : 'check')} />
      <span>{children}</span>
    </div>
  );
}
