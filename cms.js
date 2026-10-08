/* ================================================================
   CMS & PRODUCT MANAGEMENT
   Shares its login session with admin.html via admin-auth.js. Every
   number/record here is real localStorage data or clearly marked
   (Future) — same honesty rule as the rest of the project.
   ================================================================ */

/* ================================================================
   AUTH GATE
   ================================================================ */
if (!AdminAuth.isLoggedIn()){
  window.location.href = "admin.html?redirect=cms.html";
}

/* ================================================================
   PRODUCT DATA MODEL — richer overlay on top of products-data.js.
   PRODUCT_OVERRIDES_KEY/PRODUCT_EXTRAS_KEY, the read/write helpers, and
   getProduct/isExtraProduct/updateProduct/addProduct now all live in
   products-data.js so checkout (stock decrement) and the storefront
   read/write the exact same overlay CMS edits.
   effectiveProducts() here is unfiltered (drafts/archived included) since
   the CMS needs to see and manage everything; the storefront calls
   getStorefrontProducts() instead, which hides those.
   ================================================================ */
function effectiveProducts(){ return getAllProductsWithOverrides(); }

/* ---------------- version history (real revision snapshots) ---------------- */
const VERSION_HISTORY_KEY = "alt_cms_versions_v1";
function versionHistory(){ try { return JSON.parse(localStorage.getItem(VERSION_HISTORY_KEY) || "{}"); } catch (e) { return {}; } }
function pushVersionSnapshot(productId, snapshot, note){
  const all = versionHistory();
  const list = all[productId] || [];
  list.unshift({ at: Date.now(), note: note || "Saved", snapshot, by: (AdminAuth.record() || {}).name || "Owner" });
  all[productId] = list.slice(0, 20);
  localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(all));
}
function productVersions(productId){ return versionHistory()[productId] || []; }

/* ---------------- workflow ---------------- */
const WORKFLOW_STATES = ["Draft", "Review", "Approved", "Scheduled", "Published", "Archived", "Rejected"];
const WORKFLOW_COLORS = {
  Draft: "badge-neutral", Review: "badge-warn", Approved: "badge-good", Scheduled: "badge-warn",
  Published: "badge-good", Archived: "badge-neutral", Rejected: "badge-bad",
};
function workflowBadge(status){
  const s = status || "Draft";
  return `<span class="badge ${WORKFLOW_COLORS[s] || "badge-neutral"}"><span class="badge-dot"></span>${s}</span>`;
}

/* ================================================================
   MEDIA LIBRARY
   ================================================================ */
const MEDIA_KEY = "alt_cms_media_v1";
function allMedia(){ try { return JSON.parse(localStorage.getItem(MEDIA_KEY) || "[]"); } catch (e) { return []; } }
function saveMedia(list){ localStorage.setItem(MEDIA_KEY, JSON.stringify(list)); }
function addMediaItem(item){ const list = allMedia(); list.unshift(item); saveMedia(list); return item; }

/* ================================================================
   COLLECTIONS
   ================================================================ */
const COLLECTIONS_KEY = "alt_cms_collections_v1";
function allCollections(){ try { return JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || "[]"); } catch (e) { return []; } }
function saveCollectionsList(list){ localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(list)); }

/* ================================================================
   CATEGORIES (nested via parentId)
   ================================================================ */
const CATEGORIES_KEY = "alt_cms_categories_v1";
function allCmsCategories(){ try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]"); } catch (e) { return []; } }
function saveCmsCategories(list){ localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list)); }

/* ================================================================
   WEBSITE CONTENT SETTINGS
   ================================================================ */
const WEBSITE_KEY = "alt_cms_website_v1";
const DEFAULT_WEBSITE = {
  heroHeadline: "Considered essentials for a quieter life.",
  heroSubtext: "Aesthetic Lifestyle Touch — objects worth keeping.",
  heroCtaLabel: "Shop Now",
  heroFeaturedProductIds: [1, 2, 8],
  announcement: "",
  announcementActive: false,
  navLinks: [
    { label: "Store", href: "store.html" },
    { label: "Collections", href: "collections.html" },
    { label: "About", href: "about.html" },
    { label: "Contact", href: "contact.html" },
  ],
  footerLinks: [
    { label: "FAQ", href: "about.html#faq" },
    { label: "Returns", href: "contact.html" },
  ],
  socialLinks: { instagram: "", facebook: "", tiktok: "", pinterest: "" },
  contactEmail: "aestheticlifestyletouch@gmail.com",
  contactPhone: "01313667726",
  newsletterHeadline: "Join the list.",
  seoDefaultTitle: "Aesthetic Lifestyle Touch — Considered Everyday Objects",
  seoDefaultDescription: "Premium lifestyle essentials with honest quality and restrained design.",
};
function websiteContent(){
  try { return Object.assign({}, DEFAULT_WEBSITE, JSON.parse(localStorage.getItem(WEBSITE_KEY) || "{}")); }
  catch (e) { return DEFAULT_WEBSITE; }
}
function saveWebsiteContent(patch){
  const merged = Object.assign({}, websiteContent(), patch);
  localStorage.setItem(WEBSITE_KEY, JSON.stringify(merged));
  return merged;
}

/* ================================================================
   SHARED UI HELPERS (drawer/modal/toast — same DOM as admin.html)
   ================================================================ */
function cmsToast(msg){
  let toast = document.getElementById("cms-toast");
  if (!toast){
    toast = document.createElement("div");
    toast.id = "cms-toast";
    toast.style.cssText = "position:fixed;bottom:28px;left:50%;transform:translate(-50%,16px);opacity:0;pointer-events:none;z-index:260;background:var(--alt-black);color:#fff;font-size:13px;font-weight:500;padding:12px 22px;border-radius:999px;box-shadow:0 20px 40px -15px rgba(10,10,10,0.5);transition:opacity .3s ease, transform .3s cubic-bezier(0.16,1,0.3,1);";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%,0)";
  clearTimeout(cmsToast._t);
  cmsToast._t = setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translate(-50%,16px)"; }, 2200);
}

function confirmAction({ title, body, confirmLabel, danger, onConfirm }){
  const wrap = document.getElementById("adm-modal-wrap");
  document.getElementById("adm-modal-title").textContent = title;
  document.getElementById("adm-modal-body").textContent = body;
  const confirmBtn = document.getElementById("adm-modal-confirm");
  confirmBtn.textContent = confirmLabel || "Confirm";
  confirmBtn.className = "adm-btn flex-1 " + (danger ? "adm-btn-danger" : "adm-btn-primary");
  wrap.classList.add("open");
  function cleanup(){ wrap.classList.remove("open"); confirmBtn.removeEventListener("click", onYes); }
  function onYes(){ cleanup(); onConfirm(); }
  confirmBtn.addEventListener("click", onYes);
  document.getElementById("adm-modal-cancel").onclick = cleanup;
}

function openDrawer(title, bodyHTML, footHTML, wide){
  const drawer = document.getElementById("adm-drawer");
  drawer.classList.toggle("adm-drawer-wide", !!wide);
  document.getElementById("adm-drawer-title").textContent = title;
  document.getElementById("adm-drawer-body").innerHTML = bodyHTML;
  const foot = document.getElementById("adm-drawer-foot");
  if (footHTML){ foot.innerHTML = footHTML; foot.style.display = "flex"; } else { foot.style.display = "none"; foot.innerHTML = ""; }
  document.getElementById("adm-drawer-overlay").classList.add("open");
  drawer.classList.add("open");
}
function closeDrawer(){
  document.getElementById("adm-drawer-overlay").classList.remove("open");
  document.getElementById("adm-drawer").classList.remove("open");
}

