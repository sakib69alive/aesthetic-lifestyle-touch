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

/* Empty on purpose — this was sample/demo inventory for building and
   testing the storefront. Add your real catalog from Admin → Products
   (or CMS → Products); it's stored separately (see productExtras()
   below) and works exactly the same as everything that used to be
   listed here. */
const PRODUCTS = [];

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
