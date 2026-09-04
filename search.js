/* ================================================================
   SHARED AI-READY SEARCH COMMAND PALETTE
   Opens with the header Search icon or Ctrl/Cmd+K on any page that
   includes this file. Depends on products-data.js (PRODUCTS,
   CATEGORIES, starString, categoryLabel) and, where present, on
   cart.js (Cart.add, Wishlist.toggle, showCartToast) for actions.
   ================================================================ */

const RECENT_SEARCHES_KEY = "alt_recent_searches_v1";
const RECENTLY_VIEWED_KEY = "alt_recently_viewed_v1";

const TRENDING_SEARCHES = ["desk setup", "room decor", "new arrivals", "trending", "gifts under $50", "minimal accessories"];
const QUICK_ACTIONS = [
  { label: "View Wishlist", href: "dashboard.html#wishlist" },
  { label: "Track an Order", href: "dashboard.html#orders" },
  { label: "New Arrivals", tag: "new-arrivals" },
  { label: "Best Sellers", tag: "best-sellers" },
];
const AI_PROMPTS = ["Help me choose", "Recommend products", "Find gifts", "Suggest matching accessories"];

/* ================================================================
   LIGHTWEIGHT NATURAL-LANGUAGE PARSING
   Real intent understanding needs a backend AI service — this is the
   honest, working stand-in: price extraction + keyword-to-tag mapping,
   so today's plain-English queries already return sensible results.
   ================================================================ */
function parseNaturalQuery(raw){
  const q = raw.toLowerCase();
  const filters = { tags: [], maxPrice: null, trendingOnly: false };

  const priceMatch = q.match(/(?:under|below|less than)\s*(?:tk|bdt|\$)?\s*(\d+)\s*(bdt|taka|tk|usd|dollars?)?/);
  if (priceMatch){
    let val = Number(priceMatch[1]);
    if (priceMatch[2] && /bdt|taka|tk/.test(priceMatch[2])) val = val / 110; // rough demo conversion, not live FX
    filters.maxPrice = val;
  }

  CATEGORIES.forEach(c => { if (c.slug !== "all" && q.includes(c.label.toLowerCase())) filters.tags.push(c.slug); });
  if (q.includes("gift")) filters.tags.push("lifestyle");
  if (q.includes("trending")) { filters.tags.push("trending"); filters.trendingOnly = true; }
  if (q.includes("best seller") || q.includes("bestseller")) filters.tags.push("best-sellers");
  if (q.includes("new arrival")) filters.tags.push("new-arrivals");

  return filters;
}

/* ================================================================
   SEARCH STATE + RESULT LOGIC
   ================================================================ */
const searchState = {
  query: "",
  category: "all",
  priceBand: "any",   // any | under50 | 50to150 | over150
  trendingOnly: false,
  bestSellerOnly: false,
  newOnly: false,
  ratingMin: 0,       // 0 or 4.5
  inStockOnly: false,
  discountOnly: false,
  activeIndex: -1,
};

function priceBandOk(product, band){
  const price = product.salePrice || product.price;
  if (band === "under50") return price < 50;
  if (band === "50to150") return price >= 50 && price <= 150;
  if (band === "over150") return price > 150;
  return true;
}

// Common connective words stripped from natural-language queries before
// fallback matching — otherwise "I need a desk setup" would match any
// product whose description happens to contain the word "need".
const SEARCH_STOPWORDS = new Set(["the","a","an","i","me","my","we","our","you","your","is","are","was","were","be","been","to","of","in","on","for","with","and","or","show","find","need","want","looking","some","that","this","it","at","by","from","as","me."]);

