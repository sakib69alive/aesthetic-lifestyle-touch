# Mobile Redesign Plan — Aesthetic Lifestyle Touch

> Written after a live audit at 390×844 (iPhone 12–15 size) on 2026‑10‑08.
> **Who executes this:** the coding model (Sonnet), phase by phase, top to bottom.
> **Owner's goal:** the customer site must feel *aesthetic, premium, stylish* on phones.
> Tablet (768px+) and desktop are **out of scope and must not change.**

---

## 0. Hard rules (read before touching anything)

1. **Mobile only.** Every visual change lives inside `@media (max-width: 767px) { … }`.
   Every mobile-only JS behaviour is guarded by
   `const isMobile = () => window.matchMedia('(max-width: 767px)').matches;`.
   Never edit un-prefixed or `md:`/`lg:` Tailwind classes in the HTML. Never change a
   rule that also applies at ≥768px.
2. **Where CSS goes.**
   - Shared tokens + shared components → `mobile.css` (already loaded on every page).
   - Page-specific rules → that page's own `<style>` block, in a final section headed
     `/* ===== MOBILE (≤767px) ===== */` wrapped in the media query. (Home.html already
     follows this pattern for `#product-stage`.)
   - Avoid adding new Tailwind classes. If one is unavoidable, rebuild:
     `npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify`
3. **Shared mobile JS** goes in one new file `mobile-ui.js` (bottom sheet, load-more, carousel
   dots). Load it with `defer` on customer pages only, after `mobile-nav.js`.
4. **Scope = customer pages only:** Home, store, collections, product, cart drawer
   (`cart.js/css`), checkout, account, wishlist, contact, about, request-product, terms,
   privacy. **Do not touch** admin.html, cms.html, dashboard.html, `shop.html.html` (stale copy).
5. **Both themes.** Every change must look right in light and dark (`:root[data-theme="dark"]`).
   Use the `--alt-*` variables, never raw hex, except where the existing code deliberately pins a tone.
6. **Respect `prefers-reduced-motion`.** Every new animation gets a reduced-motion off switch.
7. **One commit per phase/page**, on a branch `mobile-redesign`. Message format:
   `Mobile: <page> — <what changed>`.
8. **Verify before every commit** (section 6): 360 / 390 / 430 px in light + dark, and a
   768px + 1280px screenshot that must look identical to before.

---

## 1. Design direction — "Quiet luxury, editorial"

The brand already has a strong, restrained identity. **Keep it, don't redesign it.**
The mobile work is about *refinement*: calmer rhythm, bigger imagery, fewer competing elements,
thumb-friendly controls, and app-like gestures.

**Mood:** a printed lifestyle magazine crossed with a premium native app. Lots of air, large
photography, small precise mono labels, one black CTA per screen, soft surfaces, no clutter.

### 1.1 Tokens (add to `mobile.css`, inside the mobile media query, on `:root`)

| Token | Value | Use |
|---|---|---|
| Colours | unchanged: `--alt-white #FFF`, `--alt-surface #F5F4F1`, `--alt-black #0A0A0A`, `--alt-border #E8E6E1`, `--alt-beige #C9C2B4`, `--alt-muted #8A8A8A` (+ existing dark set) | Do **not** add new brand colours. Beige is the only accent. |
| `--m-gutter` | `20px` | Page side padding (currently 24px; 20px gives images more room) |
| `--m-section` | `56px` | Vertical gap between sections (desktop uses 80–112px; too airy on a phone) |
| `--m-section-tight` | `40px` | Sections that follow a header or another section of the same surface |
| `--m-radius-card` | `20px` | Product + collection cards |
| `--m-radius-sheet` | `28px` | Top corners of bottom sheets |
| `--m-radius-pill` | `999px` | Buttons, chips, inputs |
| `--m-shadow` | `0 18px 40px -20px rgba(10,10,10,.22)` | The single elevation used on mobile |
| `--m-ease` | `cubic-bezier(.16,1,.3,1)` | All motion (already the house curve) |
| `--m-header-h` | `56px` | Header height on mobile |
| `--m-bottom-safe` | `calc(96px + var(--sab))` | Bottom padding so the floating bottom bar never covers content |

### 1.2 Type scale (mobile)

