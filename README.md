# Ozone Scents — e-commerce (React + Vanilla CSS + Supabase)

Storefront and admin for Ozone Scents (Aroma Zone Scents LLC). Requirements baseline:
`Ozone_Scents_Production_Requirements_and_Flows.md`. Implementation status, open decisions and
launch checklist: [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md).

## Architecture
```
Browser (Vite + React SPA, real paths: /product/tower-diffuser)
  └─ Supabase JS (anon key only)
       ├─ Postgres + row-level security      — catalogue, accounts, orders, coupons, reviews
       ├─ SECURITY DEFINER functions         — create_order (prices, stock, coupons, shipping, VAT), admin actions
       ├─ Auth (email + password, email OTP) — purchase requires a verified account
       ├─ Storage bucket product-images      — admin uploads
       └─ Edge Functions                     — payments-test (sandbox), send-emails (order emails)
pg_cron: release unpaid orders (15 min), dispatch order emails (1 min)
Hosting: Vercel (vercel.json: SPA rewrites, security headers/CSP, caching)
```
The browser is never trusted for prices, stock, coupon eligibility, roles or payment state.

## Local development
Requirements: Node 20+, Docker Desktop.
```
npm install
npx supabase start -x studio,vector          # local Postgres/Auth/Storage/Mailpit
npx supabase db reset                         # applies migrations + supabase/seed.sql (dev data)
cp .env.example .env.local                    # then fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `npx supabase status`
                                              # and set VITE_PAYMENT_PROVIDER=test for the sandbox card form
npx supabase functions serve --env-file supabase/functions/.env
npm run dev                                   # http://localhost:5173
```
`supabase/functions/.env` (git-ignored) for local use:
```
TEST_PAYMENTS_ENABLED=true
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
EMAIL_DISPATCH_SECRET=<random string>
MAILPIT_URL=http://supabase_inbucket_ozone:8025
SITE_URL=http://localhost:5173
```
To let pg_cron deliver order emails locally, store the same secret in Vault once:
```sql
select vault.create_secret('http://supabase_kong_ozone:8000', 'project_url');
select vault.create_secret('<EMAIL_DISPATCH_SECRET>', 'email_dispatch_secret');
```
Emails (sign-up codes, password reset, order emails) arrive in Mailpit: http://127.0.0.1:54324

### Development accounts (seed.sql — local only, never in production)
| Role | Email | Password |
|---|---|---|
| Customer | demo@ozonescents.com | Demo@123 |
| Admin | admin@ozonescents.com | Admin@123 → `/admin` |

Sandbox cards (only when `VITE_PAYMENT_PROVIDER=test`): `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined.
Card numbers never leave the browser; only the simulated outcome is sent.

## Tests
```
npm run test:unit   # pricing/shipping/VAT/coupon rules, i18n coverage, content claims (no services needed)
npm run test:db     # 28 database tests: RLS, auth-required orders, coupons, shipping, VAT, stock races, state machine, payments, email queue
npm run test:e2e    # 14 browser journeys (needs local stack + functions + dev server; uses Edge/Chrome, set E2E_BROWSER if needed)
```

## Build & deploy
```
npm run build       # vite build + dist/sitemap.xml (products read from the database, catalogue fallback)
```
Deployment steps, required secrets and the go-live checklist are in [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md#12-deployment).

## Project structure
```
src/App.jsx                 routes, page shell, error boundary, baseline SEO
src/lib/store.js            Supabase-backed client store (UI cache; server is authoritative)
src/lib/pricing.js          display mirror of the server pricing rules (unit-tested)
src/lib/router.js           path router (legacy #/ links redirect automatically)
src/lib/seo.js              canonical, robots, Open Graph, JSON-LD
src/components/ src/pages/  UI
src/i18n/                   English / Spanish / Arabic
supabase/migrations/        schema, RLS, business functions (apply in order)
supabase/functions/         payments-test, send-emails, _shared (order helpers, email templates)
scripts/gen-sitemap.mjs     sitemap generator
tests/                      unit, integration (db), e2e
vercel.json                 rewrites, security headers, caching
legacy/                     previous static version (reference only)
```
