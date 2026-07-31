# Deployment Notes — Aesthetic Lifestyle Touch

This file explains what this project is made of, how it's hosted on
GitHub Pages, and exactly what to do later if you buy a real domain.

## What this site actually is

A **static** storefront — plain HTML/CSS/JS, no build step, no real
backend for the shopping experience itself. Every page reads and
writes its data (products, cart, orders, users, coupons, loyalty
points, reviews, admin settings...) straight into the browser's
`localStorage`. That's why it can be hosted for free on GitHub Pages:
there's no server-side code to run for the storefront to work.

The one exception is the `server/` folder — a small Node.js/Express
backend that talks to the SSLCommerz payment gateway for real online
card/bKash/Nagad/Rocket payments. **GitHub Pages cannot run this** (it
only serves static files). It's kept in the repo so the code isn't
lost, but it needs its own separate host to actually go live — see
"Turning on real online payments" below. Until then, Cash on Delivery
and the manual-transfer payment methods on checkout still work fine,
since those don't need a server at all.

## What's hosted where right now

- **GitHub Pages** serves everything at the repo root (`Home.html`,
  `store.html`, `checkout.html`, `admin.html`, all the `.js`/`.css`
  files, etc.) as plain static files, straight from this repo's `main`
  branch.
- `index.html` immediately redirects to `Home.html` — that's the real
  homepage.
- `robots.txt` tells well-behaved search engines not to index
  `admin.html` or `cms.html`. That's a hint to crawlers only, **not**
  real security — anyone who has the direct link can still open those
  pages, same as before. The admin/CMS login is a client-side password
  check, not a server-verified one, because there's no server. Don't
  rely on this alone to keep the admin panel private — treat the URL
  itself as something to keep off any public link list.

## Turning on real online payments later

1. Deploy the `server/` folder to any Node host (Render, Railway,
   Fly.io, a VPS — Render's free tier is the easiest starting point).
2. Copy `server/.env.example` to `.env` on that host and fill in your
   real SSLCommerz Store ID/Password (get these free from
   https://developer.sslcommerz.com/registration/ — see
   `server/README.md` for the full walkthrough).
3. In `checkout.html`, find the `PAYMENT_SERVER_URL` constant near the
   top of the checkout script and change it from `http://localhost:4000`
   to your deployed backend's URL.
4. Commit and push that one-line change — GitHub Pages redeploys
   automatically within a minute or two.

## Adding a custom domain later (e.g. you buy alifestyletouch.com)

Right now the site lives at `https://<your-github-username>.github.io/<repo-name>/`.
To point a real domain at it instead:

1. Buy the domain from any registrar (Namecheap, Hostinger, etc.).
2. In the GitHub repo: **Settings → Pages → Custom domain** — type in
   your domain (e.g. `www.alifestyletouch.com`) and save. GitHub
   creates a `CNAME` file in the repo automatically for you — you
   don't need to make it by hand.
3. At your domain registrar's DNS settings, add:
   - For a `www` subdomain: a **CNAME** record — `www` → `<your-github-username>.github.io`
   - For the bare/apex domain (`alifestyletouch.com` with no `www`):
     four **A** records pointing at GitHub Pages' IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. DNS changes can take anywhere from a few minutes to ~24 hours to
   spread. Once it resolves, go back to **Settings → Pages** and check
   the **Enforce HTTPS** box — GitHub issues a free SSL certificate for
   your domain automatically.
5. That's it — no code changes needed anywhere else in the project for
   the domain switch itself.

## Making day-to-day changes after this is live

Any edit you (or Claude) make and push to the `main` branch redeploys
the live site automatically — usually live within 1–2 minutes. No
separate "publish" step.