| Role | Font | Size / line-height | Notes |
|---|---|---|---|
| Hero display | Space Grotesk 500 | `clamp(2.25rem, 10.5vw, 2.75rem)` / 1.05, tracking -0.02em | Max 3 lines |
| Section title (h2) | Space Grotesk 500 | `1.75rem` / 1.15, tracking -0.015em | Max 3 lines |
| Card title | Space Grotesk 500 | `0.9375rem` / 1.3 | 2-line clamp |
| Body | Inter 400 | `0.9375rem` (15px) / 1.6 | Muted colour for secondary text |
| Price | JetBrains Mono 500 | `0.875rem` | Tabular |
| Eyebrow / micro label | JetBrains Mono 400 | `11px`, uppercase, tracking 0.18em | **Minimum 11px anywhere** (except bottom-bar labels: 10px) |
| Inputs | Inter | **16px** | Prevents iOS zoom (already partly handled) |

Audit found 9–10px text in trust badges, "Future Ready", bottom-bar labels. Raise all to the table above.

### 1.3 Interaction & component language

- **Touch targets ≥ 44×44px**, ≥ 8px apart. The audit found 24–106 tappable elements under
  36px per page (mostly footer links at 35px height, icon buttons at 29px).
- **Press feedback:** `transform: scale(.97)` + 120ms on `:active` (exists; extend to cards).
- **One primary CTA per viewport**, black pill, full width or ≥ 56% width, 52px tall.
- **Bottom sheets instead of dropdowns/modals** for: sort, filters, quick view, share,
  cart. Grab handle (36×4px pill), 28px top radius, backdrop `rgba(10,10,10,.4)`,
  swipe-down or backdrop tap to close, body scroll locked while open.
- **Horizontal snap rails** for any list of cards that currently stacks into a very long
  column: `scroll-snap-type: x mandatory`, card width `78%` (so the next card "peeks"),
  `scroll-padding-inline: var(--m-gutter)`, hidden scrollbar, small progress dots or
  "1 / 6" mono counter.
- **Load more, not endless stacks:** grids show 12 items, then a
  `Showing 12 of 40` label + outline pill button "Load more".
- **Accordions** (`<details>`) for secondary information (footer groups, product specs,
  shipping, FAQ, policy sections).
- **Images:** `loading="lazy"` + `decoding="async"` below the fold, explicit
  `aspect-ratio` on every image box (no layout jump), `object-fit: cover`.
- **Motion:** entrance reveals 500–700ms with `--m-ease`, staggered max 4 items, translateY ≤ 16px.
  No parallax, no drifting animations on mobile (battery + jank).

---

## 2. Audit findings (390px, measured)

| Page | Page height now | Target | Main cause |
|---|---|---|---|
| **Footer (every page)** | **1,939px** | **≤ 900px** | Every block stacked full-width; contact, payments, trust, region selects all open |
| Home | 5,146 | ≤ 4,000 | Hero is an empty white screen on mobile (`#product-stage` hidden); collections section 2,338px (one giant card per screen) |
| Store | 8,485 | ≤ 5,000 | 40 products rendered at once (grid 5,917px) |
| **Collections** | **33,669** | **≤ 9,000** | `#co-all-grid` is `grid-cols-1` → 40 cards in ONE column = 17,612px; 10 rails × ~820px |
| Product | 6,998 | ≤ 5,000 | "Why this piece" = 5 full-width cards, 1,512px; header icon row crowds wordmark ("AESTHETIC LIFESTYLE T…"); scroll-to-top button collides with sticky buy bar |
| About | 14,517 | ≤ 8,000 | 13 sections with desktop padding; card lists stacked |
| Contact | 5,044 | ≤ 4,000 | Form section 1,311px |
| Terms / Privacy | 4.7k / 4.5k | — | Fine length; needs reading comfort + collapsible TOC |
| Account / sign-in | 1,004 | — | `.ambient-light` blobs make `scrollWidth` 530px (horizontal overflow); social sign-in buttons are icon-only with no labels |
| Request product | 4,002 | — | `[data-reveal]` sections can stay blank when the page is jumped/scrolled fast — make reveal fail-safe |

Other global findings:
- Floating **scroll-to-top** button sits on top of content and the product sticky bar.
- Bottom nav covers the footer's legal row ("Privacy Terms Cookies…").
- Store chip row / header overlap at the top when scrolled (check sticky `top` = header height).
- Nothing overflows horizontally except account page (good baseline).

