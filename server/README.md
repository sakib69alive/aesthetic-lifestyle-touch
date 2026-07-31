# Payment Server — Aesthetic Lifestyle Touch

This is the **only** part of the site that isn't a static file. Everything
else (accounts, cart, orders, reviews, custom requests, admin) still runs
entirely in the browser against `localStorage`, exactly as before. This
server exists solely to talk to SSLCommerz with real credentials and
confirm that a payment genuinely cleared — something a browser can never
safely do on its own.

## One-time setup (about 5 minutes)

1. Install dependencies:
   ```
   cd server
   npm install
   ```
2. Get free SSLCommerz **sandbox** credentials:
   - Go to https://developer.sslcommerz.com/registration/
   - Fill in your name, email, phone, and any domain (e.g. `localhost` is
     fine for testing) — no business documents needed for the sandbox.
   - Verify your email, then find **Store ID** and **Store Password** in
     your sandbox merchant panel.
3. Copy the env file and paste your credentials in:
   ```
   cp .env.example .env
   ```
   Then edit `.env` and set `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWD`.
4. Start the server:
   ```
   npm start
   ```
   You should see `Payment server running on http://localhost:4000` with
   no warning about missing credentials.

## Testing a real (sandbox) payment

With the server running and the store's `checkout.html` open in a browser,
add something to cart, check out, and pick **"Pay Online — Card / bKash /
Nagad / Rocket"**. You'll be sent to SSLCommerz's real sandbox payment
page, where their site provides test cards / mobile-banking simulators —
no real money moves. Completing it there sends you back to
`checkout.html`, which asks this server whether the payment actually
confirmed before ever calling it a success.

## Going live

Once you have a **live** SSLCommerz merchant account (a separate,
real registration with your business documents):

1. Set `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWD` to your live values.
2. Set `SSLCOMMERZ_IS_LIVE=true`.
3. Deploy this `server/` folder somewhere it can run continuously
   (Render, Railway, a VPS, etc.) and update `SERVER_BASE_URL` in `.env`
   and `PAYMENT_SERVER_URL` near the top of `checkout.html`'s script to
   point at that deployed URL instead of `localhost:4000`.

Nothing else changes — the whole integration (session init, redirect,
server-to-server validation, IPN) is identical between sandbox and live.

## What this server does and doesn't do

- **Does:** initiate a payment session, validate the result directly with
  SSLCommerz's server (never trusting the browser redirect alone), and
  expose one status endpoint the frontend polls after returning from the
  gateway.
- **Doesn't:** know anything about products, accounts, or order history —
  that all still lives in the browser's `localStorage`, unchanged.
- **Stores:** one local SQLite file (`payments.sqlite`, created
  automatically) recording every payment attempt and its confirmed
  outcome — nothing else.
