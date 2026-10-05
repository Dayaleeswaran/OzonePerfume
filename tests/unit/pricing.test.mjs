// Unit tests for the storefront pricing mirror (src/lib/pricing.js).
// Business values from Ozone_Scents_Production_Requirements_and_Flows.md (BR-SHIP, BR-GIFT, BR-PROMO, OD-003/004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, quoteShipping, findRule, qualifiesForFree, couponMinMet, applyTax, supportedCountries } from '../../src/lib/pricing.js';

const settings = { freeShippingThreshold: 250, freeShippingInclusive: false, vatRate: 5, taxMode: 'inclusive', giftWrap: { standard: 10, premium: 20, luxury: 35 } };
const rules = [
  { country: 'AE', method: 'standard', minWeight: 0, maxWeight: null, fee: 20, freeEligible: true, active: true },
  { country: 'AE', method: 'express', minWeight: 0, maxWeight: null, fee: 35, freeEligible: false, active: true },
  { country: 'SA', method: 'standard', minWeight: 0, maxWeight: 2, fee: 50, freeEligible: false, active: true },
  { country: 'SA', method: 'standard', minWeight: 2, maxWeight: null, fee: 80, freeEligible: false, active: true },
  { country: 'OM', method: 'standard', minWeight: 0, maxWeight: null, fee: 45, freeEligible: false, active: false }
];
const line = (unit, qty = 1, extra = {}) => ({ unit, compare: 0, qty, weight: 0, giftWrap: null, ...extra });

test('BR-SHIP-001/002: UAE standard AED 20, express AED 35', () => {
  assert.equal(quoteShipping(rules, settings, { country: 'AE', method: 'standard', amount: 100 }), 20);
  assert.equal(quoteShipping(rules, settings, { country: 'AE', method: 'express', amount: 100 }), 35);
});

test('BR-SHIP-003 / OD-004: free standard shipping strictly over AED 250 by default', () => {
  assert.equal(quoteShipping(rules, settings, { country: 'AE', method: 'standard', amount: 250 }), 20);
  assert.equal(quoteShipping(rules, settings, { country: 'AE', method: 'standard', amount: 250.01 }), 0);
  const inclusive = { ...settings, freeShippingInclusive: true };
  assert.equal(quoteShipping(rules, inclusive, { country: 'AE', method: 'standard', amount: 250 }), 0);
  assert.equal(qualifiesForFree(250, settings), false);
});

test('BR-SHIP-004: express never becomes free automatically', () => {
  assert.equal(quoteShipping(rules, settings, { country: 'AE', method: 'express', amount: 5000 }), 35);
});

test('FR-SHIP-009: country + weight bands; FR-SHIP-010 unsupported destinations rejected', () => {
  assert.equal(findRule(rules, 'SA', 'standard', 1.5).fee, 50);
  assert.equal(findRule(rules, 'SA', 'standard', 2).fee, 80);       // upper bound is exclusive
  assert.equal(quoteShipping(rules, settings, { country: 'SA', method: 'express', amount: 10 }), null);
  assert.equal(quoteShipping(rules, settings, { country: 'OM', method: 'standard', amount: 10 }), null);   // inactive rule
  assert.equal(quoteShipping(rules, settings, { country: 'US', method: 'standard', amount: 10 }), null);
  assert.deepEqual(supportedCountries(rules).sort(), ['AE', 'SA']);
});

test('BR-GIFT-002..004: gift wrap 10 / 20 / 35', () => {
  const tt = computeTotals({ lines: [line(100, 1, { giftWrap: 'standard' }), line(100, 1, { giftWrap: 'premium' }), line(100, 1, { giftWrap: 'luxury' })], settings, rules });
  assert.equal(tt.giftFee, 65);
});

test('BR-PROMO-003: LAUNCH20 only when subtotal is above AED 600', () => {
  const launch = { code: 'LAUNCH20', type: 'percent', value: 20, min: 600, minExclusive: true };
  assert.equal(couponMinMet(launch, 600), false);
  assert.equal(couponMinMet(launch, 600.01), true);
  const at600 = computeTotals({ lines: [line(600)], settings, rules, coupon: launch });
  assert.equal(at600.discount, 0);
  const at690 = computeTotals({ lines: [line(690)], settings, rules, coupon: launch });
  assert.equal(at690.discount, 138);
  assert.equal(at690.couponApplied, true);
});

test('BR-PROMO-001: WELCOME10 is 10% (first-order eligibility is enforced server-side)', () => {
  const welcome = { code: 'WELCOME10', type: 'percent', value: 10, min: 0, minExclusive: false };
  const tt = computeTotals({ lines: [line(270)], settings, rules, coupon: welcome });
  assert.equal(tt.discount, 27);
});

test('free-shipping threshold is measured after the discount', () => {
  const welcome = { code: 'WELCOME10', type: 'percent', value: 10, min: 0, minExclusive: false };
  const tt = computeTotals({ lines: [line(270)], settings, rules, coupon: welcome });   // 243 after discount
  assert.equal(tt.shipping, 20);
  assert.equal(tt.freeShip, false);
  assert.equal(tt.toFree, 7.01);
});

test('OD-003: VAT inclusive (extracted from total) vs exclusive (added on top)', () => {
  assert.deepEqual(applyTax(105, settings), { vat: 5, total: 105 });
  assert.deepEqual(applyTax(100, { ...settings, taxMode: 'exclusive' }), { vat: 5, total: 105 });
  const incl = computeTotals({ lines: [line(690)], settings, rules });
  assert.equal(incl.total, 690);
  assert.equal(incl.vat, 32.86);
  const excl = computeTotals({ lines: [line(690)], settings: { ...settings, taxMode: 'exclusive' }, rules });
  assert.equal(excl.vat, 34.5);
  assert.equal(excl.total, 724.5);
});

test('totals: savings from compare-at price, unavailable shipping flagged', () => {
  const tt = computeTotals({ lines: [line(230, 2, { compare: 280 })], settings, rules, country: 'US' });
  assert.equal(tt.savings, 100);
  assert.equal(tt.shippingAvailable, false);
});
