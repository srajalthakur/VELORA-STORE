# VELORA store — Phase 2 foundation

## Status (honest)
| Area | State |
|---|---|
| Server-side cart pricing (`src/lib/pricing.ts`): server prices, stock, coupon, shipping, GST-inclusive tax | Implemented, **5 unit tests pass** |
| Razorpay signature and webhook verification, order and payment lookup (`src/lib/razorpay.ts`) | Implemented, **2 unit tests pass** (HMAC logic only; no live Razorpay call made) |
| Database schema (`prisma/schema.prisma`) | Written, **not yet validated or migrated** (Prisma engines could not be downloaded) |
| Checkout, payment-verify and webhook route handlers, stock reservation, seed data | **Not built yet** |
| Auth.js accounts, persistent carts, wishlist, search, admin dashboard, Cloudinary uploads | **Not built yet** |
| Next.js + React Three Fiber port of the storefront, per-product 3D viewers, real photography | **Not built yet** (the current storefront remains the standalone HTML page) |
| Stripe | Not started |

## Run what exists
    npm install
    npm test            # 7 tests
    cp .env.example .env   # fill in Razorpay TEST keys, never commit .env
    npx prisma validate && npx prisma migrate dev --name init   # needs Postgres

## Design rules the next steps must keep
- Money is integer paise; prices include 18% GST.
- Never trust client prices or "payment succeeded" callbacks: create orders on the server, verify the signature, confirm the payment with Razorpay, then mark paid.
- Reserve stock at checkout, finalise it on verified payment, release it on failure.
- Deduplicate webhooks by Razorpay event id (`WebhookEvent`) and orders by `Idempotency-Key`.
