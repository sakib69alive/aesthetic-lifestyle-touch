/* ================================================================
   SHARED PRODUCT DATA
   Single source of truth for Store (store.html) and Product Details
   (product.html). Swap this for an API response later without
   touching any render logic on either page.
   ================================================================ */

/* Escapes user-submitted text before it's interpolated into an innerHTML
   template — reviews, ticket subjects/messages, order notes, customer
   names, etc. are all typed by site visitors, so without this any of
   them could inject a working <script>/onerror handler into another
   visitor's — or the admin's — browser (stored XSS). Call it at the
   point of render, not at the point of storage, so search/CSV/audit
   consumers still get the original, unescaped value. */
function escapeHTML(str){
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CONTEXT_IMG = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80&auto=format&fit=crop";
const DETAIL_IMG  = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1000&q=80&auto=format&fit=crop";

/* Demo/test inventory — for trying out the storefront and admin panel.
   Replace or remove these from Admin → Products (or CMS → Products)
   once real inventory is ready; admin-added products are stored
   separately (see productExtras() below) and work exactly the same. */
const PRODUCTS = [
  { id: 1,  name: "Aura Headphones",     brand: "Aesthetic Lifestyle Touch", price: 20790, rating: 4.8, reviews: 124, stock: 32, tags: ["tech","new-arrivals"],            badge: "New",      desc: "Matte ceramic shell with adaptive spatial audio, tuned for long, quiet listening.", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#C9C2B4","#E8E6E1"],
    specs: { Dimensions: "18 × 16 × 7 cm", Weight: "270 g", Material: "Ceramic composite, memory foam", Compatibility: "Bluetooth 5.3, USB-C", "Country of Origin": "Assembled in Vietnam", Warranty: "2-Year Limited" } },
  { id: 2,  name: "Halo Desk Lamp",      brand: "Aesthetic Lifestyle Touch", price: 10560,  rating: 4.6, reviews: 98,  stock: 41, tags: ["desk-setup","trending"],          badge: "Trending", desc: "Anodized aluminum arm with three warmth settings and a weighted, silent base.", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#8A8A8A"],
    specs: { Dimensions: "48 cm height, 22 cm base", Weight: "1.1 kg", Material: "Anodized aluminum, weighted steel base", Compatibility: "USB-C powered, 100–240V", "Country of Origin": "Assembled in Taiwan", Warranty: "2-Year Limited" } },
  { id: 3,  name: "Orbit Watch",         brand: "Aesthetic Lifestyle Touch", price: 27390, rating: 4.9, reviews: 210, stock: 4,  tags: ["tech","new-arrivals","best-sellers"], badge: "New",  desc: "Sapphire face, ten-day battery, and a clasp machined from a single block of steel.", img: "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#C9C2B4"],
    specs: { Dimensions: "42 mm case", Weight: "58 g", Material: "Sapphire crystal, stainless steel", Compatibility: "iOS & Android", "Country of Origin": "Assembled in Switzerland", Warranty: "2-Year Limited" } },
  { id: 4,  name: "Dune Vase",           brand: "Aesthetic Lifestyle Touch", price: 7480,  rating: 4.7, reviews: 56,  stock: 19, tags: ["room-decor","lifestyle"],         badge: null,       desc: "Hand-poured stoneware with a soft matte finish, no two exactly alike.", img: "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=900&q=80&auto=format&fit=crop", colors: ["#E8E6E1","#C9C2B4"],
    specs: { Dimensions: "24 × 14 cm", Weight: "820 g", Material: "Hand-poured stoneware", Compatibility: "—", "Country of Origin": "Handmade in Portugal", Warranty: "30-Day Quality Guarantee" } },
  { id: 5,  name: "Tray Charger",        brand: "Aesthetic Lifestyle Touch", price: 8690,  rating: 4.5, reviews: 77,  stock: 27, tags: ["desk-setup","gadgets","new-arrivals"], badge: "New", desc: "Three-in-one wireless charging tray finished in woven performance fabric.", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#E8E6E1"],
    specs: { Dimensions: "20 × 12 × 1.2 cm", Weight: "180 g", Material: "Woven performance fabric, aluminum core", Compatibility: "Qi wireless, 3-in-1", "Country of Origin": "Assembled in Vietnam", Warranty: "1-Year Limited" } },
  { id: 6,  name: "Echo Speaker",        brand: "Aesthetic Lifestyle Touch", price: 14190, salePrice: 10890, rating: 4.6, reviews: 143, stock: 22, tags: ["tech","trending","best-sellers"], badge: "Trending", desc: "360° sound from a compact woven shell that looks at home anywhere.", img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&q=80&auto=format&fit=crop", colors: ["#C9C2B4","#0A0A0A"],
    specs: { Dimensions: "16 × 16 × 18 cm", Weight: "980 g", Material: "Woven acoustic fabric, aluminum", Compatibility: "Bluetooth 5.3, Wi-Fi", "Country of Origin": "Assembled in Vietnam", Warranty: "2-Year Limited" } },
  { id: 7,  name: "Fold Wallet",         brand: "Aesthetic Lifestyle Touch", price: 5940,  rating: 4.4, reviews: 61,  stock: 38, tags: ["accessories","lifestyle"],        badge: null,       desc: "Full-grain leather, RFID-shielded, breaks in beautifully over the first month.", img: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#8A8A8A","#C9C2B4"],
    specs: { Dimensions: "11 × 8.5 × 1.5 cm", Weight: "70 g", Material: "Full-grain leather, RFID shield", Compatibility: "Holds up to 8 cards", "Country of Origin": "Handmade in Italy", Warranty: "1-Year Craftsmanship" } },
  { id: 8,  name: "Ember Candle",        brand: "Aesthetic Lifestyle Touch", price: 4620,  rating: 4.8, reviews: 189, stock: 54, tags: ["room-decor","best-sellers"],     badge: null,       desc: "Poured into a matte concrete vessel; sixty hours of clean, quiet burn.", img: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=900&q=80&auto=format&fit=crop", colors: ["#E8E6E1"],
    specs: { Dimensions: "9 × 9 × 10 cm", Weight: "620 g", Material: "Concrete vessel, soy-coconut wax", Compatibility: "60-hour burn time", "Country of Origin": "Hand-poured in-house", Warranty: "Satisfaction Guarantee" } },
];

