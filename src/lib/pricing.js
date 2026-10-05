/* Pricing rules shared by the storefront display and the unit tests.

   These mirror the database functions create_order(), shipping_quote() and coupon_lookup().
   The database is authoritative (BR-PRICE-002): values computed here are for display only and
   are recalculated server-side when the order is created. Keep both in step when rules change. */

export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* Free-shipping test: "over AED 250" is strict unless the store is set to inclusive (OD-004) */
export function qualifiesForFree(amount, settings) {
  return settings.freeShippingInclusive ? amount >= settings.freeShippingThreshold : amount > settings.freeShippingThreshold;
}

/* The active rule for a country/method/weight (heaviest matching band wins), or null if we don't ship there */
export function findRule(rules, country, method, weight = 0) {
  const w = Number(weight) || 0;
  return (rules || [])
    .filter(r => r.active !== false && r.country === String(country || '').toUpperCase() && r.method === method
      && w >= r.minWeight && (r.maxWeight == null || w < r.maxWeight))
    .sort((a, b) => b.minWeight - a.minWeight)[0] || null;
}

/* Fee for one method, or null when unavailable (FR-SHIP-010) */
export function quoteShipping(rules, settings, { country, method, weight = 0, amount = 0, forceFree = false }) {
  const r = findRule(rules, country, method, weight);
  if (!r) return null;
  if (r.freeEligible && (forceFree || qualifiesForFree(amount, settings))) return 0;
  return r.fee;
}

/* Countries that have at least one active rule */
export const supportedCountries = rules => [...new Set((rules || []).filter(r => r.active !== false).map(r => r.country))];

/* Does the coupon's minimum apply to this subtotal? (min_exclusive = strictly above) */
export function couponMinMet(coupon, subtotal) {
  if (!coupon) return false;
  return coupon.minExclusive ? subtotal > coupon.min : subtotal >= coupon.min;
}

/* VAT split for the configured mode (OD-003): inclusive prices contain VAT, exclusive prices get VAT added */
export function applyTax(taxable, settings) {
  const rate = Number(settings.vatRate) || 0;
  if (settings.taxMode === 'exclusive') {
    const vat = round2(taxable * rate / 100);
    return { vat, total: round2(taxable + vat) };
  }
  return { vat: round2(taxable * rate / (100 + rate)), total: round2(taxable) };
}

/* Full order totals.
   lines: [{ unit, compare, qty, weight, giftWrap }]  (giftWrap = 'standard'|'premium'|'luxury'|null) */
export function computeTotals({ lines, settings, rules, coupon = null, country = 'AE', method = 'standard' }) {
  const subtotal = round2(lines.reduce((a, l) => a + l.unit * l.qty, 0));
  const savings = round2(lines.reduce((a, l) => a + Math.max(0, (l.compare || 0) - l.unit) * l.qty, 0));
  const weight = lines.reduce((a, l) => a + (Number(l.weight) || 0) * l.qty, 0);
  const giftFee = round2(lines.reduce((a, l) => a + (l.giftWrap ? Number(settings.giftWrap[l.giftWrap] || 0) : 0), 0));

  let discount = 0, forceFree = false;
  const couponOk = couponMinMet(coupon, subtotal);
  if (coupon && couponOk) {
    if (coupon.type === 'percent') discount = round2(subtotal * coupon.value / 100);
    else if (coupon.type === 'fixed') discount = Math.min(coupon.value, subtotal);
    else if (coupon.type === 'ship') forceFree = true;
  }
  const afterDiscount = round2(subtotal - discount);
  const fee = lines.length ? quoteShipping(rules, settings, { country, method, weight, amount: afterDiscount, forceFree }) : 0;
  const shippingAvailable = fee !== null;
  const shipping = fee || 0;
  const taxable = Math.max(0, round2(afterDiscount + giftFee + shipping));
  const { vat, total } = applyTax(taxable, settings);

  const std = findRule(rules, country, 'standard', weight);
  const freeShip = !!std && std.freeEligible && (forceFree || qualifiesForFree(afterDiscount, settings));
  /* amount still needed for free standard delivery ("over" a threshold needs one fils more than it) */
  const toFree = !std || !std.freeEligible || freeShip ? 0
    : Math.max(0, settings.freeShippingThreshold - afterDiscount + (settings.freeShippingInclusive ? 0 : 0.01));

  return { subtotal, savings, discount, couponApplied: !!(coupon && couponOk), giftFee, shipping, shippingAvailable, method, country,
    weight, vat, total, taxMode: settings.taxMode, toFree: round2(toFree), freeShip };
}
