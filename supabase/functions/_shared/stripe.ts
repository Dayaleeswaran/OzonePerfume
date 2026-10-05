/* Minimal Stripe client for Edge Functions (no SDK): REST calls + webhook signature verification.
   Secrets come from function secrets only: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (SEC-006/018). */

const API = 'https://api.stripe.com/v1';

/* Stripe expects form encoding with bracket notation: a[b][0][c]=d */
export function form(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') out.push(...form(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe(path: string, params: Record<string, unknown> = {}, opts: { method?: string; idempotencyKey?: string } = {}) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  const method = opts.method ?? 'POST';
  const body = method === 'GET' ? undefined : form(params).join('&');
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20',
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {})
    },
    body
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`stripe ${r.status}: ${json?.error?.type ?? ''} ${json?.error?.message ?? ''}`.trim());
  return json;
}

/* AED (and most currencies) use 2 decimals: AED 250.00 → 25000 fils */
export const toMinor = (amount: number) => Math.round(Number(amount) * 100);

const enc = new TextEncoder();
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* Verify the Stripe-Signature header (t=timestamp,v1=hmac). Rejects stale events (replay protection). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = header.split(',').map(p => p.trim()).filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(`${t}.${payload}`)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return sigs.some(s => timingSafeEqual(s, hex));
}
