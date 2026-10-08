/* ================================================================
   SHARED SHOPPING CART
   One drawer, injected into every page (Home, Store, Product) that
   includes this file. State lives in localStorage so the cart
   survives navigation and refresh. Depends on products-data.js
   (getProduct/getStorefrontProducts, starString) being loaded first —
   always look products up through those, never PRODUCTS directly, or
   anything an admin added after the fact (everything not in the
   original seed catalog) silently can't be added to cart/wishlist. */

const CART_STORAGE_KEY = "alt_cart_v1";
const FREE_SHIPPING_THRESHOLD = 15000;
const FLAT_SHIPPING = 60;
const TAX_RATE = 0.08;
const COUPONS = { "WELCOME10": 0.10 };
function bdt(n){ return "৳" + Math.round(n || 0).toLocaleString(); }

/* Richer coupons created from the admin dashboard (percentage / fixed /
   free-shipping, with expiry + minimum purchase) live alongside the
   legacy COUPONS map above — this is the one place checkout reads them.
   Reward Vault-issued codes add two more checks: customerId (locks a
   scratch-card win to whoever scratched it — someone else pasting the
   code should never be able to use it) and usageLimit (a plain count
   cap, checked here since usedCount already lives on the same record). */
function getAdminCoupon(code){
  try {
    const coupon = (JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]"))
      .find(c => c.code === code && c.active && (!c.expiry || c.expiry > Date.now()));
    if (!coupon) return null;
    if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) return null;
    if (coupon.customerId){
      const currentId = (typeof Auth !== "undefined" && Auth.isLoggedIn()) ? Auth.currentUser().id : null;
      if (coupon.customerId !== currentId) return null;
    }
    return coupon;
  } catch (e) { return null; }
}
function bumpAdminCouponUsage(code){
  try {
    const list = JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]");
    const c = list.find(x => x.code === code);
    if (c){
      c.usedCount = (c.usedCount || 0) + 1;
      c.redeemedAt = Date.now();
      localStorage.setItem("alt_admin_coupons_v1", JSON.stringify(list));
    }
  } catch (e) { /* no-op */ }
}

/* ================================================================
   SHARED WISHLIST
   Persisted (unlike Cart, not tied to a user account — it's a
   browser-level list, same as the Cart, so it works for guests too).
   The Dashboard's Wishlist view reads this exact store.
   ================================================================ */
const WISHLIST_STORAGE_KEY = "alt_wishlist_v1";
const Wishlist = {
  // Internal shape: [{ id, addedAt }]. Older saves were plain numeric ids —
  // normalized here so nothing breaks for a browser that saved before this.
  _entries(){
    try {
      const raw = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]");
      return raw.map(e => typeof e === "number" ? { id: e, addedAt: Date.now() } : e);
    } catch (e) { return []; }
  },
  _save(entries){ localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries)); },

  ids(){ return this._entries().map(e => e.id); },
  has(productId){ return this.ids().includes(productId); },
  addedAt(productId){ const e = this._entries().find(x => x.id === productId); return e ? e.addedAt : null; },
  toggle(productId){
    const entries = this._entries();
    const idx = entries.findIndex(e => e.id === productId);
    const wasAdded = idx === -1;
    if (wasAdded) entries.push({ id: productId, addedAt: Date.now() });
    else entries.splice(idx, 1);
    this._save(entries);
    syncWishlistBadge();
    // A short, subtle haptic tap on add only — nothing on remove, so
    // clearing items never feels like a buzzing scolding.
    if (wasAdded && navigator.vibrate) navigator.vibrate(12);
    return wasAdded;
  },
  remove(productId){ this._save(this._entries().filter(e => e.id !== productId)); syncWishlistBadge(); },
  count(){ return this.ids().length; },
  products(){ return this.ids().map(id => getProduct(id)).filter(Boolean); },

  // Dashboard-only: same products, sorted by when they were saved or by price.
  productsSorted(sort){
    let list = this._entries()
      .map(e => ({ ...e, product: getProduct(e.id) }))
      .filter(x => x.product);
    if (sort === "price-asc") list.sort((a, b) => (a.product.salePrice || a.product.price) - (b.product.salePrice || b.product.price));
    else if (sort === "price-desc") list.sort((a, b) => (b.product.salePrice || b.product.price) - (a.product.salePrice || a.product.price));
    else list.sort((a, b) => b.addedAt - a.addedAt);
    return list.map(x => x.product);
  },

  // Full { id, addedAt, product } entries — for pages (Wishlist) that need
  // more sort options than productsSorted() covers.
  entries(){
    return this._entries()
      .map(e => ({ ...e, product: getProduct(e.id) }))
      .filter(x => x.product);
  },
};

