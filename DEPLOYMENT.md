# Deployment Notes — Aesthetic Lifestyle Touch

This file explains what this project is made of, how it's hosted, and
exactly what to do later if you buy a real domain.

## What this site actually is

A **static** storefront — plain HTML/CSS/JS, no build step, no real
backend for the shopping experience itself. Every page reads and
writes its data (products, cart, orders, users, coupons, loyalty
points, reviews, admin settings...) straight into the browser's
`localStorage`. That's why it can be hosted for free: there's no
server-side code to run for the storefront to work.

The one exception is the `server/` folder — a small Node.js/Express
backend that talks to the SSLCommerz payment gateway for real online
card/bKash/Nagad/Rocket payments. **The static host below cannot run
this** (it only serves static files). It's kept in the repo so the
code isn't lost, but it needs its own separate host to actually go
live — see "Turning on real online payments" below. Until then, Cash
on Delivery and the manual-transfer payment methods on checkout still
work fine, since those don't need a server at all.

## What's hosted where right now

- **GitHub repo**: `akibur-rahman99/aesthetic-lifestyle-touch` — kept
  **private** on purpose, so the source code (admin login logic,
  reward probabilities, discount rules, etc.) isn't publicly viewable
  or clonable by anyone browsing GitHub. Private visibility only
  controls who can *see the code on GitHub* — it has no effect on who
  can push to it (that's controlled separately, under
  Settings → Collaborators, and stays limited to whoever you
  explicitly add).
- **Netlify** is connected directly to that private repo and deploys
  the live site from it — this is what makes "private code, public
  website" possible for free. (GitHub Pages was tried first, but
  GitHub's free plan only serves Pages sites publicly from a *public*
  repo — private-repo Pages needs a paid GitHub plan. Netlify does it
  for free, which is why the site actually lives there.)
- **Live URL**: https://aestheticlifestyletouch.netlify.app
  (renamed from Netlify's auto-generated name to reserve this exact
  subdomain — can be changed again any time in Netlify → Project
  configuration → Change project name, or replaced entirely once you
  attach a custom domain — see below.)
- The Netlify project itself is set to **Public** access (Project
  overview → the visibility toggle next to the project name) — this is
  what makes the live site visible to ordinary visitors, separate from
  the GitHub repo's own private visibility.
- `index.html` immediately redirects to `Home.html` — that's the real
  homepage.
- `robots.txt` tells well-behaved search engines not to index
  `admin.html` or `cms.html`. That's a hint to crawlers only, **not**
  real security — anyone who has the direct link can still open those
  pages. The admin/CMS login is a client-side password check, not a
  server-verified one, because there's no server. Don't rely on this
  alone to keep the admin panel private — treat the URL itself as
  something to keep off any public link list.

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
4. Commit and push that one-line change — Netlify redeploys
   automatically within a minute or two.

## Adding a custom domain later (e.g. you buy alifestyletouch.com)

1. Buy the domain from any registrar (Namecheap, Hostinger, etc.).
2. In Netlify: **Project configuration → Domain management → Add a
   domain** — type in your domain and follow the prompts.
3. Netlify shows you exactly which DNS records to add at your
   registrar (usually a single **CNAME** for `www`, or Netlify's own
   nameservers if you want them to manage DNS entirely — either works,
   Netlify's UI explains both options when you add the domain).
4. DNS changes can take anywhere from a few minutes to ~24 hours to
   spread. Netlify auto-provisions a free SSL certificate for the
   domain once it resolves — no separate step needed.
5. That's it — no code changes needed anywhere else in the project for
   the domain switch itself.

## Making day-to-day changes after this is live

Any edit you (or Claude) make and push to the `main` branch on GitHub
redeploys the live Netlify site automatically — usually live within a
minute. No separate "publish" step.