// Every product borrows the same two neutral "in context" / "detail" shots
// for gallery slots 2–3 until real multi-angle photography is available.
PRODUCTS.forEach(p => { p.gallery = [p.img, CONTEXT_IMG, DETAIL_IMG]; });

const CATEGORIES = [
  { label: "All",            slug: "all" },
  { label: "New Arrivals",   slug: "new-arrivals" },
  { label: "Trending",       slug: "trending" },
  { label: "Best Sellers",   slug: "best-sellers" },
  { label: "Accessories",    slug: "accessories" },
  { label: "Lifestyle",      slug: "lifestyle" },
  { label: "Tech",           slug: "tech" },
  { label: "Desk Setup",     slug: "desk-setup" },
  { label: "Room Decor",     slug: "room-decor" },
  { label: "Gadgets",        slug: "gadgets" },
];

function starString(rating){
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function categoryLabel(slug){
  const found = CATEGORIES.find(c => c.slug === slug);
  return found ? found.label : "Shop";
}

/* ================================================================
   BANGLADESH DIVISION -> DISTRICT MAP (representative subset)
   Shared by Checkout's shipping address and the Dashboard's saved
   addresses so both use the same geography data.
   ================================================================ */
const BD_DIVISIONS = {
  "Dhaka":        ["Dhaka","Gazipur","Narayanganj","Tangail","Manikganj","Munshiganj","Narsingdi"],
  "Chattogram":   ["Chattogram","Cox's Bazar","Cumilla","Feni","Noakhali","Rangamati","Bandarban"],
  "Rajshahi":     ["Rajshahi","Bogura","Pabna","Sirajganj","Naogaon","Natore"],
  "Khulna":       ["Khulna","Jessore","Satkhira","Bagerhat","Kushtia","Jhenaidah"],
  "Barishal":     ["Barishal","Patuakhali","Bhola","Pirojpur","Barguna"],
  "Sylhet":       ["Sylhet","Moulvibazar","Habiganj","Sunamganj"],
  "Rangpur":      ["Rangpur","Dinajpur","Kurigram","Gaibandha","Lalmonirhat"],
  "Mymensingh":   ["Mymensingh","Jamalpur","Netrokona","Sherpur"],
};

/* ================================================================
   ADMIN/CMS PRODUCT OVERLAY — the one place every page (storefront
   AND the admin/CMS tools) reads and writes admin-made product
   edits, so a change made in admin.html or cms.html is visible
   everywhere else without a rebuild.
   ================================================================ */
const PRODUCT_OVERRIDES_KEY = "alt_admin_product_overrides_v1";
const PRODUCT_EXTRAS_KEY = "alt_admin_extra_products_v1";
function productOverrides(){ try { return JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY) || "{}"); } catch (e) { return {}; } }
function saveProductOverrides(obj){ localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(obj)); }
function productExtras(){ try { return JSON.parse(localStorage.getItem(PRODUCT_EXTRAS_KEY) || "[]"); } catch (e) { return []; } }
function saveProductExtras(list){ localStorage.setItem(PRODUCT_EXTRAS_KEY, JSON.stringify(list)); }

/* Every product, overrides applied, minus anything admin deleted — used by
   admin.html/cms.html so they can see and manage drafts/archived items too. */
function getAllProductsWithOverrides(){
  const overrides = productOverrides();
  const base = PRODUCTS.map(p => Object.assign({}, p, overrides[p.id] || {}));
  const extra = productExtras().map(p => Object.assign({}, p, overrides[p.id] || {}));
  return base.concat(extra).filter(p => !p.deleted);
}

/* What customers should actually see: hides Draft/Review/Archived/Rejected,
   and Scheduled items whose publish date/time hasn't arrived yet. Every
   storefront page's product grid/lookup should read from this, not PRODUCTS
   directly, so admin/CMS edits show up on the live site immediately. */
