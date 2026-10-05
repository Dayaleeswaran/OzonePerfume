/* Public forms behind a CAPTCHA (SEC-015, FR-CNT-001..004): contact messages and newsletter sign-ups.

   The browser can no longer call send_message / subscribe_newsletter directly (migration 20261005010000);
   requests come through here, where the Cloudflare Turnstile token is verified server-side first.
     TURNSTILE_SECRET_KEY set   → every request needs a valid token
                                  (a signed-in customer may join the newsletter without one: they already passed login)
     TURNSTILE_SECRET_KEY unset → no CAPTCHA check (local development only — always set it in production)
   The database functions keep their own rate limits and validation. */
import { corsHeaders, serviceClient, requestUser } from '../_shared/orders.ts';

async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}

const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max ? v : null;

Deno.serve(async req => {
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return reply(400, { error: 'invalidInput' }); }
  if (!b || (b.kind !== 'contact' && b.kind !== 'newsletter')) return reply(400, { error: 'invalidInput' });

  const admin = serviceClient();
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const signedIn = b.kind === 'newsletter' && !b.captchaToken ? await requestUser(admin, req) : null;
  if (!signedIn && !(await verifyTurnstile(b.captchaToken, ip))) return reply(400, { error: 'captcha' });

  const mapErr = (msg: string) => /rate_limited/.test(msg) ? 'rate_limited' : /check constraint|violates|invalid/i.test(msg) ? 'invalidInput' : 'unknown';
  try {
    if (b.kind === 'contact') {
      const name = str(b.name, 100), email = str(b.email, 254), message = str(b.message, 2000);
      if (!name || !email || !message) return reply(400, { error: 'invalidInput' });
      const { error } = await admin.rpc('send_message', { p_name: name, p_email: email, p_phone: str(b.phone, 30) ?? '', p_topic: str(b.topic, 20) ?? 'general', p_message: message });
      if (error) return reply(error.message.includes('rate_limited') ? 429 : 400, { error: mapErr(error.message) });
    } else {
      const email = str(b.email, 254);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply(400, { error: 'invalidInput' });
      const { error } = await admin.rpc('subscribe_newsletter', { p_email: email });
      if (error) return reply(error.message.includes('rate_limited') ? 429 : 400, { error: mapErr(error.message) });
    }
    return reply(200, { ok: true });
  } catch (e) {
    console.error('public-forms', b.kind, (e as Error).message);
    return reply(500, { error: 'unknown' });
  }
});