function getSearchResults(){
  const q = searchState.query.trim().toLowerCase();
  if (!q) return [];
  const parsed = parseNaturalQuery(q);
  const words = q.replace(/[.,!?]/g, "").split(/\s+/).filter(w => w.length > 2 && !SEARCH_STOPWORDS.has(w));

  let list = getStorefrontProducts().filter(p => {
    // Brand is identical for every product, so it's deliberately excluded
    // here — otherwise it would make broad queries match the whole catalog.
    const haystack = `${p.name} ${p.desc} ${p.tags.join(" ")} ${categoryLabel(p.tags[0])}`.toLowerCase();
    const textMatch = haystack.includes(q) || words.some(w => haystack.includes(w));
    const tagMatch = parsed.tags.length > 0 && p.tags.some(t => parsed.tags.includes(t));
    if (!textMatch && !tagMatch) return false;
    if (parsed.maxPrice !== null && (p.salePrice || p.price) > parsed.maxPrice) return false;
    return true;
  });

  // Filter bar (manual filters layered on top of the query match)
  if (searchState.category !== "all") list = list.filter(p => p.tags.includes(searchState.category));
  if (searchState.priceBand !== "any") list = list.filter(p => priceBandOk(p, searchState.priceBand));
  if (searchState.trendingOnly) list = list.filter(p => p.tags.includes("trending"));
  if (searchState.bestSellerOnly) list = list.filter(p => p.tags.includes("best-sellers"));
  if (searchState.newOnly) list = list.filter(p => p.tags.includes("new-arrivals"));
  if (searchState.ratingMin) list = list.filter(p => p.rating >= searchState.ratingMin);
  if (searchState.inStockOnly) list = list.filter(p => p.stock > 0);
  if (searchState.discountOnly) list = list.filter(p => !!p.salePrice);

  return list;
}

/* ================================================================
   RECENT SEARCHES / RECENTLY VIEWED (shared persistence)
   ================================================================ */
function getRecentSearches(){ try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"); } catch (e) { return []; } }
function addRecentSearch(q){
  q = q.trim();
  if (!q) return;
  let list = getRecentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, 6)));
}
function clearRecentSearches(){ localStorage.removeItem(RECENT_SEARCHES_KEY); }

function getRecentlyViewed(){
  try {
    const ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
    return ids.map(id => getProduct(id)).filter(Boolean);
  } catch (e) { return []; }
}
// Exposed so product.html can record a view — see recordProductView() call there.
function recordProductView(productId){
  let ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
  ids = ids.filter(id => id !== productId);
  ids.unshift(productId);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids.slice(0, 8)));
}

/* ================================================================
   DOM INJECTION
   ================================================================ */