function getStorefrontProducts(){
  const now = Date.now();
  return getAllProductsWithOverrides().filter(p => {
    if (p.status === "Draft" || p.status === "Archived" || p.status === "Rejected" || p.status === "Review") return false;
    if (p.status === "Scheduled" && p.scheduledAt && new Date(p.scheduledAt).getTime() > now) return false;
    return true;
  });
}

/* Single lookup + the two write paths (edit-in-place via override, or a
   brand new admin/CMS-added SKU). Moved here from admin.js/cms.js (where
   they used to be duplicated) so checkout — which needs to decrement
   stock on every order — can use the exact same functions without
   pulling in the whole admin app. */
/* Product IDs from the URL/DOM arrive as strings, but admin/CMS-added
   products keep string IDs (e.g. "a_1735993528123") while the older
   demo catalog used numeric ones — so a blind Number(id) turns a new
   product's ID into NaN and every lookup silently fails. Try Number()
   first (for legacy numeric IDs) and fall back to the raw string. */
function idOf(rawId){ const n = Number(rawId); return Number.isNaN(n) ? rawId : n; }
function getProduct(id){ return getAllProductsWithOverrides().find(p => p.id === id); }
function isExtraProduct(id){ return productExtras().some(p => p.id === id); }
function updateProduct(id, patch){
  const overrides = productOverrides();
  overrides[id] = Object.assign({}, overrides[id] || {}, patch);
  saveProductOverrides(overrides);
}
function addProduct(product){
  const extras = productExtras();
  extras.push(product);
  saveProductExtras(extras);
  return product;
}

/* ================================================================
   REVIEWS — single source of truth for admin.js's moderation queue
   AND the storefront's real per-product review display/submission.
   Every review already carries a real productId, so a customer's
   approved review just shows up on that exact product page — no
   separate demo/real split needed the way orders required.
   ================================================================ */
const REVIEWS_KEY = "alt_admin_reviews_v1";
function allReviews(){ try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]"); } catch (e) { return []; } }
function saveReviews(list){ localStorage.setItem(REVIEWS_KEY, JSON.stringify(list)); }
function reviewsForProduct(productId){
  return allReviews().filter(r => r.productId === productId && r.status === "approved")
    .sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
}

/* Reviews are gated to verified purchasers, one review per product per
   customer — hasPurchasedProduct() needs ordersForUser() from
   order-service.js, loaded on product.html alongside this file. */
function hasPurchasedProduct(userId, productId){
  if (!userId || userId === "guest" || typeof ordersForUser === "undefined") return false;
  return ordersForUser(userId).some(o => o.status === "delivered" && (o.items || []).some(it => it.productId === productId));
}
function hasReviewedProduct(userId, productId){
  if (!userId) return false;
  return allReviews().some(r => r.productId === productId && r.userId === userId);
}
function submitReview({ productId, productName, userId, author, rating, text, photos }){
  const errors = [];
  if (!hasPurchasedProduct(userId, productId)) errors.push("Only customers who've received this product can leave a review.");
  else if (hasReviewedProduct(userId, productId)) errors.push("You've already reviewed this product.");
  if (!author || !author.trim()) errors.push("Enter your name.");
  if (!rating || rating < 1 || rating > 5) errors.push("Choose a star rating.");
  if (!text || !text.trim()) errors.push("Write a few words about the product.");
  if (errors.length) return { ok: false, errors };

  const list = allReviews();
  list.unshift({
    id: "rev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    productId, productName, userId, author: author.trim(), rating, text: text.trim(),
    photos: Array.isArray(photos) ? photos.slice(0, 3) : [],
    helpfulBy: [],
    at: Date.now(), status: "pending", pinned: false, reply: null,
  });
  saveReviews(list);
  return { ok: true };
}

/* "Helpful" reactions — one vote per visitor per review. Logged-in
   visitors vote under their account id; guests get a persistent
   anonymous id stored locally, so a reload doesn't reset their vote. */
function reviewVoterId(){
  if (typeof Auth !== "undefined" && Auth.isLoggedIn()) return "user_" + Auth.currentUser().id;
  let id;
  try { id = localStorage.getItem("alt_anon_voter_v1"); } catch (e) { id = null; }
  if (!id){
    id = "anon_" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem("alt_anon_voter_v1", id); } catch (e) { /* private browsing — vote just won't persist */ }
  }
  return id;
}
function reviewHelpfulState(review){
  const voter = reviewVoterId();
  const helpfulBy = Array.isArray(review.helpfulBy) ? review.helpfulBy : [];
  return { count: helpfulBy.length, active: helpfulBy.includes(voter) };
}
function toggleReviewHelpful(reviewId){
  const list = allReviews();
  const r = list.find(x => x.id === reviewId);
  if (!r) return null;
  if (!Array.isArray(r.helpfulBy)) r.helpfulBy = [];
  const voter = reviewVoterId();
  const idx = r.helpfulBy.indexOf(voter);
  if (idx > -1) r.helpfulBy.splice(idx, 1);
  else r.helpfulBy.push(voter);
  saveReviews(list);
  return { count: r.helpfulBy.length, active: idx === -1 };
}
