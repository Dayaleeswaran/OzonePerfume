# Ozone Scents — Implementation Report

Against `Ozone_Scents_Production_Requirements_and_Flows.md` (sections 35 and 33). Date: 2026-10-04.

**Status: NOT production-ready yet.** The code-side P0 work that does not depend on client decisions is done and tested.
Launch is blocked by the open decisions in section 3. The biggest is the payment gateway (OD-001): the site cannot take real money until it is chosen and integrated.

---

## 1. Implemented requirements

| Area | Requirement IDs | What was done |
|---|---|---|
| Account-required purchase | GAP-001, FR-AUTH-014..016, FR-CK-001, BR-AUTH-001, AC-PURCHASE-001, TEST-CRITICAL-003 | Checkout redirects to login/register and returns to checkout with the cart intact. `create_order` rejects unauthenticated and unverified users. Guest order access was removed: `get_order` is owner/admin only. |
| Shipping | GAP-003, GAP-008, FR-SHIP-001..011, BR-SHIP-001..005, DATA-SHIPPING-RULE | New `shipping_rules` table (country, method, weight band, fee, free-eligible, localized delivery text). Seeded with UAE standard AED 20 and express AED 35. Free standard shipping strictly over AED 250 (inclusive/exclusive is a setting, OD-004). Express is never free automatically. Unsupported countries are rejected server-side. Admin editor under Admin → Settings. Product/size weight added. |
| Gift wrapping | GAP-004, BR-GIFT-001..004, FR-GIFT-* | AED 10 / 20 / 35. Non-giftable products rejected. Gift fields validated (name, message ≤ 250, email and date format). |
| Coupons | GAP-005, FR-PROMO-001..013, BR-PROMO-001..005, AC-COUPON-001/002 | `WELCOME10` is 10% on a first purchase, checked against server-side order history (also blocks a second unpaid order holding the code). `LAUNCH20` is 20% when the subtotal is strictly above AED 600. Codes are normalized. Expiry, first-order and strictly-above rules can be edited in admin. `FREESHIP` removed. The production migration creates both launch codes **inactive**; the admin activates them. |
| VAT | GAP-006, FR-CART-010, BR-PRICE-004 | `tax_mode` setting: inclusive (VAT extracted) or exclusive (VAT added). Applied in the database, cart, checkout, order pages and emails. The mode is stored on each order. **The value stays OPEN (OD-003).** |
| Crypto | GAP-009, FR-PAY-013, BR-PHASE-003 | Crypto UI, demo addresses and settings removed. A `features.crypto` flag exists (off). |
| Special dates | GAP-010, FR-ACC-006, FR-ADMIN-011, BR-PHASE-001 | Hidden behind `features.special_dates` (off): account section, home card, hero bullet and admin section. Data model kept. |
| Orders | FR-ORD-001..017, section 13 | Server-validated state machine: awaiting_payment → cancelled; processing → shipped / cancelled; shipped → delivered / refunded; delivered → refunded; cancelled → refunded (paid only). Admin UI offers only valid next states. The SKU is snapshotted on order lines. |
| Inventory | FR-INV-001..009, BR-INV-001..003, AC-STOCK-001/002 | Row-locked reservation (no overselling, proven with a concurrent test). Stock is restored exactly once via the `stock_released` flag (cancel, expiry, repeated calls). Low-stock threshold is configurable. |
| Products | FR-PROD-015/016 | Products that appear in orders cannot be deleted; admin offers "Hide product" (archive) instead. |
| Payments (code side) | INT-PAY-001/003/004/006/007, FR-PAY-003..011, BR-PAY-001..004, AC-PAY-001/002 | `_shared/orders.ts` isolates the provider logic. The payment function checks that the signed-in customer owns the order. Amount and currency come from the database. Marking paid is idempotent and rejects mismatches. The test provider is off unless `TEST_PAYMENTS_ENABLED=true`. Card data never leaves the browser. |
| Transactional email | GAP-012, PROC-15, EMAIL-001..005 | `email_outbox` table filled by order events: confirmed, shipped, delivered, cancelled (paid only), refunded. Unique per order+kind, so there are no duplicates. Shipped/delivered follow the customer's preference. `send-emails` Edge Function with en/es/ar HTML+text templates and Resend support (Mailpit locally). pg_cron dispatches every minute via Vault secrets. Failures are logged and retried up to 5 times. |
| SEO | GAP-013, FR-SEO-001..010, SEO-002..012 | Real URL paths instead of `#/` (old links redirect). Per-page title, description, canonical, robots, Open Graph. Product and Organization JSON-LD. `robots.txt`. `sitemap.xml` generated from the database at build. Private routes are `noindex` with no canonical. |
| Security | SEC-001..020 | Everything above, plus `vercel.json`: HSTS, CSP (`script-src 'self'`, no frames), `X-Frame-Options DENY`, nosniff, Referrer-Policy, Permissions-Policy, COOP. The third-party map iframe was removed. Demo credentials and sandbox instructions only appear in development builds or test mode (GAP-015). |
| Content | CONTENT-001..004, OD-006/008/009 | Legal entity corrected to **Aroma Zone Scents LLC**, licence 2647467, TRN 105514990800003, Sharjah Media City (footer, About). Removed: invented business hours, the "14-day returns" promise, the Business Bay map caption, eco/health claims, "free check-up", "reply within one business day", "guaranteed safe" and placeholder social links. Returns and Terms pages show a "pending approval" notice. Oils are described as "natural fragrance oils" (catalogue wording). |
| Reliability / observability | NFR-REL-005, OBS-001..005 | Page-level error boundary with a recovery screen. Global error hooks with a pluggable reporter (`window.__ozReport`). Edge functions log failures with safe identifiers only. |