function buildSearchDOM(){
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <div id="search-panel">
        <div id="sp-input-row">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--alt-muted)" stroke-width="1.8" class="shrink-0"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="sp-input" type="text" placeholder="Search products, categories, or describe what you need…" aria-label="Search" autocomplete="off">
          <button class="sp-icon-btn" id="sp-mic-btn" aria-label="Voice search (coming soon)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          </button>
          <button class="sp-icon-btn" id="sp-camera-btn" aria-label="Image search (coming soon)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/></svg>
          </button>
          <span class="sp-esc-hint hidden sm:inline-block">ESC</span>
        </div>

        <div id="sp-body" class="no-scrollbar">

          <!-- ============ IDLE STATE ============ -->
          <div id="sp-idle">
            <div class="sp-section">
              <div class="sp-section-head"><span class="sp-section-title">Quick Actions</span></div>
              <div class="sp-chip-row" id="sp-quick-actions"></div>
            </div>
            <div class="sp-section" id="sp-recent-wrap" style="display:none;">
              <div class="sp-section-head">
                <span class="sp-section-title">Recent Searches</span>
                <button class="sp-clear-link" id="sp-recent-clear">Clear</button>
              </div>
              <div class="sp-chip-row" id="sp-recent-searches"></div>
            </div>
            <div class="sp-section">
              <div class="sp-section-head"><span class="sp-section-title">Trending Searches</span></div>
              <div class="sp-chip-row" id="sp-trending-searches"></div>
            </div>
            <div class="sp-section">
              <div class="sp-section-head"><span class="sp-section-title">Popular Categories</span></div>
              <div class="sp-chip-row" id="sp-popular-categories"></div>
            </div>
            <div class="sp-section" id="sp-viewed-wrap" style="display:none;">
              <div class="sp-section-head"><span class="sp-section-title">Recently Viewed</span></div>
              <div class="sp-thumb-strip" id="sp-recently-viewed"></div>
            </div>
            <div class="sp-section">
              <div class="sp-section-head"><span class="sp-section-title">AI Shopping Assistant <span class="sp-font-mono" style="font-size:9px;">(Future)</span></span></div>
              <div class="sp-ai-card">
                <p class="text-xs text-[var(--alt-muted)] mb-3">Ask naturally — full AI recommendations are coming soon.</p>
                <div class="sp-chip-row" id="sp-ai-chips"></div>
              </div>
            </div>
          </div>

          <!-- ============ ACTIVE (TYPING) STATE ============ -->
          <div id="sp-active" style="display:none;">
            <div id="sp-filter-bar" class="no-scrollbar"></div>
            <div id="sp-results"></div>
            <div id="sp-empty">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--alt-muted)" stroke-width="1.3" class="mb-4"><circle cx="10" cy="10" r="6.5"/><path d="M20 20l-4.8-4.8M6 10h8"/></svg>
              <h3 class="sp-font-display text-base font-medium">No matching products found.</h3>
              <p class="mt-2 text-sm text-[var(--alt-muted)] max-w-xs">Try a different term, or explore something popular instead.</p>
              <div class="sp-chip-row mt-4" id="sp-empty-suggestions" style="justify-content:center;"></div>
              <div class="flex items-center gap-2 mt-5 flex-wrap justify-center">
                <a href="store.html" class="inline-block px-6 py-3 rounded-full bg-[var(--alt-black)] text-[var(--alt-white)] text-sm font-medium">Browse All Products</a>
                <a href="request-product.html" class="inline-block px-6 py-3 rounded-full border border-[var(--alt-black)] text-sm font-medium">Request a Product</a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Compact Quick View, layered above the palette -->
    <div id="sp-qv-backdrop" style="position:fixed;inset:0;z-index:150;background:rgba(10,10,10,0.5);opacity:0;pointer-events:none;transition:opacity .3s ease;">
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div id="sp-qv-panel" style="background:var(--alt-white);color:var(--alt-black);border-radius:22px;max-width:420px;width:100%;padding:22px;transform:scale(0.95);opacity:0;transition:transform .35s cubic-bezier(0.16,1,0.3,1), opacity .3s ease;">
          <div class="flex items-start justify-between mb-4">
            <div id="sp-qv-thumb" style="width:88px;height:88px;border-radius:14px;overflow:hidden;background:var(--alt-surface);"></div>
            <div class="flex items-center gap-2">
              <button id="sp-qv-wishlist" aria-label="Add to wishlist" style="width:30px;height:30px;border-radius:999px;border:1px solid var(--alt-border);display:flex;align-items:center;justify-content:center;color:var(--alt-muted);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/></svg>
              </button>
              <button id="sp-qv-close" aria-label="Close" style="width:30px;height:30px;border-radius:999px;border:1px solid var(--alt-border);display:flex;align-items:center;justify-content:center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
          </div>
          <h3 id="sp-qv-name" class="sp-font-display text-lg font-medium"></h3>
          <p id="sp-qv-rating" class="sp-font-mono text-xs text-[var(--alt-muted)] mt-1"></p>
          <p id="sp-qv-price" class="sp-font-mono text-base mt-2"></p>
          <p id="sp-qv-desc" class="text-sm text-[var(--alt-muted)] mt-2 leading-relaxed"></p>
          <div class="flex gap-3 mt-5">
            <button id="sp-qv-addcart" class="w-full py-3 rounded-full bg-[var(--alt-black)] text-[var(--alt-white)] text-sm font-medium">Add to Cart</button>
            <a id="sp-qv-viewfull" class="w-full py-3 rounded-full border border-[var(--alt-black)] text-sm font-medium text-center block">View Full Details</a>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

