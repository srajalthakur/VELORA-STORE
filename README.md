<div align="center">

# 👑 VELORA

### *Modern luxury, made to be experienced*

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.prisma.io)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20Hero-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test%20Mode-0C2451?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)

<br/>

> **A luxury storefront with a cinematic 3D hero, and a real shop behind it.**
> VELORA pairs an immersive front end with a server that owns the prices, the stock, the payments and the orders.

<br/>

![Status](https://img.shields.io/badge/Status-In%20development-f59e0b?style=for-the-badge)
![Payments](https://img.shields.io/badge/Payments-Razorpay%20test%20mode-3b82f6?style=for-the-badge)

</div>

---

## ✨ Features

### 🛍️ Storefront
- Cinematic full-screen hero with a procedural 3D gold sculpture (Three.js), mouse and scroll response, and an elegant fallback when WebGL is unavailable
- Editorial collections, category filters, and a featured-product layout
- Product pages with finishes (variants), live price and stock, delivery dates, and specifications
- Slide-out bag with quantity controls, a coupon field, and a free-shipping progress bar
- Mobile layout designed on its own, with reduced-motion support

### 💳 Checkout and payments
- Multi-step checkout with inline validation for Indian mobile numbers, 6-digit PIN codes, and states and union territories
- Saved addresses for signed-in customers, and guest checkout
- Razorpay payments (UPI, cards, net banking and wallets as enabled on your Razorpay account)
- Prices, shipping, discount and GST are all calculated **on the server**, never taken from the browser
- Stock is reserved while an order is being paid, and released if the checkout is abandoned
- Every payment is verified three ways before an order is marked paid: signature, a lookup with Razorpay, and an amount match
- Signed webhooks confirm orders even if the shopper closes the tab, and repeat deliveries are ignored
- Duplicate orders and duplicate refunds are prevented with idempotency keys

### 🔐 Accounts
- Register, sign in, sign out, email verification, forgot and reset password
- Saved addresses, order history, and password change
- Sessions in HTTP-only cookies; only a hash of each session token is stored
- Passwords hashed with scrypt; reset and verification links are single-use and expire

### 🛡️ Admin
- Orders list with search, status filters, and a "needs refund" view
- Order workflow: confirmed → processing → shipped → delivered
- Full refunds through Razorpay
- Product, variant, price, stock and image management
- Audit log of refunds and order status changes
- Every admin route is checked on the server, not only hidden in the interface

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **App** | Next.js 15 (App Router), React 19, TypeScript |
| **Storefront** | Static HTML page served at `/`, with Three.js for the hero |
| **Database** | PostgreSQL with Prisma 6 |
| **Validation** | Zod |
| **Auth** | Own session-cookie system (scrypt, hashed tokens) |
| **Payments** | Razorpay (Orders API, signed checkout callback, webhooks, refunds) |
| **Email** | Resend (verification and password reset) |
| **Testing** | Vitest |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.6 or newer
- A PostgreSQL database (local, or a hosted one such as Neon)
- A Razorpay account in **Test Mode** for payments

### Installation

```bash
git clone https://github.com/<your-username>/velora-store.git
cd velora-store
npm install
```

### Environment variables

Copy the example file and fill it in. **Never commit `.env`.**

```bash
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RAZORPAY_KEY_ID` | Razorpay key id (test keys start with `rzp_test_`) |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Any random text of 8+ characters; use the same value in the Razorpay webhook settings |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used by the seed to create the first admin |
| `APP_URL` | Public address of the site, used in emailed links (required in production) |
| `RESEND_API_KEY`, `MAIL_FROM` | Email sending (required in production) |
| `TRUSTED_PROXY_HOPS` | How many proxies sit in front of the app. `0` locally, `1` behind Vercel or a single proxy |

### Database and first run

```bash
npx prisma migrate dev     # creates the tables
npm run db:seed            # adds the products, a sample coupon, and the admin user
npm run dev
```

Open `http://localhost:3000`. The admin pages are at `/admin/orders` and `/admin/products`.

> Re-running the seed with `ADMIN_PASSWORD` set resets that admin's password to the value in `.env`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check the TypeScript types |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed the database |

---

## 💳 Testing payments

1. In the Razorpay dashboard, switch to **Test Mode** and generate a key under *Account & Settings → API Keys*. Put the values in `.env`.
2. Set payment capture to automatic in your Razorpay settings.
3. Add something to the bag, check out, and pay. In test mode, net banking opens a mock bank page with **Success** and **Failure** buttons.
4. For cards, use the domestic test cards listed in Razorpay's test-card documentation. Cards that Razorpay treats as international are declined unless international payments are enabled on your account.

**Webhooks on your own computer** need a public address. One free option:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then add a webhook in the Razorpay dashboard (Test Mode):
- **URL:** `https://<your-tunnel-address>/api/webhooks/razorpay`
- **Secret:** the value of `RAZORPAY_WEBHOOK_SECRET`
- **Events:** `payment.captured`, `order.paid`, `refund.processed`

The tunnel address changes every time you restart the tunnel.

---

## 🧪 Tests

```bash
npm test
npm run typecheck
```

The unit tests cover pricing (coupons, shipping, GST), payment signature and webhook verification, stock reservation and settlement, expiry of abandoned checkouts and late payments, password hashing and rules, email token handling, rate limiting, client address detection, order workflow rules, and input validation.

They run without a database. Flows that need a live database or Razorpay, such as a complete test payment, are checked by hand.

---

## 🔒 Design principles

- **The server is the source of truth.** The browser sends product ids and quantities, never prices or totals.
- **Never trust "payment succeeded" from the browser.** An order is marked paid only after the signature, the Razorpay lookup, and the amount all agree.
- **Money is stored as integer paise**, and prices include 18% GST.
- **Admin permissions are enforced on the server** for every admin route.
- **Writes check where the request came from**, on top of SameSite cookies.

---

## ⚡ API Endpoints

### Customer
| Endpoint | Description |
|---|---|
| `GET /api/products` | Catalogue with finishes, prices and available stock |
| `POST /api/checkout` | Create an order and a Razorpay order (needs an `Idempotency-Key` header) |
| `POST /api/payments/verify` | Verify a payment after Razorpay Checkout |
| `POST /api/webhooks/razorpay` | Signed Razorpay webhooks |

### Accounts
| Endpoint | Description |
|---|---|
| `/api/auth/register`, `login`, `logout`, `me` | Create an account, sign in, sign out, current user |
| `/api/auth/forgot`, `reset` | Request and complete a password reset |
| `/api/auth/verify`, `verify/send` | Confirm and resend email verification |
| `/api/account/addresses`, `addresses/[id]` | Saved addresses |
| `/api/account/password` | Change password |

### Admin *(admin role required)*
| Endpoint | Description |
|---|---|
| `GET /api/admin/orders` | List and search orders |
| `PATCH /api/admin/orders/[id]` | Move an order to its next status |
| `POST /api/admin/orders/[id]/refund` | Full refund through Razorpay |
| `/api/admin/products`, `products/[id]`, `products/[id]/variants`, `products/[id]/images` | Manage products, finishes and images |
| `/api/admin/variants/[id]`, `/api/admin/images/[id]` | Edit or remove a single finish or image |

---

## 📁 Project Structure

```
velora-store/
├── prisma/
│   ├── schema.prisma            # Data model
│   ├── migrations/
│   └── seed.ts                  # Products, coupon, first admin
├── next.config.mjs              # Security headers
└── src/
    ├── app/
    │   ├── route.ts             # Serves the storefront at /
    │   ├── account/             # Order history, addresses, password
    │   ├── login/  register/  forgot-password/  reset-password/  verify/
    │   ├── admin/orders/  admin/products/
    │   └── api/                 # auth, account, products, checkout, payments, webhooks, admin
    ├── lib/                     # pricing, orders, razorpay, session, ratelimit, clientip, audit, mail, ...
    └── storefront/
        └── velora.html          # The 3D storefront
```

---

## ☁️ Deployment

> Not deployed yet. These are the steps to follow when it is.

1. Create a hosted PostgreSQL database and set `DATABASE_URL`.
2. Deploy to a Node host (for example Vercel). The build command is `npm run build`.
3. Set every variable from the table above, including `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM`, and `TRUSTED_PROXY_HOPS=1` behind a single proxy.
4. Apply migrations against the production database with `npm run db:deploy`, then run the seed once to create the admin.
5. In Razorpay, add the webhook for `https://<your-domain>/api/webhooks/razorpay`.
6. Keep **test keys** until your Razorpay account is activated for live payments, and run a full test purchase before switching keys.

---

## ⚠️ Known limitations

- Payments have only been tested in Razorpay **test mode**.
- Rate limits are kept in memory, so they reset on restart and are not shared between servers. Use a shared store such as Redis before running more than one instance.
- The content security policy is in **report-only** mode. Check the browser console during a full purchase, then enforce it.
- A refund stays "pending" until the `refund.processed` webhook arrives, so configure the webhook in production.
- If an expired checkout is paid late and the item is gone, the order is flagged for a manual refund in the admin.
- Stock released from abandoned checkouts relies on a check that runs when the catalogue or checkout is used. A scheduled job would be more reliable.
- The database already has tables for carts, wishlists, reviews, coupons and newsletter subscribers. Their interfaces are not built yet.

---

## 🚧 Roadmap

- [ ] 🛒 Server-side carts that follow a customer between devices
- [ ] ❤️ Wishlist page
- [ ] ⭐ Verified-buyer reviews
- [ ] 📦 Customer order tracking
- [ ] 🔎 Search with suggestions
- [ ] 🏷️ Admin pages for coupons, collections and newsletter subscribers
- [ ] 📈 Sales overview in the admin
- [ ] 🧊 Per-product 3D viewers with real models
- [ ] 🖼️ Image uploads with a media service
- [ ] 🌍 International payments
- [ ] 🔐 Shared rate-limit store and enforced content security policy

---

## 📄 License

No license has been chosen yet. Add one (for example MIT) before publishing the repository.

---

## 👨‍💻 Author

Srajal Thakur

---

<div align="center">

**VELORA — Where Elegance Becomes an Experience.**

</div>
