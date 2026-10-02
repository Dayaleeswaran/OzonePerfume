# Ozone Scents — storefront (React + Vanilla CSS)

## Run it
```
npm install        # first time only
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build locally
```
`dist/` can be uploaded to any static host. URLs use `#/` routes, so no server rewrites are needed.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Customer | demo@ozonescents.com | Demo@123 |
| Admin | admin@ozonescents.com | Admin@123 (then go to `#/admin`) |

## Test payments (demo mode, no real charges)
- `4242 4242 4242 4242`: payment succeeds
- `4000 0000 0000 0002`: card declined
- Any name, a future expiry, any 3-digit CVC. Crypto uses a demo address.

Promo codes: `WELCOME10`, `FREESHIP`.

## Structure
```
index.html              Vite entry
public/assets/img/      diffuser (o1–o10) and oil (oil-*) photos as optimised WebP
src/main.jsx            React root
src/App.jsx             hash router, page shell (header/footer/panels), page transitions
src/styles.css          all styling — plain CSS, theme tokens at the top
src/data/catalog.js     products from the Catalogue PDFs, coupons, brand details
src/i18n/               English / Spanish / Arabic strings
src/lib/                store (localStorage "backend"), i18n, router, validation, search, hooks
src/components/         Header, Footer, ProductCard, Cinematic, overlays (ui.jsx), shared pieces
src/pages/              Home, Listing, Product, Cart, Checkout, Order, Auth, Account, Info, Admin
legacy/                 the previous plain HTML/JS version, kept for reference
```

## Before going live
This is a complete front end, but its "server" is simulated in the browser's localStorage.
For production you need to:
- Replace `api()` / `src/lib/store.js` calls with a real backend (accounts, orders, stock, reviews).
- Hash passwords server-side. The browser hash is only for the demo.
- Use a real payment provider's hosted card fields (e.g. Stripe, Checkout.com, Telr) and a crypto gateway. The card form here only validates format.
- Send verification, reset and special-date reminder emails from the server.
- Confirm the brand details in `src/data/catalog.js` (taken from the Catalogue PDFs).

## Catalogue notes
- Prices and specs come from `Catalogue/`. No discounts, best-seller flags or reviews are invented:
  Crazy Deals stays empty until a sale price is set in Admin → Products.
- Fragrance notes are not in the catalogue, so oil pages say "coming soon"; add them in Admin → Products.
- 10 hotel-inspired scents in the price list have no product photo yet (St. Regis, Anantara, Hilton,
  Dubai Mall, Burj Khalifa, Kempinski, Armani, Bvlgari, Vida, Emaar). Add them in Admin once photos exist.
- Delivery fees, returns window and gift-wrap prices are placeholders to confirm with the client.