/* ================================================================
   RENDER: IDLE STATE (quick actions, recents, trending, AI)
   ================================================================ */
function renderIdle(){
  document.getElementById("sp-quick-actions").innerHTML = QUICK_ACTIONS.map(a => `<button class="sp-chip" data-action-href="${a.href || ""}" data-action-tag="${a.tag || ""}">${a.label}</button>`).join("");
  document.querySelectorAll("#sp-quick-actions .sp-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.actionHref){ window.location.href = btn.dataset.actionHref; return; }
      if (btn.dataset.actionTag){ setQuery(categoryLabel(btn.dataset.actionTag)); }
    });
  });

  const recents = getRecentSearches();
  document.getElementById("sp-recent-wrap").style.display = recents.length ? "block" : "none";
  document.getElementById("sp-recent-searches").innerHTML = recents.map(q => `
    <button class="sp-chip" data-query="${q}">${q}</button>
  `).join("");
  document.querySelectorAll("#sp-recent-searches .sp-chip").forEach(btn => btn.addEventListener("click", () => setQuery(btn.dataset.query)));
  document.getElementById("sp-recent-clear").onclick = () => { clearRecentSearches(); renderIdle(); };

  document.getElementById("sp-trending-searches").innerHTML = TRENDING_SEARCHES.map(t => `<button class="sp-chip" data-query="${t}">${t}</button>`).join("");
  document.querySelectorAll("#sp-trending-searches .sp-chip").forEach(btn => btn.addEventListener("click", () => setQuery(btn.dataset.query)));

  document.getElementById("sp-popular-categories").innerHTML = CATEGORIES.filter(c => c.slug !== "all").map(c => `<button class="sp-chip" data-query="${c.label}">${c.label}</button>`).join("");
  document.querySelectorAll("#sp-popular-categories .sp-chip").forEach(btn => btn.addEventListener("click", () => setQuery(btn.dataset.query)));

  const viewed = getRecentlyViewed();
  document.getElementById("sp-viewed-wrap").style.display = viewed.length ? "block" : "none";
  document.getElementById("sp-recently-viewed").innerHTML = viewed.map(p => `
    <div class="sp-thumb-card" data-id="${p.id}">
      <div class="sp-result-thumb"><img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.style.opacity='0.3';"></div>
      <p class="text-[10px] mt-1.5 truncate">${p.name}</p>
    </div>
  `).join("");
  document.querySelectorAll("#sp-recently-viewed .sp-thumb-card").forEach(card => card.addEventListener("click", () => goToProductFromSearch(idOf(card.dataset.id))));

  document.getElementById("sp-ai-chips").innerHTML = AI_PROMPTS.map(p => `<button class="sp-chip" data-prompt="${p}">${p}</button>`).join("");
  document.querySelectorAll("#sp-ai-chips .sp-chip").forEach(btn => btn.addEventListener("click", () => {
    showSearchToast("AI Assistant is coming soon — for now, try describing what you're looking for above.");
  }));
}

/* ================================================================
   RENDER: FILTER BAR
   ================================================================ */