---

## 3. Phases

### Phase 0 — Setup (no visual change)
1. `git checkout -b mobile-redesign`.
2. Take "before" screenshots at 768px and 1280px of every in-scope page; keep them in the
   scratchpad (not the repo) for later comparison.
3. Add the tokens from §1.1 and the type scale from §1.2 to `mobile.css`.
4. Create empty `mobile-ui.js` with the `isMobile()` helper; include it on in-scope pages.
5. Commit: `Mobile: tokens + mobile-ui.js scaffold`.

### Phase 1 — Global shell (biggest win, affects every page)
1. **Footer (`footer.js` / `footer.css`) — target ≤ 900px:**
   - Keep: wordmark + one-line tagline, newsletter (input + button on one row), the 3
     existing link-group accordions.
   - Turn **Contact**, **Payment methods**, **Why trust us** into accordions too
     (same `<details class="ft-group">` pattern, mobile only — on desktop render as now).
   - Social icons: one row, 44px circles, centred.
   - **Hide** the "Future Ready" region/currency/language row on mobile (they are disabled selects).
   - Legal row: wrap links with 12px gaps, 44px tap height, and add
     `padding-bottom: var(--m-bottom-safe)` so the bottom bar never covers it.
   - Footer link rows: 44px min-height (currently 35px).
2. **Header:** 56px tall, wordmark single line (already clamped). On **product.html** use the
   same compact header as the rest (logo + cart + menu); search/account/wishlist are in the
   bottom bar or menu. Sticky elements beneath the header (store chip row, checkout stepper)
   use `top: var(--m-header-h)`.
3. **Bottom bar (`mobile-nav.css`):** labels 10px, icon 22px, active item gets a beige dot under
   the icon instead of the grey chip (more premium). Keep the hide-on-idle behaviour.
4. **Scroll-to-top button:** hide on mobile (`display:none` ≤767px). The bottom bar's Home
   tap + native scroll-to-top (tap the status bar on iOS) cover it.
5. **Section rhythm:** in mobile.css, normalise `section.py-16/py-20/py-24` to
   `padding-block: var(--m-section)`, and `px-6` sections to `padding-inline: var(--m-gutter)`.
   Scope it carefully (only `main`/page sections, not header/footer/cart).
6. **Overflow:** give the `.ambient-light` parent `overflow: clip` (fixes account, also Home).
7. **Reveal fail-safe:** in each page's reveal script, also add `.in` to any `[data-reveal]`/
   `[data-enter]` already above the viewport, and add everything after 2.5s as a fallback.
8. **Minimum text size:** raise 9–10px labels (trust badges, "Future Ready", cart trust row) to 11px.
9. Commit per item group.

### Phase 2 — Home
1. **Hero (mobile only):** the hero is currently an empty white screen because the floating
   product stage is hidden. Build a mobile hero:
   - Height `88svh`. Full-bleed editorial image (pick the strongest lifestyle photo already
     used in the collections) in the top ~58%, rounded bottom corners 28px, with a soft
     bottom gradient into `--alt-white`.
   - Below it: eyebrow (mono 11px), headline (hero display, 3 lines max), one sentence of
     body, then **one** black pill CTA "Shop Now" (full width) + a text link "View Collections".
   - CTA sits in the thumb zone (lower third). Subtle 600ms fade-up stagger on load.
   - Desktop hero untouched (`#product-stage` keeps working there).
2. **Shop by Collection (2,338px → ~1,000px):** bento layout — first card full width, 4:5
   ratio; the rest 2-column, 3:4 ratio, 12px gap, title on a bottom gradient, "→" chip.
   If more than 5 collections, put the rest in a horizontal snap rail.
3. Optional (owner approval needed): a "Trending now" snap rail of 6 products under the hero
   (data from `products-data.js`, same card as store).
4. Commit.

### Phase 3 — Store (`store.html`)
1. Chip row: sticky under header, horizontal scroll, edge fade mask on the right, 40px chips.
2. Search + sort on one row: search field (flex 1) + square 44px "sort/filter" icon button that
   opens a **bottom sheet** with sort options (radio list) and category filters. Replace the
   dropdown `#sort-menu` on mobile.
3. Product grid: keep 2 columns, 12px gap. Card: image 4:5, rounded 20px, wishlist heart 40px
   circle top-right, title 2-line clamp, rating line, price (mono) + round 40px "+" add button
   (icon only on mobile to save space; label stays for screen readers).