/* ================================================================
   HEART PULSE — ripple + scale-burst + glow, shared by every "add to
   wishlist" button across Store, Product, Search, and the Wishlist page.
   ================================================================ */
function pulseHeart(btnEl){
  if (!btnEl) return;
  btnEl.classList.remove("heart-pulse");
  void btnEl.offsetWidth; // restart animation if clicked rapidly
  btnEl.classList.add("heart-pulse");
  setTimeout(() => btnEl.classList.remove("heart-pulse"), 700);
}

// Soft highlight on the product itself (card or gallery), not just the
// heart icon — pass whatever container element visually represents the
// product on the current page.
function glowCard(el){
  if (!el) return;
  el.classList.remove("card-glow");
  void el.offsetWidth;
  el.classList.add("card-glow");
  setTimeout(() => el.classList.remove("card-glow"), 900);
}

/* Keeps the header's wishlist icon badge (and the mobile bottom-nav one, if present) in sync. */
function syncWishlistBadge(){
  const n = Wishlist.count();
  const badge = document.getElementById("wishlist-badge");
  if (badge){ badge.textContent = n; badge.classList.toggle("show", n > 0); }
  const mnavBadge = document.getElementById("mnav-wishlist-badge");
  if (mnavBadge){ mnavBadge.textContent = n; mnavBadge.classList.toggle("show", n > 0); }
}