const FILTER_DEFS = [
  { key: "trendingOnly", label: "Trending" },
  { key: "bestSellerOnly", label: "Best Seller" },
  { key: "newOnly", label: "Newest" },
  { key: "inStockOnly", label: "In Stock" },
  { key: "discountOnly", label: "Discount" },
];
function renderFilterBar(){
  const categoryChip = `
    <select id="sp-category-filter" class="sp-chip" style="border:none; -webkit-appearance:none; appearance:none; padding-right:10px;">
      ${CATEGORIES.map(c => `<option value="${c.slug}" ${c.slug === searchState.category ? "selected" : ""}>${c.label}</option>`).join("")}
    </select>`;
  const priceChip = `
    <select id="sp-price-filter" class="sp-chip" style="border:none; -webkit-appearance:none; appearance:none;">
      <option value="any" ${searchState.priceBand === "any" ? "selected" : ""}>Any Price</option>
      <option value="under50" ${searchState.priceBand === "under50" ? "selected" : ""}>Under $50</option>
      <option value="50to150" ${searchState.priceBand === "50to150" ? "selected" : ""}>$50–$150</option>
      <option value="over150" ${searchState.priceBand === "over150" ? "selected" : ""}>$150+</option>
    </select>`;
  const toggles = FILTER_DEFS.map(f => `<button class="sp-chip ${searchState[f.key] ? "selected" : ""}" data-filter="${f.key}">${f.label}</button>`).join("");
  const ratingChip = `<button class="sp-chip ${searchState.ratingMin ? "selected" : ""}" data-filter="ratingMin">4.5+ ★</button>`;
  const brandChip = `<span class="sp-chip" style="opacity:0.6; cursor:default;">Aesthetic Lifestyle Touch</span>`;

  document.getElementById("sp-filter-bar").innerHTML = categoryChip + priceChip + toggles + ratingChip + brandChip;

  document.getElementById("sp-category-filter").addEventListener("change", (e) => { searchState.category = e.target.value; renderActive(); });
  document.getElementById("sp-price-filter").addEventListener("change", (e) => { searchState.priceBand = e.target.value; renderActive(); });
  document.querySelectorAll('#sp-filter-bar [data-filter]').forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.filter;
      if (key === "ratingMin") searchState.ratingMin = searchState.ratingMin ? 0 : 4.5;
      else searchState[key] = !searchState[key];
      renderActive();
    });
  });
}

/* ================================================================
   RENDER: RESULTS
   ================================================================ */