4. **Load more:** render 12, then "Showing 12 of 40" + "Load more" pill (`mobile-ui.js`).
   Must still respect active filters/search.
5. Empty state + "Clear filters" styled as outline pill.
6. Commit.

### Phase 4 — Collections (`collections.html`) — 33,669px → ≤ 9,000px
1. `#co-all-grid`: **2 columns on mobile** (it is 1 column today) + load more (12 at a time).
2. Each collection rail (`#co-new-arrivals`, `#co-trending`, `#co-best-sellers`,
   `#co-desk-setup`, `#co-room-decor`, `#co-gadgets`, `#co-accessories`, `#co-gifts`):
   horizontal snap rail, 64% card width, section height ≤ 460px, "View all →" link in
   the section header row.
3. Interstitial editorial sections (the ~640px ones): image 16:10 + 2 lines of copy max.
4. Hero `#co-hero`: 70svh, not full screen.
5. Sticky jump-chip row ("New Arrivals · Trending · Best Sellers…") already exists — make it
   sticky under the header and highlight the current section while scrolling.
6. Commit.

### Phase 5 — Product page (`product.html`) — the conversion page, highest polish
1. **Gallery (`#gallery-stage`, `#thumb-row`):** full-bleed swipeable gallery (scroll-snap),
   aspect 4:5, edge to edge (no side padding), pill counter "1 / 4" bottom-right, dot
   indicators. Hide the thumbnail row on mobile. Tap opens fullscreen viewer (optional).
2. **Info block:** eyebrow (collection name), title (1.5rem), rating + review count link
   (scrolls to reviews), price large mono. Variant chips 44px. Quantity stepper 44px.
3. **CTA logic:** the inline Add to Cart / Buy Now buttons stay; the sticky `#mobile-bar`
   appears **only after the inline buttons scroll out of view** (IntersectionObserver),
   slides up 300ms. Sticky bar: price left, "Add to Cart" outline + "Buy Now" black, 52px,
   safe-area padding, light glass background.
4. Wishlist + share: same height (48px), wishlist full-width outline pill, share 48px circle.
5. **"Why this piece" (1,512px → ~420px):** horizontal snap rail of compact cards
   (icon + title + one line) at 70% width, OR a 2×2 grid of icon+title only. Pick the rail.
6. Description / specs / shipping & returns → accordions.
7. **Reviews:** show rating summary + 2 reviews + "See all reviews (124)" button opening a
   bottom sheet. Review form inside that sheet.
8. Related ("More from the collection"): already a rail — set 64% width + snap.
9. Hide floating scroll-to-top here (it collides with the sticky bar).
10. Commit.

### Phase 6 — Cart drawer (`cart.js` / `cart.css`)
1. On mobile render as a **bottom sheet** (92svh, 28px top radius, grab handle, swipe down to close).
2. Line items: 72px thumbnail, title, variant, qty stepper (44px), price; swipe-left or a
   small "Remove" text button.
3. Promo code collapsed behind "Have a promo code?" link.
4. **Sticky footer inside the sheet:** subtotal/total row + full-width "Checkout · ৳22,453"
   black button. "Continue shopping" becomes a text link above it.
