# Deploying VELORA (Vercel + Neon + Upstash + Resend + Razorpay)

Commands below are for Windows PowerShell. Do each step in order. Nothing here touches your local setup.

## 0. Before you start
- Commit everything in git and push to a **private** GitHub repository. `.env` is already in `.gitignore`; never commit it.
- Start the Razorpay account activation now (step 6). It needs business verification and can take days, and you can test everything else with test keys meanwhile.

## 1. Database (Neon)
1. Create a project at neon.com. Pick the region closest to your customers.
2. Click **Connect**. Copy two strings: the **pooled** one (host contains `-pooler`) and the **direct** one (turn "Connection pooling" off).
3. Create the tables from your own computer, using the direct string:
   ```
   $env:DATABASE_URL="PASTE-DIRECT-STRING"
   npx prisma migrate deploy
   ```
   `migrate deploy` only applies the existing migrations. It never resets data.
4. Create your admin account only (no demo products, no demo coupon):
   ```
   $env:SEED_ADMIN_ONLY="1"; $env:ADMIN_EMAIL="you@yourdomain.com"; $env:ADMIN_PASSWORD="a-long-unique-password"
   npm run db:seed
   ```
5. Close that PowerShell window afterwards so the variables are gone. Add your real products in `/admin/products`.

## 2. Shared rate-limit store (Upstash)
Create a Redis database at upstash.com. From its **REST API** section copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without these, login, checkout and tracking limits are kept per server and reset on every restart.

## 3. Email (Resend)
Add and verify your domain at resend.com, create an API key, and choose a sender such as `VELORA <orders@yourdomain.com>`. Password reset, email verification and "your order has shipped" all depend on this.

## 4. Hosting (Vercel)
1. vercel.com > Add New > Project > import the GitHub repository. Framework is detected as Next.js. The build command in `package.json` already runs `prisma generate`.
2. Add these environment variables (Production):

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon **pooled** string |
| `APP_URL` | your final address, e.g. `https://velora.example` (no trailing slash) |
| `TRUSTED_PROXY_HOPS` | `1` |
| `RESEND_API_KEY`, `MAIL_FROM` | from step 3 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from step 2 |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **test** keys first |
| `RAZORPAY_WEBHOOK_SECRET` | a long random string you make up (8+ characters); you paste the same value into Razorpay in step 5 |

3. Deploy. If you add your own domain later, change `APP_URL` to it and redeploy.

## 5. Razorpay webhook (test mode first)
Razorpay Dashboard (Test Mode) > Webhooks > Add: URL `https://YOUR-SITE/api/webhooks/razorpay`, secret = your `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `refund.processed`.

## 6. Check the deployed site with test keys
- Home page loads with products; `/api/products` returns JSON.
- Browser DevTools > Network > the home request shows `X-Frame-Options: DENY` and `Strict-Transport-Security`.
- Register, then "forgot password": a real email arrives.
- Place a test order and pay with a Razorpay test card. Razorpay > Webhooks > the delivery shows status 200. The order shows **confirmed**.
- Admin: mark processing, then shipped with a tracking number. The customer email arrives. `/track` shows the timeline.
- Fail a login 5 times: it blocks. This now holds across restarts.
- Content policy: open DevTools > Console during that whole run. If nothing mentions "Content Security Policy", rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `next.config.mjs`, redeploy, and repeat one purchase.

## 7. Go live
1. Razorpay: switch to **Live Mode**, then Account & Settings > API Keys > Generate Key.
2. Create a second webhook in Live Mode with the same URL, a **new** secret, and the same three events.
3. In Vercel, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` with the live values and redeploy.
4. Buy the cheapest item yourself with a real payment, confirm the order turns **confirmed**, then refund it from `/admin/orders`.

## Things to know
- Unpaid checkouts release their held stock when someone loads the catalogue, so a completely idle site releases it late. It is harmless, but stock stays held until the next visit.
- The `review.zip` file in the repository is not part of the app. Remove it from git.
- `README.md` is out of date (it describes an early phase). Do not rely on it.
- Take a database backup or note Neon's restore window before the first real order.