## 2. Deferred (Phase 2 / future, by decision)
- **P2-DATE-001..008:** special-date reminders. The data model and UI exist but are switched off, and no reminder dispatcher has been built yet.
- **WhatsApp reminders, crypto payments, extra currencies at checkout** (BR-PHASE-002/003, OD-010).

## 3. Open decisions (client input required)
| ID | Decision | Effect today |
|---|---|---|
| **OD-001** | Payment gateway (Stripe / Telr / N-Genius …) | **Launch blocker.** Without `VITE_PAYMENT_PROVIDER=test`, checkout shows "payment being set up" and the Pay button is disabled. |
| **OD-002** | Oil prices: 230/320 (detailed catalogue, current) vs 250/350 + tax (general sheet) | Using 230 / 320. Change in Admin → Products if needed. |
| **OD-003** | Are listed prices VAT-inclusive? | Setting = inclusive. One switch in Admin → Settings. |
| **OD-004** | "Over AED 250" means `>` or `≥` | Setting = strictly over. |
| **OD-005** | GCC model: country + weight table, or AED 50 flat | No GCC rules yet, so GCC addresses can't check out. Add rules in Admin → Settings → Shipping rules. |
| OD-006 | Final legal/brand wording | Spec values used. Check footer and About. |
| **OD-007** | Permission to use hotel/brand names (Versace, Ritz-Carlton, Address, Rove …) | Product names unchanged. **Legal risk if published without permission.** |
| **OD-008** | Returns/refunds and terms | Neutral placeholder text plus a "pending approval" notice. |
| OD-009 | Business hours | Not shown anywhere. |
| OD-011 | Final cinematic commercial frames | Product photos are used as frames. |
| OD-012 | Final product copy, fragrance notes, social links | Notes show "coming soon". Social icons are hidden until `BRAND.socials` is filled. |

Content gap: 10 hotel-inspired scents from the price list are not in the catalogue yet: St. Regis, Anantara, Hilton, Dubai Mall, Burj Khalifa, Kempinski, Armani, Bvlgari, Vida and Emaar. They have no photos, and OD-007 applies.

## 4. Database changes
New migration `supabase/migrations/20261004000000_production_rules.sql`:
- **New tables:**
  - `shipping_rules`, with RLS: public reads active rules; admin writes; audited.
  - `email_outbox`, with RLS: admin read only; written by trigger.
- **New columns:**
  - `settings`: `tax_mode`, `free_shipping_inclusive`, `low_stock_threshold`, `features`. `shipping_fee` and `express_fee` were dropped.
  - `products.weight_kg`.
  - `coupons`: `first_order_only`, `min_exclusive`, `created_at`.
  - `orders`: `lang`, `tax_mode`, `weight_kg`, `stock_released`.
  - `order_items.sku`.
- **Functions:**
  - **New:**
    - `shipping_quote`, `coupon_lookup` and `release_order_stock` (all internal).
    - `claim_emails` and `finish_email` (service role only).
    - `dispatch_emails`.
    - The product-delete guard.
    - The order-event email trigger.
  - **Rewritten:** `create_order`, which now takes `(items, shipping, method, coupon, lang)` and requires auth.
  - **Changed signatures:** `get_order(id)` and `validate_coupon`.
  - **Updated:** `mark_order_paid`, `mark_order_failed` and `admin_set_order_status`.
