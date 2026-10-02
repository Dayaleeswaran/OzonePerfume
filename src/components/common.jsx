import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import { imgSrc, reducedMotion, debounce } from '../lib/format.js';

/* Responsive product image from public/assets/img */
export function Img({ k, alt = '', size = 'sm', eager = false, sizes, className = '' }) {
  const { src, srcSet } = imgSrc(k, size);
  return <img src={src} srcSet={srcSet} sizes={sizes || (size === 'lg' ? '(max-width: 900px) 100vw, 55vw' : '(max-width: 600px) 50vw, 25vw')}
    alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" width="640" height="640" />;
}

/* Shows the whole photo inside any frame shape: a blurred, cropped copy fills the frame
   and the full image sits on top with object-fit: contain, so nothing important is cut off. */
export function FitImage({ k, alt = '', size = 'lg', eager, sizes, className = '' }) {
  const { src, srcSet } = imgSrc(k, size);
  return (
    <span className={`fit-img ${className}`}>
      <img className="fit-bg" src={imgSrc(k, 'sm').src} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} />
      <img className="fit-fg" src={src} srcSet={srcSet} sizes={sizes || '100vw'} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </span>
  );
}

export function Stars({ rating, lg }) {
  const pct = Math.max(0, Math.min(100, rating / 5 * 100));
  const row = [0, 1, 2, 3, 4].map(i => <Icon key={i} name="star" />);
  return (
    <span className={`stars${lg ? ' lg' : ''}`} role="img" aria-label={t('a11y.rating', { n: rating })}>
      <span className="stars-bg">{row}</span>
      <span className="stars-fg" style={{ width: pct + '%' }}>{row}</span>
    </span>
  );
}

export function Qty({ value, max = 99, onChange, label, disabled }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = v => { const n = parseInt(v, 10); if (isNaN(n) || n < 1) { setDraft(String(value)); return; } onChange(Math.min(max, n)); };
  return (
    <div className="qty" role="group" aria-label={label || t('cart.quantity')}>
      <button type="button" className="qty-btn" aria-label={t('a11y.decrease')} disabled={disabled} onClick={() => onChange(value - 1)}><Icon name="minus" /></button>
      <input type="number" inputMode="numeric" min="1" max={max} value={draft} aria-label={t('cart.quantity')} disabled={disabled}
        onChange={e => setDraft(e.target.value)} onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); } }} />
      <button type="button" className="qty-btn" aria-label={t('a11y.increase')} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Icon name="plus" /></button>
    </div>
  );
}

/* Labelled form control with hint + error wiring (uncontrolled; read values with FormData) */
export function Field({ name, label, type = 'text', defaultValue = '', required, options, hint, error, rows, autoComplete, placeholder, onClear, className = '', ...rest }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const describe = `${id}-err${hint ? ' ' + id + '-hint' : ''}`;
  const common = { id, name, required, 'aria-required': required || undefined, 'aria-invalid': error ? 'true' : 'false', 'aria-describedby': describe, onInput: () => error && onClear && onClear(name), ...rest };
  let control;
  if (options) control = <select defaultValue={defaultValue} {...common}>{options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select>;
  else if (type === 'textarea') control = <textarea rows={rows || 4} defaultValue={defaultValue} autoComplete={autoComplete} placeholder={placeholder} {...common} />;
  else control = <input type={type === 'password' && show ? 'text' : type} defaultValue={defaultValue} autoComplete={autoComplete} placeholder={placeholder} {...common} />;
  return (
    <div className={`field ${className}${error ? ' invalid' : ''}${type === 'password' ? ' has-toggle' : ''}`}>
      <label htmlFor={id}>{label}{!required && <> <span className="opt">{t('common.optional')}</span></>}</label>
      <div className="control">
        {control}
        {type === 'password' && (
          <button type="button" className="pw-toggle" aria-pressed={show} aria-label={t(show ? 'a11y.hidePassword' : 'a11y.showPassword')} onClick={() => setShow(s => !s)}>
            <Icon name={show ? 'eyeOff' : 'eye'} />
          </button>
        )}
      </div>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <p className="err" id={`${id}-err`} role="alert">{error || ''}</p>
    </div>
  );
}

export function Check({ name, label, defaultChecked, checked, onChange, disabled, value, className = '', children, ...rest }) {
  return (
    <label className={`check ${className}`}>
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} checked={checked} onChange={onChange} disabled={disabled} {...rest} />
      <span className="box" aria-hidden="true"><Icon name="check" /></span>
      {label != null && <span>{label}</span>}
      {children}
    </label>
  );
}

export function Switch({ name, checked, defaultChecked, onChange, label, disabled }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" name={name} checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} aria-label={label} />
      <span aria-hidden="true" />
    </span>
  );
}

export function Empty({ ic = 'box', title, text, children, compact }) {
  return (
    <div className={`empty${compact ? ' compact' : ''}`}>
      <Icon name={ic} className="empty-ic" />
      {compact ? <h3>{title}</h3> : <h2>{title}</h2>}
      {text && <p>{text}</p>}
      {children && <div className="btn-row center">{children}</div>}
    </div>
  );
}

export function SectionHead({ title, eyebrow, sub, link, linkLabel, icon, left }) {
  return (
    <div className={`sec-head reveal${left ? ' left' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="sec-title">{title}{icon && <Icon name={icon} className="sec-ic" />}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
      {link && <a className="link-arrow" href={link}>{linkLabel || t('common.viewAll')} <Icon name="arrowRight" className="flip" /></a>}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs container" aria-label={t('a11y.breadcrumb')}>
      <ol>{items.map(([href, label], i) => i === items.length - 1
        ? <li key={i} aria-current="page">{label}</li>
        : <li key={i}><a href={href}>{label}</a></li>)}</ol>
    </nav>
  );
}

export function PayMarks() {
  return (
    <span className="paymarks" aria-label={t('pay.accepted')}>
      <span className="pm pm-visa" title="Visa">VISA</span>
      <span className="pm pm-mc" title="Mastercard"><i /><i /></span>
      <span className="pm pm-amex" title="American Express">AMEX</span>
      <span className="pm pm-crypto" title={t('pay.crypto')}><Icon name="crypto" /></span>
    </span>
  );
}

/* Horizontal scroll-snap carousel with prev/next buttons (RTL aware) */
export function Carousel({ id, label, children }) {
  const track = useRef(null);
  const [state, setState] = useState({ prev: true, next: false, none: false });
  useEffect(() => {
    const el = track.current; if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth - 2, x = Math.abs(el.scrollLeft);
      setState({ prev: x <= 2, next: x >= max, none: max <= 0 });
    };
    const onScroll = debounce(update, 60), onResize = debounce(update, 150);
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, [children]);
  const go = dir => {
    const el = track.current, card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : 300;
    const rtl = document.documentElement.dir === 'rtl';
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(el.clientWidth / step)) * (rtl ? -1 : 1), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  return (
    <div className={`carousel${state.none ? ' no-scroll' : ''}`} id={id}>
      <button className="car-btn prev" disabled={state.prev} onClick={() => go(-1)} aria-label={t('a11y.prev')} aria-controls={`${id}-track`}><Icon name="chevLeft" className="flip" /></button>
      <div className="car-track" id={`${id}-track`} tabIndex={0} role="region" aria-label={label} ref={track}>{children}</div>
      <button className="car-btn next" disabled={state.next} onClick={() => go(1)} aria-label={t('a11y.next')} aria-controls={`${id}-track`}><Icon name="chevRight" className="flip" /></button>
    </div>
  );
}
