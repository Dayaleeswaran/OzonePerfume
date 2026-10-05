/* Delivery information rendered from the shipping rules in the database (FR-SHIP-008: no hardcoded fees) */
import Icon from './Icon.jsx';
import { S } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { money, countryName } from '../lib/format.js';

/* Delivery-time text: the rule's own wording (admin, per language) or the storefront default */
export function shipEta(rule, method) {
  const lang = S.session.lang;
  return (rule && rule.eta && (rule.eta[lang] || rule.eta.en)) || t('ship.' + method + 'Eta');
}

/* "free on orders over AED 250" / "from AED 250" depending on the configured rule (OD-004) */
export function freeText() {
  const set = S.settings();
  return t(set.freeShippingInclusive ? 'ship.freeFrom' : 'ship.freeOver', { amount: money(set.freeShippingThreshold) });
}

export default function ShippingInfo() {
  const std = S.shipRule('AE', 'standard'), exp = S.shipRule('AE', 'express');
  const others = S.shipCountries().filter(c => c !== 'AE');
  return (
    <div className="ship-grid">
      {std && <div><Icon name="truck" /><h3>{t('ship.standard')}</h3>
        <p>{t('ship.standardD', { eta: shipEta(std, 'standard'), fee: money(std.fee) })}{std.freeEligible ? ' ' + freeText() : ''}</p></div>}
      {exp && <div><Icon name="clock" /><h3>{t('ship.express')}</h3><p>{t('ship.expressD', { eta: shipEta(exp, 'express'), fee: money(exp.fee) })}</p></div>}
      <div><Icon name="globe" /><h3>{t('ship.gcc')}</h3>
        <p>{others.length ? t('ship.gccD', { countries: others.map(countryName).join(', ') }) : t('ship.gccPending')}</p></div>
    </div>
  );
}