- **Settings data:** free-shipping threshold 250, gift wrap 10/20/35, UAE shipping rules, launch codes created inactive.
- **Seed (`supabase/seed.sql`, dev only):** the launch codes active, plus the demo accounts.

## 5. Payment integration
- **Update 2026-10-05: OD-001 decided, Stripe.** Stripe Checkout (hosted page) is implemented:
  - `supabase/functions/stripe-checkout` creates a session for the order total held in the database, and expires any previous session first.
  - `supabase/functions/stripe-webhook` verifies the signature and replay window, checks amount and currency, then:
    - marks the order paid (idempotent);
    - cancels and restocks on expiry, but only for the order's current session;
    - mirrors full refunds made in the Stripe dashboard;
    - flags "paid after expiry" for a manual refund.
  - Migration `20261005000000_stripe.sql`.
  - Checkout redirects to Stripe when `VITE_PAYMENT_PROVIDER=stripe`, and the order page waits for the webhook confirmation.
  - Tested with 8 signed-webhook integration tests (`tests/integration/stripe.test.mjs`).
  - Remaining: a test with real Stripe test-mode keys, then the client's live keys after Stripe verifies their business.
- **Sandbox:** `supabase/functions/payments-test` simulates success, decline, insufficient funds and cancel. It is disabled unless `TEST_PAYMENTS_ENABLED=true`.
- **To integrate the chosen gateway (INT-PAY-002..006):**
  1. Add a `create-payment-session` function that uses the provider's hosted page or tokenized fields.
  2. Add a `payment-webhook` function that verifies the provider signature, then calls `markPaid()` or `markCancelled()` from `_shared/orders.ts`. These already handle idempotency and amount/currency checks.
  3. Replace the sandbox card form in `PaymentStep`.
  4. Add the gateway's domains to the CSP in `vercel.json` (`script-src`, `frame-src`, `connect-src`).
  5. Implement the refund API. Today, "refunded" in admin only records the refund (the UI says so).
- **Payments gate:** the §33 P0-03 items are all still open.

## 6. Email
- **Order emails:** implemented and verified locally end to end (cron → pg_net → Edge Function → Mailpit, 7/7 delivered).
- **Production needs:**
  - an email provider account (Resend supported out of the box);
  - a verified sender domain (SPF/DKIM);
  - the secrets in section 13.
- **Auth emails:** sign-up codes and password reset need SMTP configured under Supabase → Authentication → SMTP.

## 7. SEO migration
- **URL inventory (SEO-001):** `www.ozonescents.com` currently serves an empty directory listing ("Index of /"), with no sitemap and no pages, so no existing URLs need redirects. Recheck in Google Search Console before launch, and add any indexed legacy URLs to `vercel.json` → `redirects`.
- **Done:** canonical URLs, sitemap, robots.txt, Product and Organization JSON-LD, noindex on admin/auth/checkout/account/cart/order pages.
- **Locale strategy (SEO-013):** one URL per page; English is indexed; Spanish and Arabic are a visitor preference. Separate locale URLs with hreflang would be a later enhancement.
- **Limitation:** this is a client-rendered SPA. Google renders JavaScript, but social-preview bots don't see per-page Open Graph tags. Prerendering would fix that if it's needed.

## 8. Test results (local stack, 2026-10-04)
| Suite | Command | Result |
|---|---|---|
| Unit: pricing, shipping, VAT, coupons, i18n coverage, claims | `npm run test:unit` | **14 / 14 pass** |
| Database integration: RLS, auth, coupons, shipping, VAT, concurrency, state machine, payments, email | `npm run test:db` | **28 / 28 pass** |
| Browser E2E: section 28 list items 1–3 and 5–20, plus SEO/nav/RTL/mobile | `npm run test:e2e` | **14 / 14 pass**, no console errors |

Not yet covered: the real gateway (§28 items 10–11 with real provider webhooks), refunds via a provider API, and a production smoke test.

## 9. Build
- `npm run build` passes and produces `dist/` plus a 45-URL `sitemap.xml`.
- Bundle note: the main JS chunk is about 840 kB, roughly 240 kB gzipped. Admin is already lazy-loaded.
- Further code-splitting is recommended (NFR-PERF-001/008), then a Lighthouse run on throttled mobile.

## 10. Security findings
- **Fixed in this pass:**
  - Guest order tokens no longer grant access.
  - The payment function now verifies order ownership.
  - Placeholder social links and the third-party map iframe are gone.
  - Demo credentials and sandbox instructions are hidden outside development and test.
  - The CSP is strict.