5. Trust row: 4 icons with 11px labels, or remove on mobile (it's repeated at checkout).
6. Free-shipping progress bar at top if a threshold exists in the code (check before adding).
7. Commit.

### Phase 7 — Checkout (`checkout.html`) + Account (`account.html`)
Checkout (needs a signed-in test account to verify — create one locally with test data):
1. Stepper (`#stepper`) sticky under header, compact: 3 dots + current step name.
2. **Collapsible order summary bar** at top on mobile: "Show order summary ▾ ৳22,453"
   (the `lg:sticky` right column becomes this).
3. Forms: single column on screens < 400px except genuinely short pairs (City/ZIP).
   Add `autocomplete`, `inputmode="tel"`/`"numeric"`, `enterkeyhint="next"`.
   Inputs 52px, 16px font, 14px radius, label floats.
4. Delivery and payment option cards: full width, radio on the right, logo left, 64px tall.
5. **Sticky bottom CTA** ("Continue to payment" / "Place order · ৳X"), safe-area aware.
6. Success screen: big check animation (respect reduced motion), order number in mono.

Account / sign-in:
1. Fix horizontal overflow (Phase 1.6).
2. Social buttons: full-width outline pills with icon **and label** ("Continue with Google").
3. Signed-in dashboard: profile header card, then a list-style menu (Orders, Wishlist,
   Addresses, Rewards, Sign out) with 56px rows and chevrons — native-settings feel.
4. Commit.

### Phase 8 — Wishlist, Contact, About, Request product, Terms, Privacy
- **Wishlist:** 2-col grid like store; "Move to cart" 40px pill; elegant empty state
  (line icon, one sentence, "Explore the store" CTA).
- **Contact:** quick-action row at top (Call · WhatsApp · Email as 3 tiles, 72px),
  form below, map/hours as accordion.
- **About (14,517 → ≤ 8,000):** apply section rhythm; card lists → snap rails; hero 70svh;
  stats in 2×2 grid; FAQ stays accordion.
- **Request product:** reveal fail-safe (Phase 1.7); the 8 steps as a vertical timeline
  with a thin beige line; form inputs per §1.2.
- **Terms / Privacy:** 15px/1.7 body, h2 1.25rem, "On this page" collapsible TOC at top,
  section anchors offset by header height (`scroll-margin-top`).
- One commit per page.

### Phase 9 — Performance & polish
1. All below-the-fold `<img>`: `loading="lazy" decoding="async"`; hero image
   `fetchpriority="high"`.
2. Loader (`loader.js`): on mobile, never show longer than 800ms; skip on repeat visits in the
   same session.
3. Remove/disable on mobile any infinite CSS animations (`drift-*`), `will-change` left on idle
   elements, and backdrop-filter on large areas (header/bottom bar already done).
4. Check fonts: `display=swap` is present; preload only Space Grotesk 500 if needed.
5. Lighthouse mobile run on Home, Store, Product: Performance ≥ 85, Accessibility ≥ 95,
   CLS < 0.05. Record scores in the commit message.
6. Final dark-mode pass on every page.

---

## 4. File map (where each change lives)

| Area | Files |
|---|---|
| Tokens, global components, section rhythm | `mobile.css` |
| Bottom bar, menu overlay | `mobile-nav.css`, `mobile-nav.js` |
| Footer | `footer.js`, `footer.css` |
| Bottom sheet, load-more, rail dots, reveal fail-safe helper | **new** `mobile-ui.js` |
| Cart sheet | `cart.js`, `cart.css` |
| Search overlay | `search.js`, `search.css` (only touch-target fixes) |
| Page-specific | each page's own `<style>` block (MOBILE section) + inline script |

---

## 5. Out of scope / ask the owner first

- Any change ≥768px wide.
- Admin, CMS, dashboard pages.
- New content or sections (e.g. Home "Trending now" rail) — ask first.
- Changing brand colours, fonts or logo.
- Server / payment code.

---

## 6. Verification checklist (run before each commit)

Use the built-in browser preview (`.claude/launch.json` → `site`, port 5500).

1. `resize_window` 360×780, 390×844, 430×932; light **and** dark.
2. Run this audit snippet in the console on the page and compare with §2 targets:

```js
const W = document.documentElement.clientWidth;
({
  height: document.documentElement.scrollHeight,
  overflowX: document.documentElement.scrollWidth > W,
  tapsUnder44: [...document.querySelectorAll('a,button,input,select,[role=button]')]
    .filter(e => { const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)
        && !e.closest('p, li > p'); }).length,
  textUnder11: [...document.querySelectorAll('body *')].filter(e =>
    e.children.length === 0 && e.textContent.trim() &&
    e.getBoundingClientRect().width > 0 &&
    parseFloat(getComputedStyle(e).fontSize) < 11).length,
  footer: Math.round(document.getElementById('site-footer')?.getBoundingClientRect().height || 0),
});
```

3. Interact: open/close menu, cart sheet, sort sheet; add to cart; swipe gallery; load more.
4. Console has no errors.
5. Resize to 768px and 1280px and compare with the Phase 0 "before" screenshots — **must be identical**.
6. Reset the viewport (`preset: "desktop"`).

**Done = ** every §2 target met, no horizontal overflow, no tap target < 44px outside
paragraph text, no text < 11px (except bottom-bar labels), both themes checked,
tablet/desktop unchanged.