function fmtMoney(n){ return "৳" + Math.round(n).toLocaleString(); }
function timeAgo(ts){
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ================================================================
   SIDEBAR NAV + VIEW SWITCHING
   ================================================================ */
const ADMIN_NAV = [
  { group: "Overview", items: [
    { key: "overview", label: "CMS Home", icon: `<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z"/>` },
  ]},
  { group: "Catalog", items: [
    { key: "products", label: "Products", icon: `<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 016 0"/>`, badgeFn: () => effectiveProducts().filter(p => (p.status || "Draft") === "Draft").length },
    { key: "media", label: "Media Library", icon: `<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5-9 9"/>` },
    { key: "collections", label: "Collections", icon: `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/>` },
    { key: "categories", label: "Categories", icon: `<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>` },
  ]},
  { group: "Operations", items: [
    { key: "bulk", label: "Bulk Operations", icon: `<path d="M4 6h16M4 12h16M4 18h16"/>` },
  ]},
  { group: "Content", items: [
    { key: "website", label: "Website Content", icon: `<path d="M4 5h16v14H4z"/><path d="M4 9h16"/>` },
  ]},
  { group: "System", items: [
    { key: "workflow", label: "Workflow & History", icon: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>` },
    { key: "permissions", label: "Permissions", icon: `<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 15.5c2.5.3 4 1.6 4 4.5"/>` },
    { href: "admin.html", label: "Store Admin", icon: `<path d="M3 9l9-6 9 6-9 6z"/><path d="M3 9v6l9 6 9-6V9"/>` },
  ]},
];

function renderSidebar(){
  document.getElementById("admin-nav").innerHTML = ADMIN_NAV.map(g => `
    <p class="side-group-title">${g.group}</p>
    ${g.items.map(it => {
      if (it.href){
        return `
          <a href="${it.href}" class="side-link">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${it.icon}</svg>
            ${it.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;opacity:0.5;"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
          </a>`;
      }
      const badge = it.badgeFn ? it.badgeFn() : 0;
      return `
        <button class="side-link" data-view="${it.key}">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${it.icon}</svg>
          ${it.label}
          ${badge > 0 ? `<span class="side-badge">${badge}</span>` : ""}
        </button>`;
    }).join("")}
  `).join("");
  document.querySelectorAll(".side-link[data-view]").forEach(btn => btn.addEventListener("click", () => setAdminView(btn.dataset.view)));
}

const VIEW_TITLES = {
  overview: "CMS Home", products: "Products", media: "Media Library", collections: "Collections",
  categories: "Categories", bulk: "Bulk Operations", website: "Website Content",
  workflow: "Workflow & History", permissions: "Permissions",
};
const VIEW_RENDERERS = {};

function setAdminView(name){
  document.querySelectorAll(".admin-view").forEach(v => v.classList.toggle("active", v.dataset.view === name));
  document.querySelectorAll(".side-link[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("admin-page-title").textContent = VIEW_TITLES[name] || "CMS Home";
  closeAdminSidebar();
  if (VIEW_RENDERERS[name]) VIEW_RENDERERS[name]();
  document.querySelectorAll(`#view-${name} [data-enter]`).forEach((el, i) => {
    requestAnimationFrame(() => setTimeout(() => el.classList.add("in"), i * 30));
  });
  history.replaceState(null, "", `#${name}`);
}
function openAdminSidebar(){ document.getElementById("admin-sidebar").classList.add("open"); document.getElementById("admin-sidebar-overlay").classList.add("open"); }
function closeAdminSidebar(){ document.getElementById("admin-sidebar").classList.remove("open"); document.getElementById("admin-sidebar-overlay").classList.remove("open"); }

/* ================================================================
   OVERVIEW — CMS Home
   ================================================================ */
VIEW_RENDERERS.overview = function(){
  const products = effectiveProducts();
  const drafts = products.filter(p => (p.status || "Draft") === "Draft").length;
  const scheduled = products.filter(p => p.status === "Scheduled").length;
  const published = products.filter(p => p.status === "Published").length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 8).length;
  const media = allMedia();
  const collections = allCollections();
  const categories = allCmsCategories();
  const activity = auditLog().filter(a => a.action.startsWith("CMS")).slice(0, 6);

  const cards = [
    { label: "Products", value: products.length, view: "products", icon: `<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 016 0"/>` },
    { label: "Collections", value: collections.length, view: "collections", icon: `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/>` },
    { label: "Categories", value: categories.length, view: "categories", icon: `<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>` },
    { label: "Media Library", value: media.length, view: "media", icon: `<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5-9 9"/>` },
    { label: "Draft Products", value: drafts, view: "products", icon: `<path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/>` },
    { label: "Scheduled Products", value: scheduled, view: "products", icon: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>` },
    { label: "Published Products", value: published, view: "products", icon: `<path d="M20 6L9 17l-5-5"/>` },
    { label: "Low Stock Alerts", value: lowStock, view: "products", danger: lowStock > 0, icon: `<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>` },
    { label: "SEO Health", value: `${Math.round((products.filter(p => p.seoTitle).length / Math.max(1, products.length)) * 100)}%`, view: "products", icon: `<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>` },
    { label: "Website Status", value: "Live", view: "website", icon: `<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/>` },
  ];

  document.getElementById("view-overview").innerHTML = `
    <div class="mb-6" data-enter>
      <h2 class="font-display text-2xl font-medium">Content & Product Command Center</h2>
      <p class="text-sm text-[var(--alt-muted)] mt-1">Everything needed to manage the catalog and site content, without touching code.</p>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      ${cards.map((c, i) => `
        <div class="stat-card cms-quick-card" data-view="${c.view}" data-enter style="transition-delay:${i * 0.02}s; cursor:pointer;">
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.6">${c.icon}</svg></div>
          <p class="stat-value tabular" style="${c.danger ? "color:var(--alt-bad);" : ""}">${c.value}</p>
          <p class="stat-label">${c.label}</p>
        </div>
      `).join("")}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="panel lg:col-span-2" data-enter>
        <div class="flex items-center justify-between mb-4"><p class="panel-title">Quick Actions</p></div>
        <div class="grid grid-cols-2 gap-3">
          <button class="adm-btn adm-btn-primary" id="qa-new-product">+ Create Product</button>
          <button class="adm-btn adm-btn-ghost" id="qa-upload-media">Upload Media</button>
          <button class="adm-btn adm-btn-ghost" id="qa-new-collection">New Collection</button>
          <button class="adm-btn adm-btn-ghost" id="qa-new-category">New Category</button>
        </div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Recent CMS Activity</p>
        ${activity.length ? activity.map(a => `<div class="mb-3"><p class="text-sm">${a.action}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${a.detail} · ${timeAgo(a.at)}</p></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No CMS activity yet — changes you make will show up here.</p>`}
      </div>
    </div>
  `;
  document.querySelectorAll(".cms-quick-card").forEach(el => el.addEventListener("click", () => setAdminView(el.dataset.view)));
  document.getElementById("qa-new-product").addEventListener("click", () => { setAdminView("products"); setTimeout(() => openProductEditor(null), 150); });
  document.getElementById("qa-upload-media").addEventListener("click", () => setAdminView("media"));
  document.getElementById("qa-new-collection").addEventListener("click", () => { setAdminView("collections"); setTimeout(() => openCollectionEditor(null), 150); });
  document.getElementById("qa-new-category").addEventListener("click", () => { setAdminView("categories"); setTimeout(() => openCategoryEditor(null), 150); });
};

/* ================================================================
   PRODUCTS — catalog table + rich multi-tab editor
   ================================================================ */
const productsState = { search: "", status: "all", page: 1, perPage: 8 };

VIEW_RENDERERS.products = function(){
  document.getElementById("view-products").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Products</h2>
      <div class="flex items-center gap-2">
        <button id="prod-import" class="adm-btn adm-btn-ghost">CSV Import</button>
        <button id="prod-export" class="adm-btn adm-btn-ghost">CSV Export</button>
        <button id="prod-add" class="adm-btn adm-btn-primary">+ Create Product</button>
      </div>
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <input id="prod-search" type="text" placeholder="Search products…" class="adm-input" style="min-width:220px;">
      ${["all"].concat(WORKFLOW_STATES).map(s => `<button class="adm-chip prod-status-chip ${productsState.status === s ? "active" : ""}" data-status="${s}">${s === "all" ? "All" : s}</button>`).join("")}
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th></th><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th></th></tr></thead>
        <tbody id="prod-tbody"></tbody>
      </table>
    </div>
    <div id="prod-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("prod-search").addEventListener("input", e => { productsState.search = e.target.value; productsState.page = 1; renderProductsTable(); });
  document.querySelectorAll(".prod-status-chip").forEach(btn => btn.addEventListener("click", () => { productsState.status = btn.dataset.status; productsState.page = 1; VIEW_RENDERERS.products(); }));
  document.getElementById("prod-add").addEventListener("click", () => openProductEditor(null));
  document.getElementById("prod-export").addEventListener("click", () => {
    const rows = effectiveProducts();
    const fields = ["id","name","sku","brand","price","salePrice","stock","status"];
    const header = fields.join(",");
    const lines = rows.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "products-export.csv"; a.click(); URL.revokeObjectURL(a.href);
    logAudit("CMS export", `${rows.length} products to CSV`);
  });
  document.getElementById("prod-import").addEventListener("click", openCsvImport);
  renderProductsTable();
};

function filteredCmsProducts(){
  let list = effectiveProducts();
  if (productsState.status !== "all") list = list.filter(p => (p.status || "Draft") === productsState.status);
  if (productsState.search.trim()){
    const q = productsState.search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  }
  return list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

function renderProductsTable(){
  const list = filteredCmsProducts();
  const start = (productsState.page - 1) * productsState.perPage;
  const rows = list.slice(start, start + productsState.perPage);
  document.getElementById("prod-tbody").innerHTML = rows.length ? rows.map(p => `
    <tr>
      <td><img src="${p.img}" class="w-11 h-11 rounded-lg object-cover" loading="lazy" decoding="async" alt=""></td>
      <td class="prod-open" data-id="${p.id}" style="cursor:pointer;"><p class="text-sm">${p.name}</p><p class="text-xs text-[var(--alt-muted)] font-mono">#${p.id}</p></td>
      <td class="text-xs font-mono">${p.sku || "—"}</td>
      <td class="text-xs">${(p.tags || []).slice(0, 2).join(", ") || "—"}</td>
      <td class="font-mono">${fmtMoney(p.salePrice || p.price)}</td>
      <td class="tabular">${p.stock}</td>
      <td>${workflowBadge(p.status)}</td>
      <td>${p.featured ? "★" : ""}${p.trending ? " 🔥" : ""}${p.bestSeller ? " 🏆" : ""}</td>
      <td>
        <div class="flex items-center gap-1">
          <button class="adm-icon-btn prod-open" data-id="${p.id}" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="adm-icon-btn prod-dup" data-id="${p.id}" aria-label="Duplicate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
          <button class="adm-icon-btn prod-delete" data-id="${p.id}" style="color:var(--alt-bad);" aria-label="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg></button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="text-center text-sm text-[var(--alt-muted)] py-10">No products match this filter.</td></tr>`;

  document.querySelectorAll(".prod-open").forEach(el => el.addEventListener("click", () => openProductEditor(idOf(el.dataset.id))));
  document.querySelectorAll(".prod-dup").forEach(el => el.addEventListener("click", () => duplicateProduct(idOf(el.dataset.id))));
  document.querySelectorAll(".prod-delete").forEach(el => el.addEventListener("click", () => deleteProduct(idOf(el.dataset.id))));

  const totalPages = Math.max(1, Math.ceil(list.length / productsState.perPage));
  document.getElementById("prod-pagination").innerHTML = `
    <span>${list.length} product${list.length === 1 ? "" : "s"} · page ${productsState.page} of ${totalPages}</span>
    <div class="flex gap-2">
      <button id="prod-prev" class="adm-btn adm-btn-ghost" ${productsState.page <= 1 ? "disabled style=opacity:.4" : ""}>Previous</button>
      <button id="prod-next" class="adm-btn adm-btn-ghost" ${productsState.page >= totalPages ? "disabled style=opacity:.4" : ""}>Next</button>
    </div>
  `;
  document.getElementById("prod-prev").addEventListener("click", () => { if (productsState.page > 1){ productsState.page--; renderProductsTable(); } });
  document.getElementById("prod-next").addEventListener("click", () => { if (productsState.page < totalPages){ productsState.page++; renderProductsTable(); } });
}
function idOf(rawId){ const n = Number(rawId); return Number.isNaN(n) ? rawId : n; }

function duplicateProduct(id){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  const clone = Object.assign({}, p, { id: "cms_" + Date.now(), name: `${p.name} (Copy)`, status: "Draft", sku: (p.sku || "") + "-COPY" });
  delete clone.archived;
  addProduct(clone);
  logAudit("CMS product duplicated", p.name);
  renderProductsTable();
  cmsToast("Product duplicated as a new draft.");
}
function deleteProduct(id){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  confirmAction({
    title: "Delete this product?",
    body: `"${p.name}" will be removed everywhere, including the storefront catalog. This can't be undone from here.`,
    confirmLabel: "Delete Product", danger: true,
    onConfirm(){
      updateProduct(id, { deleted: true });
      logAudit("CMS product deleted", p.name);
      renderProductsTable();
      renderSidebar();
      cmsToast("Product deleted.");
    },
  });
}
function archiveProduct(id, restore){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  updateProduct(id, { status: restore ? "Draft" : "Archived" });
  logAudit(restore ? "CMS product restored" : "CMS product archived", p.name);
  renderProductsTable();
  cmsToast(restore ? "Product restored to Draft." : "Product archived.");
}

/* ================================================================
   RICH PRODUCT EDITOR — tabbed drawer (Info / Variants / Pricing /
   Inventory / SEO / Media / Workflow). All tabs write into one
   in-memory draft so switching tabs never loses unsaved input.
   ================================================================ */
const PE_TABS = [
  { key: "info", label: "Info" },
  { key: "variants", label: "Variants" },
  { key: "pricing", label: "Pricing" },
  { key: "inventory", label: "Inventory" },
  { key: "seo", label: "SEO" },
  { key: "media", label: "Media" },
  { key: "workflow", label: "Workflow" },
];
let peDraft = null;
let peActiveTab = "info";
let peIsNew = false;

function blankProductDraft(){
  return {
    id: null, name: "", shortDesc: "", desc: "", brand: "Aesthetic Lifestyle Touch",
    category: "", subcategory: "", collectionIds: [], sku: "", barcode: "", vendor: "",
    tags: [], status: "Draft", releaseDate: "", featured: false, trending: false,
    bestSeller: false, newArrival: false, limitedEdition: false, displayOrder: 0,
    variants: [], price: 0, salePrice: null, costPrice: null, taxRule: "Standard",
    stock: 0, lowStockThreshold: 8, stockHistory: [],
    seoTitle: "", seoDescription: "", slug: "", canonicalUrl: "", ogImage: "", twitterCard: "summary_large_image",
    img: "", gallery: [], scheduledAt: "",
  };
}

function openProductEditor(id){
  peIsNew = id === null;
  peActiveTab = "info";
  if (peIsNew){
    peDraft = blankProductDraft();
  } else {
    // An existing product with no explicit status is one of the original
    // catalog items — it's already live on the storefront, so the editor
    // must not silently default it to "Draft" just for being opened here.
    const existing = getProduct(id);
    peDraft = Object.assign(blankProductDraft(), existing, { status: existing.status || "Published" });
  }
  renderProductEditorDrawer();
}

function renderProductEditorDrawer(){
  const title = peIsNew ? "Create Product" : `Edit — ${peDraft.name || "Untitled"}`;
  const body = `
    <div class="tab-bar">
      ${PE_TABS.map(t => `<button class="tab-btn pe-tab ${peActiveTab === t.key ? "active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
    </div>
    <div id="pe-tab-content">${renderPeTab(peActiveTab)}</div>
  `;
  const foot = `
    <button id="pe-preview" class="adm-btn adm-btn-ghost">Preview</button>
    <button id="pe-save-draft" class="adm-btn adm-btn-ghost">Save Draft</button>
    <button id="pe-save" class="adm-btn adm-btn-primary flex-1">${peIsNew ? "Create Product" : "Save Changes"}</button>
  `;
  openDrawer(title, body, foot, true);
  document.querySelectorAll(".pe-tab").forEach(btn => btn.addEventListener("click", () => {
    peActiveTab = btn.dataset.tab;
    document.querySelectorAll(".pe-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === peActiveTab));
    document.getElementById("pe-tab-content").innerHTML = renderPeTab(peActiveTab);
    wirePeTab(peActiveTab);
  }));
  wirePeTab(peActiveTab);
  document.getElementById("pe-preview").addEventListener("click", () => cmsToast("Live storefront preview needs the product to be saved first — coming soon as an inline preview."));
  document.getElementById("pe-save-draft").addEventListener("click", () => savePeDraft("Draft"));
  document.getElementById("pe-save").addEventListener("click", () => savePeDraft(null));
}

function renderPeTab(tab){
  const d = peDraft;
  if (tab === "info") return `
    <div class="mb-4"><label class="field-label">Product Name</label><input id="pe-name" class="field-input" value="${d.name}"></div>
    <div class="mb-4"><label class="field-label">Short Description</label><input id="pe-shortdesc" class="field-input" value="${d.shortDesc}" placeholder="One line, shown on cards"></div>
    <div class="mb-4">
      <label class="field-label">Long Description</label>
      <div class="rte-toolbar">
        <button type="button" class="rte-btn" data-cmd="bold"><b>B</b></button>
        <button type="button" class="rte-btn" data-cmd="italic"><i>I</i></button>
        <button type="button" class="rte-btn" data-cmd="formatBlock" data-val="h3">H3</button>
        <button type="button" class="rte-btn" data-cmd="insertUnorderedList">•</button>
        <button type="button" class="rte-btn" data-cmd="insertOrderedList">1.</button>
        <button type="button" class="rte-btn" data-cmd="formatBlock" data-val="blockquote">“”</button>
        <button type="button" class="rte-btn" data-cmd="createLink">🔗</button>
      </div>
      <div id="pe-desc" class="rte-editor" contenteditable="true">${d.desc}</div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Brand</label><input id="pe-brand" class="field-input" value="${d.brand}"></div>
      <div><label class="field-label">Vendor</label><input id="pe-vendor" class="field-input" value="${d.vendor}"></div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Category</label>
        <select id="pe-category" class="field-input">
          <option value="">— None —</option>
          ${allCmsCategories().map(c => `<option value="${c.id}" ${d.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
        </select>
      </div>
      <div><label class="field-label">Subcategory</label><input id="pe-subcategory" class="field-input" value="${d.subcategory}"></div>
    </div>
    <div class="mb-4"><label class="field-label">Collections</label>
      <div class="flex flex-wrap gap-2">
        ${allCollections().length ? allCollections().map(c => `<button type="button" class="adm-chip pe-collection-chip ${d.collectionIds.includes(c.id) ? "active" : ""}" data-id="${c.id}">${c.name}</button>`).join("") : `<span class="text-xs text-[var(--alt-muted)]">No collections yet — create one from the Collections tab.</span>`}
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">SKU</label><input id="pe-sku" class="field-input font-mono" value="${d.sku}"></div>
      <div><label class="field-label">Barcode</label><input id="pe-barcode" class="field-input font-mono" value="${d.barcode}"></div>
    </div>
    <div class="mb-4"><label class="field-label">Tags (comma separated)</label><input id="pe-tags" class="field-input" value="${(d.tags || []).join(", ")}"></div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Release Date</label><input id="pe-release" type="date" class="field-input" value="${d.releaseDate}"></div>
      <div><label class="field-label">Display Order</label><input id="pe-order" type="number" class="field-input" value="${d.displayOrder}"></div>
    </div>
    <div class="grid grid-cols-2 gap-y-2">
      ${["featured:Featured Product","trending:Trending Product","bestSeller:Best Seller","newArrival:New Arrival","limitedEdition:Limited Edition"].map(pair => {
        const [key, label] = pair.split(":");
        return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="pe-${key}" ${d[key] ? "checked" : ""}> ${label}</label>`;
      }).join("")}
    </div>
  `;

  if (tab === "variants") return `
    <p class="text-sm text-[var(--alt-muted)] mb-4">Unlimited variants — color, size, material, storage, bundle, edition. Each has its own SKU, price, inventory, and availability.</p>
    <div id="pe-variants-list">${renderPeVariants()}</div>
    <button type="button" id="pe-add-variant" class="adm-btn adm-btn-ghost mt-2">+ Add Variant</button>
  `;

  if (tab === "pricing") return `
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Regular Price (৳)</label><input id="pe-price" type="number" min="0" class="field-input" value="${d.price}"></div>
      <div><label class="field-label">Sale Price (৳)</label><input id="pe-saleprice" type="number" min="0" class="field-input" value="${d.salePrice ?? ""}" placeholder="Optional"></div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Cost Price (৳) <span class="future-tag">Admin only</span></label><input id="pe-cost" type="number" min="0" class="field-input" value="${d.costPrice ?? ""}" placeholder="Not shown to customers"></div>
      <div><label class="field-label">Profit Margin</label><input id="pe-margin" class="field-input" value="${peMargin(d)}" disabled></div>
    </div>
    <div class="mb-4"><label class="field-label">Tax Rule</label>
      <select id="pe-tax" class="field-input">
        ${["Standard","Zero-rated","Exempt"].map(t => `<option ${d.taxRule === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="flex items-center justify-between panel" style="padding:14px;"><span class="text-sm">Wholesale Pricing</span><span class="future-tag">Future</span></div>
      <div class="flex items-center justify-between panel" style="padding:14px;"><span class="text-sm">Volume Discounts</span><span class="future-tag">Future</span></div>
    </div>
  `;

  if (tab === "inventory") return `
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Current Stock</label><input id="pe-stock" type="number" min="0" class="field-input" value="${d.stock}"></div>
      <div><label class="field-label">Low Stock Threshold</label><input id="pe-threshold" type="number" min="0" class="field-input" value="${d.lowStockThreshold}"></div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-5">
      <div class="flex items-center justify-between panel" style="padding:14px;"><span class="text-sm">Reserved Stock</span><span class="font-mono text-sm">0 <span class="future-tag">Future</span></span></div>
      <div class="flex items-center justify-between panel" style="padding:14px;"><span class="text-sm">Incoming Stock</span><span class="font-mono text-sm">— <span class="future-tag">Future</span></span></div>
    </div>
    <div class="flex items-center justify-between panel mb-5" style="padding:14px;"><span class="text-sm">Warehouse</span><span class="font-mono text-sm">Main <span class="future-tag">Future</span></span></div>
    <p class="field-label mb-2">Stock History</p>
    <div class="max-h-40 overflow-y-auto no-scrollbar">
      ${(d.stockHistory || []).length ? d.stockHistory.slice(0, 10).map(h => `<div class="flex items-center justify-between text-sm mb-2"><span>${h.from} → ${h.to}</span><span class="text-xs text-[var(--alt-muted)] font-mono">${timeAgo(h.at)}</span></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No stock changes recorded yet.</p>`}
    </div>
  `;

  if (tab === "seo") return `
    <div class="mb-4"><label class="field-label">SEO Title</label><input id="pe-seotitle" class="field-input" value="${d.seoTitle}" maxlength="60"></div>
    <div class="mb-4"><label class="field-label">Meta Description</label><textarea id="pe-seodesc" rows="3" class="field-input" maxlength="160">${d.seoDescription}</textarea></div>
    <div class="mb-4"><label class="field-label">URL Slug</label><input id="pe-slug" class="field-input font-mono" value="${d.slug}"></div>
    <div class="mb-4"><label class="field-label">Canonical URL</label><input id="pe-canonical" class="field-input" value="${d.canonicalUrl}" placeholder="Optional"></div>
    <div class="mb-4"><label class="field-label">Open Graph Image URL</label><input id="pe-ogimage" class="field-input" value="${d.ogImage}"></div>
    <div class="mb-4"><label class="field-label">Twitter Card</label>
      <select id="pe-twittercard" class="field-input">
        <option value="summary" ${d.twitterCard === "summary" ? "selected" : ""}>Summary</option>
        <option value="summary_large_image" ${d.twitterCard === "summary_large_image" ? "selected" : ""}>Summary with Large Image</option>
      </select>
    </div>
    <div class="flex items-center justify-between panel mb-4" style="padding:14px;"><span class="text-sm">Structured Data (JSON-LD)</span><span class="future-tag">Placeholder</span></div>
    <div class="panel mb-4">
      <p class="field-label mb-2">Search Preview</p>
      <p class="text-[#1a0dab] text-base leading-tight truncate">${d.seoTitle || d.name || "Untitled product"}</p>
      <p class="text-[#006621] text-xs">aestheticlifestyletouch.com › store › ${d.slug || "product"}</p>
      <p class="text-sm text-[var(--alt-muted)] mt-1 line-clamp-2">${d.seoDescription || d.shortDesc || "Add a meta description to control how this looks in search results."}</p>
    </div>
    <div>
      <p class="field-label mb-2">SEO Score <span class="future-tag">Placeholder heuristic</span></p>
      <div class="ranked-track" style="height:10px;"><div class="ranked-fill" style="width:${peSeoScore(d)}%; height:100%;"></div></div>
      <p class="text-xs text-[var(--alt-muted)] mt-2">${peSeoScore(d)}% — based on title, description, slug, and image being filled in.</p>
    </div>
  `;

  if (tab === "media") return `
    <label class="field-label">Featured Image URL</label>
    <input id="pe-img" class="field-input mb-4" value="${d.img}">
    ${d.img ? `<img src="${d.img}" class="w-full h-40 object-cover rounded-xl mb-4" loading="lazy" decoding="async" alt="">` : ""}
    <label class="field-label">Gallery</label>
    <div class="grid grid-cols-4 gap-2 mb-3" id="pe-gallery-grid">
      ${(d.gallery || []).map((src, i) => `
        <div class="media-tile"><img src="${src}" loading="lazy" decoding="async" alt=""><button type="button" class="adm-icon-btn pe-gallery-remove" data-i="${i}" style="position:absolute;top:4px;right:4px;background:rgba(255,255,255,0.85);width:22px;height:22px;" aria-label="Remove"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      `).join("")}
    </div>
    <button type="button" id="pe-open-media" class="adm-btn adm-btn-ghost">Choose from Media Library</button>
  `;

  if (tab === "workflow") return `
    <div class="mb-4"><label class="field-label">Status</label>
      <select id="pe-status" class="field-input">
        ${WORKFLOW_STATES.map(s => `<option ${d.status === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </div>
    <div class="mb-5"><label class="field-label">Scheduled Publish Date/Time</label><input id="pe-scheduled" type="datetime-local" class="field-input" value="${d.scheduledAt}"></div>
    <p class="field-label mb-2">Publishing Timeline</p>
    <div class="flex items-center gap-1 mb-5">
      ${WORKFLOW_STATES.filter(s => s !== "Rejected").map(s => `<span class="wf-badge ${s === d.status ? "badge-good" : "badge-neutral"}" style="${s === d.status ? "" : "opacity:.5;"}">${s}</span>`).join(" → ")}
    </div>
    <p class="field-label mb-2">Version History <span class="future-tag">Real snapshots, kept on save</span></p>
    <div id="pe-versions" class="max-h-48 overflow-y-auto no-scrollbar">${renderPeVersions()}</div>
  `;

  return "";
}

function peMargin(d){
  const price = Number(d.salePrice || d.price) || 0;
  const cost = Number(d.costPrice) || 0;
  if (!price || !cost) return "—";
  return Math.round(((price - cost) / price) * 100) + "%";
}
function peSeoScore(d){
  let score = 0;
  if (d.seoTitle) score += 30;
  if (d.seoDescription) score += 30;
  if (d.slug) score += 20;
  if (d.img || d.ogImage) score += 20;
  return score;
}
function renderPeVariants(){
  return (peDraft.variants || []).map((v, i) => `
    <div class="panel mb-3" style="padding:14px;">
      <div class="flex items-center justify-between mb-3">
        <input class="field-input pe-variant-field" style="font-weight:500;" data-i="${i}" data-field="name" value="${v.name || ""}" placeholder="e.g. Black / Large">
        <button type="button" class="adm-icon-btn pe-remove-variant" data-i="${i}" style="color:var(--alt-bad);margin-left:8px;" aria-label="Remove variant"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="grid grid-cols-3 gap-2 mb-2">
        <input class="field-input pe-variant-field" data-i="${i}" data-field="sku" value="${v.sku || ""}" placeholder="SKU">
        <input class="field-input pe-variant-field" type="number" data-i="${i}" data-field="price" value="${v.price ?? ""}" placeholder="Price">
        <input class="field-input pe-variant-field" type="number" data-i="${i}" data-field="compareAt" value="${v.compareAt ?? ""}" placeholder="Compare-at">
      </div>
      <div class="grid grid-cols-3 gap-2">
        <input class="field-input pe-variant-field" type="number" data-i="${i}" data-field="inventory" value="${v.inventory ?? ""}" placeholder="Inventory">
        <input class="field-input pe-variant-field" data-i="${i}" data-field="weight" value="${v.weight || ""}" placeholder="Weight">
        <input class="field-input pe-variant-field" data-i="${i}" data-field="dimensions" value="${v.dimensions || ""}" placeholder="Dimensions">
      </div>
    </div>
  `).join("") || `<p class="text-sm text-[var(--alt-muted)]">No variants yet.</p>`;
}
function renderPeVersions(){
  const versions = peDraft.id ? productVersions(peDraft.id) : [];
  if (!versions.length) return `<p class="text-sm text-[var(--alt-muted)]">No saved versions yet — they'll appear here after your first save.</p>`;
  return versions.map((v, i) => `
    <div class="flex items-center justify-between text-sm mb-2">
      <span>${v.note} <span class="text-xs text-[var(--alt-muted)] font-mono">by ${v.by}</span></span>
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--alt-muted)] font-mono">${timeAgo(v.at)}</span>
        <button type="button" class="adm-icon-btn pe-restore-version" data-i="${i}" aria-label="Restore"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg></button>
      </div>
    </div>
  `).join("");
}

function wirePeTab(tab){
  const on = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

  if (tab === "info"){
    on("pe-name", "input", e => peDraft.name = e.target.value);
    on("pe-shortdesc", "input", e => peDraft.shortDesc = e.target.value);
    on("pe-desc", "input", e => peDraft.desc = e.target.innerHTML);
    on("pe-brand", "input", e => peDraft.brand = e.target.value);
    on("pe-vendor", "input", e => peDraft.vendor = e.target.value);
    on("pe-category", "change", e => peDraft.category = e.target.value);
    on("pe-subcategory", "input", e => peDraft.subcategory = e.target.value);
    on("pe-sku", "input", e => peDraft.sku = e.target.value);
    on("pe-barcode", "input", e => peDraft.barcode = e.target.value);
    on("pe-tags", "input", e => peDraft.tags = e.target.value.split(",").map(s => s.trim()).filter(Boolean));
    on("pe-release", "input", e => peDraft.releaseDate = e.target.value);
    on("pe-order", "input", e => peDraft.displayOrder = Number(e.target.value) || 0);
    ["featured","trending","bestSeller","newArrival","limitedEdition"].forEach(key => on(`pe-${key}`, "change", e => peDraft[key] = e.target.checked));
    document.querySelectorAll(".rte-btn").forEach(btn => btn.addEventListener("click", () => {
      document.getElementById("pe-desc").focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || (btn.dataset.cmd === "createLink" ? prompt("Link URL:") || "" : null));
      peDraft.desc = document.getElementById("pe-desc").innerHTML;
    }));
    document.querySelectorAll(".pe-collection-chip").forEach(chip => chip.addEventListener("click", () => {
      const id = chip.dataset.id;
      const idx = peDraft.collectionIds.indexOf(id);
      if (idx > -1) peDraft.collectionIds.splice(idx, 1); else peDraft.collectionIds.push(id);
      chip.classList.toggle("active");
    }));
  }

  if (tab === "variants"){
    on("pe-add-variant", "click", () => {
      peDraft.variants.push({ name: "", sku: "", price: null, compareAt: null, inventory: 0, weight: "", dimensions: "" });
      document.getElementById("pe-variants-list").innerHTML = renderPeVariants();
      wirePeTab("variants");
    });
    document.querySelectorAll(".pe-variant-field").forEach(inp => inp.addEventListener("input", () => {
      const i = Number(inp.dataset.i);
      const field = inp.dataset.field;
      peDraft.variants[i][field] = inp.type === "number" ? (inp.value === "" ? null : Number(inp.value)) : inp.value;
    }));
    document.querySelectorAll(".pe-remove-variant").forEach(btn => btn.addEventListener("click", () => {
      peDraft.variants.splice(Number(btn.dataset.i), 1);
      document.getElementById("pe-variants-list").innerHTML = renderPeVariants();
      wirePeTab("variants");
    }));
  }

  if (tab === "pricing"){
    on("pe-price", "input", e => { peDraft.price = Number(e.target.value) || 0; refreshMargin(); });
    on("pe-saleprice", "input", e => { peDraft.salePrice = e.target.value === "" ? null : Number(e.target.value); refreshMargin(); });
    on("pe-cost", "input", e => { peDraft.costPrice = e.target.value === "" ? null : Number(e.target.value); refreshMargin(); });
    on("pe-tax", "change", e => peDraft.taxRule = e.target.value);
    function refreshMargin(){ const el = document.getElementById("pe-margin"); if (el) el.value = peMargin(peDraft); }
  }

  if (tab === "inventory"){
    on("pe-stock", "input", e => peDraft.stock = Math.max(0, Number(e.target.value) || 0));
    on("pe-threshold", "input", e => peDraft.lowStockThreshold = Math.max(0, Number(e.target.value) || 0));
  }

  if (tab === "seo"){
    on("pe-seotitle", "input", e => peDraft.seoTitle = e.target.value);
    on("pe-seodesc", "input", e => peDraft.seoDescription = e.target.value);
    on("pe-slug", "input", e => peDraft.slug = e.target.value);
    on("pe-canonical", "input", e => peDraft.canonicalUrl = e.target.value);
    on("pe-ogimage", "input", e => peDraft.ogImage = e.target.value);
    on("pe-twittercard", "change", e => peDraft.twitterCard = e.target.value);
  }

  if (tab === "media"){
    on("pe-img", "input", e => peDraft.img = e.target.value);
    on("pe-open-media", "click", () => openMediaPicker(url => {
      peDraft.gallery = (peDraft.gallery || []).concat(url);
      document.getElementById("pe-tab-content").innerHTML = renderPeTab("media");
      wirePeTab("media");
    }));
    document.querySelectorAll(".pe-gallery-remove").forEach(btn => btn.addEventListener("click", () => {
      peDraft.gallery.splice(Number(btn.dataset.i), 1);
      document.getElementById("pe-tab-content").innerHTML = renderPeTab("media");
      wirePeTab("media");
    }));
  }

  if (tab === "workflow"){
    on("pe-status", "change", e => peDraft.status = e.target.value);
    on("pe-scheduled", "input", e => peDraft.scheduledAt = e.target.value);
    document.querySelectorAll(".pe-restore-version").forEach(btn => btn.addEventListener("click", () => {
      const v = productVersions(peDraft.id)[Number(btn.dataset.i)];
      if (!v) return;
      peDraft = Object.assign(blankProductDraft(), v.snapshot);
      renderProductEditorDrawer();
      cmsToast("Version restored into the editor — save to apply it.");
    }));
  }
}

function savePeDraft(forceStatus){
  if (!peDraft.name.trim()){ cmsToast("Product name is required."); return; }
  if (forceStatus) peDraft.status = forceStatus;
  if (!peDraft.slug) peDraft.slug = peDraft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  if (peIsNew){
    peDraft.id = "cms_" + Date.now();
    peDraft.stockHistory = [{ from: 0, to: peDraft.stock, at: Date.now() }];
    addProduct(peDraft);
    logAudit("CMS product created", peDraft.name);
  } else {
    const previous = getProduct(peDraft.id);
    if (previous && previous.stock !== peDraft.stock){
      peDraft.stockHistory = [{ from: previous.stock, to: peDraft.stock, at: Date.now() }].concat(previous.stockHistory || []).slice(0, 20);
    }
    if (isExtraProduct(peDraft.id)){
      const extras = productExtras().map(p => p.id === peDraft.id ? Object.assign({}, p, peDraft) : p);
      saveProductExtras(extras);
    } else {
      updateProduct(peDraft.id, peDraft);
    }
    logAudit("CMS product updated", peDraft.name);
  }
  pushVersionSnapshot(peDraft.id, Object.assign({}, peDraft), forceStatus ? "Saved as draft" : "Saved changes");
  closeDrawer();
  renderProductsTable();
  renderSidebar();
  cmsToast(peIsNew ? "Product created." : "Product saved.");
}

/* ---------------- media picker (used by product editor + others) ---------------- */
function openMediaPicker(onPick){
  const items = allMedia();
  const body = `
    <div class="grid grid-cols-3 gap-3">
      ${items.length ? items.map(m => `
        <div class="media-tile mp-pick" data-url="${m.url}">
          ${m.type === "video" ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" loading="lazy" decoding="async" alt="${m.alt || ""}">`}
        </div>
      `).join("") : `<p class="text-sm text-[var(--alt-muted)] col-span-3">No media uploaded yet — visit the Media Library first.</p>`}
    </div>
  `;
  openDrawer("Choose Media", body, null);
  document.querySelectorAll(".mp-pick").forEach(el => el.addEventListener("click", () => { onPick(el.dataset.url); closeDrawer(); }));
}

/* ---------------- CSV import ---------------- */
function openCsvImport(){
  const body = `
    <p class="text-sm text-[var(--alt-muted)] mb-3">Paste CSV with a header row. Minimum columns: <code class="font-mono text-xs">name,price,stock</code>. An Excel (.xlsx) importer is <span class="future-tag">Future</span> — export to CSV first.</p>
    <textarea id="csv-textarea" rows="8" class="field-input font-mono text-xs" placeholder="name,price,stock&#10;New Item,49,10"></textarea>
    <p id="csv-error" class="text-xs text-[var(--alt-bad)] mt-2" style="display:none;"></p>
  `;
  const foot = `<button id="csv-submit" class="adm-btn adm-btn-primary flex-1">Import</button>`;
  openDrawer("CSV Import", body, foot);
  document.getElementById("csv-submit").addEventListener("click", () => {
    const err = document.getElementById("csv-error");
    try {
      const lines = document.getElementById("csv-textarea").value.trim().split("\n");
      const header = lines.shift().split(",").map(h => h.trim());
      if (!header.includes("name") || !header.includes("price")) throw new Error("CSV needs at least name and price columns.");
      let count = 0;
      lines.forEach(line => {
        if (!line.trim()) return;
        const cells = line.split(",").map(c => c.trim());
        const row = {};
        header.forEach((h, i) => row[h] = cells[i]);
        addProduct(Object.assign(blankProductDraft(), { id: "cms_" + Date.now() + "_" + count, name: row.name, price: Number(row.price) || 0, stock: Number(row.stock) || 0, status: "Draft" }));
        count++;
      });
      logAudit("CMS CSV import", `${count} products`);
      closeDrawer();
      renderProductsTable();
      cmsToast(`${count} product(s) imported as drafts.`);
    } catch (e){ err.textContent = e.message; err.style.display = "block"; }
  });
}

/* ================================================================
   MEDIA LIBRARY
   ================================================================ */
const mediaState = { search: "", folder: "all", selected: new Set() };
VIEW_RENDERERS.media = function(){
  const folders = ["all"].concat([...new Set(allMedia().map(m => m.folder).filter(Boolean))]);
  document.getElementById("view-media").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Media Library</h2>
      <div class="flex items-center gap-2">
        ${mediaState.selected.size ? `<button id="media-bulk-delete" class="adm-btn adm-btn-danger">Delete ${mediaState.selected.size} Selected</button>` : ""}
      </div>
    </div>
    <div class="dropzone mb-5" id="media-dropzone" data-enter>
      <input type="file" id="media-file-input" accept="image/*,video/*" multiple class="hidden">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--alt-muted)" stroke-width="1.5" class="mx-auto mb-3"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      <p class="text-sm">Drag & drop images or videos here, or <span class="underline" style="cursor:pointer;" id="media-browse">browse files</span></p>
      <p class="text-xs text-[var(--alt-muted)] mt-1">Bulk upload supported. Images are stored as-is in this browser-only prototype (no server compression yet).</p>
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <input id="media-search" type="text" placeholder="Search media…" class="adm-input" style="min-width:220px;">
      ${folders.map(f => `<button class="adm-chip media-folder-chip ${mediaState.folder === f ? "active" : ""}" data-folder="${f}">${f === "all" ? "All Folders" : f}</button>`).join("")}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3" id="media-grid" data-enter></div>
  `;
  const dz = document.getElementById("media-dropzone");
  const fileInput = document.getElementById("media-file-input");
  document.getElementById("media-browse").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleMediaFiles(fileInput.files));
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag-over"); handleMediaFiles(e.dataTransfer.files); });
  document.getElementById("media-search").addEventListener("input", e => { mediaState.search = e.target.value; renderMediaGrid(); });
  document.querySelectorAll(".media-folder-chip").forEach(btn => btn.addEventListener("click", () => { mediaState.folder = btn.dataset.folder; VIEW_RENDERERS.media(); }));
  const bulkDelete = document.getElementById("media-bulk-delete");
  if (bulkDelete) bulkDelete.addEventListener("click", () => {
    confirmAction({
      title: `Delete ${mediaState.selected.size} media item(s)?`, body: "This can't be undone.", confirmLabel: "Delete", danger: true,
      onConfirm(){
        saveMedia(allMedia().filter(m => !mediaState.selected.has(m.id)));
        logAudit("CMS media deleted", `${mediaState.selected.size} items`);
        mediaState.selected.clear();
        VIEW_RENDERERS.media();
        cmsToast("Media deleted.");
      },
    });
  });
  renderMediaGrid();
};

function handleMediaFiles(files){
  const MAX_BYTES = 4 * 1024 * 1024;
  let accepted = 0, rejected = 0;
  Array.from(files).forEach(file => {
    if (!/^image\/|^video\//.test(file.type)){ rejected++; return; }
    if (file.size > MAX_BYTES){ rejected++; return; }
    const reader = new FileReader();
    reader.onload = () => {
      addMediaItem({
        id: "med_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name: file.name, type: file.type.startsWith("video") ? "video" : "image",
        url: reader.result, alt: "", folder: "Uploads", uploadedAt: Date.now(), size: file.size,
      });
      renderMediaGrid();
    };
    reader.readAsDataURL(file);
    accepted++;
  });
  logAudit("CMS media uploaded", `${accepted} accepted, ${rejected} rejected (type/size)`);
  cmsToast(rejected ? `${accepted} uploaded, ${rejected} rejected (only images/video under 4MB).` : `${accepted} file(s) uploaded.`);
}

function renderMediaGrid(){
  let items = allMedia();
  if (mediaState.folder !== "all") items = items.filter(m => m.folder === mediaState.folder);
  if (mediaState.search.trim()){
    const q = mediaState.search.trim().toLowerCase();
    items = items.filter(m => m.name.toLowerCase().includes(q));
  }
  document.getElementById("media-grid").innerHTML = items.length ? items.map(m => `
    <div class="media-tile media-item" data-id="${m.id}">
      <input type="checkbox" class="media-check row-check media-select" data-id="${m.id}">
      ${m.type === "video" ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" loading="lazy" decoding="async" alt="${m.alt || ""}">`}
    </div>
  `).join("") : `<p class="text-sm text-[var(--alt-muted)] col-span-full">No media yet — upload something above.</p>`;
  document.querySelectorAll(".media-select").forEach(cb => cb.addEventListener("click", e => e.stopPropagation()));
  document.querySelectorAll(".media-select").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) mediaState.selected.add(cb.dataset.id); else mediaState.selected.delete(cb.dataset.id);
    VIEW_RENDERERS.media();
  }));
  document.querySelectorAll(".media-item").forEach(el => el.addEventListener("click", (e) => { if (e.target.type !== "checkbox") openMediaDetail(el.dataset.id); }));
}
function openMediaDetail(id){
  const m = allMedia().find(x => x.id === id);
  if (!m) return;
  const body = `
    ${m.type === "video" ? `<video src="${m.url}" controls class="w-full rounded-xl mb-4"></video>` : `<img src="${m.url}" class="w-full rounded-xl mb-4" alt="">`}
    <div class="mb-4"><label class="field-label">Alt Text</label><input id="md-alt" class="field-input" value="${m.alt || ""}"></div>
    <div class="mb-4"><label class="field-label">Folder</label><input id="md-folder" class="field-input" value="${m.folder || ""}"></div>
    <p class="text-xs text-[var(--alt-muted)]">${m.name} · ${(m.size / 1024).toFixed(0)} KB · uploaded ${timeAgo(m.uploadedAt)}</p>
    <p class="text-xs text-[var(--alt-muted)] mt-1">Duplicate detection <span class="future-tag">Future</span> · Image cropping <span class="future-tag">Future</span></p>
  `;
  const foot = `<button id="md-delete" class="adm-btn adm-btn-danger">Delete</button><button id="md-save" class="adm-btn adm-btn-primary flex-1">Save</button>`;
  openDrawer("Media Details", body, foot);
  document.getElementById("md-save").addEventListener("click", () => {
    const list = allMedia().map(x => x.id === id ? Object.assign({}, x, { alt: document.getElementById("md-alt").value, folder: document.getElementById("md-folder").value }) : x);
    saveMedia(list);
    closeDrawer();
    renderMediaGrid();
    cmsToast("Media updated.");
  });
  document.getElementById("md-delete").addEventListener("click", () => {
    confirmAction({
      title: "Delete this media item?", body: "This can't be undone.", confirmLabel: "Delete", danger: true,
      onConfirm(){
        saveMedia(allMedia().filter(x => x.id !== id));
        logAudit("CMS media deleted", m.name);
        closeDrawer();
        renderMediaGrid();
        cmsToast("Media deleted.");
      },
    });
  });
}

/* ================================================================
   COLLECTIONS
   ================================================================ */
VIEW_RENDERERS.collections = function(){
  const collections = allCollections();
  document.getElementById("view-collections").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Collections</h2>
      <button id="col-add" class="adm-btn adm-btn-primary">+ New Collection</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-enter>
      ${collections.length ? collections.map(c => `
        <div class="panel col-open" data-id="${c.id}" style="cursor:pointer;">
          <div class="flex items-center justify-between mb-2">
            <p class="panel-title">${c.name}</p>
            <span class="badge ${c.visible ? "badge-good" : "badge-neutral"}"><span class="badge-dot"></span>${c.visible ? "Visible" : "Hidden"}</span>
          </div>
          <p class="text-xs text-[var(--alt-muted)] font-mono uppercase mb-2">${c.type}</p>
          <p class="text-sm text-[var(--alt-muted)]">${(c.productIds || []).length} product${(c.productIds || []).length === 1 ? "" : "s"}</p>
        </div>
      `).join("") : `<p class="text-sm text-[var(--alt-muted)]">No collections yet.</p>`}
    </div>
  `;
  document.getElementById("col-add").addEventListener("click", () => openCollectionEditor(null));
  document.querySelectorAll(".col-open").forEach(el => el.addEventListener("click", () => openCollectionEditor(el.dataset.id)));
};
function openCollectionEditor(id){
  const isNew = !id;
  const c = isNew ? { id: "col_" + Date.now(), name: "", type: "Manual", productIds: [], visible: true, visibleFrom: "", visibleTo: "" } : allCollections().find(x => x.id === id);
  const products = effectiveProducts();
  const body = `
    <div class="mb-4"><label class="field-label">Collection Name</label><input id="col-name" class="field-input" value="${c.name}"></div>
    <div class="mb-4"><label class="field-label">Type</label>
      <select id="col-type" class="field-input">
        ${["Manual","Featured","Seasonal","Campaign"].map(t => `<option ${c.type === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <p class="text-xs text-[var(--alt-muted)] mt-1">Smart Collections (rule-based auto-membership) <span class="future-tag">Future</span></p>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Visible From</label><input id="col-from" type="date" class="field-input" value="${c.visibleFrom || ""}"></div>
      <div><label class="field-label">Visible To</label><input id="col-to" type="date" class="field-input" value="${c.visibleTo || ""}"></div>
    </div>
    <label class="flex items-center gap-2 text-sm mb-4"><input type="checkbox" id="col-visible" ${c.visible ? "checked" : ""}> Visible on storefront</label>
    <label class="field-label mb-2 block">Products</label>
    <div class="max-h-64 overflow-y-auto no-scrollbar">
      ${products.map(p => `<label class="flex items-center gap-2 text-sm mb-2"><input type="checkbox" class="col-product-check" data-id="${p.id}" ${(c.productIds || []).includes(p.id) ? "checked" : ""}> ${p.name}</label>`).join("")}
    </div>
  `;
  const foot = `${!isNew ? `<button id="col-delete" class="adm-btn adm-btn-danger">Delete</button>` : ""}<button id="col-save" class="adm-btn adm-btn-primary flex-1">${isNew ? "Create Collection" : "Save Changes"}</button>`;
  openDrawer(isNew ? "New Collection" : `Edit — ${c.name}`, body, foot);
  document.getElementById("col-save").addEventListener("click", () => {
    const patch = {
      name: document.getElementById("col-name").value.trim(),
      type: document.getElementById("col-type").value,
      visibleFrom: document.getElementById("col-from").value,
      visibleTo: document.getElementById("col-to").value,
      visible: document.getElementById("col-visible").checked,
      productIds: Array.from(document.querySelectorAll(".col-product-check:checked")).map(cb => idOf(cb.dataset.id)),
    };
    if (!patch.name){ cmsToast("Collection name is required."); return; }
    const list = allCollections();
    if (isNew){ list.push(Object.assign(c, patch)); logAudit("CMS collection created", patch.name); }
    else { const idx = list.findIndex(x => x.id === id); list[idx] = Object.assign(list[idx], patch); logAudit("CMS collection updated", patch.name); }
    saveCollectionsList(list);
    closeDrawer();
    VIEW_RENDERERS.collections();
    cmsToast(isNew ? "Collection created." : "Collection saved.");
  });
  const deleteBtn = document.getElementById("col-delete");
  if (deleteBtn) deleteBtn.addEventListener("click", () => {
    confirmAction({
      title: `Delete "${c.name}"?`, body: "Products stay in the catalog; only the collection grouping is removed.", confirmLabel: "Delete", danger: true,
      onConfirm(){
        saveCollectionsList(allCollections().filter(x => x.id !== id));
        logAudit("CMS collection deleted", c.name);
        closeDrawer();
        VIEW_RENDERERS.collections();
        cmsToast("Collection deleted.");
      },
    });
  });
}

/* ================================================================
   CATEGORIES (nested)
   ================================================================ */
VIEW_RENDERERS.categories = function(){
  const categories = allCmsCategories();
  const roots = categories.filter(c => !c.parentId);
  function renderTree(parentId, depth){
    return categories.filter(c => c.parentId === parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(c => `
      <div class="tree-row" style="padding-left:${depth * 22 + 10}px;">
        <span>${c.icon || "📁"}</span>
        <span class="flex-1 cat-open" data-id="${c.id}" style="cursor:pointer;">${c.name}</span>
        <span class="badge ${c.visible ? "badge-good" : "badge-neutral"}"><span class="badge-dot"></span>${c.visible ? "Visible" : "Hidden"}</span>
        <button class="adm-icon-btn cat-add-child" data-id="${c.id}" aria-label="Add subcategory"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      ${renderTree(c.id, depth + 1)}
    `).join("");
  }
  document.getElementById("view-categories").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Categories</h2>
      <button id="cat-add" class="adm-btn adm-btn-primary">+ New Category</button>
    </div>
    <div class="panel" data-enter>
      ${categories.length ? renderTree(null, 0) : `<p class="text-sm text-[var(--alt-muted)]">No categories yet.</p>`}
    </div>
  `;
  document.getElementById("cat-add").addEventListener("click", () => openCategoryEditor(null));
  document.querySelectorAll(".cat-open").forEach(el => el.addEventListener("click", () => openCategoryEditor(el.dataset.id)));
  document.querySelectorAll(".cat-add-child").forEach(el => el.addEventListener("click", () => openCategoryEditor(null, el.dataset.id)));
};
function openCategoryEditor(id, parentId){
  const isNew = !id;
  const cat = isNew ? { id: "cat_" + Date.now(), name: "", parentId: parentId || null, icon: "📁", coverImage: "", visible: true, sortOrder: 0, seoTitle: "", seoDescription: "" } : allCmsCategories().find(x => x.id === id);
  const body = `
    <div class="mb-4"><label class="field-label">Category Name</label><input id="cat-name" class="field-input" value="${cat.name}"></div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Icon (emoji)</label><input id="cat-icon" class="field-input" value="${cat.icon}"></div>
      <div><label class="field-label">Sort Order</label><input id="cat-sort" type="number" class="field-input" value="${cat.sortOrder}"></div>
    </div>
    <div class="mb-4"><label class="field-label">Parent Category</label>
      <select id="cat-parent" class="field-input">
        <option value="">— Top level —</option>
        ${allCmsCategories().filter(c => c.id !== id).map(c => `<option value="${c.id}" ${cat.parentId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
      </select>
    </div>
    <div class="mb-4"><label class="field-label">Cover Image URL</label><input id="cat-cover" class="field-input" value="${cat.coverImage}"></div>
    <label class="flex items-center gap-2 text-sm mb-4"><input type="checkbox" id="cat-visible" ${cat.visible ? "checked" : ""}> Visible on storefront</label>
    <div class="mb-4"><label class="field-label">SEO Title</label><input id="cat-seotitle" class="field-input" value="${cat.seoTitle || ""}"></div>
    <div><label class="field-label">SEO Description</label><textarea id="cat-seodesc" rows="2" class="field-input">${cat.seoDescription || ""}</textarea></div>
  `;
  const foot = `${!isNew ? `<button id="cat-delete" class="adm-btn adm-btn-danger">Delete</button>` : ""}<button id="cat-save" class="adm-btn adm-btn-primary flex-1">${isNew ? "Create Category" : "Save Changes"}</button>`;
  openDrawer(isNew ? "New Category" : `Edit — ${cat.name}`, body, foot);
  document.getElementById("cat-save").addEventListener("click", () => {
    const patch = {
      name: document.getElementById("cat-name").value.trim(),
      icon: document.getElementById("cat-icon").value,
      sortOrder: Number(document.getElementById("cat-sort").value) || 0,
      parentId: document.getElementById("cat-parent").value || null,
      coverImage: document.getElementById("cat-cover").value,
      visible: document.getElementById("cat-visible").checked,
      seoTitle: document.getElementById("cat-seotitle").value,
      seoDescription: document.getElementById("cat-seodesc").value,
    };
    if (!patch.name){ cmsToast("Category name is required."); return; }
    const list = allCmsCategories();
    if (isNew){ list.push(Object.assign(cat, patch)); logAudit("CMS category created", patch.name); }
    else { const idx = list.findIndex(x => x.id === id); list[idx] = Object.assign(list[idx], patch); logAudit("CMS category updated", patch.name); }
    saveCmsCategories(list);
    closeDrawer();
    VIEW_RENDERERS.categories();
    cmsToast(isNew ? "Category created." : "Category saved.");
  });
  const deleteBtn = document.getElementById("cat-delete");
  if (deleteBtn) deleteBtn.addEventListener("click", () => {
    confirmAction({
      title: `Delete "${cat.name}"?`, body: "Subcategories will move up to this category's parent.", confirmLabel: "Delete", danger: true,
      onConfirm(){
        const list = allCmsCategories();
        list.forEach(c => { if (c.parentId === id) c.parentId = cat.parentId; });
        saveCmsCategories(list.filter(x => x.id !== id));
        logAudit("CMS category deleted", cat.name);
        closeDrawer();
        VIEW_RENDERERS.categories();
        cmsToast("Category deleted.");
      },
    });
  });
}

/* ================================================================
   BULK OPERATIONS
   ================================================================ */
const bulkState = { selected: new Set() };
VIEW_RENDERERS.bulk = function(){
  const products = effectiveProducts();
  document.getElementById("view-bulk").innerHTML = `
    <div class="mb-5" data-enter><h2 class="font-display text-2xl font-medium">Bulk Operations</h2><p class="text-sm text-[var(--alt-muted)] mt-1">Select products, then apply one change to all of them at once.</p></div>
    <div class="panel mb-5" data-enter>
      <div class="flex items-center gap-2 flex-wrap">
        <button class="adm-btn adm-btn-ghost" data-bulk="publish">Bulk Publish</button>
        <button class="adm-btn adm-btn-ghost" data-bulk="archive">Bulk Archive</button>
        <button class="adm-btn adm-btn-danger" data-bulk="delete">Bulk Delete</button>
        <button class="adm-btn adm-btn-ghost" id="bulk-price">Bulk Price Update</button>
        <button class="adm-btn adm-btn-ghost" id="bulk-inventory">Bulk Inventory Update</button>
        <button class="adm-btn adm-btn-ghost" id="bulk-category">Bulk Category Assign</button>
        <button class="adm-btn adm-btn-ghost" id="bulk-collection">Bulk Collection Assign</button>
      </div>
      <p id="bulk-count" class="text-xs text-[var(--alt-muted)] font-mono mt-3">${bulkState.selected.size} selected</p>
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th><input type="checkbox" id="bulk-check-all" class="row-check"></th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><input type="checkbox" class="row-check bulk-row-check" data-id="${p.id}" ${bulkState.selected.has(String(p.id)) ? "checked" : ""}></td>
              <td>${p.name}</td>
              <td class="font-mono">${fmtMoney(p.salePrice || p.price)}</td>
              <td class="tabular">${p.stock}</td>
              <td>${workflowBadge(p.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById("bulk-check-all").addEventListener("change", e => {
    products.forEach(p => { if (e.target.checked) bulkState.selected.add(String(p.id)); else bulkState.selected.delete(String(p.id)); });
    VIEW_RENDERERS.bulk();
  });
  document.querySelectorAll(".bulk-row-check").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) bulkState.selected.add(cb.dataset.id); else bulkState.selected.delete(cb.dataset.id);
    document.getElementById("bulk-count").textContent = `${bulkState.selected.size} selected`;
  }));
  document.querySelectorAll("[data-bulk]").forEach(btn => btn.addEventListener("click", () => runBulkAction(btn.dataset.bulk)));
  document.getElementById("bulk-price").addEventListener("click", openBulkPriceModal);
  document.getElementById("bulk-inventory").addEventListener("click", openBulkInventoryModal);
  document.getElementById("bulk-category").addEventListener("click", openBulkCategoryModal);
  document.getElementById("bulk-collection").addEventListener("click", openBulkCollectionModal);
};
function requireBulkSelection(){
  if (!bulkState.selected.size){ cmsToast("Select at least one product first."); return false; }
  return true;
}
function runBulkAction(action){
  if (!requireBulkSelection()) return;
  const ids = Array.from(bulkState.selected).map(idOf);
  const labelMap = { publish: "Published", archive: "Archived", delete: "deleted" };
  confirmAction({
    title: `${action === "delete" ? "Delete" : action === "publish" ? "Publish" : "Archive"} ${ids.length} product(s)?`,
    body: action === "delete" ? "This can't be undone." : `They will be marked as ${labelMap[action]}.`,
    confirmLabel: "Apply", danger: action === "delete",
    onConfirm(){
      ids.forEach(id => updateProduct(id, action === "delete" ? { deleted: true } : { status: action === "publish" ? "Published" : "Archived" }));
      logAudit(`CMS bulk ${action}`, `${ids.length} products`);
      bulkState.selected.clear();
      VIEW_RENDERERS.bulk();
      renderSidebar();
      cmsToast("Bulk action applied.");
    },
  });
}
function openBulkPriceModal(){
  if (!requireBulkSelection()) return;
  const body = `<label class="field-label">New price for ${bulkState.selected.size} product(s)</label><input id="bulk-price-input" type="number" min="0" class="field-input" placeholder="৳">`;
  const foot = `<button id="bulk-price-apply" class="adm-btn adm-btn-primary flex-1">Apply</button>`;
  openDrawer("Bulk Price Update", body, foot);
  document.getElementById("bulk-price-apply").addEventListener("click", () => {
    const price = Number(document.getElementById("bulk-price-input").value);
    if (!price){ cmsToast("Enter a valid price."); return; }
    Array.from(bulkState.selected).map(idOf).forEach(id => updateProduct(id, { price }));
    logAudit("CMS bulk price update", `${bulkState.selected.size} products → ${fmtMoney(price)}`);
    closeDrawer(); bulkState.selected.clear(); VIEW_RENDERERS.bulk(); cmsToast("Prices updated.");
  });
}
function openBulkInventoryModal(){
  if (!requireBulkSelection()) return;
  const body = `<label class="field-label">Set stock for ${bulkState.selected.size} product(s)</label><input id="bulk-inv-input" type="number" min="0" class="field-input">`;
  const foot = `<button id="bulk-inv-apply" class="adm-btn adm-btn-primary flex-1">Apply</button>`;
  openDrawer("Bulk Inventory Update", body, foot);
  document.getElementById("bulk-inv-apply").addEventListener("click", () => {
    const stock = Math.max(0, Number(document.getElementById("bulk-inv-input").value) || 0);
    Array.from(bulkState.selected).map(idOf).forEach(id => updateProduct(id, { stock }));
    logAudit("CMS bulk inventory update", `${bulkState.selected.size} products → ${stock}`);
    closeDrawer(); bulkState.selected.clear(); VIEW_RENDERERS.bulk(); cmsToast("Inventory updated.");
  });
}
function openBulkCategoryModal(){
  if (!requireBulkSelection()) return;
  const body = `<label class="field-label">Assign category to ${bulkState.selected.size} product(s)</label>
    <select id="bulk-cat-input" class="field-input">${allCmsCategories().map(c => `<option value="${c.id}">${c.name}</option>`).join("") || "<option>No categories yet</option>"}</select>`;
  const foot = `<button id="bulk-cat-apply" class="adm-btn adm-btn-primary flex-1">Apply</button>`;
  openDrawer("Bulk Category Assignment", body, foot);
  document.getElementById("bulk-cat-apply").addEventListener("click", () => {
    const category = document.getElementById("bulk-cat-input").value;
    Array.from(bulkState.selected).map(idOf).forEach(id => updateProduct(id, { category }));
    logAudit("CMS bulk category assign", `${bulkState.selected.size} products`);
    closeDrawer(); bulkState.selected.clear(); VIEW_RENDERERS.bulk(); cmsToast("Category assigned.");
  });
}
function openBulkCollectionModal(){
  if (!requireBulkSelection()) return;
  const body = `<label class="field-label">Add ${bulkState.selected.size} product(s) to collection</label>
    <select id="bulk-col-input" class="field-input">${allCollections().map(c => `<option value="${c.id}">${c.name}</option>`).join("") || "<option>No collections yet</option>"}</select>`;
  const foot = `<button id="bulk-col-apply" class="adm-btn adm-btn-primary flex-1">Apply</button>`;
  openDrawer("Bulk Collection Assignment", body, foot);
  document.getElementById("bulk-col-apply").addEventListener("click", () => {
    const colId = document.getElementById("bulk-col-input").value;
    const ids = Array.from(bulkState.selected).map(idOf);
    const list = allCollections().map(c => c.id === colId ? Object.assign({}, c, { productIds: [...new Set((c.productIds || []).concat(ids))] }) : c);
    saveCollectionsList(list);
    logAudit("CMS bulk collection assign", `${ids.length} products`);
    closeDrawer(); bulkState.selected.clear(); VIEW_RENDERERS.bulk(); cmsToast("Added to collection.");
  });
}

/* ================================================================
   WEBSITE CONTENT
   ================================================================ */
VIEW_RENDERERS.website = function(){
  const w = websiteContent();
  document.getElementById("view-website").innerHTML = `
    <div class="mb-6" data-enter><h2 class="font-display text-2xl font-medium">Website Content</h2></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Homepage Hero</p>
        <div class="mb-3"><label class="field-label">Headline</label><input id="wc-hero-headline" class="field-input" value="${w.heroHeadline}"></div>
        <div class="mb-3"><label class="field-label">Subtext</label><input id="wc-hero-subtext" class="field-input" value="${w.heroSubtext}"></div>
        <div class="mb-3"><label class="field-label">CTA Button Label</label><input id="wc-hero-cta" class="field-input" value="${w.heroCtaLabel}"></div>
        <div>
          <label class="field-label">Featured Products (the 3 floating images)</label>
          ${[0, 1, 2].map(i => {
            const products = getAllProductsWithOverrides();
            const current = (w.heroFeaturedProductIds || [])[i];
            return `<select class="field-input wc-hero-product mb-2" data-i="${i}">
              <option value="">— None —</option>
              ${products.map(p => `<option value="${p.id}" ${String(current) === String(p.id) ? "selected" : ""}>${escapeHTML(p.name)}</option>`).join("")}
            </select>`;
          }).join("")}
        </div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Announcement Bar</p>
        <label class="flex items-center gap-2 text-sm mb-3"><input type="checkbox" id="wc-announce-active" ${w.announcementActive ? "checked" : ""}> Show announcement bar</label>
        <input id="wc-announce-text" class="field-input" value="${w.announcement}" placeholder="e.g. Free shipping over $100">
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Navigation Menu</p>
        <div id="wc-nav-list">${w.navLinks.map((l, i) => `<div class="flex items-center gap-2 mb-2"><input class="field-input wc-nav-label" data-i="${i}" value="${l.label}" placeholder="Label" style="flex:1;"><input class="field-input wc-nav-href" data-i="${i}" value="${l.href}" placeholder="URL" style="flex:1;"><button class="adm-icon-btn wc-nav-remove" data-i="${i}" style="color:var(--alt-bad);">✕</button></div>`).join("")}</div>
        <button id="wc-nav-add" class="adm-btn adm-btn-ghost mt-1">+ Add Link</button>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Footer, Social &amp; Contact</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <input id="wc-social-ig" class="field-input" value="${w.socialLinks.instagram}" placeholder="Instagram URL">
          <input id="wc-social-fb" class="field-input" value="${w.socialLinks.facebook}" placeholder="Facebook URL">
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <input id="wc-contact-email" class="field-input" value="${w.contactEmail}" placeholder="Contact email">
          <input id="wc-contact-phone" class="field-input" value="${w.contactPhone}" placeholder="Contact phone">
        </div>
        <input id="wc-newsletter" class="field-input" value="${w.newsletterHeadline}" placeholder="Newsletter headline">
      </div>
      <div class="panel lg:col-span-2" data-enter>
        <p class="panel-title mb-4">SEO Defaults</p>
        <div class="mb-3"><label class="field-label">Default Site Title</label><input id="wc-seo-title" class="field-input" value="${w.seoDefaultTitle}"></div>
        <div><label class="field-label">Default Meta Description</label><textarea id="wc-seo-desc" rows="2" class="field-input">${w.seoDefaultDescription}</textarea></div>
      </div>
    </div>
    <button id="wc-save" class="adm-btn adm-btn-primary mt-5" data-enter>Save Website Content</button>
  `;
  document.getElementById("wc-nav-add").addEventListener("click", () => { w.navLinks.push({ label: "", href: "" }); saveWebsiteContent({ navLinks: w.navLinks }); VIEW_RENDERERS.website(); });
  document.querySelectorAll(".wc-nav-remove").forEach(btn => btn.addEventListener("click", () => { w.navLinks.splice(Number(btn.dataset.i), 1); saveWebsiteContent({ navLinks: w.navLinks }); VIEW_RENDERERS.website(); }));
  document.getElementById("wc-save").addEventListener("click", () => {
    const navLinks = Array.from(document.querySelectorAll(".wc-nav-label")).map((inp, i) => ({ label: inp.value, href: document.querySelectorAll(".wc-nav-href")[i].value }));
    // Product ids are strings now (e.g. "a_1785...") for anything added
    // through the admin/CMS — Number()'ing one silently turns it into
    // NaN, so the saved id would never match any real product again.
    const heroFeaturedProductIds = Array.from(document.querySelectorAll(".wc-hero-product")).map(sel => sel.value || null);
    saveWebsiteContent({
      heroHeadline: document.getElementById("wc-hero-headline").value,
      heroSubtext: document.getElementById("wc-hero-subtext").value,
      heroCtaLabel: document.getElementById("wc-hero-cta").value,
      heroFeaturedProductIds,
      announcementActive: document.getElementById("wc-announce-active").checked,
      announcement: document.getElementById("wc-announce-text").value,
      navLinks,
      socialLinks: { instagram: document.getElementById("wc-social-ig").value, facebook: document.getElementById("wc-social-fb").value, tiktok: w.socialLinks.tiktok, pinterest: w.socialLinks.pinterest },
      contactEmail: document.getElementById("wc-contact-email").value,
      contactPhone: document.getElementById("wc-contact-phone").value,
      newsletterHeadline: document.getElementById("wc-newsletter").value,
      seoDefaultTitle: document.getElementById("wc-seo-title").value,
      seoDefaultDescription: document.getElementById("wc-seo-desc").value,
    });
    logAudit("CMS website content saved", "");
    cmsToast("Website content saved.");
  });
};

/* ================================================================
   WORKFLOW & HISTORY
   ================================================================ */
VIEW_RENDERERS.workflow = function(){
  const products = effectiveProducts();
  const activity = auditLog().filter(a => a.action.startsWith("CMS")).slice(0, 30);
  document.getElementById("view-workflow").innerHTML = `
    <div class="mb-6" data-enter><h2 class="font-display text-2xl font-medium">Workflow & History</h2></div>
    <div class="panel mb-5" data-enter>
      <p class="panel-title mb-4">Products by Status</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${WORKFLOW_STATES.map(s => `<div class="flex items-center justify-between panel" style="padding:12px 16px;">${workflowBadge(s)}<span class="font-mono tabular">${products.filter(p => (p.status || "Draft") === s).length}</span></div>`).join("")}
      </div>
    </div>
    <div class="panel" data-enter>
      <p class="panel-title mb-4">Activity Log <span class="future-tag ml-1">User attribution: single Owner session today</span></p>
      <div class="max-h-96 overflow-y-auto no-scrollbar">
        ${activity.length ? activity.map(a => `<div class="mb-3 flex items-center justify-between"><div><p class="text-sm">${a.action}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${a.detail}</p></div><span class="text-xs text-[var(--alt-muted)] font-mono shrink-0">${timeAgo(a.at)}</span></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No activity recorded yet.</p>`}
      </div>
    </div>
  `;
};

/* ================================================================
   PERMISSIONS — future-ready preview
   ================================================================ */
const CMS_ROLES = [
  { role: "Owner", perms: [1,1,1,1,1,1] },
  { role: "Administrator", perms: [1,1,1,1,1,0] },
  { role: "Editor", perms: [1,1,1,0,0,0] },
  { role: "Content Manager", perms: [1,1,0,0,0,1] },
  { role: "Warehouse Manager", perms: [0,0,1,1,0,0] },
  { role: "Marketing Manager", perms: [1,0,0,0,1,1] },
  { role: "Viewer", perms: [0,0,0,0,0,0] },
];
const CMS_PERM_COLS = ["Products","Media","Inventory","Orders","Coupons","Website"];
VIEW_RENDERERS.permissions = function(){
  document.getElementById("view-permissions").innerHTML = `
    <div class="mb-5" data-enter>
      <h2 class="font-display text-2xl font-medium">Permissions <span class="future-tag ml-1">Future</span></h2>
      <p class="text-sm text-[var(--alt-muted)] mt-1">Multi-user roles and enforced permissions aren't wired up yet — this previews the intended model, matching Staff Management in Store Admin.</p>
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th>Role</th>${CMS_PERM_COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>
          ${CMS_ROLES.map(r => `<tr><td class="text-sm">${r.role}</td>${r.perms.map(p => `<td>${p ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--alt-good)" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>` : `<span class="text-[var(--alt-border)]">—</span>`}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="panel mt-5" data-enter>
      <p class="panel-title mb-2">Security Preparation</p>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="flex items-center justify-between"><span>Secure Media Uploads</span><span class="badge badge-good"><span class="badge-dot"></span>Type/size checked</span></div>
        <div class="flex items-center justify-between"><span>Input Validation</span><span class="badge badge-good"><span class="badge-dot"></span>Active</span></div>
        <div class="flex items-center justify-between"><span>Audit Logs</span><span class="badge badge-good"><span class="badge-dot"></span>Active</span></div>
        <div class="flex items-center justify-between"><span>CSRF Protection</span><span class="future-tag">Needs a backend</span></div>
        <div class="flex items-center justify-between"><span>Rate Limiting</span><span class="future-tag">Needs a backend</span></div>
        <div class="flex items-center justify-between"><span>Session Management</span><span class="future-tag">Needs a backend</span></div>
      </div>
    </div>
  `;
};

/* ================================================================
   COMMAND PALETTE (⌘K)
   ================================================================ */
let cmdkHighlight = 0;
function buildCommandIndex(){
  const items = [];
  ADMIN_NAV.forEach(g => g.items.forEach(it => { if (!it.href) items.push({ tag: "Go to", label: it.label, action: () => setAdminView(it.key) }); }));
  effectiveProducts().forEach(p => items.push({ tag: "Product", label: p.name, action: () => { setAdminView("products"); setTimeout(() => openProductEditor(p.id), 200); } }));
  allMedia().forEach(m => items.push({ tag: "Media", label: m.name, action: () => setAdminView("media") }));
  allCollections().forEach(c => items.push({ tag: "Collection", label: c.name, action: () => { setAdminView("collections"); setTimeout(() => openCollectionEditor(c.id), 200); } }));
  allCmsCategories().forEach(c => items.push({ tag: "Category", label: c.name, action: () => { setAdminView("categories"); setTimeout(() => openCategoryEditor(c.id), 200); } }));
  return items;
}
function openCmdk(){
  document.getElementById("adm-cmdk-overlay").classList.add("open");
  document.getElementById("adm-cmdk-input").value = "";
  document.getElementById("adm-cmdk-input").focus();
  renderCmdkResults("");
}
function closeCmdk(){ document.getElementById("adm-cmdk-overlay").classList.remove("open"); }
function renderCmdkResults(query){
  const all = buildCommandIndex();
  const q = query.trim().toLowerCase();
  const results = (q ? all.filter(i => i.label.toLowerCase().includes(q)) : all.slice(0, 8)).slice(0, 20);
  cmdkHighlight = 0;
  document.getElementById("adm-cmdk-results").innerHTML = results.length ? results.map((r, i) => `
    <div class="cmdk-item ${i === 0 ? "hl" : ""}" data-idx="${i}">
      <span class="text-sm">${r.label}</span>
      <span class="cmdk-item-tag">${r.tag}</span>
    </div>
  `).join("") : `<p class="text-sm text-[var(--alt-muted)] px-5 py-6">No matches.</p>`;
  document.querySelectorAll(".cmdk-item").forEach(el => el.addEventListener("click", () => { results[Number(el.dataset.idx)].action(); closeCmdk(); }));
  window._cmdkResults = results;
}
document.getElementById("adm-cmdk-input").addEventListener("input", e => renderCmdkResults(e.target.value));
document.getElementById("adm-cmdk-overlay").addEventListener("click", e => { if (e.target.id === "adm-cmdk-overlay") closeCmdk(); });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){ e.preventDefault(); openCmdk(); return; }
  if (!document.getElementById("adm-cmdk-overlay").classList.contains("open")) return;
  const items = document.querySelectorAll(".cmdk-item");
  if (e.key === "Escape") closeCmdk();
  if (e.key === "ArrowDown"){ e.preventDefault(); cmdkHighlight = Math.min(items.length - 1, cmdkHighlight + 1); items.forEach((el, i) => el.classList.toggle("hl", i === cmdkHighlight)); }
  if (e.key === "ArrowUp"){ e.preventDefault(); cmdkHighlight = Math.max(0, cmdkHighlight - 1); items.forEach((el, i) => el.classList.toggle("hl", i === cmdkHighlight)); }
  if (e.key === "Enter" && window._cmdkResults && window._cmdkResults[cmdkHighlight]){ window._cmdkResults[cmdkHighlight].action(); closeCmdk(); }
});

/* ================================================================
   SHELL WIRING + INIT
   ================================================================ */
if (AdminAuth.isLoggedIn()){
  document.getElementById("admin-sidebar-open").addEventListener("click", openAdminSidebar);
  document.getElementById("admin-sidebar-close").addEventListener("click", closeAdminSidebar);
  document.getElementById("admin-sidebar-overlay").addEventListener("click", closeAdminSidebar);
  document.getElementById("admin-cmdk-trigger").addEventListener("click", openCmdk);
  document.getElementById("adm-drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("adm-drawer-overlay").addEventListener("click", closeDrawer);
  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    confirmAction({
      title: "Sign out?", body: "You'll need the admin password again to get back into either Store Admin or the CMS.",
      confirmLabel: "Sign Out",
      onConfirm(){ AdminAuth.logout(); window.location.href = "admin.html"; },
    });
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("adm-drawer").classList.contains("open")) closeDrawer(); });

  document.getElementById("cms-gate").style.display = "none";
  document.getElementById("admin-shell-root").style.display = "block";
  requestAnimationFrame(() => document.getElementById("admin-shell-root").classList.add("settled"));
  document.getElementById("admin-avatar").textContent = ((AdminAuth.record() || {}).name || "O")[0].toUpperCase();
  renderSidebar();
  const startView = (location.hash || "#overview").slice(1);
  setAdminView(VIEW_RENDERERS[startView] ? startView : "overview");
}