- **Note:** the auth container must run with `config.toml` (email confirmation on, password minimum 8 with letters and digits). The same must be set in the production dashboard.
- **Recommended before launch:**
  - Turn on MFA for the admin account.
  - Enable Cloudflare Turnstile CAPTCHA on sign-up, login and contact (Supabase Attack Protection).
  - Enable Supabase leaked-password protection.
  - Run Supabase's security advisor on the production project.

## 11. Performance
- **Already in place:**
  - The cinematic section meets FR-CINE-001..011: canvas, `requestAnimationFrame`, DPR cap, mobile asset set, reduced-motion fallback, and a failure can't block navigation.
  - Images are WebP with responsive sizes.
- **To do:** split the main bundle, and measure on a throttled mobile network (NFR-PERF-008).

## 12. Deployment
1. **Create the production Supabase project (Pro).** Apply migrations in order with `npx supabase link` then `npx supabase db push`. **Do not run `seed.sql`.**
2. **Configure Supabase Auth in the dashboard:**
   - email confirmation on;
   - minimum password 8, with letters and digits;
   - OTP email templates (copy from `supabase/templates/`);
   - Site URL and redirect URLs set to the production domain;
   - custom SMTP;
   - CAPTCHA;
   - admin MFA.
3. **Create the admin user.** Set `app_metadata.role = "admin"` from the dashboard or SQL. Never use the seed accounts.
4. **Deploy the functions:** `npx supabase functions deploy send-emails` (and the real payment functions later). **Do not deploy `payments-test`**, or leave `TEST_PAYMENTS_ENABLED` unset.
5. **Set the function secrets** (section 13) and the two Vault secrets for the email cron:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<EMAIL_DISPATCH_SECRET>', 'email_dispatch_secret');
   ```
6. **Set up data in the admin:**
   - activate `WELCOME10` and `LAUNCH20`;
   - confirm the settings (VAT mode, threshold rule);
   - add GCC shipping rules once agreed;
   - set real stock and product weights.
7. **Vercel (Pro):** import the repo and set the env vars in section 13. `vercel.json` configures the build, rewrites and headers. Add the custom domain (HTTPS is automatic).
8. **Smoke test on production:**
   1. Register and verify by email.
   2. Place an order and pay with the real gateway in test mode.
   3. Check the confirmation email.
   4. Mark the order shipped in admin.
   5. Confirm the email preference behaviour.
9. **Rollback (NFR-AVL-001):** use Vercel "Promote previous deployment". For a bad migration, apply a forward-fix migration (Supabase Pro daily backups and PITR are add-ons; test a restore before launch, OBS-008).

## 13. Environment variables and secrets (values never committed)
| Where | Name | Public? | Purpose |
|---|---|---|---|
| Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | yes | browser client |
| Vercel | `VITE_SITE_URL` | yes | canonical links / sitemap (`https://www.ozonescents.com`) |
| Vercel | `VITE_PAYMENT_PROVIDER` | yes | empty until the gateway is live; **never `test` in production** |
| Supabase function secrets | `EMAIL_DISPATCH_SECRET` | **secret** | authorizes the cron → send-emails call |
| Supabase function secrets | `RESEND_API_KEY` | **secret** | email provider |
| Supabase function secrets | `EMAIL_FROM`, `SUPPORT_EMAIL`, `SITE_URL`, `LEGAL_NAME`, `ALLOWED_ORIGINS` | no | email sender, links, CORS |
| Supabase function secrets | gateway secret key, webhook signing secret | **secret** | when OD-001 is decided |
| Supabase Vault | `project_url`, `email_dispatch_secret` | secret | email cron |
| Supabase Auth settings | SMTP password, Turnstile secret | **secret** | entered in the dashboard by the client |

## 14. Known remaining risks
1. **No real payments (OD-001):** this is the launch blocker.
2. **Third-party hotel/brand names without confirmed permission (OD-007).**
3. **Unconfirmed tax interpretation (OD-003) and oil prices (OD-002):** totals could be legally or commercially wrong until confirmed.
4. **Returns, refund and terms text not approved (OD-008).**
5. **GCC customers cannot check out until rules are added (OD-005).**
6. **Monitoring is not connected to a service yet:** the reporter hook exists; choose Sentry or similar.
7. **The bundle size is unmeasured** on real mobile networks.
8. **Backups and restore are not yet tested** on the production plan.
