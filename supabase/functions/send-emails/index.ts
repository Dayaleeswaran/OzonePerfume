/* Transactional email dispatcher (PROC-15, section 19).

   Triggered every minute by pg_cron → public.dispatch_emails() (see migration 20261004000000), or manually.
   Authorised by the shared secret EMAIL_DISPATCH_SECRET (header x-dispatch-secret) — never by a browser.

   Provider (GAP-012, provider still to be chosen):
     RESEND_API_KEY set   → sends through Resend (https://resend.com)
     MAILPIT_URL set      → local development only: delivers into the local Mailpit inbox
     neither              → emails stay queued (status "failed" with a clear error) until configured
   Each email is claimed with SKIP LOCKED and is unique per (order, kind), so retries never double-send. */
import { serviceClient } from '../_shared/orders.ts';
import { render, type Kind } from '../_shared/email-templates.ts';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://www.ozonescents.com').replace(/\/+$/, '');
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Ozone Scents <no-reply@ozonescents.com>';
const SUPPORT = Deno.env.get('SUPPORT_EMAIL') ?? 'info@ozonescents.com';
const LEGAL = Deno.env.get('LEGAL_NAME') ?? 'Aroma Zone Scents LLC';

function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1], email: m[2] } : { name: '', email: from.trim() };
}

async function deliver(to: string, subject: string, html: string, text: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: SUPPORT })
    });
    if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  const mailpit = Deno.env.get('MAILPIT_URL');
  if (mailpit) {
    const f = parseFrom(FROM);
    const r = await fetch(`${mailpit.replace(/\/+$/, '')}/api/v1/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ From: { Email: f.email, Name: f.name }, To: [{ Email: to }], Subject: subject, HTML: html, Text: text })
    });
    if (!r.ok) throw new Error(`mailpit ${r.status}`);
    return;
  }
  throw new Error('no email provider configured (set RESEND_API_KEY)');
}

Deno.serve(async req => {
  const secret = Deno.env.get('EMAIL_DISPATCH_SECRET');
  if (!secret || req.headers.get('x-dispatch-secret') !== secret) return new Response('forbidden', { status: 403 });

  const admin = serviceClient();
  const { data: jobs, error } = await admin.rpc('claim_emails', { p_limit: 20 });
  if (error) { console.error('claim_emails', error.message); return new Response(JSON.stringify({ error: 'claim' }), { status: 500 }); }

  let sent = 0, failed = 0;
  for (const job of jobs ?? []) {
    try {
      if (!job.data) throw new Error('order missing');
      const m = render(job.kind as Kind, job.lang, job.data, { siteUrl: SITE_URL, supportEmail: SUPPORT, legalName: LEGAL });
      await deliver(job.to_email, m.subject, m.html, m.text);
      await admin.rpc('finish_email', { p_id: job.id, p_ok: true });
      sent++;
    } catch (e) {
      failed++;
      const msg = (e as Error).message;
      console.error('send-emails', job.id, job.kind, msg);           // EMAIL-005: failures are logged and kept for retry
      await admin.rpc('finish_email', { p_id: job.id, p_ok: false, p_error: msg });
    }
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } });
});
