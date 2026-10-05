/* Transactional order email templates (EMAIL-001..004). One place for wording, in en / es / ar.
   Only customer-safe data is used: no card data, no internal ids or tokens. */

type Lang = 'en' | 'es' | 'ar';
export type Kind = 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled' | 'order_refunded';

const S: Record<Lang, Record<string, string>> = {
  en: {
    order_confirmed: 'Order {id} confirmed', order_confirmed_p: 'Thank you for your order. Your payment has been received and we are preparing your items.',
    order_shipped: 'Order {id} is on its way', order_shipped_p: 'Good news — your order has been shipped.',
    order_delivered: 'Order {id} delivered', order_delivered_p: 'Your order has been delivered. We hope you enjoy it.',
    order_cancelled: 'Order {id} cancelled', order_cancelled_p: 'Your order has been cancelled. If you were charged, the refund will be processed to your original payment method.',
    order_refunded: 'Order {id} refunded', order_refunded_p: 'Your refund has been issued to your original payment method. Timing depends on your bank or card provider.',
    hi: 'Hello {name},', items: 'Items', qty: 'Qty', subtotal: 'Subtotal', discount: 'Discount', gift: 'Gift wrapping', shipping: 'Delivery', free: 'Free',
    vatIncl: 'Includes VAT', vatAdd: 'VAT', total: 'Total', shipTo: 'Delivery address', view: 'View your order', help: 'Questions? Reply to this email or contact {email}.',
    footer: '{legal} · Sharjah Media City, UAE'
  },
  es: {
    order_confirmed: 'Pedido {id} confirmado', order_confirmed_p: 'Gracias por tu pedido. Hemos recibido el pago y estamos preparando tus artículos.',
    order_shipped: 'Tu pedido {id} está en camino', order_shipped_p: 'Buenas noticias: tu pedido ha sido enviado.',
    order_delivered: 'Pedido {id} entregado', order_delivered_p: 'Tu pedido ha sido entregado. Esperamos que lo disfrutes.',
    order_cancelled: 'Pedido {id} cancelado', order_cancelled_p: 'Tu pedido ha sido cancelado. Si se realizó un cobro, el reembolso se tramitará al método de pago original.',
    order_refunded: 'Pedido {id} reembolsado', order_refunded_p: 'Hemos emitido el reembolso a tu método de pago original. El plazo depende de tu banco o emisor.',
    hi: 'Hola, {name}:', items: 'Artículos', qty: 'Cant.', subtotal: 'Subtotal', discount: 'Descuento', gift: 'Envoltorio de regalo', shipping: 'Envío', free: 'Gratis',
    vatIncl: 'IVA incluido', vatAdd: 'IVA', total: 'Total', shipTo: 'Dirección de entrega', view: 'Ver tu pedido', help: '¿Preguntas? Responde a este correo o escribe a {email}.',
    footer: '{legal} · Sharjah Media City, EAU'
  },
  ar: {
    order_confirmed: 'تم تأكيد الطلب {id}', order_confirmed_p: 'شكراً لطلبك. تم استلام الدفع ونقوم بتجهيز منتجاتك.',
    order_shipped: 'طلبك {id} في الطريق', order_shipped_p: 'أخبار سارة — تم شحن طلبك.',
    order_delivered: 'تم توصيل الطلب {id}', order_delivered_p: 'تم توصيل طلبك. نتمنى أن ينال إعجابك.',
    order_cancelled: 'تم إلغاء الطلب {id}', order_cancelled_p: 'تم إلغاء طلبك. إذا تم خصم أي مبلغ فسيُعاد إلى وسيلة الدفع الأصلية.',
    order_refunded: 'تم استرداد مبلغ الطلب {id}', order_refunded_p: 'تم إصدار المبلغ المسترد إلى وسيلة الدفع الأصلية. تعتمد المدة على البنك أو مزوّد البطاقة.',
    hi: 'مرحباً {name}،', items: 'المنتجات', qty: 'الكمية', subtotal: 'المجموع الفرعي', discount: 'الخصم', gift: 'تغليف الهدايا', shipping: 'التوصيل', free: 'مجاني',
    vatIncl: 'تشمل ضريبة القيمة المضافة', vatAdd: 'ضريبة القيمة المضافة', total: 'الإجمالي', shipTo: 'عنوان التوصيل', view: 'عرض طلبك', help: 'لديك أسئلة؟ رد على هذه الرسالة أو تواصل عبر {email}.',
    footer: '{legal} · مدينة الشارقة للإعلام، الإمارات'
  }
};

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fill = (s: string, vars: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const aed = (n: unknown) => 'AED ' + Number(n).toFixed(2);

// deno-lint-ignore no-explicit-any
export function render(kind: Kind, langIn: string, data: { order: any; items: any[] }, opts: { siteUrl: string; supportEmail: string; legalName: string }) {
  const lang: Lang = (['en', 'es', 'ar'].includes(langIn) ? langIn : 'en') as Lang;
  const L = S[lang], o = data.order, sh = o.shipping || {};
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const subject = fill(L[kind], { id: o.id });
  const name = sh.first_name || '';
  const link = `${opts.siteUrl}/account/orders/${encodeURIComponent(o.id)}`;
  const showItems = kind === 'order_confirmed' || kind === 'order_shipped';

  const rows = (data.items || []).map(i =>
    `<tr><td style="padding:6px 0">${esc(i.name)} · ${esc(i.ml)} ml${i.gift ? ' 🎁' : ''}</td><td style="padding:6px 8px;text-align:center">${esc(i.qty)}</td><td style="padding:6px 0;text-align:end">${aed(i.unit_price * i.qty)}</td></tr>`).join('');
  const sum = (label: string, val: string, bold = false) => `<tr><td colspan="2" style="padding:4px 0${bold ? ';font-weight:700' : ''}">${label}</td><td style="padding:4px 0;text-align:end${bold ? ';font-weight:700' : ''}">${val}</td></tr>`;
  const totals = [
    sum(L.subtotal, aed(o.subtotal)),
    Number(o.discount) > 0 ? sum(L.discount + (o.coupon_code ? ` (${esc(o.coupon_code)})` : ''), '− ' + aed(o.discount)) : '',
    Number(o.gift_fee) > 0 ? sum(L.gift, aed(o.gift_fee)) : '',
    sum(L.shipping, Number(o.shipping_fee) > 0 ? aed(o.shipping_fee) : L.free),
    o.tax_mode === 'exclusive' ? sum(L.vatAdd, aed(o.vat)) : '',
    sum(L.total, aed(o.total), true),
    o.tax_mode === 'exclusive' ? '' : sum(L.vatIncl, aed(o.vat))
  ].join('');
  const address = [`${sh.first_name || ''} ${sh.last_name || ''}`, sh.line1, sh.line2, [sh.city, sh.state].filter(Boolean).join(', '), sh.country, sh.phone]
    .filter(Boolean).map(esc).join('<br>');

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0b0b;color:#d4af37;padding:20px 28px;font-size:22px;letter-spacing:6px">OZONE<span style="display:block;font-size:10px;letter-spacing:5px;color:#fff">SCENTS</span></td></tr>
<tr><td style="padding:28px" dir="${dir}">
<h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1>
<p>${esc(fill(L.hi, { name }))}</p><p>${esc(L[kind + '_p'])}</p>
${showItems ? `<h2 style="font-size:15px;margin:24px 0 8px">${L.items}</h2>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px"><tr><th style="text-align:start">&nbsp;</th><th>${L.qty}</th><th></th></tr>${rows}
<tr><td colspan="3"><hr style="border:0;border-top:1px solid #e5e0d5"></td></tr>${totals}</table>
<h2 style="font-size:15px;margin:24px 0 8px">${L.shipTo}</h2><p style="font-size:14px">${address}</p>` : ''}
<p style="margin:28px 0"><a href="${esc(link)}" style="background:#0b0b0b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block">${L.view}</a></p>
<p style="font-size:13px;color:#555">${esc(fill(L.help, { email: opts.supportEmail }))}</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#faf8f3;font-size:12px;color:#777">${esc(fill(L.footer, { legal: opts.legalName }))}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [subject, '', fill(L.hi, { name }), L[kind + '_p'], '',
    ...(showItems ? [...(data.items || []).map(i => `- ${i.name} ${i.ml} ml × ${i.qty}: ${aed(i.unit_price * i.qty)}`), `${L.total}: ${aed(o.total)}`, ''] : []),
    `${L.view}: ${link}`, fill(L.help, { email: opts.supportEmail })].join('\n');

  return { subject, html, text };
}