function renderResultRow(p, index){
  const isWished = typeof Wishlist !== "undefined" && Wishlist.has(p.id);
  return `
    <div class="sp-result sp-fade-item" data-id="${p.id}" data-index="${index}" style="animation-delay:${Math.min(index, 8) * 0.03}s;" role="option">
      <div class="sp-result-thumb"><img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.style.opacity='0.3';"></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <h4 class="sp-font-display text-[14px] font-medium truncate">${p.name}</h4>
          <span class="sp-font-mono text-sm shrink-0">${bdt(p.salePrice || p.price)}</span>
        </div>
        <p class="text-xs text-[var(--alt-muted)] truncate mt-0.5">${p.desc}</p>
        <p class="text-[11px] text-[var(--alt-muted)] mt-1 sp-font-mono">
          ${categoryLabel(p.tags[0])} · <span style="color:var(--alt-black)">${starString(p.rating)}</span> ${p.rating} · ${p.stock > 0 ? "In Stock" : "Out of Stock"}
        </p>
      </div>
      <div class="sp-result-actions">
        <button class="sp-mini-btn ${isWished ? "active" : ""}" data-action="wishlist" aria-label="Wishlist">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/></svg>
        </button>
        <button class="sp-mini-btn" data-action="quickview" aria-label="Quick view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="sp-mini-btn" data-action="addcart" aria-label="Quick add to cart" ${p.stock === 0 ? "disabled style='opacity:.4;'" : ""}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L4.5 2.5H2"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderActive(){
  document.getElementById("sp-idle").style.display = "none";
  document.getElementById("sp-active").style.display = "block";
  renderFilterBar();

  const results = getSearchResults();
  const resultsEl = document.getElementById("sp-results");
  const emptyEl = document.getElementById("sp-empty");
  searchState.activeIndex = -1;

  if (results.length === 0){
    resultsEl.innerHTML = "";
    emptyEl.classList.add("show");
    document.getElementById("sp-empty-suggestions").innerHTML = TRENDING_SEARCHES.slice(0, 4).map(t => `<button class="sp-chip" data-query="${t}">${t}</button>`).join("");
    document.querySelectorAll("#sp-empty-suggestions .sp-chip").forEach(btn => btn.addEventListener("click", () => setQuery(btn.dataset.query)));
    return;
  }
  emptyEl.classList.remove("show");
  resultsEl.innerHTML = results.map((p, i) => renderResultRow(p, i)).join("");
  wireResultRows();
}

function wireResultRows(){
  document.querySelectorAll(".sp-result").forEach(row => {
    const id = idOf(row.dataset.id);
    row.addEventListener("click", (e) => { if (!e.target.closest("[data-action]")) goToProductFromSearch(id); });
    row.querySelector('[data-action="wishlist"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const active = Wishlist.toggle(id);
      e.currentTarget.classList.toggle("active", active);
      if (active){ pulseHeart(e.currentTarget); glowCard(row); }
    });
    row.querySelector('[data-action="quickview"]').addEventListener("click", (e) => { e.stopPropagation(); openMiniQuickView(id); });
    row.querySelector('[data-action="addcart"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const p = getProduct(id);
      if (p.stock === 0) return;
      Cart.add(id, {}, 1);
      showSearchToast("Added to your cart.");
    });
  });
}

function updateActiveHighlight(){
  document.querySelectorAll(".sp-result").forEach(row => {
    row.classList.toggle("active", Number(row.dataset.index) === searchState.activeIndex);
  });
  const activeRow = document.querySelector(`.sp-result[data-index="${searchState.activeIndex}"]`);
  if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
}

function goToProductFromSearch(id){
  addRecentSearch(searchState.query || getProduct(id)?.name || "");
  Search.close();
  window.location.href = `product.html?id=${id}`;
}

/* ================================================================
   MINI QUICK VIEW
   ================================================================ */
function openMiniQuickView(id){
  const p = getProduct(id);
  if (!p) return;
  document.getElementById("sp-qv-thumb").innerHTML = `<img src="${p.img}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.opacity='0.3';">`;
  document.getElementById("sp-qv-name").textContent = p.name;
  document.getElementById("sp-qv-rating").innerHTML = `<span style="color:var(--alt-black)">${starString(p.rating)}</span> ${p.rating} · ${p.reviews} reviews`;
  document.getElementById("sp-qv-price").textContent = p.salePrice ? `${bdt(p.salePrice)} (was ${bdt(p.price)})` : bdt(p.price);
  document.getElementById("sp-qv-desc").textContent = p.desc;
  document.getElementById("sp-qv-viewfull").href = `product.html?id=${p.id}`;
  document.getElementById("sp-qv-addcart").onclick = () => { Cart.add(p.id, {}, 1); showSearchToast("Added to your cart."); };

  const qvWishBtn = document.getElementById("sp-qv-wishlist");
  qvWishBtn.classList.toggle("active", Wishlist.has(p.id));
  qvWishBtn.style.color = Wishlist.has(p.id) ? "var(--alt-black)" : "var(--alt-muted)";
  qvWishBtn.onclick = () => {
    const active = Wishlist.toggle(p.id);
    qvWishBtn.style.color = active ? "var(--alt-black)" : "var(--alt-muted)";
    if (active){ pulseHeart(qvWishBtn); glowCard(document.getElementById("sp-qv-thumb")); }
    // Refresh the underlying result row's heart too, if this quick view
    // was opened from a visible search result.
    const row = document.querySelector(`.sp-result[data-id="${p.id}"] [data-action="wishlist"]`);
    if (row) row.classList.toggle("active", active);
  };

  const backdrop = document.getElementById("sp-qv-backdrop");
  backdrop.style.pointerEvents = "all"; backdrop.style.opacity = "1";
  const panel = document.getElementById("sp-qv-panel");
  requestAnimationFrame(() => { panel.style.opacity = "1"; panel.style.transform = "scale(1)"; });
}
function closeMiniQuickView(){
  document.getElementById("sp-qv-backdrop").style.opacity = "0";
  document.getElementById("sp-qv-backdrop").style.pointerEvents = "none";
  const panel = document.getElementById("sp-qv-panel");
  panel.style.opacity = "0"; panel.style.transform = "scale(0.95)";
}

/* ================================================================
   TOAST (reuses cart.js's shared toast if present)
   ================================================================ */
function showSearchToast(msg){
  if (typeof showCartToast === "function") showCartToast(msg);
}

/* ================================================================
   INPUT HANDLING (debounced)
   ================================================================ */
let searchDebounce;
function setQuery(q){
  searchState.query = q;
  document.getElementById("sp-input").value = q;
  document.getElementById("sp-input").focus();
  if (q.trim()) renderActive(); else renderIdleView();
}
function renderIdleView(){
  document.getElementById("sp-idle").style.display = "block";
  document.getElementById("sp-active").style.display = "none";
  renderIdle();
}

/* ================================================================
   OPEN / CLOSE
   ================================================================ */
const Search = {
  lastFocused: null,
  open(){
    document.getElementById("search-overlay").classList.add("open");
    document.documentElement.style.overflow = "hidden";
    this.lastFocused = document.activeElement;
    if (!searchState.query) renderIdleView();
    setTimeout(() => document.getElementById("sp-input").focus(), 50);
  },
  close(){
    document.getElementById("search-overlay").classList.remove("open");
    document.documentElement.style.overflow = "";
    closeMiniQuickView();
    if (this.lastFocused && this.lastFocused.focus) this.lastFocused.focus();
  },
};

/* ================================================================
   INIT
   ================================================================ */
function initSearch(){
  buildSearchDOM();

  const trigger = document.getElementById("search-trigger");
  if (trigger) trigger.addEventListener("click", () => Search.open());

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
      e.preventDefault();
      Search.open();
      return;
    }
    const overlay = document.getElementById("search-overlay");
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape"){ Search.close(); return; }
    const results = document.querySelectorAll(".sp-result");
    if (results.length === 0) return;
    if (e.key === "ArrowDown"){
      e.preventDefault();
      searchState.activeIndex = (searchState.activeIndex + 1) % results.length;
      updateActiveHighlight();
    } else if (e.key === "ArrowUp"){
      e.preventDefault();
      searchState.activeIndex = (searchState.activeIndex - 1 + results.length) % results.length;
      updateActiveHighlight();
    } else if (e.key === "Enter" && searchState.activeIndex >= 0){
      e.preventDefault();
      goToProductFromSearch(idOf(results[searchState.activeIndex].dataset.id));
    }
  });

  document.getElementById("search-overlay").addEventListener("click", (e) => {
    if (e.target.id === "search-overlay") Search.close();
  });
  document.getElementById("sp-qv-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "sp-qv-backdrop") closeMiniQuickView();
  });
  document.getElementById("sp-qv-close").addEventListener("click", closeMiniQuickView);

  document.getElementById("sp-mic-btn").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("mic-active");
    showSearchToast(e.currentTarget.classList.contains("mic-active") ? "Listening… voice search is coming soon." : "Voice search stopped.");
    if (e.currentTarget.classList.contains("mic-active")) setTimeout(() => e.currentTarget.classList.remove("mic-active"), 2200);
  });
  document.getElementById("sp-camera-btn").addEventListener("click", () => showSearchToast("Image search is coming soon."));

  const input = document.getElementById("sp-input");
  input.addEventListener("input", (e) => {
    searchState.query = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      if (searchState.query.trim()) renderActive(); else renderIdleView();
    }, 150);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchState.query.trim() && searchState.activeIndex === -1){
      addRecentSearch(searchState.query);
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSearch);
else initSearch();
