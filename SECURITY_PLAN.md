# Security plan (before the store takes real customers or real money)

Status today: **demo / pre-launch.** The site is a static front-end — customer accounts, orders, the admin
panel and its login all live in the visitor's own browser (`localStorage`). That is fine for building and
showing the design, but it is **not secure** and must be replaced before launch.

## Known weak spots right now

| What | Where | Why it is unsafe |
|---|---|---|
| Owner login `sakib69alive@gmail.com` / `1234` | `admin-auth.js` | The whole file is public; only a SHA-256 hash is stored and `1234` is guessable in seconds. |
| Admin + CMS data (products, orders, coupons, settings) | `admin.js`, `cms.js`, `localStorage` | Anyone can edit their own browser storage; nothing is checked by a server. |
| Customer accounts and passwords | `auth.js` | Unsalted SHA-256 in the browser; sessions are just a flag in storage. |
| Orders / payment status | `order-service.js`, `checkout.html` | Prices and totals are computed in the browser and can be changed by the buyer. |
| Admin URLs are public | `admin.html`, `cms.html` | Only the (client-side) login stands in the way. |

## Plan, in order

1. **Real backend for auth (first).** Move login to a server (Netlify Functions, or the existing `server/` app).
   Passwords hashed with argon2/bcrypt, sessions in `HttpOnly; Secure; SameSite` cookies, short expiry,
   login rate-limiting and lockout. Delete the hard-coded owner credentials from `admin-auth.js`.
2. **Admin = server-protected.** `admin.html` / `cms.html` and every admin API call must check a server
   session and a role (Owner / Staff). Add 2-factor (TOTP) for the owner. Use a long random password stored
   only in a password manager.
3. **Data in a database, not `localStorage`.** Products, orders, users, coupons, reviews in a real DB
   (e.g. Supabase/Postgres or the `server/` SQLite → Postgres). The browser only reads what it is allowed to.
4. **Never trust the browser for money.** Recalculate prices, discounts, shipping and stock on the server at
   checkout; verify payment-gateway callbacks by signature (`server/routes`), never by the page's own redirect.
5. **Security headers** via a Netlify `_headers` file: `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` (or CSP `frame-ancestors`).
6. **Stop XSS.** Several pages build HTML with template strings from product/review/request text. Escape
   everything user-supplied (reviews, custom requests, names) and let the CSP block inline script where possible.
7. **Secrets.** API keys, payment secrets, DB URLs only in Netlify environment variables; `.env` stays out of git
   (already ignored for `server/`). Rotate anything that was ever committed.
8. **Accounts hygiene.** Turn on 2FA for both GitHub accounts and Netlify, protect `main` (pull request +
   review required), enable GitHub secret scanning and Dependabot.
9. **Monitoring.** Server-side audit log for admin actions (the current `logAudit` is browser-only), error
   alerts, and regular backups of the database.
10. **Pre-launch checklist.** Change every default password, remove demo data and demo coupons, run a dependency
    audit, test with a second account that it cannot read the first one's orders, then a basic penetration test.

Until steps 1–4 are done, **do not** use real customer data or take real payments on this site.