const Cart = {
  items: [],      // { lineId, productId, qty, color, size }
  coupon: null,
  lastFocused: null,

  /* ---------------- persistence ---------------- */
  load(){
    try {
      const raw = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}");
      this.items = Array.isArray(raw.items) ? raw.items : [];
      this.coupon = raw.coupon || null;
    } catch (e) {
      this.items = [];
      this.coupon = null;
    }
    // Backfill lineId on any line saved before that field existed — without
    // it, its data-line-id renders as "undefined" and never matches a real
    // line lookup, silently breaking that row's remove/qty buttons.
    let healed = false;
    this.items.forEach(l => {
      if (!l.lineId){ l.lineId = `${l.productId}-${l.color}-${l.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; healed = true; }
    });
    if (healed) this.save();
  },
  save(){
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: this.items, coupon: this.coupon }));
  },

  /* ---------------- derived data ---------------- */
  // Enriched lines — live product data joined onto stored cart lines.
  // A line for a product removed from the catalog is silently dropped.
  lines(){
    return this.items
      .map(line => ({ line, product: getProduct(line.productId) }))
      .filter(x => x.product);
  },
  count(){
    return this.lines().reduce((sum, { line }) => sum + line.qty, 0);
  },
  totals(){
    const lines = this.lines();
    const subtotal = lines.reduce((sum, { line, product }) => sum + line.qty * (product.salePrice || product.price), 0);
    const adminCoupon = this.coupon ? getAdminCoupon(this.coupon) : null;
    let discount = 0, freeShippingOverride = false;
    if (adminCoupon){
      if (subtotal >= (adminCoupon.minPurchase || 0)){
        if (adminCoupon.type === "percentage"){
          discount = subtotal * (adminCoupon.value / 100);
          if (adminCoupon.maxDiscount) discount = Math.min(discount, adminCoupon.maxDiscount);
        }
        else if (adminCoupon.type === "fixed") discount = Math.min(subtotal, adminCoupon.value);
        else if (adminCoupon.type === "free-shipping") freeShippingOverride = true;
      }
    } else {
      const discountRate = this.coupon && COUPONS[this.coupon] ? COUPONS[this.coupon] : 0;
      discount = subtotal * discountRate;
    }
    const afterDiscount = subtotal - discount;
    const shipping = lines.length === 0 ? 0 : (freeShippingOverride || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING);
    const tax = afterDiscount * TAX_RATE;
    const total = afterDiscount + shipping + tax;
    return { subtotal, discount, shipping, tax, total };
  },

  /* ---------------- mutations ---------------- */
  add(productId, variant = {}, qty = 1){
    const product = getProduct(productId);
    if (!product || product.stock === 0) return;
    const color = variant.color || (product.colors ? product.colors[0] : null);
    const size = variant.size || (product.sizes ? product.sizes[0] : null);

    const existing = this.items.find(l => l.productId === productId && l.color === color && l.size === size);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock);
    } else {
      this.items.push({ lineId: `${productId}-${color}-${size}-${Date.now()}`, productId, qty: Math.min(qty, product.stock), color, size });
    }
    this.save();
    this.render();
    this.syncBadges();
  },
  setQty(lineId, qty){
    const line = this.items.find(l => l.lineId === lineId);
    if (!line) return;
    const product = getProduct(line.productId);
    const max = product ? product.stock : 99;
    line.qty = Math.max(1, Math.min(qty, max));
    this.save();
    this.updateLineUI(lineId);
    this.updateSummaryUI();
    this.syncBadges();
  },
  removeLine(lineId){
    this.save(); // persist happens after the fade in animateRemoveLine()
    this.animateRemoveLine(lineId);
  },
  applyCoupon(code){
    const trimmed = code.trim().toUpperCase();
    if (!trimmed){
      this.showCouponFeedback("Enter a code to apply.", "error");
      return;
    }
    const adminCoupon = getAdminCoupon(trimmed);
    if (adminCoupon){
      const subtotal = this.totals ? this.lines().reduce((sum, { line, product }) => sum + line.qty * (product.salePrice || product.price), 0) : 0;
      if (subtotal < (adminCoupon.minPurchase || 0)){
        this.showCouponFeedback(`Add ${subtotal ? "more to your cart" : "items to your cart"} — this code needs a ${bdt(adminCoupon.minPurchase)} minimum.`, "error");
        return;
      }
      this.coupon = trimmed;
      this.save();
      this.updateSummaryUI();
      bumpAdminCouponUsage(trimmed);
      const label = adminCoupon.type === "percentage" ? `${adminCoupon.value}% off` : adminCoupon.type === "fixed" ? `${bdt(adminCoupon.value)} off` : "free shipping";
      this.showCouponFeedback(`Code applied — ${label}.`, "success");
    } else if (COUPONS[trimmed]){
      this.coupon = trimmed;
      this.save();
      this.updateSummaryUI();
      this.showCouponFeedback(`Code applied — ${Math.round(COUPONS[trimmed]*100)}% off.`, "success");
    } else {
      this.showCouponFeedback("That code isn't valid.", "error");
    }
  },
  showCouponFeedback(msg, kind){
    const el = document.getElementById("cart-coupon-feedback");
    if (!el) return;
    el.textContent = msg;
    el.className = `cart-coupon-feedback show ${kind}`;
  },

  /* ---------------- badge sync (per-page cart icon) ---------------- */
  syncBadges(){
    const badge = document.getElementById("cart-badge");
    const icon = document.getElementById("cart-icon");
    const n = this.count();
    if (badge){
      badge.textContent = n;
      badge.classList.toggle("show", n > 0);
    }
    if (icon){
      icon.setAttribute("aria-label", `Cart, ${n} item${n === 1 ? "" : "s"}`);
      icon.classList.remove("bump", "cart-icon-bump");
      void icon.offsetWidth;
      icon.classList.add("cart-icon-bump");
    }
    const mnavBadge = document.getElementById("mnav-cart-badge");
    if (mnavBadge){ mnavBadge.textContent = n; mnavBadge.classList.toggle("show", n > 0); }
  },

  /* ---------------- drawer open/close ---------------- */
  open(){
    document.getElementById("cart-overlay").classList.add("open");
    document.getElementById("cart-drawer").classList.add("open");
    document.documentElement.style.overflow = "hidden";
    this.render();
    this.lastFocused = document.activeElement;
    document.getElementById("cart-drawer-close").focus();
  },
  close(){
    document.getElementById("cart-overlay").classList.remove("open");
    document.getElementById("cart-drawer").classList.remove("open");
    document.documentElement.style.overflow = "";
    if (this.lastFocused && this.lastFocused.focus) this.lastFocused.focus();
  },

  /* ---------------- checkout hand-off ---------------- */
  goToCheckout(){
    if (this.count() === 0) return;
    const curtain = document.getElementById("checkout-curtain");
    curtain.classList.add("active");
    setTimeout(() => { window.location.href = "checkout.html"; }, 650);
  },

  /* ---------------- rendering ---------------- */
  render(){
    const lines = this.lines();
    const itemsEl = document.getElementById("cart-items-list");
    const emptyEl = document.getElementById("cart-empty");
    const countEl = document.getElementById("cart-drawer-count");
    const bodyEl = document.getElementById("cart-drawer-body");
    const footerEl = document.getElementById("cart-drawer-footer");

    countEl.textContent = `${this.count()} item${this.count() === 1 ? "" : "s"}`;

    if (lines.length === 0){
      itemsEl.innerHTML = "";
      itemsEl.style.display = "none";
      document.getElementById("cart-summary-block").style.display = "none";
      document.getElementById("cart-recommended-block").style.display = "none";
      emptyEl.classList.add("show");
      footerEl.style.display = "none";
      return;
    }

    emptyEl.classList.remove("show");
    itemsEl.style.display = "";
    document.getElementById("cart-summary-block").style.display = "";
    footerEl.style.display = "flex";

    itemsEl.innerHTML = lines.map(({ line, product }) => cartItemHTML(line, product)).join("");
    wireItemEvents();

    this.updateSummaryUI();
    renderRecommended(lines.map(l => l.product.id));
  },

  updateLineUI(lineId){
    const line = this.items.find(l => l.lineId === lineId);
    const product = line && getProduct(line.productId);
    if (!line || !product) return;
    const row = document.querySelector(`.cart-item[data-line-id="${lineId}"]`);
    if (!row) return;
    row.querySelector(".cart-qty-value").textContent = line.qty;
    const unit = product.salePrice || product.price;
    row.querySelector(".cart-line-total").textContent = bdt(unit * line.qty);
    row.querySelector(".cart-qty-minus").disabled = line.qty <= 1;
    row.querySelector(".cart-qty-plus").disabled = line.qty >= product.stock;
  },

  updateSummaryUI(){
    const { subtotal, discount, shipping, tax, total } = this.totals();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("cart-subtotal", bdt(subtotal));
    set("cart-discount", discount > 0 ? `-${bdt(discount)}` : bdt(0));
    set("cart-shipping", shipping === 0 ? "Free" : bdt(shipping));
    set("cart-tax", bdt(tax));
    set("cart-total", bdt(total));
  },

  animateRemoveLine(lineId){
    const row = document.querySelector(`.cart-item[data-line-id="${lineId}"]`);
    this.items = this.items.filter(l => l.lineId !== lineId);
    this.save();
    this.syncBadges();
    if (!row){ this.render(); return; }

    const startHeight = row.getBoundingClientRect().height;
    row.style.maxHeight = `${startHeight}px`;
    row.style.opacity = "1";
    requestAnimationFrame(() => {
      row.style.maxHeight = "0px";
      row.style.opacity = "0";
      row.style.paddingTop = "0px";
      row.style.paddingBottom = "0px";
      row.style.borderBottomWidth = "0px";
    });
    setTimeout(() => { this.render(); }, 380);
  },
};

/* ================================================================
   TEMPLATES
   ================================================================ */
function cartItemHTML(line, product){
  const unit = product.salePrice || product.price;
  return `
    <article class="cart-item" data-line-id="${line.lineId}">
      <div class="cart-item-img">
        <img src="${typeof thumb === "function" ? thumb(product.img, 200) : product.img}" alt="${product.name}" loading="lazy" decoding="async"
             onerror="this.style.opacity='0.4';" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <h4 class="cart-font-display text-[14px] font-medium leading-snug">${product.name}</h4>
          <button class="cart-icon-btn shrink-0" data-action="remove" aria-label="Remove ${product.name} from cart">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
            </svg>
          </button>
        </div>
        <div class="cart-item-variant mt-1">
          ${line.color ? `<span class="cart-swatch-dot" style="background:${line.color};"></span>` : ""}
          ${line.size ? `<span>Size ${line.size}</span>` : ""}
          ${!line.color && !line.size ? `<span>Standard</span>` : ""}
        </div>
        <div class="mt-3 flex items-center justify-between">
          <div class="cart-qty-stepper" role="group" aria-label="Quantity for ${product.name}">
            <button class="cart-qty-btn cart-qty-minus" data-action="qty-minus" aria-label="Decrease quantity" ${line.qty <= 1 ? "disabled" : ""}>–</button>
            <span class="cart-qty-value cart-font-mono text-xs w-6 text-center" aria-live="polite">${line.qty}</span>
            <button class="cart-qty-btn cart-qty-plus" data-action="qty-plus" aria-label="Increase quantity" ${line.qty >= product.stock ? "disabled" : ""}>+</button>
          </div>
          <div class="flex items-center gap-3">
            <button class="cart-icon-btn" data-action="wishlist" aria-label="Move ${product.name} to wishlist">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/>
              </svg>
            </button>
            <span class="cart-line-total cart-font-mono text-sm">${bdt(unit * line.qty)}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function wireItemEvents(){
  document.querySelectorAll("#cart-items-list .cart-item").forEach(row => {
    const lineId = row.dataset.lineId;
    const line = Cart.items.find(l => l.lineId === lineId);
    if (!line) return;

    row.querySelector('[data-action="qty-minus"]').addEventListener("click", () => Cart.setQty(lineId, line.qty - 1));
    row.querySelector('[data-action="qty-plus"]').addEventListener("click", () => Cart.setQty(lineId, line.qty + 1));
    row.querySelector('[data-action="remove"]').addEventListener("click", () => Cart.removeLine(lineId));
    row.querySelector('[data-action="wishlist"]').addEventListener("click", (e) => {
      e.currentTarget.classList.toggle("active");
    });
  });
}

function renderRecommended(excludeIds){
  const excluded = new Set(excludeIds);
  let picks = getStorefrontProducts().filter(p => !excluded.has(p.id) && p.stock > 0);
  const cartTags = new Set(Cart.lines().flatMap(({ product }) => product.tags));
  picks.sort((a, b) => {
    const aMatch = a.tags.some(t => cartTags.has(t)) ? 1 : 0;
    const bMatch = b.tags.some(t => cartTags.has(t)) ? 1 : 0;
    return bMatch - aMatch;
  });
  picks = picks.slice(0, 6);

  const block = document.getElementById("cart-recommended-block");
  if (picks.length === 0){ block.style.display = "none"; return; }
  block.style.display = "";

  document.getElementById("cart-recommended-row").innerHTML = picks.map(p => `
    <div class="cart-rec-card" data-id="${p.id}">
      <div class="cart-rec-stage">
        <img src="${typeof thumb === "function" ? thumb(p.img, 240) : p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.style.opacity='0.4';" />
      </div>
      <p class="cart-font-display text-[12px] font-medium mt-2 leading-snug truncate">${p.name}</p>
      <p class="cart-font-mono text-[12px] text-[var(--alt-muted)] mt-0.5">${bdt(p.salePrice || p.price)}</p>
    </div>
  `).join("");

  document.querySelectorAll("#cart-recommended-row .cart-rec-card").forEach(card => {
    card.addEventListener("click", () => {
      Cart.close();
      window.location.href = `product.html?id=${card.dataset.id}`;
    });
  });
}

/* ================================================================
   SHARED HELPERS — reused by Store & Product "Add to Cart" flows
   ================================================================ */
function showCartToast(msg){
  let toast = document.getElementById("cart-toast") || document.getElementById("toast");
  if (!toast){
    toast = document.createElement("div");
    toast.id = "cart-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showCartToast._t);
  showCartToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function flyImageToCart(sourceImgEl){
  const cartIcon = document.getElementById("cart-icon");
  if (!sourceImgEl || !cartIcon || !sourceImgEl.getBoundingClientRect) return;
  const startRect = sourceImgEl.getBoundingClientRect();
  const endRect = cartIcon.getBoundingClientRect();
  const clone = sourceImgEl.cloneNode(true);
  clone.className = "cart-flying-img";
  clone.style.top = `${startRect.top}px`;
  clone.style.left = `${startRect.left}px`;
  clone.style.width = `${startRect.width}px`;
  clone.style.height = `${startRect.height}px`;
  clone.style.opacity = "0.95";
  document.body.appendChild(clone);
  requestAnimationFrame(() => {
    clone.style.top = `${endRect.top + endRect.height/2 - 10}px`;
    clone.style.left = `${endRect.left + endRect.width/2 - 10}px`;
    clone.style.width = "20px";
    clone.style.height = "20px";
    clone.style.opacity = "0.2";
  });
  setTimeout(() => clone.remove(), 800);
}

// Full choreography for an "Add to Cart" click: fly the image, toast,
// then let the drawer slide open once the motion settles.
function addToCartWithFlourish(productId, variant, qty, sourceImgEl){
  Cart.add(productId, variant, qty);
  flyImageToCart(sourceImgEl);
  showCartToast("Added to your cart.");
}

/* ================================================================
   DRAWER MARKUP (injected once per page)
   ================================================================ */
function buildCartDrawerDOM(){
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="cart-overlay"></div>
    <div id="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">

      <div id="cart-drawer-header">
        <div>
          <h2 class="cart-font-display text-lg font-medium">Shopping Cart</h2>
          <p id="cart-drawer-count" class="cart-font-mono text-xs text-[var(--alt-muted)] mt-1">0 items</p>
        </div>
        <button id="cart-drawer-close" class="cart-close-btn" aria-label="Close cart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div id="cart-drawer-body" class="no-scrollbar">

        <!-- Empty state -->
        <div id="cart-empty">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--alt-muted)" stroke-width="1.2" class="mb-6">
            <path d="M6 8h12l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.5H8.7a1.5 1.5 0 0 1-1.5-1.5L6 8z"/>
            <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
          </svg>
          <h3 class="cart-font-display text-xl font-medium">Your cart is waiting.</h3>
          <p class="mt-3 text-sm text-[var(--alt-muted)] max-w-xs">Nothing here yet — browse the collection and find something worth keeping.</p>
          <button id="cart-explore-btn" class="cart-btn-primary mt-7" style="width:auto; padding:14px 28px;">Explore Products</button>
        </div>

        <!-- Items -->
        <div id="cart-items-list"></div>

        <!-- Summary -->
        <div id="cart-summary-block" class="mt-2">
          <div class="mt-6">
            <p class="cart-font-mono text-[11px] tracking-widest uppercase text-[var(--alt-muted)] mb-3">Promo Code</p>
            <div class="cart-coupon-row">
              <input id="cart-coupon-input" type="text" placeholder="Enter code (try WELCOME10)" aria-label="Promo code" />
              <button id="cart-coupon-apply" class="cart-coupon-apply">Apply</button>
            </div>
            <p id="cart-coupon-feedback" class="cart-coupon-feedback" role="status"></p>
          </div>

          <div class="mt-7 pt-2">
            <div class="cart-summary-row"><span>Subtotal</span><span id="cart-subtotal" class="cart-font-mono">৳0</span></div>
            <div class="cart-summary-row"><span>Discount</span><span id="cart-discount" class="cart-font-mono">৳0</span></div>
            <div class="cart-summary-row"><span>Shipping</span><span id="cart-shipping" class="cart-font-mono">Free</span></div>
            <div class="cart-summary-row"><span>Estimated Tax</span><span id="cart-tax" class="cart-font-mono">৳0</span></div>
            <div class="cart-summary-row total"><span>Total</span><span id="cart-total" class="cart-font-mono">৳0</span></div>
          </div>

          <p class="mt-4 text-xs text-[var(--alt-muted)]">Estimated delivery: 2–5 business days</p>

          <div class="mt-7 grid grid-cols-4 gap-2">
            <div class="cart-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.5"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.4"/><circle cx="17.5" cy="18" r="1.4"/></svg>
              <p class="text-[10px] text-[var(--alt-muted)] leading-tight">Fast Shipping</p>
            </div>
            <div class="cart-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.5"><path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
              <p class="text-[10px] text-[var(--alt-muted)] leading-tight">Secure Payment</p>
            </div>
            <div class="cart-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.5"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M4.5 15a8 8 0 0 0 14 4.2M19.5 9A8 8 0 0 0 5.5 4.8"/></svg>
              <p class="text-[10px] text-[var(--alt-muted)] leading-tight">Easy Returns</p>
            </div>
            <div class="cart-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.5"><path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/></svg>
              <p class="text-[10px] text-[var(--alt-muted)] leading-tight">Customer Support</p>
            </div>
          </div>
        </div>

        <!-- Recommended -->
        <div id="cart-recommended-block" class="mt-9">
          <p class="cart-font-mono text-[11px] tracking-widest uppercase text-[var(--alt-muted)] mb-4">You May Also Like</p>
          <div id="cart-recommended-row" class="flex gap-4 overflow-x-auto no-scrollbar pb-1"></div>
        </div>

      </div>

      <div id="cart-drawer-footer">
        <button id="cart-continue-btn" class="cart-btn-secondary">Continue Shopping</button>
        <button id="cart-checkout-btn" class="cart-btn-primary">Proceed to Checkout</button>
      </div>
    </div>
    <div id="checkout-curtain"></div>
  `;
  document.body.appendChild(wrap);
}

/* ================================================================
   INIT
   ================================================================ */
function initCart(){
  buildCartDrawerDOM();
  Cart.load();
  Cart.syncBadges();
  syncWishlistBadge();

  const cartIcon = document.getElementById("cart-icon");
  if (cartIcon) cartIcon.addEventListener("click", () => Cart.open());

  document.getElementById("cart-drawer-close").addEventListener("click", () => Cart.close());
  document.getElementById("cart-overlay").addEventListener("click", () => Cart.close());
  document.getElementById("cart-continue-btn").addEventListener("click", () => Cart.close());
  document.getElementById("cart-checkout-btn").addEventListener("click", () => Cart.goToCheckout());
  document.getElementById("cart-explore-btn").addEventListener("click", () => { window.location.href = "store.html"; });

  document.getElementById("cart-coupon-apply").addEventListener("click", () => {
    Cart.applyCoupon(document.getElementById("cart-coupon-input").value);
  });
  document.getElementById("cart-coupon-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") Cart.applyCoupon(e.target.value);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("cart-drawer").classList.contains("open")) Cart.close();
  });

  // Magnetic hover on "Proceed to Checkout" (desktop only), same feel as Home's Shop Now
  if (window.matchMedia("(min-width: 1024px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const checkoutBtn = document.getElementById("cart-checkout-btn");
    checkoutBtn.addEventListener("mousemove", (e) => {
      const rect = checkoutBtn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.12;
      checkoutBtn.style.transform = `translateX(${x}px) scale(1.015)`;
    });
    checkoutBtn.addEventListener("mouseleave", () => { checkoutBtn.style.transform = "translate(0,0) scale(1)"; });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCart);
} else {
  initCart();
}
