/* ================================================================
   ADMIN COMMAND CENTER
   Prototype-only, no backend. Mirrors the storefront's own honesty
   rule: every number here is either read from real localStorage data
   (orders/customers/tickets/products) or clearly marked (Future).
   ================================================================ */

/* AdminAuth, auditLog()/logAudit() now live in admin-auth.js (shared with cms.html). */

/* ================================================================
   DATA HELPERS — same per-user flattening pattern dashboard.html uses,
   just unfiltered here so admin sees every account at once.
   ================================================================ */
function readUserStore(key){ try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } }
function writeUserStore(key, obj){ localStorage.setItem(key, JSON.stringify(obj)); }

/* allOrders()/saveOrder()/orderAmount() now live in order-service.js —
   the single order dataset shared with checkout.html and dashboard.html. */

function allTickets(){
  const store = readUserStore("alt_tickets_v1");
  const out = [];
  Object.keys(store).forEach(userId => {
    (store[userId] || []).forEach(t => out.push(Object.assign({ userId }, t)));
  });
  return out.sort((a, b) => b.at - a.at);
}
function saveTicket(ticket){
  const store = readUserStore("alt_tickets_v1");
  const list = store[ticket.userId] || [];
  const idx = list.findIndex(t => t.id === ticket.id);
  const clean = Object.assign({}, ticket); delete clean.userId;
  if (idx > -1) list[idx] = clean;
  store[ticket.userId] = list;
  writeUserStore("alt_tickets_v1", store);
}

function customerName(userId){
  const u = Auth.users().find(x => x.id === userId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : "Guest Customer";
}

/* ---------------- product overlay ----------------
   PRODUCT_OVERRIDES_KEY/PRODUCT_EXTRAS_KEY, the read/write helpers, and
   updateProduct/addProduct/getProduct now all live in products-data.js so
   checkout (stock decrement) and the storefront read/write the exact
   same overlay admin/CMS edit. effectiveProducts() here just shows admin
   everything, including drafts/archived, which the storefront's
   getStorefrontProducts() hides. */
function effectiveProducts(){ return getAllProductsWithOverrides(); }

/* allReviews()/saveReviews()/REVIEWS_KEY now live in products-data.js —
   shared with the storefront's real per-product review display/submission. */

/* ---------------- coupons ---------------- */
const COUPONS_KEY = "alt_admin_coupons_v1";
function allCoupons(){ try { return JSON.parse(localStorage.getItem(COUPONS_KEY) || "[]"); } catch (e) { return []; } }
function saveCoupons(list){ localStorage.setItem(COUPONS_KEY, JSON.stringify(list)); }

/* ---------------- store settings ---------------- */
const SETTINGS_KEY = "alt_store_settings_v1";
function storeSettings(){
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
  catch (e) { return DEFAULT_SETTINGS; }
}
const DEFAULT_SETTINGS = {
  storeName: "Aesthetic Lifestyle Touch",
  supportEmail: "support@aestheticlifestyletouch.com",
  currency: "BDT",
  taxRate: 0,
  /* Consumed by checkout.html/order-service.js's getDeliveryMethods() —
     this is the one place Standard/Express pricing is defined. */
  deliveryMethods: [
    { id: "standard", label: "Standard Delivery", eta: "3–5 business days", priceDhaka: 60, priceOutside: 120, etaDays: 5 },
    { id: "express",  label: "Express Delivery",  eta: "1–2 business days", priceDhaka: 120, priceOutside: 200, etaDays: 2 },
  ],
  freeShippingThreshold: 15000,
  /* Numbers customers manually send mobile-wallet payments to — read by
     checkout.html via order-service.js's getWalletNumber(). */
  walletNumbers: { bkash: "", nagad: "", rocket: "" },
  /* Custom Product Request advance-payment percentage — configurable,
     never hardcoded; read via customRequestAdvancePercent() in
     custom-requests.js on every page that quotes/collects it. */
  customRequestAdvancePercent: 25,
  /* Loyalty Points — see loyalty.js's loyaltySettings(). */
  loyaltyEnabled: true,
  loyaltyEarnRateBDT: 100,
  loyaltyPointValueBDT: 1,
  loyaltyMinRedeemPoints: 100,
  /* Return/Exchange eligibility window — see returns.js's returnWindowDays(). */
  returnWindowDays: 14,
  language: "English",
  notifyNewOrders: true,
  notifyLowStock: true,
  notifyTickets: true,
};
function saveSettings(patch){
  const merged = Object.assign({}, storeSettings(), patch);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

/* ---------------- notification read-state + audit log ---------------- */
const NOTIF_READ_KEY = "alt_admin_notif_read_v1";
function readNotifIds(){ try { return JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || "[]"); } catch (e) { return []; } }
function markNotifRead(id){
  const list = readNotifIds();
  if (!list.includes(id)){ list.push(id); localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(list)); }
}
const NOTIF_ARCHIVE_KEY = "alt_admin_notif_archive_v1";
function archivedNotifIds(){ try { return JSON.parse(localStorage.getItem(NOTIF_ARCHIVE_KEY) || "[]"); } catch (e) { return []; } }
function archiveNotif(id){
  const list = archivedNotifIds();
  if (!list.includes(id)){ list.push(id); localStorage.setItem(NOTIF_ARCHIVE_KEY, JSON.stringify(list)); }
}

/* ---------------- customer notes ---------------- */
const CUSTOMER_NOTES_KEY = "alt_admin_customer_notes_v1";
function customerNotes(){ try { return JSON.parse(localStorage.getItem(CUSTOMER_NOTES_KEY) || "{}"); } catch (e) { return {}; } }
function saveCustomerNote(userId, note){
  const notes = customerNotes();
  notes[userId] = note;
  localStorage.setItem(CUSTOMER_NOTES_KEY, JSON.stringify(notes));
}

/* ---------------- ticket meta (priority) ---------------- */
const TICKET_META_KEY = "alt_admin_ticket_meta_v1";
function ticketMeta(){ try { return JSON.parse(localStorage.getItem(TICKET_META_KEY) || "{}"); } catch (e) { return {}; } }
function setTicketMeta(id, patch){
  const meta = ticketMeta();
  meta[id] = Object.assign({}, meta[id] || {}, patch);
  localStorage.setItem(TICKET_META_KEY, JSON.stringify(meta));
}

/* ================================================================
   DEMO DATA SEEDING (first admin visit only, and only if sparse)
   ================================================================ */
async function seedDemoDataIfNeeded(){
  const existingOrders = allOrders();
  // Once a real order exists, demo data is frozen (never grows) and is
  // hidden from every order view anyway — see filteredOrders()'s
  // hasAnyRealOrders() check.
  if (existingOrders.length >= 6 || hasAnyRealOrders()) { seedCouponsIfNeeded(); seedReviewsIfNeeded(); return; }

  const demoCustomers = [
    { first: "Amelia", last: "Reyes", email: "amelia.reyes@example.com" },
    { first: "Noah", last: "Kim", email: "noah.kim@example.com" },
    { first: "Farah", last: "Ahmed", email: "farah.ahmed@example.com" },
    { first: "Lucas", last: "Bennett", email: "lucas.bennett@example.com" },
    { first: "Sana", last: "Malik", email: "sana.malik@example.com" },
  ];
  const users = Auth.users();
  const seededUsers = [];
  for (const c of demoCustomers){
    let u = users.find(x => x.email === c.email);
    if (!u){
      u = {
        id: "u_demo_" + c.first.toLowerCase(),
        firstName: c.first, lastName: c.last, email: c.email, phone: "",
        passwordHash: await Auth.hash("demo-customer"),
        newsletter: Math.random() > 0.5, avatar: null, emailVerified: true, twoFA: false,
        marketingPrefs: { promotions: true, restock: true, orderUpdates: true },
        createdAt: Date.now() - Math.floor(Math.random() * 90) * 86400000,
      };
      users.push(u);
    }
    seededUsers.push(u);
  }
  Auth.saveUsers(users);

  const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "delivered", "delivered", "cancelled"];
  const store = readUserStore("alt_orders_v1");
  const DAY = 86400000;
  seededUsers.forEach((u, ui) => {
    const list = store[u.id] || [];
    const orderCount = 2 + (ui % 3);
    for (let i = 0; i < orderCount; i++){
      const daysAgo = Math.floor(Math.random() * 60);
      const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const items = [];
      for (let j = 0; j < itemCount; j++){
        const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        items.push({ productId: p.id, name: p.name, img: p.img, qty: 1 + Math.floor(Math.random() * 2), unitPrice: p.salePrice || p.price });
      }
      const placedAt = Date.now() - daysAgo * DAY;
      const stepIndex = STATUS_TIMELINE_INDEX[status] ?? 0;
      list.push({
        id: "ALT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        demo: true,
        placedAt,
        status,
        paymentStatus: status === "cancelled" ? "Refunded" : "Paid",
        deliveryMethod: Math.random() > 0.7 ? "express" : "standard",
        items,
        timeline: TIMELINE_STEPS.map((label, idx) => ({ label, done: idx <= stepIndex, at: idx <= stepIndex ? placedAt + idx * DAY : null })),
        eta: placedAt + 5 * DAY,
      });
    }
    store[u.id] = list;
  });
  writeUserStore("alt_orders_v1", store);

  seedCouponsIfNeeded();
  seedReviewsIfNeeded();
}

function seedCouponsIfNeeded(){
  if (allCoupons().length) return;
  saveCoupons([
    { code: "WELCOME10", type: "percentage", value: 10, minPurchase: 0, expiry: null, usageLimit: null, usedCount: 38, active: true },
    { code: "FREESHIP", type: "free-shipping", value: 0, minPurchase: 6000, expiry: null, usageLimit: 200, usedCount: 54, active: true },
    { code: "FLASH25", type: "fixed", value: 2500, minPurchase: 12000, expiry: Date.now() + 7 * 86400000, usageLimit: 100, usedCount: 12, active: true },
  ]);
}
function seedReviewsIfNeeded(){
  if (allReviews().length) return;
  const now = Date.now();
  const picks = [PRODUCTS[0], PRODUCTS[2], PRODUCTS[5], PRODUCTS[7], PRODUCTS[10], PRODUCTS[3]];
  const texts = [
    { author: "Priya S.", rating: 5, text: "Genuinely feels like a ৳40,000 product. The packaging alone was a moment." },
    { author: "Marcus T.", rating: 4, text: "Beautiful design, battery life is solid. Wish it came in one more colorway." },
    { author: "Elena V.", rating: 5, text: "Bought this as a gift and ended up ordering a second one for myself." },
    { author: "Daniel K.", rating: 2, text: "Nice look but mine arrived with a small scuff on the base. Support hasn't replied yet." },
    { author: "Hana W.", rating: 5, text: "Quiet, considered, exactly the aesthetic I was after for my desk setup." },
    { author: "Omar R.", rating: 3, text: "It's fine — good but not life-changing for the price." },
  ];
  saveReviews(picks.map((p, i) => Object.assign({
    id: "rev_" + i,
    productId: p.id,
    productName: p.name,
    at: now - (i + 1) * 3 * 86400000,
    status: i === 3 ? "pending" : "approved",
    pinned: i === 0,
    reply: i === 2 ? "Thank you so much, Elena — this made our week." : null,
  }, texts[i])));
}

/* ================================================================
   TOAST / CONFIRM / DRAWER
   ================================================================ */
function adminToast(msg){ showCartToast(msg); }

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

/* Small styled text-input drawer — used in place of the native
   window.prompt() (which doesn't exist anywhere else in this admin
   panel, and would look out of place next to the rest of these
   styled drawers/modals). Closes over onSubmit(value); reopens
   whatever was showing before it via returnTo(), if given. */
function admPromptText({ title, label, placeholder, confirmLabel, onSubmit, returnTo }){
  const body = `
    <label class="field-label">${label}</label>
    <textarea id="adm-prompt-input" rows="3" class="field-input" placeholder="${placeholder || ""}"></textarea>
  `;
  const foot = `<button id="adm-prompt-cancel" class="adm-btn adm-btn-ghost">Cancel</button><button id="adm-prompt-submit" class="adm-btn adm-btn-primary flex-1">${confirmLabel || "Submit"}</button>`;
  openDrawer(title, body, foot);
  document.getElementById("adm-prompt-input").focus();
  document.getElementById("adm-prompt-cancel").addEventListener("click", () => { if (returnTo) returnTo(); else closeDrawer(); });
  document.getElementById("adm-prompt-submit").addEventListener("click", () => {
    const value = document.getElementById("adm-prompt-input").value.trim();
    if (!value) return;
    onSubmit(value);
  });
}

function openDrawer(title, bodyHTML, footHTML){
  document.getElementById("adm-drawer-title").textContent = title;
  document.getElementById("adm-drawer-body").innerHTML = bodyHTML;
  const foot = document.getElementById("adm-drawer-foot");
  if (footHTML){ foot.innerHTML = footHTML; foot.style.display = "flex"; } else { foot.style.display = "none"; foot.innerHTML = ""; }
  document.getElementById("adm-drawer-overlay").classList.add("open");
  document.getElementById("adm-drawer").classList.add("open");
}
function closeDrawer(){
  document.getElementById("adm-drawer-overlay").classList.remove("open");
  document.getElementById("adm-drawer").classList.remove("open");
}

/* ================================================================
   CHART HELPERS — single-hue marks per the site's monochrome system;
   status colors reserved for real state, never used as chart identity.
   ================================================================ */
function fmtMoney(n){ return "৳" + Math.round(n).toLocaleString(); }
function fmtCompact(n){
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(Math.round(n));
}

function barChart(containerId, points, { money } = {}){
  const el = document.getElementById(containerId);
  const max = Math.max(1, ...points.map(p => p.value));
  el.innerHTML = `<div class="chart-bar-track">${points.map(p => {
    const h = Math.max(2, Math.round((p.value / max) * 150));
    const label = money ? fmtMoney(p.value) : p.value.toLocaleString();
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${h}px;" tabindex="0" role="img" aria-label="${p.label}: ${label}">
          <span class="chart-tip">${label}</span>
        </div>
        <span class="chart-bar-x">${p.label}</span>
      </div>`;
  }).join("")}</div>`;
}

function rankedList(containerId, points, { money } = {}){
  const el = document.getElementById(containerId);
  const max = Math.max(1, ...points.map(p => p.value));
  el.innerHTML = points.map(p => `
    <div class="ranked-row mb-3">
      <span class="text-sm w-32 truncate shrink-0" title="${p.label}">${p.label}</span>
      <div class="ranked-track"><div class="ranked-fill" style="width:${Math.max(3, (p.value / max) * 100)}%"></div></div>
      <span class="text-xs font-mono text-[var(--alt-muted)] w-16 text-right shrink-0">${money ? fmtMoney(p.value) : p.value}</span>
    </div>
  `).join("") || `<p class="text-sm text-[var(--alt-muted)]">Not enough data yet.</p>`;
}

/* ================================================================
   SIDEBAR NAV + VIEW SWITCHING
   ================================================================ */
const ADMIN_NAV = [
  { group: "Overview", items: [
    { key: "overview", label: "Dashboard", icon: `<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z"/>` },
    { key: "analytics", label: "Analytics", icon: `<path d="M4 20V10M12 20V4M20 20v-6"/>` },
  ]},
  { group: "Commerce", items: [
    { key: "orders", label: "Orders", icon: `<path d="M4 7h16l-1.5 13h-13z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>`, badgeFn: () => allOrders().filter(o => o.status === "pending").length },
    { key: "custom-requests", label: "Custom Requests", icon: `<path d="M9 3h6l1 4H8z"/><path d="M4 7h16l-1.5 13h-13z"/><path d="M12 11v6M9 11l.5 6M15 11l-.5 6"/>`, badgeFn: () => allCustomRequests().filter(r => r.status === "submitted" || r.status === "under-review").length },
    { key: "returns", label: "Returns", icon: `<path d="M4 4v6h6M20 20v-6h-6"/><path d="M4.5 15a8 8 0 0 0 14 4.2M19.5 9A8 8 0 0 0 5.5 4.8"/>`, badgeFn: () => allReturnRequests().filter(r => r.status === "requested" || r.status === "under-review").length },
    { key: "reward-vault", label: "Reward Vault", icon: `<path d="M4 8h16v12H4z"/><path d="M4 8l8-5 8 5"/><path d="M12 3v17"/>` },
    { key: "products", label: "Products", icon: `<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 016 0"/>` },
    { key: "inventory", label: "Inventory", icon: `<path d="M3 9l9-6 9 6-9 6z"/><path d="M3 9v6l9 6 9-6V9"/>`, badgeFn: () => effectiveProducts().filter(p => p.stock <= 8).length },
    { key: "coupons", label: "Coupons", icon: `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/>` },
  ]},
  { group: "People", items: [
    { key: "customers", label: "Customers", icon: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"/>` },
    { key: "reviews", label: "Reviews", icon: `<path d="M12 17.3l-5.4 3 1-6-4.6-4 6.1-.6L12 4l2.9 5.7 6.1.6-4.6 4 1 6z"/>`, badgeFn: () => allReviews().filter(r => r.status === "pending").length },
    { key: "support", label: "Support", icon: `<path d="M21 11.5a8.5 8.5 0 1 1-3.8-7.1"/><path d="M21 4l-9 9-4-4"/>`, badgeFn: () => allTickets().filter(t => t.status === "Open").length },
  ]},
  { group: "System", items: [
    { key: "notifications", label: "Notifications", icon: `<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>`, badgeFn: () => adminNotifications().filter(n => !n.read).length },
    { key: "staff", label: "Staff", icon: `<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 15.5c2.5.3 4 1.6 4 4.5"/>` },
    { key: "settings", label: "Settings", icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>` },
    { key: "backup", label: "Backup & Recovery", icon: `<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>` },
    { key: "security", label: "Security", icon: `<path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>` },
  ]},
  { group: "Content", items: [
    { href: "cms.html", label: "Content & Products (CMS)", icon: `<path d="M4 5h16v3H4z"/><path d="M4 11h10v8H4z"/><path d="M16 11h4v8h-4z"/>` },
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
  const dot = document.getElementById("admin-notif-dot");
  if (dot) dot.style.display = adminNotifications().some(n => !n.read) ? "block" : "none";
}

const VIEW_TITLES = {
  overview: "Dashboard", analytics: "Analytics", orders: "Orders", products: "Products",
  inventory: "Inventory", customers: "Customers", reviews: "Reviews", coupons: "Coupons",
  notifications: "Notifications", support: "Support", staff: "Staff", settings: "Settings",
  backup: "Backup & Recovery", security: "Security", "custom-requests": "Custom Requests",
  returns: "Returns & Exchanges", "reward-vault": "Reward Vault",
};
const VIEW_RENDERERS = {};

function setAdminView(name){
  document.querySelectorAll(".admin-view").forEach(v => v.classList.toggle("active", v.dataset.view === name));
  document.querySelectorAll(".side-link[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("admin-page-title").textContent = VIEW_TITLES[name] || "Dashboard";
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
   NOTIFICATIONS — synthesized live from real signals, not stored as
   their own dataset, so they never drift out of sync with the data.
   ================================================================ */
function adminNotifications(){
  const now = Date.now();
  const read = readNotifIds();
  const archived = archivedNotifIds();
  const list = [];

  const realOrdersExist = hasAnyRealOrders();
  allOrders().filter(o => (!realOrdersExist || !o.demo) && now - o.placedAt < 2 * 86400000).forEach(o => {
    list.push({ id: `order-${o.id}`, category: "New Orders", title: `New order ${o.id}`, body: `${customerNameForOrder(o)} — ${fmtMoney(orderAmount(o))}`, at: o.placedAt });
  });
  effectiveProducts().filter(p => p.stock === 0).forEach(p => {
    list.push({ id: `oos-${p.id}`, category: "Low Stock", title: `${p.name} is out of stock`, body: "Restock to avoid missed sales.", at: now - 3600000 });
  });
  effectiveProducts().filter(p => p.stock > 0 && p.stock <= 8).forEach(p => {
    list.push({ id: `low-${p.id}`, category: "Low Stock", title: `${p.name} is running low`, body: `Only ${p.stock} left in stock.`, at: now - 7200000 });
  });
  allTickets().filter(t => t.status === "Open").forEach(t => {
    list.push({ id: `ticket-${t.id}`, category: "Support Tickets", title: `Open ticket — ${t.subject}`, body: customerName(t.userId), at: t.at });
  });
  allReviews().filter(r => r.status === "pending").forEach(r => {
    list.push({ id: `review-${r.id}`, category: "Customer Messages", title: `Review awaiting moderation`, body: `${r.productName} — ${r.author}`, at: r.at });
  });
  allOrders().filter(o => o.paymentVerification && o.paymentVerification.status === "pending").forEach(o => {
    list.push({ id: `payment-${o.id}`, category: "New Orders", title: `Payment awaiting verification — ${o.id}`, body: `${customerNameForOrder(o)} · ${o.paymentMethod} · ${fmtMoney(orderAmount(o))}`, at: o.placedAt });
  });
  allCustomRequests().filter(r => !r.archived && (r.status === "submitted" || r.status === "under-review")).forEach(r => {
    list.push({ id: `cr-${r.id}`, category: "Custom Requests", title: `New product request — ${r.productName}`, body: r.customerName || "Custom Requests", at: r.createdAt });
  });
  allCustomRequests().filter(r => (r.advancePayment && r.advancePayment.status === "pending") || (r.finalPayment && r.finalPayment.status === "pending")).forEach(r => {
    list.push({ id: `cr-pay-${r.id}`, category: "Custom Requests", title: `Payment awaiting verification — ${r.id}`, body: r.productName, at: r.updatedAt });
  });
  allReturnRequests().filter(r => r.status === "requested" || r.status === "under-review").forEach(r => {
    list.push({ id: `ret-${r.id}`, category: "Returns", title: `New ${r.type} request — ${r.id}`, body: `Order ${r.orderId} · ${customerName(r.userId)}`, at: r.createdAt });
  });

  return list
    .filter(n => !archived.includes(n.id))
    .map(n => Object.assign({}, n, { read: read.includes(n.id) }))
    .sort((a, b) => b.at - a.at);
}

/* ================================================================
   OVERVIEW
   ================================================================ */
function timeAgo(ts){
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

VIEW_RENDERERS.overview = function(){
  const orders = hasAnyRealOrders() ? allOrders().filter(o => !o.demo) : allOrders();
  const now = Date.now();
  const DAY = 86400000;
  const todaySales = orders.filter(o => now - o.placedAt < DAY).reduce((s, o) => s + orderAmount(o), 0);
  const weekSales = orders.filter(o => now - o.placedAt < 7 * DAY).reduce((s, o) => s + orderAmount(o), 0);
  const monthSales = orders.filter(o => now - o.placedAt < 30 * DAY).reduce((s, o) => s + orderAmount(o), 0);
  const activeSlugs = ["pending", "confirmed", "packed", "shipped", "out-for-delivery"];
  const pending = orders.filter(o => activeSlugs.includes(o.status) || o.status === "processing").length;
  const completed = orders.filter(o => o.status === "delivered").length;
  const cancelled = orders.filter(o => ["cancelled", "returned", "refunded"].includes(o.status)).length;
  const avgOrderValue = orders.length ? orders.reduce((s, o) => s + orderAmount(o), 0) / orders.length : 0;

  const users = Auth.users();
  const newCustomers = users.filter(u => now - u.createdAt < 30 * DAY).length;
  const ordersByCustomer = {};
  orders.forEach(o => { ordersByCustomer[o.userId] = (ordersByCustomer[o.userId] || 0) + 1; });
  const returning = Object.values(ordersByCustomer).filter(n => n > 1).length;

  const products = effectiveProducts();
  const inStock = products.filter(p => p.stock > 8).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 8).length;
  const outOfStock = products.filter(p => p.stock === 0).length;

  const wishlistCount = (typeof Wishlist !== "undefined") ? Wishlist.ids().length : 0;

  const cards = [
    { label: "Today's Sales", value: fmtMoney(todaySales), icon: `<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
    { label: "Weekly Revenue", value: fmtMoney(weekSales), icon: `<path d="M4 20V10M12 20V4M20 20v-6"/>` },
    { label: "Monthly Revenue", value: fmtMoney(monthSales), icon: `<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>` },
    { label: "Total Orders", value: orders.length, icon: `<path d="M4 7h16l-1.5 13h-13z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>` },
    { label: "Pending Orders", value: pending, icon: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>` },
    { label: "Completed Orders", value: completed, icon: `<path d="M20 6L9 17l-5-5"/>` },
    { label: "Cancelled Orders", value: cancelled, icon: `<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>` },
    { label: "Total Customers", value: users.length, icon: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"/>` },
    { label: "New Customers (30d)", value: newCustomers, icon: `<circle cx="10" cy="9" r="3.5"/><path d="M3 20c0-3.5 3-5.3 7-5.3s7 1.8 7 5.3"/><path d="M18 8v5M15.5 10.5h5"/>` },
    { label: "Returning Customers", value: returning, icon: `<path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M4 10a8 8 0 0 1 14.5-4.5M20 14a8 8 0 0 1-14.5 4.5"/>` },
    { label: "Products In Stock", value: inStock, icon: `<path d="M3 9l9-6 9 6-9 6z"/><path d="M3 9v6l9 6 9-6V9"/>` },
    { label: "Low Stock Alerts", value: lowStock, danger: lowStock > 0, icon: `<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>` },
    { label: "Out of Stock", value: outOfStock, danger: outOfStock > 0, icon: `<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>` },
    { label: "Wishlist Activity", value: wishlistCount, icon: `<path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/>` },
    { label: "Average Order Value", value: fmtMoney(avgOrderValue), icon: `<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
  ];

  const unitsSoldByProduct = {};
  orders.forEach(o => (o.items || []).forEach(it => { unitsSoldByProduct[it.productId] = (unitsSoldByProduct[it.productId] || 0) + it.qty; }));
  const topProducts = Object.keys(unitsSoldByProduct).length
    ? Object.keys(unitsSoldByProduct)
        .map(id => products.find(p => p.id === Number(id)) || products.find(p => String(p.id) === id))
        .filter(Boolean)
        .sort((a, b) => unitsSoldByProduct[b.id] - unitsSoldByProduct[a.id])
        .slice(0, 5)
    : [...products].sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 5);
  const recentReviews = [...allReviews()].sort((a, b) => b.at - a.at).slice(0, 4);
  const recentTickets = [...allTickets()].slice(0, 4);

  document.getElementById("view-overview").innerHTML = `
    <div class="mb-6" data-enter>
      <h2 class="font-display text-2xl font-medium">Good to see you, ${AdminAuth.record()?.name || "Owner"}.</h2>
      <p class="text-sm text-[var(--alt-muted)] mt-1">Here's how Aesthetic Lifestyle Touch is doing right now.</p>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      ${cards.map((c, i) => `
        <div class="stat-card" data-enter data-stat="${c.label}" style="transition-delay:${i * 0.02}s;">
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.6">${c.icon}</svg></div>
          <p class="stat-value tabular" style="${c.danger ? "color:var(--alt-bad);" : ""}">${c.value}</p>
          <p class="stat-label">${c.label}</p>
        </div>
      `).join("")}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Top Selling Products</p>
        ${topProducts.map(p => `
          <div class="flex items-center gap-3 mb-3">
            <img src="${p.img}" class="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" alt="">
            <div class="flex-1 min-w-0"><p class="text-sm truncate">${p.name}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${p.reviews || 0} reviews</p></div>
            <span class="text-sm font-mono">${fmtMoney(p.salePrice || p.price)}</span>
          </div>
        `).join("")}
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Recent Reviews</p>
        ${recentReviews.length ? recentReviews.map(r => `
          <div class="mb-3">
            <p class="text-sm">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} <span class="text-[var(--alt-muted)] font-mono text-xs">${r.author}</span></p>
            <p class="text-xs text-[var(--alt-muted)] mt-1 line-clamp-2">${r.text}</p>
          </div>
        `).join("") : `<p class="text-sm text-[var(--alt-muted)]">No reviews yet.</p>`}
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Recent Support Requests</p>
        ${recentTickets.length ? recentTickets.map(t => `
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="min-w-0"><p class="text-sm truncate">${t.subject}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${customerName(t.userId)} · ${timeAgo(t.at)}</p></div>
            <span class="badge ${t.status === "Open" ? "badge-warn" : "badge-good"}"><span class="badge-dot"></span>${t.status}</span>
          </div>
        `).join("") : `<p class="text-sm text-[var(--alt-muted)]">No support requests yet.</p>`}
      </div>
    </div>
  `;

  /* ---------------- stat card drill-downs ---------------- */
  function drillOrderRow(o){
    return `<div class="flex items-center justify-between gap-3 mb-3 stat-drill-row" data-order-id="${o.id}" style="cursor:pointer;">
      <div class="min-w-0"><p class="text-sm font-mono">${o.id}</p><p class="text-xs text-[var(--alt-muted)] mt-0.5">${escapeHTML(customerNameForOrder(o))} · ${new Date(o.placedAt).toLocaleDateString()}</p></div>
      ${orderStatusBadge(o.status)}
      <span class="font-mono text-sm shrink-0">${fmtMoney(orderAmount(o))}</span>
    </div>`;
  }
  function drillCustomerRow(u){
    const n = ordersByCustomer[u.id] || 0;
    return `<div class="flex items-center justify-between gap-3 mb-3">
      <div class="min-w-0"><p class="text-sm">${escapeHTML(u.firstName)} ${escapeHTML(u.lastName)}</p><p class="text-xs text-[var(--alt-muted)] mt-0.5">${escapeHTML(u.email || "")}${u.phone ? " · " + escapeHTML(u.phone) : ""}</p></div>
      <div class="text-right shrink-0"><p class="text-xs font-mono">${n} order${n === 1 ? "" : "s"}</p><p class="text-xs text-[var(--alt-muted)]">Joined ${new Date(u.createdAt).toLocaleDateString()}</p></div>
    </div>`;
  }
  function drillProductRow(p){
    const stockColor = p.stock === 0 ? "var(--alt-bad)" : p.stock <= 8 ? "var(--alt-warn)" : "var(--alt-black)";
    return `<div class="flex items-center gap-3 mb-3">
      <img src="${p.img}" class="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" alt="">
      <div class="flex-1 min-w-0"><p class="text-sm truncate">${p.name}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${fmtMoney(p.salePrice || p.price)}</p></div>
      <span class="text-sm font-mono shrink-0" style="color:${stockColor};">${p.stock} in stock</span>
    </div>`;
  }
  function drillList(items, renderRow, emptyMsg){
    return items.length ? items.map(renderRow).join("") : `<p class="text-sm text-[var(--alt-muted)] py-6 text-center">${emptyMsg}</p>`;
  }

  function openStatDetail(label){
    let body = "";
    let hasOrders = false;
    if (label === "Today's Sales"){
      const list = orders.filter(o => now - o.placedAt < DAY);
      body = `<p class="text-sm text-[var(--alt-muted)] mb-4">${list.length} order${list.length === 1 ? "" : "s"} today · ${fmtMoney(todaySales)} total</p>` + drillList(list, drillOrderRow, "No orders placed today yet.");
      hasOrders = true;
    } else if (label === "Weekly Revenue"){
      const list = orders.filter(o => now - o.placedAt < 7 * DAY);
      body = `<p class="text-sm text-[var(--alt-muted)] mb-4">${list.length} order${list.length === 1 ? "" : "s"} in the last 7 days · ${fmtMoney(weekSales)} total</p>` + drillList(list, drillOrderRow, "No orders in the last 7 days.");
      hasOrders = true;
    } else if (label === "Monthly Revenue"){
      const list = orders.filter(o => now - o.placedAt < 30 * DAY);
      body = `<p class="text-sm text-[var(--alt-muted)] mb-4">${list.length} order${list.length === 1 ? "" : "s"} in the last 30 days · ${fmtMoney(monthSales)} total</p>` + drillList(list, drillOrderRow, "No orders in the last 30 days.");
      hasOrders = true;
    } else if (label === "Total Orders"){
      body = `<p class="text-sm text-[var(--alt-muted)] mb-4">${orders.length} order${orders.length === 1 ? "" : "s"} all-time</p>` + drillList(orders, drillOrderRow, "No orders yet.");
      hasOrders = true;
    } else if (label === "Pending Orders"){
      body = drillList(orders.filter(o => activeSlugs.includes(o.status) || o.status === "processing"), drillOrderRow, "Nothing pending — you're all caught up.");
      hasOrders = true;
    } else if (label === "Completed Orders"){
      body = drillList(orders.filter(o => o.status === "delivered"), drillOrderRow, "No delivered orders yet.");
      hasOrders = true;
    } else if (label === "Cancelled Orders"){
      body = drillList(orders.filter(o => ["cancelled", "returned", "refunded"].includes(o.status)), drillOrderRow, "No cancelled, returned, or refunded orders.");
      hasOrders = true;
    } else if (label === "Average Order Value"){
      body = `<p class="text-sm text-[var(--alt-muted)] mb-4">${fmtMoney(avgOrderValue)} average across ${orders.length} order${orders.length === 1 ? "" : "s"} · ${fmtMoney(orders.reduce((s, o) => s + orderAmount(o), 0))} total revenue</p>` + drillList(orders, drillOrderRow, "No orders yet.");
      hasOrders = true;
    } else if (label === "Total Customers"){
      body = drillList(users, drillCustomerRow, "No customers yet.");
    } else if (label === "New Customers (30d)"){
      body = drillList(users.filter(u => now - u.createdAt < 30 * DAY), drillCustomerRow, "No new customers in the last 30 days.");
    } else if (label === "Returning Customers"){
      body = drillList(users.filter(u => (ordersByCustomer[u.id] || 0) > 1), drillCustomerRow, "No repeat customers yet.");
    } else if (label === "Products In Stock"){
      body = drillList(products.filter(p => p.stock > 8), drillProductRow, "Nothing healthy in stock right now.");
    } else if (label === "Low Stock Alerts"){
      body = drillList(products.filter(p => p.stock > 0 && p.stock <= 8), drillProductRow, "No low-stock products.");
    } else if (label === "Out of Stock"){
      body = drillList(products.filter(p => p.stock === 0), drillProductRow, "Nothing out of stock.");
    } else if (label === "Wishlist Activity"){
      const ids = (typeof Wishlist !== "undefined") ? Wishlist.ids() : [];
      const list = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
      body = `<p class="text-xs text-[var(--alt-muted)] mb-4">Reflects wishlist activity on this browser only — there's no cross-device wishlist tracking yet.</p>` + drillList(list, drillProductRow, "Nothing wishlisted on this browser yet.");
    } else {
      body = `<p class="text-sm text-[var(--alt-muted)]">No details available.</p>`;
    }
    openDrawer(label, body);
    if (hasOrders){
      document.querySelectorAll(".stat-drill-row").forEach(row => {
        row.addEventListener("click", () => openOrderDetail(row.dataset.orderId));
      });
    }
  }

  document.querySelectorAll("#view-overview .stat-card[data-stat]").forEach(el => {
    el.addEventListener("click", () => openStatDetail(el.dataset.stat));
  });
};

/* ================================================================
   ANALYTICS
   ================================================================ */
let analyticsRange = "weekly";
function bucketOrders(orders, range){
  const DAY = 86400000;
  const now = new Date();
  const buckets = [];
  if (range === "daily"){
    for (let i = 6; i >= 0; i--){
      const d = new Date(now); d.setDate(d.getDate() - i);
      buckets.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), from: +new Date(d.setHours(0,0,0,0)), to: +new Date(d.setHours(23,59,59,999)) });
    }
  } else if (range === "weekly"){
    for (let i = 7; i >= 0; i--){
      const to = now.getTime() - i * 7 * DAY;
      buckets.push({ label: `W-${i}`, from: to - 7 * DAY, to });
    }
  } else if (range === "monthly"){
    for (let i = 11; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ label: d.toLocaleDateString(undefined, { month: "short" }), from: +d, to: +to });
    }
  } else {
    for (let i = 3; i >= 0; i--){
      buckets.push({ label: String(now.getFullYear() - i), from: +new Date(now.getFullYear() - i, 0, 1), to: +new Date(now.getFullYear() - i + 1, 0, 1) });
    }
  }
  return buckets.map(b => ({
    label: b.label,
    orders: orders.filter(o => o.placedAt >= b.from && o.placedAt < b.to),
  }));
}

VIEW_RENDERERS.analytics = function(){
  document.getElementById("view-analytics").innerHTML = `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Analytics</h2>
      <div class="flex items-center gap-2">
        ${["daily","weekly","monthly","yearly"].map(r => `<button class="adm-chip an-range ${analyticsRange === r ? "active" : ""}" data-range="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join("")}
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="panel" data-enter><p class="panel-title mb-4">Revenue Overview</p><div id="an-revenue"></div></div>
      <div class="panel" data-enter><p class="panel-title mb-4">Orders Over Time</p><div id="an-orders"></div></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="panel" data-enter><p class="panel-title mb-4">Customer Growth (cumulative)</p><div id="an-customers"></div></div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Conversion Rate <span class="future-tag ml-1">Approximate</span></p>
        <div id="an-conversion"></div>
        <p class="text-xs text-[var(--alt-muted)] mt-3">Orders ÷ registered customers — a proxy only, since page-view traffic isn't tracked yet.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="panel" data-enter><p class="panel-title mb-4">Top Categories</p><div id="an-categories"></div></div>
      <div class="panel" data-enter><p class="panel-title mb-4">Top Products</p><div id="an-top-products"></div></div>
    </div>
    <div class="panel" data-enter>
      <p class="panel-title mb-1">Traffic Overview <span class="future-tag ml-1">Future</span></p>
      <p class="text-sm text-[var(--alt-muted)] mt-2">Sessions, page views, and referral sources will appear here once site analytics is wired up. No traffic data is collected today.</p>
    </div>
  `;
  document.querySelectorAll(".an-range").forEach(btn => btn.addEventListener("click", () => { analyticsRange = btn.dataset.range; VIEW_RENDERERS.analytics(); }));
  renderAnalyticsCharts();
};

function renderAnalyticsCharts(){
  const orders = allOrders();
  const buckets = bucketOrders(orders, analyticsRange);

  barChart("an-revenue", buckets.map(b => ({ label: b.label, value: b.orders.reduce((s, o) => s + orderAmount(o), 0) })), { money: true });
  barChart("an-orders", buckets.map(b => ({ label: b.label, value: b.orders.length })));

  const users = [...Auth.users()].sort((a, b) => a.createdAt - b.createdAt);
  let running = 0;
  const custBuckets = bucketOrders([], analyticsRange).map(b => {
    running = users.filter(u => u.createdAt < b.to).length;
    return { label: b.label, value: running };
  });
  barChart("an-customers", custBuckets);

  const totalOrders = orders.length;
  const totalCustomers = Math.max(1, Auth.users().length);
  const conv = Math.min(100, Math.round((totalOrders / totalCustomers) * 100));
  document.getElementById("an-conversion").innerHTML = `
    <p class="stat-value tabular">${conv}%</p>
    <div class="ranked-track mt-3" style="height:10px;"><div class="ranked-fill" style="width:${conv}%; height:100%;"></div></div>
  `;

  const categoryTotals = {};
  orders.forEach(o => (o.items || []).forEach(it => {
    const p = PRODUCTS.find(pp => pp.id === it.productId);
    if (!p) return;
    (p.tags || []).forEach(tag => { categoryTotals[tag] = (categoryTotals[tag] || 0) + it.qty; });
  }));
  const catPoints = Object.keys(categoryTotals).map(tag => ({ label: categoryLabel ? categoryLabel(tag) : tag, value: categoryTotals[tag] }))
    .sort((a, b) => b.value - a.value).slice(0, 6);
  rankedList("an-categories", catPoints);

  const productTotals = {};
  orders.forEach(o => (o.items || []).forEach(it => { productTotals[it.productId] = (productTotals[it.productId] || 0) + it.qty; }));
  const prodPoints = Object.keys(productTotals).map(id => {
    const p = PRODUCTS.find(pp => pp.id === Number(id));
    return { label: p ? p.name : `#${id}`, value: productTotals[id] };
  }).sort((a, b) => b.value - a.value).slice(0, 6);
  rankedList("an-top-products", prodPoints);
}

/* ================================================================
   ORDERS
   ================================================================ */
const ordersState = { search: "", status: "all", dateRange: "all", sort: "newest", page: 1, perPage: 8, selected: new Set() };
/* ORDER_STATUSES / orderStatusMeta now live in order-service.js. */
function orderStatusBadge(status){
  const m = orderStatusMeta(status);
  return `<span class="badge ${m.badgeClass}"><span class="badge-dot"></span>${m.label}</span>`;
}
const ORDER_BULK_ACTIONS = [
  { slug: "confirmed", label: "Confirm" },
  { slug: "packed", label: "Pack" },
  { slug: "shipped", label: "Ship" },
  { slug: "delivered", label: "Deliver" },
  { slug: "cancelled", label: "Cancel", danger: true },
  { slug: "returned", label: "Return", danger: true },
  { slug: "refunded", label: "Refund", danger: true },
];
const ORDER_DATE_RANGES = ["all", "today", "yesterday", "this-week", "this-month"];
function orderDateRangeLabel(slug){
  return { all: "All Time", today: "Today", yesterday: "Yesterday", "this-week": "This Week", "this-month": "This Month" }[slug] || slug;
}
function orderInDateRange(o, range){
  if (range === "all") return true;
  const d = new Date(o.placedAt);
  const now = new Date();
  const startOfDay = dt => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  if (range === "today") return startOfDay(d) === startOfDay(now);
  if (range === "yesterday") return startOfDay(d) === startOfDay(now) - 86400000;
  if (range === "this-week"){
    const dayIdx = (now.getDay() + 6) % 7; // Monday-based
    const weekStart = startOfDay(now) - dayIdx * 86400000;
    return o.placedAt >= weekStart;
  }
  if (range === "this-month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

VIEW_RENDERERS.orders = function(){
  document.getElementById("view-orders").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Orders</h2>
      <button id="ord-export" class="adm-btn adm-btn-ghost">Export CSV</button>
    </div>
    <div class="panel mb-5" data-enter>
      <p class="panel-title mb-1">Quick Verify Payment</p>
      <p class="text-xs text-[var(--alt-muted)] mb-3">Got a Transaction ID on your own bKash/Nagad/Rocket? Paste it here with the amount you received — it'll find the matching order and confirm it automatically.</p>
      <div class="flex items-center gap-3 flex-wrap">
        <input id="qv-txn" type="text" placeholder="Transaction ID" class="adm-input" style="min-width:200px;">
        <input id="qv-amount" type="number" step="0.01" placeholder="Amount received (৳)" class="adm-input" style="width:180px;">
        <button id="qv-submit" class="adm-btn adm-btn-primary">Find &amp; Verify</button>
      </div>
      <p id="qv-result" class="text-xs mt-2"></p>
    </div>
    <div class="flex items-center gap-3 mb-3 flex-wrap" data-enter>
      <input id="ord-search" type="text" placeholder="Search order #, customer, phone, email, product…" class="adm-input flex-1" style="min-width:260px;" value="${ordersState.search}">
      <select id="ord-sort" class="adm-input">
        <option value="newest" ${ordersState.sort === "newest" ? "selected" : ""}>Newest First</option>
        <option value="oldest" ${ordersState.sort === "oldest" ? "selected" : ""}>Oldest First</option>
        <option value="amount-desc" ${ordersState.sort === "amount-desc" ? "selected" : ""}>Amount: High to Low</option>
        <option value="amount-asc" ${ordersState.sort === "amount-asc" ? "selected" : ""}>Amount: Low to High</option>
      </select>
    </div>
    <div class="flex items-center gap-2 mb-2 flex-wrap" data-enter>
      <button class="adm-chip ord-status-chip ${ordersState.status === "all" ? "active" : ""}" data-status="all">All Statuses</button>
      ${ORDER_STATUSES.map(s => `<button class="adm-chip ord-status-chip ${ordersState.status === s.slug ? "active" : ""}" data-status="${s.slug}">${s.label}</button>`).join("")}
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      ${ORDER_DATE_RANGES.map(r => `<button class="adm-chip ord-range-chip ${ordersState.dateRange === r ? "active" : ""}" data-range="${r}">${orderDateRangeLabel(r)}</button>`).join("")}
    </div>
    <div id="ord-bulk-bar" class="flex items-center gap-3 mb-4 flex-wrap" style="display:none;">
      <span id="ord-bulk-count" class="text-sm font-mono"></span>
      ${ORDER_BULK_ACTIONS.map(a => `<button class="adm-btn ${a.danger ? "adm-btn-danger" : "adm-btn-ghost"}" data-bulk="${a.slug}">${a.label}</button>`).join("")}
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr>
          <th><input type="checkbox" id="ord-check-all" class="row-check"></th>
          <th>Order #</th><th>Customer</th><th>Date</th><th>Items</th><th>Payment</th><th>Delivery</th><th>Status</th><th>Amount</th><th></th>
        </tr></thead>
        <tbody id="ord-tbody"></tbody>
      </table>
    </div>
    <div id="ord-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("qv-submit").addEventListener("click", quickVerifyPayment);
  document.getElementById("qv-txn").addEventListener("keydown", e => { if (e.key === "Enter") quickVerifyPayment(); });
  document.getElementById("qv-amount").addEventListener("keydown", e => { if (e.key === "Enter") quickVerifyPayment(); });
  document.getElementById("ord-search").addEventListener("input", e => { ordersState.search = e.target.value; ordersState.page = 1; renderOrdersTable(); });
  document.querySelectorAll(".ord-status-chip").forEach(btn => btn.addEventListener("click", () => { ordersState.status = btn.dataset.status; ordersState.page = 1; VIEW_RENDERERS.orders(); }));
  document.querySelectorAll(".ord-range-chip").forEach(btn => btn.addEventListener("click", () => { ordersState.dateRange = btn.dataset.range; ordersState.page = 1; VIEW_RENDERERS.orders(); }));
  document.getElementById("ord-sort").addEventListener("change", e => { ordersState.sort = e.target.value; renderOrdersTable(); });
  document.getElementById("ord-export").addEventListener("click", () => exportCSV(filteredOrders().map(o => ({
    id: o.id, customer: customerNameForOrder(o), email: (o.customer || {}).email || "", phone: (o.customer || {}).phone || "",
    status: orderStatusMeta(o.status).label, paymentStatus: o.paymentStatus, deliveryMethod: o.deliveryMethod,
    placedAt: new Date(o.placedAt).toISOString(), total: orderAmount(o).toFixed(2),
  })), ["id","customer","email","phone","status","paymentStatus","deliveryMethod","placedAt","total"], "orders.csv"));
  document.getElementById("ord-check-all").addEventListener("change", e => {
    const rows = paginatedOrders();
    if (e.target.checked) rows.forEach(o => ordersState.selected.add(o.id)); else rows.forEach(o => ordersState.selected.delete(o.id));
    renderOrdersTable();
  });
  document.querySelectorAll("#ord-bulk-bar [data-bulk]").forEach(btn => btn.addEventListener("click", () => bulkUpdateOrders(btn.dataset.bulk)));
  renderOrdersTable();
};

function filteredOrders(){
  let list = allOrders();
  if (hasAnyRealOrders()) list = list.filter(o => !o.demo);
  if (ordersState.status !== "all") list = list.filter(o => o.status === ordersState.status);
  if (ordersState.dateRange !== "all") list = list.filter(o => orderInDateRange(o, ordersState.dateRange));
  if (ordersState.search.trim()){
    const q = ordersState.search.trim().toLowerCase();
    list = list.filter(o => orderSearchText(o).includes(q));
  }
  if (ordersState.sort === "newest") list.sort((a, b) => b.placedAt - a.placedAt);
  if (ordersState.sort === "oldest") list.sort((a, b) => a.placedAt - b.placedAt);
  if (ordersState.sort === "amount-desc") list.sort((a, b) => orderAmount(b) - orderAmount(a));
  if (ordersState.sort === "amount-asc") list.sort((a, b) => orderAmount(a) - orderAmount(b));
  return list;
}
function paginatedOrders(){
  const list = filteredOrders();
  const start = (ordersState.page - 1) * ordersState.perPage;
  return list.slice(start, start + ordersState.perPage);
}

function renderOrdersTable(){
  const list = filteredOrders();
  const rows = paginatedOrders();
  document.getElementById("ord-tbody").innerHTML = rows.length ? rows.map(o => `
    <tr>
      <td><input type="checkbox" class="row-check ord-row-check" data-id="${o.id}" ${ordersState.selected.has(o.id) ? "checked" : ""}></td>
      <td class="font-mono text-xs cursor-pointer ord-view" data-id="${o.id}">${o.id}</td>
      <td>${escapeHTML(customerNameForOrder(o))}</td>
      <td class="text-xs text-[var(--alt-muted)]">${new Date(o.placedAt).toLocaleDateString()}</td>
      <td>${(o.items || []).reduce((s, it) => s + it.qty, 0)}</td>
      <td class="text-xs">${o.paymentVerification && o.paymentVerification.status === "pending" ? `<span class="badge badge-warn"><span class="badge-dot"></span>${o.paymentStatus}</span>` : o.paymentStatus}</td>
      <td class="text-xs capitalize">${o.deliveryMethod}</td>
      <td>${orderStatusBadge(o.status)}</td>
      <td class="font-mono">${fmtMoney(orderAmount(o))}</td>
      <td><button class="adm-icon-btn ord-view" data-id="${o.id}" aria-label="View order"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg></button></td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="text-center text-sm text-[var(--alt-muted)] py-10">No orders match these filters.</td></tr>`;

  document.querySelectorAll(".ord-row-check").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) ordersState.selected.add(cb.dataset.id); else ordersState.selected.delete(cb.dataset.id);
    document.getElementById("ord-bulk-bar").style.display = ordersState.selected.size ? "flex" : "none";
    document.getElementById("ord-bulk-count").textContent = `${ordersState.selected.size} selected`;
  }));
  document.querySelectorAll(".ord-view").forEach(el => el.addEventListener("click", () => openOrderDetail(el.dataset.id)));

  const totalPages = Math.max(1, Math.ceil(list.length / ordersState.perPage));
  document.getElementById("ord-pagination").innerHTML = `
    <span>${list.length} order${list.length === 1 ? "" : "s"} · page ${ordersState.page} of ${totalPages}</span>
    <div class="flex gap-2">
      <button id="ord-prev" class="adm-btn adm-btn-ghost" ${ordersState.page <= 1 ? "disabled style=opacity:.4" : ""}>Previous</button>
      <button id="ord-next" class="adm-btn adm-btn-ghost" ${ordersState.page >= totalPages ? "disabled style=opacity:.4" : ""}>Next</button>
    </div>
  `;
  document.getElementById("ord-prev").addEventListener("click", () => { if (ordersState.page > 1){ ordersState.page--; renderOrdersTable(); } });
  document.getElementById("ord-next").addEventListener("click", () => { if (ordersState.page < totalPages){ ordersState.page++; renderOrdersTable(); } });
  document.getElementById("ord-bulk-bar").style.display = ordersState.selected.size ? "flex" : "none";
  document.getElementById("ord-bulk-count").textContent = `${ordersState.selected.size} selected`;
}

/* ================================================================
   CUSTOM PRODUCT REQUESTS
   Same list/search/filter/export/detail-drawer pattern as Orders
   above, backed by custom-requests.js instead of order-service.js.
   ================================================================ */
const crState = { search: "", status: "all", showArchived: false, sort: "newest", page: 1, perPage: 8 };

function filteredCustomRequests(){
  let list = allCustomRequests().filter(r => crState.showArchived ? r.archived : !r.archived);
  if (crState.status !== "all") list = list.filter(r => r.status === crState.status);
  if (crState.search.trim()){
    const q = crState.search.trim().toLowerCase();
    list = list.filter(r => `${r.id} ${r.productName} ${r.customerName} ${r.customerEmail}`.toLowerCase().includes(q));
  }
  if (crState.sort === "newest") list.sort((a, b) => b.createdAt - a.createdAt);
  if (crState.sort === "oldest") list.sort((a, b) => a.createdAt - b.createdAt);
  if (crState.sort === "priority") { const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 }; list.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2)); }
  return list;
}
function paginatedCustomRequests(){
  const list = filteredCustomRequests();
  const start = (crState.page - 1) * crState.perPage;
  return list.slice(start, start + crState.perPage);
}

VIEW_RENDERERS["custom-requests"] = function(){
  document.getElementById("view-custom-requests").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Custom Requests</h2>
      <button id="cr-export" class="adm-btn adm-btn-ghost">Export CSV</button>
    </div>
    <div class="flex items-center gap-3 mb-3 flex-wrap" data-enter>
      <input id="cr-search" type="text" placeholder="Search request #, product, customer…" class="adm-input flex-1" style="min-width:260px;" value="${crState.search}">
      <select id="cr-sort" class="adm-input">
        <option value="newest" ${crState.sort === "newest" ? "selected" : ""}>Newest First</option>
        <option value="oldest" ${crState.sort === "oldest" ? "selected" : ""}>Oldest First</option>
        <option value="priority" ${crState.sort === "priority" ? "selected" : ""}>Priority</option>
      </select>
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <button class="adm-chip cr-status-chip ${crState.status === "all" ? "active" : ""}" data-status="all">All Statuses</button>
      ${CR_ALL_STATUSES.map(s => `<button class="adm-chip cr-status-chip ${crState.status === s.slug ? "active" : ""}" data-status="${s.slug}">${s.label}</button>`).join("")}
      <button class="adm-chip ${crState.showArchived ? "active" : ""}" id="cr-archived-toggle">${crState.showArchived ? "Showing Archived" : "Show Archived"}</button>
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr>
          <th>Request #</th><th>Customer</th><th>Product</th><th>Budget</th><th>Priority</th><th>Status</th><th>Date</th><th></th>
        </tr></thead>
        <tbody id="cr-tbody"></tbody>
      </table>
    </div>
    <div id="cr-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("cr-search").addEventListener("input", e => { crState.search = e.target.value; crState.page = 1; renderCrTable(); });
  document.getElementById("cr-sort").addEventListener("change", e => { crState.sort = e.target.value; renderCrTable(); });
  document.querySelectorAll(".cr-status-chip").forEach(btn => btn.addEventListener("click", () => { crState.status = btn.dataset.status; crState.page = 1; VIEW_RENDERERS["custom-requests"](); }));
  document.getElementById("cr-archived-toggle").addEventListener("click", () => { crState.showArchived = !crState.showArchived; crState.page = 1; VIEW_RENDERERS["custom-requests"](); });
  document.getElementById("cr-export").addEventListener("click", () => exportCSV(filteredCustomRequests().map(r => ({
    id: r.id, customer: r.customerName, email: r.customerEmail, product: r.productName, budget: r.budget,
    priority: r.priority, status: crStatusMeta(r.status).label, createdAt: new Date(r.createdAt).toISOString(),
  })), ["id","customer","email","product","budget","priority","status","createdAt"], "custom-requests.csv"));
  renderCrTable();
};

function renderCrTable(){
  const list = filteredCustomRequests();
  const rows = paginatedCustomRequests();
  document.getElementById("cr-tbody").innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td class="font-mono text-xs cursor-pointer cr-row-view" data-id="${r.id}">${r.id}</td>
      <td>${escapeHTML(r.customerName || "—")}</td>
      <td class="text-sm cursor-pointer cr-row-view" data-id="${r.id}">${escapeHTML(r.productName)}</td>
      <td class="text-xs">${escapeHTML(r.budget || "—")}</td>
      <td><span class="badge ${r.priority === "Urgent" || r.priority === "High" ? "badge-warn" : "badge-neutral"}"><span class="badge-dot"></span>${r.priority}</span></td>
      <td>${(() => { const m = crStatusMeta(r.status); return `<span class="badge ${m.badgeClass}"><span class="badge-dot"></span>${m.label}</span>`; })()}</td>
      <td class="text-xs text-[var(--alt-muted)]">${new Date(r.createdAt).toLocaleDateString()}</td>
      <td><button class="adm-icon-btn cr-row-view" data-id="${r.id}" aria-label="View request"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg></button></td>
    </tr>
  `).join("") : `<tr><td colspan="8" class="text-center text-sm text-[var(--alt-muted)] py-10">No custom requests match these filters.</td></tr>`;
  document.querySelectorAll(".cr-row-view").forEach(el => el.addEventListener("click", () => openCustomRequestAdminDetail(el.dataset.id)));

  const totalPages = Math.max(1, Math.ceil(list.length / crState.perPage));
  document.getElementById("cr-pagination").innerHTML = `
    <span>${list.length} request${list.length === 1 ? "" : "s"} · page ${crState.page} of ${totalPages}</span>
    <div class="flex gap-2">
      <button id="cr-prev" class="adm-btn adm-btn-ghost" ${crState.page <= 1 ? "disabled style=opacity:.4" : ""}>Previous</button>
      <button id="cr-next" class="adm-btn adm-btn-ghost" ${crState.page >= totalPages ? "disabled style=opacity:.4" : ""}>Next</button>
    </div>
  `;
  document.getElementById("cr-prev").addEventListener("click", () => { if (crState.page > 1){ crState.page--; renderCrTable(); } });
  document.getElementById("cr-next").addEventListener("click", () => { if (crState.page < totalPages){ crState.page++; renderCrTable(); } });
}

function openCustomRequestAdminDetail(id){
  const r = getCustomRequestById(id);
  if (!r) return;
  const links = Object.entries(r.links || {}).filter(([, v]) => v);
  const imagesHTML = (r.images || []).map(src => `<img src="${src}" class="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" alt="">`).join("");
  const notesHTML = (r.internalNotes || []).map(n => `<div class="text-xs border-b border-[var(--alt-border)] pb-2 mb-2"><p>${escapeHTML(n.text)}</p><p class="text-[var(--alt-muted)] mt-0.5 font-mono">${new Date(n.at).toLocaleString()}</p></div>`).join("") || `<p class="text-xs text-[var(--alt-muted)]">No internal notes yet.</p>`;

  const paymentHTML = (kind, payment, expectedAmount) => {
    if (!payment) return "";
    return `
      <div class="mb-5 border-t border-[var(--alt-border)] pt-4">
        <p class="field-label mb-2">${kind === "advance" ? "Advance" : "Final"} Payment</p>
        <div class="rounded-xl p-3 text-sm mb-3" style="background:var(--alt-surface);">
          <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Customer's Wallet Number</span><span class="font-mono">${escapeHTML(payment.walletNumber || "—")}</span></div>
          <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Transaction ID Submitted</span><span class="font-mono">${escapeHTML(payment.customerTxnId || "—")}</span></div>
          <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Amount Due</span><span class="font-mono">${fmtMoney(expectedAmount)}</span></div>
          <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Status</span><span class="badge ${payment.status === "verified" ? "badge-good" : payment.status === "rejected" ? "badge-bad" : "badge-warn"}"><span class="badge-dot"></span>${payment.status}</span></div>
        </div>
        ${payment.status === "pending" ? `
          <label class="field-label">Transaction ID you received</label>
          <input id="cr-pv-${kind}-txn" class="field-input mb-2" placeholder="Paste the exact Transaction ID">
          <label class="field-label">Amount Received (৳)</label>
          <input id="cr-pv-${kind}-amount" type="number" step="0.01" class="field-input mb-2" placeholder="${expectedAmount.toFixed(2)}">
          <p id="cr-pv-${kind}-error" class="text-xs mb-2" style="color:var(--alt-bad); display:none;"></p>
          <div class="flex gap-2">
            <button id="cr-pv-${kind}-verify" class="adm-btn adm-btn-primary flex-1">Verify &amp; Confirm Payment</button>
            <button id="cr-pv-${kind}-reject" class="adm-btn adm-btn-danger">Reject</button>
          </div>
        ` : ""}
      </div>`;
  };

  const body = `
    <div class="mb-5">
      <div class="flex items-center justify-between mb-1"><span class="font-mono text-xs text-[var(--alt-muted)]">${r.id}</span>${(() => { const m = crStatusMeta(r.status); return `<span class="badge ${m.badgeClass}"><span class="badge-dot"></span>${m.label}</span>`; })()}</div>
      <p class="text-sm font-medium">${escapeHTML(r.customerName || "Unknown customer")}</p>
      <p class="text-xs text-[var(--alt-muted)]">${escapeHTML(r.customerEmail || "")} ${escapeHTML(r.customerPhone || "")}</p>
      <p class="text-xs text-[var(--alt-muted)] mt-1">Submitted ${new Date(r.createdAt).toLocaleString()}</p>
    </div>

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
      <p class="field-label mb-1">Product</p>
      <p class="text-sm font-medium">${escapeHTML(r.productName)}</p>
      <p class="text-xs text-[var(--alt-muted)] mt-1">${[r.category, r.brand, r.color, r.size, `Qty ${r.quantity}`, r.budget ? `Budget ${r.budget}` : null].filter(Boolean).map(escapeHTML).join(" · ")}</p>
      <p class="text-sm mt-2">${escapeHTML(r.description)}</p>
      ${r.specialInstructions ? `<p class="text-xs text-[var(--alt-muted)] mt-2"><strong>Special Instructions:</strong> ${escapeHTML(r.specialInstructions)}</p>` : ""}
    </div>

    ${links.length ? `<div class="border-t border-[var(--alt-border)] pt-4 mb-5"><p class="field-label mb-2">Reference Links</p>${links.map(([k, v]) => `<p class="text-xs mb-1"><span class="capitalize text-[var(--alt-muted)]">${k}:</span> <a href="${escapeHTML(v)}" target="_blank" rel="noopener" class="underline break-all">${escapeHTML(v)}</a></p>`).join("")}</div>` : ""}

    ${imagesHTML ? `<div class="border-t border-[var(--alt-border)] pt-4 mb-5"><p class="field-label mb-2">Reference Images</p><div class="flex gap-2 flex-wrap">${imagesHTML}</div></div>` : ""}

    ${r.quotation ? `
      <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
        <p class="field-label mb-2">Quotation Sent</p>
        <div class="text-sm space-y-1">
          <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Total</span><span class="font-mono">${fmtMoney(r.quotation.total)}</span></div>
          <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Advance (${r.quotation.advancePercent}%)</span><span class="font-mono">${fmtMoney(r.quotation.advanceAmount)}</span></div>
          <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Remaining</span><span class="font-mono">${fmtMoney(r.quotation.remainingAmount)}</span></div>
        </div>
      </div>
    ` : ""}

    ${paymentHTML("advance", r.advancePayment, r.quotation ? r.quotation.advanceAmount : 0)}
    ${paymentHTML("final", r.finalPayment, r.quotation ? r.quotation.remainingAmount : 0)}

    ${!r.quotation || r.status === "awaiting-confirmation" || r.status === "under-review" ? `
      <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
        <p class="field-label mb-3">Build Quotation</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div><label class="field-label">Product Cost (৳)</label><input id="cr-q-product" type="number" min="0" class="field-input" value="${r.quotation ? r.quotation.productCost : ""}"></div>
          <div><label class="field-label">Shipping Cost (৳)</label><input id="cr-q-shipping" type="number" min="0" class="field-input" value="${r.quotation ? r.quotation.shippingCost : ""}"></div>
          <div><label class="field-label">Import Cost (৳) <span class="font-mono text-[10px]">optional</span></label><input id="cr-q-import" type="number" min="0" class="field-input" value="${r.quotation ? r.quotation.importCost : ""}"></div>
          <div><label class="field-label">Service Charge (৳)</label><input id="cr-q-service" type="number" min="0" class="field-input" value="${r.quotation ? r.quotation.serviceCharge : ""}"></div>
          <div><label class="field-label">Tax Rate (%)</label><input id="cr-q-tax" type="number" min="0" class="field-input" value="${r.quotation ? r.quotation.taxRate : 0}"></div>
          <div><label class="field-label">Delivery Time (days)</label><input id="cr-q-delivery" type="number" min="1" class="field-input" value="${r.quotation ? r.quotation.deliveryDays : 14}"></div>
          <div><label class="field-label">Quotation Valid (days)</label><input id="cr-q-valid" type="number" min="1" class="field-input" value="7"></div>
          <div><label class="field-label">Refund Policy</label>
            <select id="cr-q-refund" class="field-input">
              ${CR_REFUND_POLICIES.map(p => `<option value="${p.slug}" ${r.quotation && r.quotation.refundPolicy === p.slug ? "selected" : ""}>${p.label}</option>`).join("")}
            </select>
          </div>
        </div>
        <label class="field-label">Notes to Customer</label>
        <textarea id="cr-q-notes" rows="2" class="field-input mb-3">${r.quotation ? escapeHTML(r.quotation.notes || "") : ""}</textarea>
        <p class="text-xs text-[var(--alt-muted)] mb-3">Advance required: <strong>${customRequestAdvancePercent()}%</strong> (set in Settings).</p>
        <button id="cr-send-quote" class="adm-btn adm-btn-primary w-full">Send Quotation to Customer</button>
      </div>
    ` : ""}

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div><label class="field-label">Priority</label>
          <select id="cr-priority" class="field-input">
            ${CR_URGENCY_LEVELS.map(p => `<option ${r.priority === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>
        <div><label class="field-label">Assigned Staff</label><input id="cr-staff" class="field-input" value="${escapeHTML(r.assignedStaff || "")}" placeholder="Staff name"></div>
      </div>
      <label class="field-label">Update Status</label>
      <select id="cr-detail-status" class="field-input mb-3">
        ${CR_ALL_STATUSES.map(s => `<option value="${s.slug}" ${r.status === s.slug ? "selected" : ""}>${s.label}</option>`).join("")}
      </select>
    </div>

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
      <p class="field-label mb-2">Internal Notes</p>
      <div class="mb-3">${notesHTML}</div>
      <textarea id="cr-new-note" rows="2" class="field-input mb-2" placeholder="Add an internal note (not visible to customer)"></textarea>
      <button id="cr-add-note" class="adm-btn adm-btn-ghost">Add Note</button>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <button id="cr-approve" class="adm-chip">Approve</button>
      <button id="cr-reject" class="adm-chip" style="color:var(--alt-bad);">Reject</button>
      <button id="cr-request-info" class="adm-chip">Request More Info</button>
      <button id="cr-merge" class="adm-chip">Merge Duplicate</button>
      <button id="cr-archive" class="adm-chip">${r.archived ? "Unarchive" : "Archive"}</button>
    </div>
  `;
  const foot = `<button id="cr-detail-save" class="adm-btn adm-btn-primary flex-1">Save Changes</button>`;
  openDrawer(`Request ${r.id}`, body, foot);

  ["advance", "final"].forEach(kind => {
    const payment = kind === "advance" ? r.advancePayment : r.finalPayment;
    if (!payment || payment.status !== "pending") return;
    document.getElementById(`cr-pv-${kind}-verify`).addEventListener("click", () => {
      const fn = kind === "advance" ? verifyAdvancePayment : verifyFinalPayment;
      const result = fn(r, { adminTxnId: document.getElementById(`cr-pv-${kind}-txn`).value, amountReceived: document.getElementById(`cr-pv-${kind}-amount`).value });
      const errEl = document.getElementById(`cr-pv-${kind}-error`);
      if (!result.ok){
        errEl.textContent = !result.txnMatch ? "Transaction ID doesn't match what the customer submitted." : "Amount received doesn't match the expected amount.";
        errEl.style.display = "block";
        return;
      }
      logAudit(`Custom request ${kind} payment verified`, r.id);
      closeDrawer(); renderCrTable(); renderSidebar(); adminToast("Payment verified.");
    });
    document.getElementById(`cr-pv-${kind}-reject`).addEventListener("click", () => {
      confirmAction({
        title: `Reject ${kind} payment for ${r.id}?`, confirmLabel: "Reject Payment", danger: true,
        body: "The customer will need to resubmit their payment details.",
        onConfirm(){
          (kind === "advance" ? rejectAdvancePayment : rejectFinalPayment)(r, "Transaction ID or amount could not be verified.");
          logAudit(`Custom request ${kind} payment rejected`, r.id);
          closeDrawer(); renderCrTable(); adminToast("Payment rejected.");
        },
      });
    });
  });

  const sendQuoteBtn = document.getElementById("cr-send-quote");
  if (sendQuoteBtn) sendQuoteBtn.addEventListener("click", () => {
    sendQuotation(r, {
      productCost: document.getElementById("cr-q-product").value,
      shippingCost: document.getElementById("cr-q-shipping").value,
      importCost: document.getElementById("cr-q-import").value,
      serviceCharge: document.getElementById("cr-q-service").value,
      taxRate: document.getElementById("cr-q-tax").value,
      deliveryDays: document.getElementById("cr-q-delivery").value,
      validDays: document.getElementById("cr-q-valid").value,
      refundPolicy: document.getElementById("cr-q-refund").value,
      notes: document.getElementById("cr-q-notes").value,
    });
    logAudit("Quotation sent", r.id);
    closeDrawer(); renderCrTable(); renderSidebar(); adminToast("Quotation sent to customer.");
  });

  document.getElementById("cr-approve").addEventListener("click", () => {
    advanceCustomRequestStatus(r, "awaiting-confirmation", "Approved by admin.");
    logAudit("Custom request approved", r.id);
    closeDrawer(); renderCrTable(); renderSidebar(); adminToast("Request approved.");
  });
  document.getElementById("cr-reject").addEventListener("click", () => {
    confirmAction({
      title: `Reject ${r.id}?`, confirmLabel: "Reject Request", danger: true,
      body: "The customer will be notified that this request was rejected.",
      onConfirm(){
        advanceCustomRequestStatus(r, "rejected", "Rejected by admin.");
        logAudit("Custom request rejected", r.id);
        closeDrawer(); renderCrTable(); renderSidebar(); adminToast("Request rejected.");
      },
    });
  });
  document.getElementById("cr-request-info").addEventListener("click", () => {
    admPromptText({
      title: "Request More Information",
      label: "What do you need from the customer?",
      placeholder: "e.g. Which color did you want — the photo shows two options.",
      confirmLabel: "Send to Customer",
      returnTo: () => openCustomRequestAdminDetail(r.id),
      onSubmit(note){
        r.internalNotes = r.internalNotes || [];
        r.internalNotes.push({ text: `Requested more info: ${note}`, at: Date.now() });
        saveCustomRequest(r);
        pushCustomerNotification(r.userId, { category: "Order Updates", title: `We need more information about ${r.id}.`, body: note, customRequestId: r.id });
        logAudit("Requested more info", r.id);
        closeDrawer(); adminToast("Message sent to customer.");
      },
    });
  });
  document.getElementById("cr-merge").addEventListener("click", () => {
    admPromptText({
      title: "Merge Duplicate Request",
      label: "Request ID this is a duplicate of",
      placeholder: "e.g. CR-2026-0002",
      confirmLabel: "Mark as Duplicate",
      returnTo: () => openCustomRequestAdminDetail(r.id),
      onSubmit(otherId){
        r.duplicateOf = otherId;
        r.archived = true;
        saveCustomRequest(r);
        logAudit("Custom request merged", `${r.id} -> ${otherId}`);
        closeDrawer(); renderCrTable(); adminToast("Marked as duplicate and archived.");
      },
    });
  });
  document.getElementById("cr-archive").addEventListener("click", () => {
    r.archived = !r.archived;
    saveCustomRequest(r);
    logAudit(r.archived ? "Custom request archived" : "Custom request unarchived", r.id);
    closeDrawer(); renderCrTable(); adminToast(r.archived ? "Request archived." : "Request restored.");
  });
  document.getElementById("cr-add-note").addEventListener("click", () => {
    const text = document.getElementById("cr-new-note").value.trim();
    if (!text) return;
    r.internalNotes = r.internalNotes || [];
    r.internalNotes.push({ text, at: Date.now() });
    saveCustomRequest(r);
    openCustomRequestAdminDetail(r.id);
  });
  document.getElementById("cr-detail-save").addEventListener("click", () => {
    r.priority = document.getElementById("cr-priority").value;
    r.assignedStaff = document.getElementById("cr-staff").value.trim();
    const newStatus = document.getElementById("cr-detail-status").value;
    if (newStatus !== r.status) advanceCustomRequestStatus(r, newStatus, "Status updated by admin.");
    else saveCustomRequest(r);
    logAudit("Custom request updated", r.id);
    closeDrawer(); renderCrTable(); renderSidebar(); adminToast("Request updated.");
  });
}

/* ================================================================
   RETURNS & EXCHANGES
   Same list/search/filter/export/detail-drawer pattern as Custom
   Requests above, backed by returns.js.
   ================================================================ */
const retState = { search: "", status: "all", type: "all", sort: "newest", page: 1, perPage: 8 };

function filteredReturnRequests(){
  let list = allReturnRequests();
  if (retState.status !== "all") list = list.filter(r => r.status === retState.status);
  if (retState.type !== "all") list = list.filter(r => r.type === retState.type);
  if (retState.search.trim()){
    const q = retState.search.trim().toLowerCase();
    list = list.filter(r => `${r.id} ${r.orderId} ${customerName(r.userId)}`.toLowerCase().includes(q));
  }
  list.sort((a, b) => retState.sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  return list;
}
function paginatedReturnRequests(){
  const list = filteredReturnRequests();
  const start = (retState.page - 1) * retState.perPage;
  return list.slice(start, start + retState.perPage);
}

VIEW_RENDERERS.returns = function(){
  document.getElementById("view-returns").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Returns &amp; Exchanges</h2>
      <button id="ret-export" class="adm-btn adm-btn-ghost">Export CSV</button>
    </div>
    <div class="flex items-center gap-3 mb-3 flex-wrap" data-enter>
      <input id="ret-search" type="text" placeholder="Search request #, order #, customer…" class="adm-input flex-1" style="min-width:260px;" value="${retState.search}">
      <select id="ret-type-filter" class="adm-input">
        <option value="all">All Types</option>
        ${RETURN_TYPES.map(t => `<option value="${t.slug}" ${retState.type === t.slug ? "selected" : ""}>${t.label}</option>`).join("")}
      </select>
      <select id="ret-sort" class="adm-input">
        <option value="newest" ${retState.sort === "newest" ? "selected" : ""}>Newest First</option>
        <option value="oldest" ${retState.sort === "oldest" ? "selected" : ""}>Oldest First</option>
      </select>
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <button class="adm-chip ret-status-chip ${retState.status === "all" ? "active" : ""}" data-status="all">All Statuses</button>
      ${RETURN_ALL_STATUSES.map(s => `<button class="adm-chip ret-status-chip ${retState.status === s.slug ? "active" : ""}" data-status="${s.slug}">${s.label}</button>`).join("")}
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr>
          <th>Request #</th><th>Order #</th><th>Customer</th><th>Type</th><th>Status</th><th>Date</th><th></th>
        </tr></thead>
        <tbody id="ret-tbody"></tbody>
      </table>
    </div>
    <div id="ret-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("ret-search").addEventListener("input", e => { retState.search = e.target.value; retState.page = 1; renderRetTable(); });
  document.getElementById("ret-type-filter").addEventListener("change", e => { retState.type = e.target.value; retState.page = 1; renderRetTable(); });
  document.getElementById("ret-sort").addEventListener("change", e => { retState.sort = e.target.value; renderRetTable(); });
  document.querySelectorAll(".ret-status-chip").forEach(btn => btn.addEventListener("click", () => { retState.status = btn.dataset.status; retState.page = 1; VIEW_RENDERERS.returns(); }));
  document.getElementById("ret-export").addEventListener("click", () => exportCSV(filteredReturnRequests().map(r => ({
    id: r.id, orderId: r.orderId, customer: customerName(r.userId), type: r.type,
    status: returnStatusMeta(r.status).label, reason: r.reasonCategory, createdAt: new Date(r.createdAt).toISOString(),
  })), ["id","orderId","customer","type","status","reason","createdAt"], "returns.csv"));
  renderRetTable();
};

function renderRetTable(){
  const list = filteredReturnRequests();
  const rows = paginatedReturnRequests();
  document.getElementById("ret-tbody").innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td class="font-mono text-xs cursor-pointer ret-row-view" data-id="${r.id}">${r.id}</td>
      <td class="font-mono text-xs">${r.orderId}</td>
      <td>${escapeHTML(customerName(r.userId))}</td>
      <td class="text-xs">${RETURN_TYPES.find(t => t.slug === r.type).label}</td>
      <td>${(() => { const m = returnStatusMeta(r.status); return `<span class="badge ${m.badgeClass}"><span class="badge-dot"></span>${m.label}</span>`; })()}</td>
      <td class="text-xs text-[var(--alt-muted)]">${new Date(r.createdAt).toLocaleDateString()}</td>
      <td><button class="adm-icon-btn ret-row-view" data-id="${r.id}" aria-label="View request"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg></button></td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="text-center text-sm text-[var(--alt-muted)] py-10">No return/exchange requests match these filters.</td></tr>`;
  document.querySelectorAll(".ret-row-view").forEach(el => el.addEventListener("click", () => openReturnAdminDetail(el.dataset.id)));

  const totalPages = Math.max(1, Math.ceil(list.length / retState.perPage));
  document.getElementById("ret-pagination").innerHTML = `
    <span>${list.length} request${list.length === 1 ? "" : "s"} · page ${retState.page} of ${totalPages}</span>
    <div class="flex gap-2">
      <button id="ret-prev" class="adm-btn adm-btn-ghost" ${retState.page <= 1 ? "disabled style=opacity:.4" : ""}>Previous</button>
      <button id="ret-next" class="adm-btn adm-btn-ghost" ${retState.page >= totalPages ? "disabled style=opacity:.4" : ""}>Next</button>
    </div>
  `;
  document.getElementById("ret-prev").addEventListener("click", () => { if (retState.page > 1){ retState.page--; renderRetTable(); } });
  document.getElementById("ret-next").addEventListener("click", () => { if (retState.page < totalPages){ retState.page++; renderRetTable(); } });
}

function openReturnAdminDetail(id){
  const r = getReturnRequestById(id);
  if (!r) return;
  const order = getOrderById(r.orderId);
  const itemsHTML = (r.items || []).map(it => `
    <div class="flex items-center gap-3 mb-2">
      <img src="${it.img || ""}" class="w-11 h-11 rounded-lg object-cover shrink-0" loading="lazy" alt="">
      <p class="text-sm flex-1">${it.name || "Unknown item"}${it.qty > 1 ? ` × ${it.qty}` : ""}</p>
    </div>`).join("");
  const imagesHTML = (r.images || []).map(src => `<img src="${src}" class="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" alt="">`).join("");
  const notesHTML = (r.internalNotes || []).map(n => `<div class="text-xs border-b border-[var(--alt-border)] pb-2 mb-2"><p>${escapeHTML(n.text)}</p><p class="text-[var(--alt-muted)] mt-0.5 font-mono">${new Date(n.at).toLocaleString()}</p></div>`).join("") || `<p class="text-xs text-[var(--alt-muted)]">No internal notes yet.</p>`;

  const body = `
    <div class="mb-5">
      <div class="flex items-center justify-between mb-1"><span class="font-mono text-xs text-[var(--alt-muted)]">${r.id}</span>${(() => { const m = returnStatusMeta(r.status); return `<span class="badge ${m.badgeClass}"><span class="badge-dot"></span>${m.label}</span>`; })()}</div>
      <p class="text-sm font-medium">${escapeHTML(customerName(r.userId))}</p>
      <p class="text-xs text-[var(--alt-muted)] mt-1">Order ${r.orderId}${order ? ` · ${fmtMoney(orderAmount(order))}` : ""} · ${new Date(r.createdAt).toLocaleString()}</p>
    </div>

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
      <p class="field-label mb-2">${RETURN_TYPES.find(t => t.slug === r.type).label}</p>
      ${itemsHTML}
      <p class="text-sm mt-2"><strong>${escapeHTML(r.reasonCategory)}:</strong> ${escapeHTML(r.reason)}</p>
      ${r.exchangeFor ? `<p class="text-xs text-[var(--alt-muted)] mt-2">Wants: ${escapeHTML([r.exchangeFor.color, r.exchangeFor.size].filter(Boolean).join(" · ") || "—")}</p>` : ""}
    </div>

    ${imagesHTML ? `<div class="border-t border-[var(--alt-border)] pt-4 mb-5"><p class="field-label mb-2">Photos</p><div class="flex gap-2 flex-wrap">${imagesHTML}</div></div>` : ""}

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">
      <p class="field-label mb-3">${r.refundMethod ? "Resolution" : "Process Resolution"}</p>
      ${r.refundMethod ? `<p class="text-sm">${REFUND_METHODS.find(m => m.slug === r.refundMethod).label} — ${fmtMoney(r.refundAmount || 0)}</p>` : `
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div><label class="field-label">Refund Method</label>
            <select id="ret-refund-method" class="field-input">
              ${REFUND_METHODS.map(m => `<option value="${m.slug}">${m.label}</option>`).join("")}
            </select>
          </div>
          <div><label class="field-label">Amount (৳)</label><input id="ret-refund-amount" type="number" min="0" class="field-input" value="${order ? orderAmount(order) : 0}"></div>
        </div>
        <button id="ret-resolve" class="adm-btn adm-btn-primary w-full">Mark Resolved &amp; Process</button>
      `}
    </div>

    <div class="mb-5">
      <label class="field-label">Update Status</label>
      <select id="ret-detail-status" class="field-input">
        ${RETURN_ALL_STATUSES.map(s => `<option value="${s.slug}" ${r.status === s.slug ? "selected" : ""}>${s.label}</option>`).join("")}
      </select>
    </div>

    <div class="mb-5">
      <p class="field-label mb-2">Internal Notes</p>
      <div class="mb-3">${notesHTML}</div>
      <textarea id="ret-new-note" rows="2" class="field-input mb-2" placeholder="Add an internal note"></textarea>
      <button id="ret-add-note" class="adm-btn adm-btn-ghost">Add Note</button>
    </div>
  `;
  const foot = `<button id="ret-detail-save" class="adm-btn adm-btn-primary flex-1">Save Changes</button>`;
  openDrawer(`Return/Exchange ${r.id}`, body, foot);

  const resolveBtn = document.getElementById("ret-resolve");
  if (resolveBtn) resolveBtn.addEventListener("click", () => {
    resolveReturnRequest(r, {
      refundMethod: document.getElementById("ret-refund-method").value,
      refundAmount: document.getElementById("ret-refund-amount").value,
    });
    logAudit("Return/exchange resolved", r.id);
    closeDrawer(); renderRetTable(); renderSidebar(); adminToast("Resolution processed.");
  });
  document.getElementById("ret-add-note").addEventListener("click", () => {
    const text = document.getElementById("ret-new-note").value.trim();
    if (!text) return;
    r.internalNotes = r.internalNotes || [];
    r.internalNotes.push({ text, at: Date.now() });
    saveReturnRequest(r);
    openReturnAdminDetail(r.id);
  });
  document.getElementById("ret-detail-save").addEventListener("click", () => {
    const newStatus = document.getElementById("ret-detail-status").value;
    if (newStatus !== r.status) advanceReturnStatus(r, newStatus, "Status updated by admin.");
    else saveReturnRequest(r);
    logAudit("Return/exchange updated", r.id);
    closeDrawer(); renderRetTable(); renderSidebar(); adminToast("Request updated.");
  });
}

/* ================================================================
   REWARD VAULT — gamified scratch-card reward system management.
   One admin nav item, four internal tabs (Templates / Promotional
   Codes / Scratch Cards / Analytics) rather than four separate
   sidebar entries — same idea as Custom Requests/Returns above, just
   grouped since these four are really one feature's control panel.
   ================================================================ */
const rvState = { tab: "templates", cardSearch: "", cardPage: 1, cardPerPage: 10 };

VIEW_RENDERERS["reward-vault"] = function(){
  document.getElementById("view-reward-vault").innerHTML = `
    <div class="mb-5" data-enter><h2 class="font-display text-2xl font-medium">Reward Vault</h2><p class="text-sm text-[var(--alt-muted)] mt-1">Manage the Mystery Reward scratch-card system — templates, promotional codes, issued cards, and how it's performing.</p></div>
    <div class="flex items-center gap-2 mb-5 flex-wrap" data-enter>
      ${[["templates","Reward Templates"],["promo","Promotional Codes"],["cards","Scratch Cards"],["analytics","Analytics"]].map(([slug, label]) => `<button class="adm-chip rv-tab-chip ${rvState.tab === slug ? "active" : ""}" data-tab="${slug}">${label}</button>`).join("")}
    </div>
    <div id="rv-tab-content" data-enter></div>
  `;
  document.querySelectorAll(".rv-tab-chip").forEach(btn => btn.addEventListener("click", () => { rvState.tab = btn.dataset.tab; VIEW_RENDERERS["reward-vault"](); }));
  if (rvState.tab === "templates") renderRvTemplatesTab();
  else if (rvState.tab === "promo") renderRvPromoTab();
  else if (rvState.tab === "cards") renderRvCardsTab();
  else renderRvAnalyticsTab();
};

/* ---------------- Reward Templates ---------------- */
function renderRvTemplatesTab(){
  const templates = allRewardTemplates();
  const totalWeight = templates.filter(t => t.active).reduce((s, t) => s + (Number(t.probability) || 0), 0);
  document.getElementById("rv-tab-content").innerHTML = `
    <div class="flex items-center justify-end mb-4">
      <button id="rv-add-template" class="adm-btn adm-btn-primary">+ Add Template</button>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Label</th><th>Type</th><th>Value</th><th>Odds</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${templates.map(t => `
            <tr>
              <td class="text-sm">${escapeHTML(t.label)}</td>
              <td class="text-xs">${(REWARD_TYPES.find(r => r.slug === t.type) || {}).label || t.type}</td>
              <td class="font-mono text-xs">${t.type === "percentage" ? t.value + "%" : t.type === "fixed" ? fmtMoney(t.value) : t.type === "coins" ? t.value + " coins" : "—"}</td>
              <td class="font-mono text-xs">${t.active && totalWeight ? Math.round((t.probability / totalWeight) * 100) : 0}%</td>
              <td><button class="toggle rv-tpl-toggle ${t.active ? "on" : ""}" data-id="${t.id}"><span class="toggle-knob"></span></button></td>
              <td><button class="adm-icon-btn rv-tpl-edit" data-id="${t.id}" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll(".rv-tpl-toggle").forEach(btn => btn.addEventListener("click", () => {
    const list = allRewardTemplates();
    const t = list.find(x => x.id === btn.dataset.id);
    t.active = !t.active;
    saveRewardTemplates(list);
    logAudit("Reward template toggled", `${t.label} → ${t.active ? "active" : "inactive"}`);
    renderRvTemplatesTab();
  }));
  document.querySelectorAll(".rv-tpl-edit").forEach(btn => btn.addEventListener("click", () => openRvTemplateForm(btn.dataset.id)));
  document.getElementById("rv-add-template").addEventListener("click", () => openRvTemplateForm(null));
}
function openRvTemplateForm(id){
  const list = allRewardTemplates();
  const t = id ? list.find(x => x.id === id) : { id: null, label: "", type: "percentage", value: 10, probability: 10, expiryDays: 30, minPurchase: 0, maxDiscount: null, active: true };
  const body = `
    <div class="mb-3"><label class="field-label">Label</label><input id="rv-tpl-label" class="field-input" value="${escapeHTML(t.label)}" placeholder="e.g. 10% Off"></div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div><label class="field-label">Reward Type</label>
        <select id="rv-tpl-type" class="field-input">
          ${REWARD_TYPES.map(rt => `<option value="${rt.slug}" ${t.type === rt.slug ? "selected" : ""}>${rt.label}</option>`).join("")}
        </select>
      </div>
      <div><label class="field-label">Value</label><input id="rv-tpl-value" type="number" min="0" class="field-input" value="${t.value}"></div>
    </div>
    <div class="mb-4"><label class="field-label">Probability Weight</label><input id="rv-tpl-prob" type="number" min="0" class="field-input max-w-xs" value="${t.probability}"><p class="text-xs text-[var(--alt-muted)] mt-1">Relative to every other active template's weight — doesn't need to add up to 100.</p></div>
    <div id="rv-tpl-coupon-fields" class="grid grid-cols-2 gap-3 mb-3" style="${["percentage","fixed","free-shipping"].includes(t.type) ? "" : "display:none;"}">
      <div><label class="field-label">Expires After (days)</label><input id="rv-tpl-expiry" type="number" min="1" class="field-input" value="${t.expiryDays || 30}"></div>
      <div><label class="field-label">Min. Purchase (৳)</label><input id="rv-tpl-min" type="number" min="0" class="field-input" value="${t.minPurchase || 0}"></div>
      <div class="col-span-2"><label class="field-label">Max Discount Cap (৳) <span class="font-mono text-[10px]">optional, percentage only</span></label><input id="rv-tpl-max" type="number" min="0" class="field-input" value="${t.maxDiscount || ""}"></div>
    </div>
  `;
  const foot = `<button id="rv-tpl-save" class="adm-btn adm-btn-primary flex-1">${id ? "Save Changes" : "Create Template"}</button>`;
  openDrawer(id ? "Edit Reward Template" : "New Reward Template", body, foot);
  document.getElementById("rv-tpl-type").addEventListener("change", (e) => {
    document.getElementById("rv-tpl-coupon-fields").style.display = ["percentage","fixed","free-shipping"].includes(e.target.value) ? "grid" : "none";
  });
  document.getElementById("rv-tpl-save").addEventListener("click", () => {
    const updated = {
      id: id || ("tpl_" + Date.now()),
      label: document.getElementById("rv-tpl-label").value.trim() || "Untitled Reward",
      type: document.getElementById("rv-tpl-type").value,
      value: Number(document.getElementById("rv-tpl-value").value) || 0,
      probability: Number(document.getElementById("rv-tpl-prob").value) || 0,
      expiryDays: Number(document.getElementById("rv-tpl-expiry").value) || 30,
      minPurchase: Number(document.getElementById("rv-tpl-min").value) || 0,
      maxDiscount: Number(document.getElementById("rv-tpl-max").value) || null,
      active: t.active !== false,
    };
    const current = allRewardTemplates();
    const idx = current.findIndex(x => x.id === updated.id);
    if (idx > -1) current[idx] = updated; else current.push(updated);
    saveRewardTemplates(current);
    logAudit(id ? "Reward template updated" : "Reward template created", updated.label);
    closeDrawer(); renderRvTemplatesTab(); adminToast("Template saved.");
  });
}

/* ---------------- Promotional Codes ---------------- */
function renderRvPromoTab(){
  const codes = allPromoCodes();
  document.getElementById("rv-tab-content").innerHTML = `
    <div class="flex items-center justify-end mb-4">
      <button id="rv-add-promo" class="adm-btn adm-btn-primary">+ Create Code</button>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Code</th><th>Claims</th><th>Expiry</th><th>Eligibility</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${codes.length ? codes.map(p => `
            <tr>
              <td class="font-mono text-sm">${p.code}</td>
              <td class="font-mono text-xs">${promoClaimsFor(p.code).length}${p.claimLimit ? ` / ${p.claimLimit}` : ""}</td>
              <td class="text-xs text-[var(--alt-muted)]">${p.expiry ? new Date(p.expiry).toLocaleDateString() : "No expiry"}</td>
              <td class="text-xs">${p.eligibility?.firstPurchaseOnly ? "First purchase only" : p.eligibility?.existingCustomersOnly ? "Existing customers" : "Everyone"}</td>
              <td><button class="toggle rv-promo-toggle ${p.active ? "on" : ""}" data-code="${p.code}"><span class="toggle-knob"></span></button></td>
              <td><button class="adm-icon-btn rv-promo-delete" data-code="${p.code}" aria-label="Delete" style="color:var(--alt-bad);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></td>
            </tr>
          `).join("") : `<tr><td colspan="6" class="text-center text-sm text-[var(--alt-muted)] py-10">No promotional codes yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll(".rv-promo-toggle").forEach(btn => btn.addEventListener("click", () => {
    const list = allPromoCodes();
    const p = list.find(x => x.code === btn.dataset.code);
    p.active = !p.active;
    savePromoCodes(list);
    renderRvPromoTab();
  }));
  document.querySelectorAll(".rv-promo-delete").forEach(btn => btn.addEventListener("click", () => {
    confirmAction({
      title: `Delete ${btn.dataset.code}?`, confirmLabel: "Delete", danger: true,
      body: "Customers will no longer be able to claim this code.",
      onConfirm(){
        savePromoCodes(allPromoCodes().filter(p => p.code !== btn.dataset.code));
        logAudit("Promotional code deleted", btn.dataset.code);
        renderRvPromoTab();
      },
    });
  }));
  document.getElementById("rv-add-promo").addEventListener("click", openRvPromoForm);
}
function openRvPromoForm(){
  const templates = allRewardTemplates().filter(t => t.active);
  const body = `
    <div class="mb-3"><label class="field-label">Code</label><input id="rv-promo-code" class="field-input" placeholder="e.g. SUMMER25" style="text-transform:uppercase;"></div>
    <div class="mb-3">
      <label class="field-label">Reward Pool <span class="font-mono text-[10px]">(which templates this code can grant)</span></label>
      <div class="space-y-1.5 max-h-40 overflow-y-auto">
        ${templates.map(t => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="rv-promo-pool-check" value="${t.id}" checked> ${escapeHTML(t.label)}</label>`).join("")}
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div><label class="field-label">Total Claim Limit <span class="font-mono text-[10px]">optional</span></label><input id="rv-promo-limit" type="number" min="1" class="field-input"></div>
      <div><label class="field-label">Expires After (days) <span class="font-mono text-[10px]">optional</span></label><input id="rv-promo-expiry" type="number" min="1" class="field-input"></div>
    </div>
    <div class="mb-3">
      <label class="field-label mb-2">Eligibility</label>
      <label class="flex items-center gap-2 text-sm mb-1"><input type="radio" name="rv-promo-elig" value="everyone" checked> Everyone</label>
      <label class="flex items-center gap-2 text-sm mb-1"><input type="radio" name="rv-promo-elig" value="first"> First purchase only</label>
      <label class="flex items-center gap-2 text-sm"><input type="radio" name="rv-promo-elig" value="existing"> Existing customers only</label>
    </div>
  `;
  const foot = `<button id="rv-promo-save" class="adm-btn adm-btn-primary flex-1">Create Code</button>`;
  openDrawer("New Promotional Code", body, foot);
  document.getElementById("rv-promo-save").addEventListener("click", () => {
    const code = document.getElementById("rv-promo-code").value.trim().toUpperCase();
    if (!code){ adminToast("Enter a code first."); return; }
    if (allPromoCodes().some(p => p.code === code)){ adminToast("That code already exists."); return; }
    const pool = Array.from(document.querySelectorAll(".rv-promo-pool-check:checked")).map(cb => cb.value);
    const elig = document.querySelector('input[name="rv-promo-elig"]:checked').value;
    const list = allPromoCodes();
    list.push({
      code,
      templatePoolIds: pool,
      claimLimit: Number(document.getElementById("rv-promo-limit").value) || null,
      perCustomerLimit: 1,
      expiry: document.getElementById("rv-promo-expiry").value ? Date.now() + Number(document.getElementById("rv-promo-expiry").value) * 86400000 : null,
      eligibility: { firstPurchaseOnly: elig === "first", existingCustomersOnly: elig === "existing" },
      active: true,
      createdAt: Date.now(),
    });
    savePromoCodes(list);
    logAudit("Promotional code created", code);
    closeDrawer(); renderRvPromoTab(); adminToast("Promotional code created.");
  });
}

/* ---------------- Scratch Cards / History ---------------- */
function allScratchCardsFlat(){
  const store = JSON.parse(localStorage.getItem("alt_scratch_cards_v1") || "{}");
  const out = [];
  Object.keys(store).forEach(userId => (store[userId] || []).forEach(c => out.push(Object.assign({ userId }, c))));
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
function renderRvCardsTab(){
  document.getElementById("rv-tab-content").innerHTML = `
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <input id="rv-card-search" type="text" placeholder="Search card #, customer, order…" class="adm-input flex-1" style="min-width:260px;" value="${rvState.cardSearch}">
      <button id="rv-card-export" class="adm-btn adm-btn-ghost">Export CSV</button>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Card #</th><th>Customer</th><th>Source</th><th>Reward</th><th>Code</th><th>Status</th><th>Date</th></tr></thead>
        <tbody id="rv-cards-tbody"></tbody>
      </table>
    </div>
    <div id="rv-cards-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("rv-card-search").addEventListener("input", e => { rvState.cardSearch = e.target.value; rvState.cardPage = 1; renderRvCardsTable(); });
  document.getElementById("rv-card-export").addEventListener("click", () => exportCSV(filteredScratchCards().map(c => ({
    id: c.id, customer: customerName(c.userId), source: c.source, sourceRef: c.sourceRef,
    reward: c.scratched ? rewardCardRewardText(c.rewardSnapshot) : "Unopened",
    code: (c.scratched && c.rewardSnapshot.couponCode) ? c.rewardSnapshot.couponCode : "",
    scratched: c.scratched, createdAt: new Date(c.createdAt).toISOString(),
  })), ["id","customer","source","sourceRef","reward","code","scratched","createdAt"], "scratch-cards.csv"));
  renderRvCardsTable();
}
function filteredScratchCards(){
  let list = allScratchCardsFlat();
  if (rvState.cardSearch.trim()){
    const q = rvState.cardSearch.trim().toLowerCase();
    list = list.filter(c => `${c.id} ${c.sourceRef} ${customerName(c.userId)}`.toLowerCase().includes(q));
  }
  return list;
}
function renderRvCardsTable(){
  const list = filteredScratchCards();
  const start = (rvState.cardPage - 1) * rvState.cardPerPage;
  const rows = list.slice(start, start + rvState.cardPerPage);
  document.getElementById("rv-cards-tbody").innerHTML = rows.length ? rows.map(c => `
    <tr>
      <td class="font-mono text-xs">${c.id}</td>
      <td class="text-sm">${escapeHTML(customerName(c.userId))}</td>
      <td class="text-xs capitalize">${c.source}${c.sourceRef ? ` · ${c.sourceRef}` : ""}</td>
      <td class="text-xs">${c.scratched ? rewardCardRewardText(c.rewardSnapshot) : "—"}</td>
      <td class="font-mono text-xs">${(c.scratched && c.rewardSnapshot.couponCode) ? escapeHTML(c.rewardSnapshot.couponCode) : "—"}</td>
      <td>${c.scratched ? `<span class="badge badge-good"><span class="badge-dot"></span>Revealed</span>` : `<span class="badge badge-warn"><span class="badge-dot"></span>Unopened</span>`}</td>
      <td class="text-xs text-[var(--alt-muted)]">${new Date(c.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="text-center text-sm text-[var(--alt-muted)] py-10">No scratch cards match this search.</td></tr>`;
  const totalPages = Math.max(1, Math.ceil(list.length / rvState.cardPerPage));
  document.getElementById("rv-cards-pagination").innerHTML = `
    <span>${list.length} card${list.length === 1 ? "" : "s"} · page ${rvState.cardPage} of ${totalPages}</span>
    <div class="flex gap-2">
      <button id="rv-cards-prev" class="adm-btn adm-btn-ghost" ${rvState.cardPage <= 1 ? "disabled style=opacity:.4" : ""}>Previous</button>
      <button id="rv-cards-next" class="adm-btn adm-btn-ghost" ${rvState.cardPage >= totalPages ? "disabled style=opacity:.4" : ""}>Next</button>
    </div>
  `;
  document.getElementById("rv-cards-prev").addEventListener("click", () => { if (rvState.cardPage > 1){ rvState.cardPage--; renderRvCardsTable(); } });
  document.getElementById("rv-cards-next").addEventListener("click", () => { if (rvState.cardPage < totalPages){ rvState.cardPage++; renderRvCardsTable(); } });
}

/* ---------------- Analytics ---------------- */
function renderRvAnalyticsTab(){
  const cards = allScratchCardsFlat();
  const scratched = cards.filter(c => c.scratched);
  const rewardCounts = {};
  scratched.forEach(c => {
    const key = c.rewardSnapshot.label;
    rewardCounts[key] = (rewardCounts[key] || 0) + 1;
  });
  const mostCommon = Object.entries(rewardCounts).sort((a, b) => b[1] - a[1])[0];
  const rewardCoupons = JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]").filter(c => c.source === "reward");
  const coinsGiven = scratched.filter(c => c.rewardSnapshot.type === "coins").reduce((s, c) => s + c.rewardSnapshot.value, 0);

  const stats = [
    { label: "Cards Issued", value: cards.length },
    { label: "Scratched", value: `${scratched.length} (${cards.length ? Math.round(scratched.length / cards.length * 100) : 0}%)` },
    { label: "Most Common Reward", value: mostCommon ? mostCommon[0] : "—" },
    { label: "Coupons Issued", value: rewardCoupons.length },
    { label: "Coupons Redeemed", value: rewardCoupons.filter(c => (c.usedCount || 0) > 0).length },
    { label: "Coins Given Out", value: coinsGiven },
  ];
  document.getElementById("rv-tab-content").innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      ${stats.map(s => `
        <div class="overview-card">
          <p class="font-display text-2xl font-medium">${s.value}</p>
          <p class="text-xs text-[var(--alt-muted)] mt-1">${s.label}</p>
        </div>
      `).join("")}
    </div>
  `;
}

/* Paste a Transaction ID (+ amount you actually received) and find the
   one pending wallet order it belongs to — no need to hunt it down in
   the table first. Mirrors verifyOrderPayment()'s match rules exactly. */
function quickVerifyPayment(){
  const txnInput = document.getElementById("qv-txn");
  const amountInput = document.getElementById("qv-amount");
  const resultEl = document.getElementById("qv-result");
  const txn = txnInput.value.trim();
  const amountRaw = amountInput.value.trim();
  resultEl.style.color = "var(--alt-bad)";
  if (!txn){ resultEl.textContent = "Paste the Transaction ID first."; return; }
  if (!amountRaw){ resultEl.textContent = "Enter the amount you received too."; return; }

  const candidates = allOrders().filter(o =>
    o.paymentVerification && o.paymentVerification.status === "pending" &&
    (o.paymentVerification.customerTxnId || "").trim().toLowerCase() === txn.toLowerCase()
  );
  if (candidates.length === 0){ resultEl.textContent = "No pending order found with that Transaction ID."; return; }
  if (candidates.length > 1){
    resultEl.style.color = "var(--alt-warn)";
    resultEl.textContent = `${candidates.length} pending orders share that Transaction ID — verify them individually from the table below.`;
    return;
  }

  const order = candidates[0];
  const result = verifyOrderPayment(order, { adminTxnId: txn, amountReceived: Number(amountRaw) });
  if (!result.ok){
    resultEl.textContent = !result.txnMatch ? "Transaction ID didn't match after all." : `Amount doesn't match order ${order.id}'s total (${fmtMoney(orderAmount(order))}).`;
    return;
  }

  logAudit("Payment verified (quick match)", `${order.id} — ${order.paymentMethod}`);
  resultEl.style.color = "var(--alt-good)";
  resultEl.textContent = `Verified — order ${order.id} for ${customerNameForOrder(order)} is now confirmed.`;
  txnInput.value = ""; amountInput.value = "";
  renderOrdersTable();
  renderSidebar();
  adminToast("Payment verified — order confirmed.");
}

function bulkUpdateOrders(statusSlug){
  const actionLabel = (ORDER_BULK_ACTIONS.find(a => a.slug === statusSlug) || {}).label || statusSlug;
  confirmAction({
    title: `${actionLabel} ${ordersState.selected.size} order(s)?`,
    body: `They will be marked as "${orderStatusMeta(statusSlug).label}" and the customer will be notified. This can be changed again later from each order's detail panel.`,
    confirmLabel: actionLabel,
    danger: (ORDER_BULK_ACTIONS.find(a => a.slug === statusSlug) || {}).danger,
    onConfirm(){
      ordersState.selected.forEach(id => {
        const o = getOrderById(id);
        if (o) advanceOrderStatus(o, statusSlug);
      });
      logAudit("Bulk order update", `${ordersState.selected.size} orders → ${orderStatusMeta(statusSlug).label}`);
      ordersState.selected.clear();
      renderOrdersTable();
      renderSidebar();
      adminToast("Orders updated.");
    },
  });
}

function openOrderDetail(id){
  const o = getOrderById(id);
  if (!o) return;
  const items = (o.items || []).map(it => `
    <div class="flex items-center gap-3 mb-3">
      <img src="${it.img || ""}" class="w-11 h-11 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" alt="">
      <div class="flex-1"><p class="text-sm">${it.name || "Unknown product"}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${[it.color, it.size].filter(Boolean).join(" · ")}${it.color || it.size ? " · " : ""}Qty ${it.qty}</p></div>
      <span class="text-sm font-mono">${fmtMoney((it.unitPrice || 0) * it.qty)}</span>
    </div>`).join("");
  const addr = a => a ? escapeHTML(`${a.street || ""}${a.apartment ? ", " + a.apartment : ""}, ${a.area || ""} ${a.upazila || ""}, ${a.district || ""}, ${a.division || ""} ${a.postal || ""}`.replace(/\s+,/g, ",").trim()) : "—";
  const timelineHTML = (o.timeline || []).map((step, i) => {
    const isCurrent = !step.done && (i === 0 || o.timeline[i - 1].done);
    return `
      <div class="timeline-row ${step.done ? "done" : ""} ${isCurrent ? "current" : ""}">
        <div class="timeline-dot">${step.done ? "✓" : ""}</div>
        <div>
          <p class="text-sm font-medium">${step.label}</p>
          <p class="text-xs text-[var(--alt-muted)] mt-0.5">${step.at ? new Date(step.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Pending"}</p>
        </div>
      </div>`;
  }).join("");
  const body = `
    <div class="mb-5">
      <div class="flex items-center justify-between mb-1"><span class="font-mono text-xs text-[var(--alt-muted)]">${o.id} · ${o.invoiceNumber || ""}</span>${orderStatusBadge(o.status)}</div>
      <p class="text-sm font-medium">${escapeHTML(customerNameForOrder(o))}</p>
      <p class="text-xs text-[var(--alt-muted)]">${escapeHTML((o.customer || {}).email || "")} ${escapeHTML((o.customer || {}).phone || "")}</p>
      <p class="text-xs text-[var(--alt-muted)] mt-1">${new Date(o.placedAt).toLocaleString()} · ${o.paymentMethod || ""} · ${o.paymentStatus} · ${o.deliveryMethod} delivery</p>
    </div>

    <div class="border-t border-[var(--alt-border)] pt-4 mb-5">${items}</div>

    <div class="text-sm space-y-1.5 border-t border-[var(--alt-border)] pt-4 mb-5">
      <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Subtotal</span><span class="font-mono">${fmtMoney(o.subtotal || 0)}</span></div>
      ${o.discount ? `<div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Discount${o.couponCode ? " (" + o.couponCode + ")" : ""}</span><span class="font-mono">-${fmtMoney(o.discount)}</span></div>` : ""}
      <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Shipping</span><span class="font-mono">${o.shipping ? fmtMoney(o.shipping) : "Free"}</span></div>
      <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Tax</span><span class="font-mono">${fmtMoney(o.tax || 0)}</span></div>
      <div class="flex items-center justify-between font-medium border-t border-[var(--alt-border)] pt-2 mt-1"><span>Total</span><span class="font-mono">${fmtMoney(orderAmount(o))}</span></div>
    </div>

    ${o.paymentVerification ? `
    <div class="mb-5 border-t border-[var(--alt-border)] pt-4">
      <p class="field-label mb-2">Manual Payment Verification</p>
      <div class="rounded-xl p-3 text-sm mb-3" style="background:var(--alt-surface);">
        <div class="flex items-center justify-between"><span class="text-[var(--alt-muted)]">Customer's Wallet Number</span><span class="font-mono">${escapeHTML(o.paymentVerification.walletNumber || "—")}</span></div>
        <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Transaction ID Submitted</span><span class="font-mono">${escapeHTML(o.paymentVerification.customerTxnId || "—")}</span></div>
        <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Amount Due</span><span class="font-mono">${fmtMoney(orderAmount(o))}</span></div>
        <div class="flex items-center justify-between mt-1"><span class="text-[var(--alt-muted)]">Status</span><span class="badge ${o.paymentVerification.status === "verified" ? "badge-good" : o.paymentVerification.status === "rejected" ? "badge-bad" : "badge-warn"}"><span class="badge-dot"></span>${o.paymentVerification.status}</span></div>
      </div>
      ${o.paymentVerification.status === "pending" ? `
        <label class="field-label">Transaction ID you received (from your ${o.paymentMethod} account)</label>
        <input id="pv-txn" class="field-input mb-2" placeholder="Paste the exact Transaction ID">
        <label class="field-label">Amount Received (৳)</label>
        <input id="pv-amount" type="number" step="0.01" class="field-input mb-2" placeholder="${orderAmount(o).toFixed(2)}">
        <p id="pv-error" class="text-xs mb-2" style="color:var(--alt-bad); display:none;"></p>
        <div class="flex gap-2">
          <button id="pv-verify" class="adm-btn adm-btn-primary flex-1">Verify &amp; Confirm Payment</button>
          <button id="pv-reject" class="adm-btn adm-btn-danger">Reject</button>
        </div>
      ` : `<p class="text-xs text-[var(--alt-muted)]">${o.paymentVerification.status === "verified" ? `Verified ${o.paymentVerification.verifiedAt ? new Date(o.paymentVerification.verifiedAt).toLocaleString() : ""}.` : `Rejected ${o.paymentVerification.rejectedAt ? new Date(o.paymentVerification.rejectedAt).toLocaleString() : ""}.`}</p>`}
    </div>
    ` : ""}

    <div class="grid grid-cols-2 gap-4 text-sm mb-5">
      <div><p class="field-label mb-1">Shipping Address</p><p class="text-xs">${addr(o.shippingAddress)}</p></div>
      <div><p class="field-label mb-1">Billing Address</p><p class="text-xs">${o.billingSameAsShipping ? "Same as shipping" : addr(o.billingAddress)}</p></div>
    </div>

    ${o.timeline && o.timeline.length ? `<div class="mb-5"><p class="field-label mb-2">Status Timeline</p>${timelineHTML}</div>` : ""}

    <div class="mb-5">
      <label class="field-label">Order Notes</label>
      <textarea id="ord-detail-notes" rows="2" class="field-input">${escapeHTML(o.notes || "")}</textarea>
    </div>

    <div>
      <label class="field-label">Update status</label>
      <select id="ord-detail-status" class="field-input">
        ${ORDER_STATUSES.map(s => `<option value="${s.slug}" ${o.status === s.slug ? "selected" : ""}>${s.label}</option>`).join("")}
      </select>
    </div>
  `;
  const foot = `<button id="ord-detail-invoice" class="adm-btn adm-btn-ghost">Invoice</button><button id="ord-detail-save" class="adm-btn adm-btn-primary flex-1">Save Changes</button>`;
  openDrawer(`Order ${o.id}`, body, foot);
  document.getElementById("ord-detail-invoice").addEventListener("click", () => downloadInvoice(o));
  if (o.paymentVerification && o.paymentVerification.status === "pending"){
    document.getElementById("pv-verify").addEventListener("click", () => {
      const result = verifyOrderPayment(o, { adminTxnId: document.getElementById("pv-txn").value, amountReceived: document.getElementById("pv-amount").value });
      const errEl = document.getElementById("pv-error");
      if (!result.ok){
        errEl.textContent = !result.txnMatch ? "Transaction ID doesn't match what the customer submitted." : "Amount received doesn't match the order total.";
        errEl.style.display = "block";
        return;
      }
      logAudit("Payment verified", `${o.id} — ${o.paymentMethod}`);
      closeDrawer();
      renderOrdersTable();
      renderSidebar();
      adminToast("Payment verified — order confirmed.");
    });
    document.getElementById("pv-reject").addEventListener("click", () => {
      confirmAction({
        title: `Reject payment for ${o.id}?`,
        body: "The customer will be notified that their payment couldn't be verified.",
        confirmLabel: "Reject Payment",
        danger: true,
        onConfirm(){
          rejectOrderPayment(o, "Transaction ID or amount could not be verified.");
          logAudit("Payment rejected", o.id);
          closeDrawer();
          renderOrdersTable();
          renderSidebar();
          adminToast("Payment rejected.");
        },
      });
    });
  }
  document.getElementById("ord-detail-save").addEventListener("click", () => {
    const newStatus = document.getElementById("ord-detail-status").value;
    o.notes = document.getElementById("ord-detail-notes").value;
    if (newStatus !== o.status) advanceOrderStatus(o, newStatus);
    else saveOrder(o);
    logAudit("Order updated", `${o.id} → ${orderStatusMeta(newStatus).label}`);
    closeDrawer();
    renderOrdersTable();
    renderSidebar();
    adminToast("Order updated.");
  });
}

function exportCSV(rows, fields, filename){
  const header = fields.join(",");
  const lines = rows.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  logAudit("Export", filename);
}

/* ================================================================
   PRODUCTS
   ================================================================ */
const productsState = { search: "", page: 1, perPage: 8 };

VIEW_RENDERERS.products = function(){
  document.getElementById("view-products").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Products</h2>
      <div class="flex items-center gap-2">
        <button id="prod-import" class="adm-btn adm-btn-ghost">Bulk Import</button>
        <button id="prod-export" class="adm-btn adm-btn-ghost">Bulk Export</button>
        <button id="prod-add" class="adm-btn adm-btn-primary">Add Product</button>
      </div>
    </div>
    <input id="prod-search" type="text" placeholder="Search products…" class="adm-input w-full mb-4" style="max-width:320px;" data-enter>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody id="prod-tbody"></tbody>
      </table>
    </div>
    <div id="prod-pagination" class="flex items-center justify-between mt-4 text-sm text-[var(--alt-muted)]"></div>
  `;
  document.getElementById("prod-search").addEventListener("input", e => { productsState.search = e.target.value; productsState.page = 1; renderProductsTable(); });
  document.getElementById("prod-add").addEventListener("click", () => openProductEditor(null));
  document.getElementById("prod-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(effectiveProducts(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "products-export.json"; a.click(); URL.revokeObjectURL(a.href);
    logAudit("Product export", `${effectiveProducts().length} products`);
  });
  document.getElementById("prod-import").addEventListener("click", openBulkImport);
  renderProductsTable();
};

function filteredProducts(){
  let list = effectiveProducts();
  if (productsState.search.trim()){
    const q = productsState.search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }
  return list;
}

function renderProductsTable(){
  const list = filteredProducts();
  const start = (productsState.page - 1) * productsState.perPage;
  const rows = list.slice(start, start + productsState.perPage);
  document.getElementById("prod-tbody").innerHTML = rows.length ? rows.map(p => `
    <tr>
      <td><img src="${p.img}" class="w-11 h-11 rounded-lg object-cover" loading="lazy" decoding="async" alt=""></td>
      <td><p class="text-sm">${p.name}</p><p class="text-xs text-[var(--alt-muted)] font-mono">#${p.id}</p></td>
      <td class="text-xs">${(p.tags || []).slice(0, 2).join(", ")}</td>
      <td class="font-mono">${fmtMoney(p.salePrice || p.price)}</td>
      <td><input type="number" min="0" class="adm-input prod-stock-input tabular" style="width:72px;" data-id="${p.id}" value="${p.stock}"></td>
      <td>${p.archived ? `<span class="badge badge-neutral"><span class="badge-dot"></span>Archived</span>` : p.stock === 0 ? `<span class="badge badge-bad"><span class="badge-dot"></span>Out of Stock</span>` : `<span class="badge badge-good"><span class="badge-dot"></span>Active</span>`}</td>
      <td>
        <div class="flex items-center gap-1">
          <button class="adm-icon-btn prod-edit" data-id="${p.id}" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="adm-icon-btn prod-dup" data-id="${p.id}" aria-label="Duplicate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
          <button class="adm-icon-btn prod-archive" data-id="${p.id}" aria-label="Archive"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 13h4"/></svg></button>
          <button class="adm-icon-btn prod-delete" data-id="${p.id}" aria-label="Delete" style="color:var(--alt-bad);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg></button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="text-center text-sm text-[var(--alt-muted)] py-10">No products match this search.</td></tr>`;

  document.querySelectorAll(".prod-stock-input").forEach(inp => {
    inp.addEventListener("change", () => {
      updateProduct(Number(inp.dataset.id) || inp.dataset.id, { stock: Math.max(0, Number(inp.value) || 0) });
      logAudit("Inventory update", `Product #${inp.dataset.id} → stock ${inp.value}`);
      adminToast("Stock updated.");
      renderSidebar();
    });
  });
  document.querySelectorAll(".prod-edit").forEach(btn => btn.addEventListener("click", () => openProductEditor(idOf(btn.dataset.id))));
  document.querySelectorAll(".prod-dup").forEach(btn => btn.addEventListener("click", () => duplicateProduct(idOf(btn.dataset.id))));
  document.querySelectorAll(".prod-archive").forEach(btn => btn.addEventListener("click", () => toggleArchiveProduct(idOf(btn.dataset.id))));
  document.querySelectorAll(".prod-delete").forEach(btn => btn.addEventListener("click", () => deleteProduct(idOf(btn.dataset.id))));

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

function openProductEditor(id){
  const isNew = id === null;
  const p = isNew ? { name: "", price: 0, stock: 0, tags: [], desc: "", img: "" } : effectiveProducts().find(x => x.id === id);
  const body = `
    <div class="mb-4"><label class="field-label">Name</label><input id="pe-name" class="field-input" value="${p.name || ""}"></div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Price (৳)</label><input id="pe-price" type="number" min="0" class="field-input" value="${p.price || 0}"></div>
      <div><label class="field-label">Stock</label><input id="pe-stock" type="number" min="0" class="field-input" value="${p.stock || 0}"></div>
    </div>
    <div class="mb-4"><label class="field-label">Category tags (comma separated)</label><input id="pe-tags" class="field-input" value="${(p.tags || []).join(", ")}"></div>
    <div class="mb-4"><label class="field-label">Image URL</label><input id="pe-img" class="field-input" value="${p.img || ""}"></div>
    <div><label class="field-label">Description</label><textarea id="pe-desc" rows="3" class="field-input">${p.desc || ""}</textarea></div>
  `;
  const foot = `<button id="pe-save" class="adm-btn adm-btn-primary flex-1">${isNew ? "Add Product" : "Save Changes"}</button>`;
  openDrawer(isNew ? "Add Product" : `Edit — ${p.name}`, body, foot);
  document.getElementById("pe-save").addEventListener("click", () => {
    const patch = {
      name: document.getElementById("pe-name").value.trim(),
      price: Number(document.getElementById("pe-price").value) || 0,
      stock: Math.max(0, Number(document.getElementById("pe-stock").value) || 0),
      tags: document.getElementById("pe-tags").value.split(",").map(s => s.trim()).filter(Boolean),
      img: document.getElementById("pe-img").value.trim(),
      desc: document.getElementById("pe-desc").value.trim(),
    };
    if (!patch.name){ adminToast("Product name is required."); return; }
    if (isNew){
      addProduct(Object.assign({ id: "a_" + Date.now(), brand: "Aesthetic Lifestyle Touch", rating: 0, reviews: 0, colors: [], specs: {} }, patch));
      logAudit("Product added", patch.name);
    } else {
      updateProduct(id, patch);
      logAudit("Product edited", patch.name);
    }
    closeDrawer();
    renderProductsTable();
    renderSidebar();
    adminToast(isNew ? "Product added." : "Product updated.");
  });
}
function duplicateProduct(id){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  const clone = Object.assign({}, p, { id: "a_" + Date.now(), name: `${p.name} (Copy)` });
  delete clone.archived;
  addProduct(clone);
  logAudit("Product duplicated", p.name);
  renderProductsTable();
  adminToast("Product duplicated.");
}
function toggleArchiveProduct(id){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  confirmAction({
    title: p.archived ? "Unarchive this product?" : "Archive this product?",
    body: p.archived ? "It will become visible in the storefront catalog again." : "It stays out of the storefront catalog but its data is kept.",
    confirmLabel: p.archived ? "Unarchive" : "Archive",
    onConfirm(){
      updateProduct(id, { archived: !p.archived });
      logAudit(p.archived ? "Product unarchived" : "Product archived", p.name);
      renderProductsTable();
      adminToast("Product updated.");
    },
  });
}
function deleteProduct(id){
  const p = effectiveProducts().find(x => x.id === id);
  if (!p) return;
  confirmAction({
    title: "Delete this product?",
    body: `"${p.name}" will be removed from every admin view. This can't be undone from here.`,
    confirmLabel: "Delete Product",
    danger: true,
    onConfirm(){
      updateProduct(id, { deleted: true });
      logAudit("Product deleted", p.name);
      renderProductsTable();
      renderSidebar();
      adminToast("Product deleted.");
    },
  });
}
function openBulkImport(){
  const body = `
    <p class="text-sm text-[var(--alt-muted)] mb-3">Paste a JSON array of products. Each needs at least <code class="font-mono text-xs">name</code>, <code class="font-mono text-xs">price</code>, and <code class="font-mono text-xs">stock</code>.</p>
    <textarea id="bi-textarea" rows="10" class="field-input font-mono text-xs" placeholder='[{"name":"New Item","price":49,"stock":10}]'></textarea>
    <p id="bi-error" class="text-xs text-[var(--alt-bad)] mt-2" style="display:none;"></p>
  `;
  const foot = `<button id="bi-submit" class="adm-btn adm-btn-primary flex-1">Import</button>`;
  openDrawer("Bulk Import Products", body, foot);
  document.getElementById("bi-submit").addEventListener("click", () => {
    const err = document.getElementById("bi-error");
    try {
      const parsed = JSON.parse(document.getElementById("bi-textarea").value);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
      parsed.forEach((item, i) => {
        if (!item.name || item.price == null) throw new Error(`Item ${i + 1} is missing name or price.`);
        addProduct(Object.assign({ id: "a_" + Date.now() + "_" + i, brand: "Aesthetic Lifestyle Touch", stock: 0, tags: [], rating: 0, reviews: 0, colors: [], specs: {} }, item));
      });
      logAudit("Bulk import", `${parsed.length} products`);
      closeDrawer();
      renderProductsTable();
      adminToast(`${parsed.length} product(s) imported.`);
    } catch (e){
      err.textContent = e.message;
      err.style.display = "block";
    }
  });
}

/* ================================================================
   INVENTORY
   ================================================================ */
VIEW_RENDERERS.inventory = function(){
  const products = [...effectiveProducts()].sort((a, b) => a.stock - b.stock);
  document.getElementById("view-inventory").innerHTML = `
    <div class="mb-5" data-enter><h2 class="font-display text-2xl font-medium">Inventory</h2><p class="text-sm text-[var(--alt-muted)] mt-1">Sorted by lowest stock first — reserved stock, incoming shipments, and warehouse routing are future-ready placeholders.</p></div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th>Product</th><th>Stock Qty</th><th>Reserved</th><th>Alert</th><th>Incoming</th><th>Warehouse</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><div class="flex items-center gap-3"><img src="${p.img}" class="w-9 h-9 rounded-lg object-cover" loading="lazy" decoding="async" alt=""><span class="text-sm">${p.name}</span></div></td>
              <td><input type="number" min="0" class="adm-input inv-stock-input tabular" style="width:72px;" data-id="${p.id}" value="${p.stock}"></td>
              <td class="text-xs text-[var(--alt-muted)] font-mono">0 <span class="future-tag">Future</span></td>
              <td>${p.stock === 0 ? `<span class="badge badge-bad"><span class="badge-dot"></span>Out of stock</span>` : p.stock <= 8 ? `<span class="badge badge-warn"><span class="badge-dot"></span>Low stock</span>` : `<span class="badge badge-good"><span class="badge-dot"></span>Healthy</span>`}</td>
              <td class="text-xs text-[var(--alt-muted)] font-mono">— <span class="future-tag">Future</span></td>
              <td class="text-xs text-[var(--alt-muted)] font-mono">Main <span class="future-tag">Future</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll(".inv-stock-input").forEach(inp => inp.addEventListener("change", () => {
    updateProduct(idOf(inp.dataset.id), { stock: Math.max(0, Number(inp.value) || 0) });
    logAudit("Inventory update", `Product #${inp.dataset.id} → stock ${inp.value}`);
    adminToast("Stock updated.");
    VIEW_RENDERERS.inventory();
    renderSidebar();
  }));
};

/* ================================================================
   CUSTOMERS
   ================================================================ */
const customersState = { search: "" };
VIEW_RENDERERS.customers = function(){
  document.getElementById("view-customers").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Customers</h2>
      <button id="cust-export" class="adm-btn adm-btn-ghost">Export CSV</button>
    </div>
    <input id="cust-search" type="text" placeholder="Search name or email…" class="adm-input w-full mb-4" style="max-width:320px;" data-enter>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime Spend</th><th>Wishlist</th><th>Status</th><th></th></tr></thead>
        <tbody id="cust-tbody"></tbody>
      </table>
    </div>
  `;
  document.getElementById("cust-search").addEventListener("input", e => { customersState.search = e.target.value; renderCustomersTable(); });
  document.getElementById("cust-export").addEventListener("click", () => exportCSV(Auth.users(), ["firstName","lastName","email","phone","createdAt"], "customers.csv"));
  renderCustomersTable();
};
function renderCustomersTable(){
  let users = Auth.users();
  if (customersState.search.trim()){
    const q = customersState.search.trim().toLowerCase();
    users = users.filter(u => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q));
  }
  const orders = allOrders();
  const notes = customerNotes();
  document.getElementById("cust-tbody").innerHTML = users.length ? users.map(u => {
    const own = orders.filter(o => o.userId === u.id);
    const spend = own.reduce((s, o) => s + orderAmount(o), 0);
    const isNew = Date.now() - u.createdAt < 30 * 86400000;
    return `
      <tr>
        <td><div class="flex items-center gap-3"><div class="avatar-circle" style="width:32px;height:32px;font-size:11px;">${escapeHTML((u.firstName[0] || "?").toUpperCase())}</div><span class="text-sm">${escapeHTML(u.firstName)} ${escapeHTML(u.lastName)}</span></div></td>
        <td class="text-xs">${escapeHTML(u.email)}</td>
        <td class="text-xs text-[var(--alt-muted)]">${escapeHTML(u.phone || "—")}</td>
        <td class="tabular">${own.length}</td>
        <td class="font-mono">${fmtMoney(spend)}</td>
        <td class="text-xs text-[var(--alt-muted)]" title="Wishlists aren't tracked per-account yet">—</td>
        <td>${isNew ? `<span class="badge badge-good"><span class="badge-dot"></span>New</span>` : `<span class="badge badge-neutral"><span class="badge-dot"></span>Active</span>`}</td>
        <td><button class="adm-icon-btn cust-view" data-id="${u.id}" aria-label="View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg></button></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="8" class="text-center text-sm text-[var(--alt-muted)] py-10">No customers match this search.</td></tr>`;
  document.querySelectorAll(".cust-view").forEach(btn => btn.addEventListener("click", () => openCustomerDetail(btn.dataset.id)));
}
/* Icon-only tier badge — reuses rewards-engine.js's loyaltyTier() (same
   Bronze→VIP ladder the customer sees in their own Reward Vault), so
   "regular customer" status here always matches what they'd see. */
const TIER_BADGE_COLOR = { bronze: "#9c6b3e", silver: "#8a8a8a", gold: "#b8901f", diamond: "#4a90b8", vip: "#0A0A0A" };
function customerTierBadge(userId){
  if (typeof loyaltyTier !== "function") return "";
  const { tier } = loyaltyTier(userId);
  const color = TIER_BADGE_COLOR[tier.slug] || "var(--alt-muted)";
  return `<span class="badge" style="background:${color}22; color:${color};"><span class="badge-dot" style="background:${color};"></span>${tier.label}</span>`;
}
function openCustomerDetail(userId){
  const u = Auth.users().find(x => x.id === userId);
  if (!u) return;
  const own = allOrders().filter(o => o.userId === userId);
  const spend = own.reduce((s, o) => s + orderAmount(o), 0);
  const notes = customerNotes();
  const coins = (typeof loyaltyAccount === "function") ? loyaltyAccount(userId) : { balance: 0 };

  const pendingOrders = own.filter(o => !["delivered", "cancelled", "returned", "refunded"].includes(o.status));
  const pendingReturns = (typeof returnRequestsForUser === "function")
    ? returnRequestsForUser(userId).filter(r => !RETURN_TERMINAL_STATUSES.some(s => s.slug === r.status) && r.status !== "completed") : [];
  const pendingCustomReqs = (typeof customRequestsForUser === "function")
    ? customRequestsForUser(userId).filter(r => !["completed", "cancelled", "rejected"].includes(r.status)) : [];
  const pendingItems = [
    ...pendingOrders.map(o => ({ label: `Order ${o.id}`, status: orderStatusMeta(o.status).label })),
    ...pendingReturns.map(r => ({ label: `Return ${r.id}`, status: (RETURN_ALL_STATUSES.find(s => s.slug === r.status) || {}).label || r.status })),
    ...pendingCustomReqs.map(r => ({ label: `Custom Request ${r.id}`, status: (CR_STATUSES.concat(CR_TERMINAL_STATUSES).find(s => s.slug === r.status) || {}).label || r.status })),
  ];

  const myCoupons = JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]").filter(c => c.customerId === userId);

  const body = `
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <div class="avatar-circle" style="width:48px;height:48px;font-size:16px;">${escapeHTML((u.firstName[0] || "?").toUpperCase())}</div>
      <div><p class="font-display text-lg">${escapeHTML(u.firstName)} ${escapeHTML(u.lastName)}</p><p class="text-xs text-[var(--alt-muted)]">${escapeHTML(u.email)}${u.phone ? " · " + escapeHTML(u.phone) : ""}</p></div>
      <div class="ml-auto">${customerTierBadge(userId)}</div>
    </div>
    <div class="grid grid-cols-4 gap-2 mb-5 text-center">
      <div class="panel" style="padding:12px;"><p class="stat-value tabular" style="font-size:1.1rem;">${own.length}</p><p class="stat-label">Orders</p></div>
      <div class="panel" style="padding:12px;"><p class="stat-value tabular" style="font-size:1.1rem;">${fmtMoney(spend)}</p><p class="stat-label">Spend</p></div>
      <div class="panel" style="padding:12px;"><p class="stat-value tabular" style="font-size:1.1rem;">${fmtMoney(coins.balance || 0)}</p><p class="stat-label">Store Credit</p></div>
      <div class="panel" style="padding:12px;"><p class="stat-value tabular" style="font-size:1.1rem;">${new Date(u.createdAt).getFullYear()}</p><p class="stat-label">Since</p></div>
    </div>

    <div class="mb-5">
      <p class="field-label">Pending / Needs Attention</p>
      ${pendingItems.length ? pendingItems.map(p => `<div class="flex items-center justify-between text-sm mb-2"><span class="font-mono text-xs">${escapeHTML(p.label)}</span><span class="badge badge-warn"><span class="badge-dot"></span>${escapeHTML(p.status)}</span></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">Nothing pending — all caught up.</p>`}
    </div>

    <div class="mb-5">
      <p class="field-label">Coupons Won / Assigned</p>
      ${myCoupons.length ? myCoupons.map(c => `<div class="flex items-center justify-between text-sm mb-2"><span class="font-mono text-xs">${escapeHTML(c.code)}</span><span class="text-xs text-[var(--alt-muted)]">${c.type === "percentage" ? c.value + "% off" : c.type === "fixed" ? fmtMoney(c.value) + " off" : "Free shipping"}</span>${(c.usedCount || 0) > 0 ? `<span class="badge badge-neutral"><span class="badge-dot"></span>Used</span>` : `<span class="badge badge-good"><span class="badge-dot"></span>Active</span>`}</div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No reward coupons yet.</p>`}
    </div>

    <div class="mb-5">
      <label class="field-label">Message this customer</label>
      <p class="text-xs text-[var(--alt-muted)] mb-2">Sent as a notification straight to their account — the closest thing to a direct line without a live-chat backend.</p>
      <textarea id="cust-message" rows="2" class="field-input" placeholder="Type a message…"></textarea>
      <button id="cust-message-send" class="adm-btn adm-btn-ghost mt-2 w-full">Send Message</button>
    </div>

    <div class="mb-5">
      <label class="field-label">Admin notes (private, only visible here)</label>
      <textarea id="cust-note" rows="3" class="field-input">${escapeHTML(notes[userId] || "")}</textarea>
    </div>
    <div>
      <p class="field-label">Recent Orders</p>
      ${own.slice(0, 5).map(o => `<div class="flex items-center justify-between text-sm mb-2"><span class="font-mono text-xs">${o.id}</span><span class="text-xs text-[var(--alt-muted)] truncate" style="max-width:140px;">${escapeHTML((o.items || []).map(it => it.name).join(", "))}</span>${orderStatusBadge(o.status)}<span class="font-mono">${fmtMoney(orderAmount(o))}</span></div>`).join("") || `<p class="text-sm text-[var(--alt-muted)]">No orders yet.</p>`}
    </div>
  `;
  const foot = `<button id="cust-note-save" class="adm-btn adm-btn-primary flex-1">Save Note</button>`;
  openDrawer(`${u.firstName} ${u.lastName}`, body, foot);
  document.getElementById("cust-message-send").addEventListener("click", () => {
    const text = document.getElementById("cust-message").value.trim();
    if (!text) return;
    pushCustomerNotification(userId, { category: "Admin Message", title: "Message from Aesthetic Lifestyle Touch", body: text });
    document.getElementById("cust-message").value = "";
    adminToast("Message sent.");
  });
  document.getElementById("cust-note-save").addEventListener("click", () => {
    saveCustomerNote(userId, document.getElementById("cust-note").value);
    adminToast("Note saved.");
    closeDrawer();
  });
}

/* ================================================================
   REVIEWS
   ================================================================ */
VIEW_RENDERERS.reviews = function(){
  const reviews = [...allReviews()].sort((a, b) => b.at - a.at);
  document.getElementById("view-reviews").innerHTML = `
    <div class="mb-5" data-enter><h2 class="font-display text-2xl font-medium">Reviews</h2><p class="text-sm text-[var(--alt-muted)] mt-1">Real customer submissions land here as Pending — approve to publish them on the product page, reject to hide them.</p></div>
    <div class="space-y-4">
      ${reviews.map(r => `
        <div class="panel" data-enter>
          <div class="flex items-start justify-between gap-3 mb-2">
            <div>
              <p class="text-sm font-medium">${escapeHTML(r.productName)}</p>
              <p class="text-xs text-[var(--alt-muted)] font-mono">${escapeHTML(r.author)} · ${new Date(r.at).toLocaleDateString()}</p>
            </div>
            <div class="flex items-center gap-2">
              ${r.pinned ? `<span class="badge badge-neutral"><span class="badge-dot"></span>Pinned</span>` : ""}
              <span class="badge ${r.status === "approved" ? "badge-good" : r.status === "rejected" ? "badge-bad" : "badge-warn"}"><span class="badge-dot"></span>${r.status}</span>
            </div>
          </div>
          <p class="text-sm mb-2">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</p>
          <p class="text-sm text-[var(--alt-muted)] mb-3">${escapeHTML(r.text)}</p>
          ${r.photos && r.photos.length ? `<div class="flex items-center gap-2 mb-3">${r.photos.map(src => `<img src="${src}" alt="Attached photo" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0;">`).join("")}</div>` : ""}
          ${r.reply ? `<div class="bg-[var(--alt-surface)] rounded-xl p-3 text-xs mb-3"><strong>Store reply:</strong> ${escapeHTML(r.reply)}</div>` : ""}
          <div class="flex items-center gap-2 flex-wrap">
            <button class="adm-chip rev-approve" data-id="${r.id}">Approve</button>
            <button class="adm-chip rev-reject" data-id="${r.id}">Reject</button>
            <button class="adm-chip rev-pin" data-id="${r.id}">${r.pinned ? "Unpin" : "Pin Featured"}</button>
            <button class="adm-chip rev-reply" data-id="${r.id}">Reply</button>
            <span class="future-tag ml-auto">Report Abuse — Future</span>
          </div>
        </div>
      `).join("") || `<p class="text-sm text-[var(--alt-muted)]">No reviews yet.</p>`}
    </div>
  `;
  document.querySelectorAll(".rev-approve").forEach(b => b.addEventListener("click", () => setReviewStatus(b.dataset.id, "approved")));
  document.querySelectorAll(".rev-reject").forEach(b => b.addEventListener("click", () => setReviewStatus(b.dataset.id, "rejected")));
  document.querySelectorAll(".rev-pin").forEach(b => b.addEventListener("click", () => toggleReviewPin(b.dataset.id)));
  document.querySelectorAll(".rev-reply").forEach(b => b.addEventListener("click", () => openReviewReply(b.dataset.id)));
};
function setReviewStatus(id, status){
  const list = allReviews();
  const r = list.find(x => x.id === id);
  if (!r) return;
  r.status = status;
  saveReviews(list);
  logAudit("Review moderated", `${r.productName} → ${status}`);
  VIEW_RENDERERS.reviews();
  renderSidebar();
  adminToast(`Review ${status}.`);
}
function toggleReviewPin(id){
  const list = allReviews();
  const r = list.find(x => x.id === id);
  if (!r) return;
  r.pinned = !r.pinned;
  saveReviews(list);
  VIEW_RENDERERS.reviews();
  adminToast(r.pinned ? "Review pinned." : "Review unpinned.");
}
function openReviewReply(id){
  const list = allReviews();
  const r = list.find(x => x.id === id);
  if (!r) return;
  const body = `<label class="field-label">Reply to ${escapeHTML(r.author)}</label><textarea id="rev-reply-text" rows="4" class="field-input">${escapeHTML(r.reply || "")}</textarea>`;
  const foot = `<button id="rev-reply-save" class="adm-btn adm-btn-primary flex-1">Post Reply</button>`;
  openDrawer("Reply to Review", body, foot);
  document.getElementById("rev-reply-save").addEventListener("click", () => {
    r.reply = document.getElementById("rev-reply-text").value.trim();
    saveReviews(list);
    logAudit("Review reply posted", r.productName);
    closeDrawer();
    VIEW_RENDERERS.reviews();
    adminToast("Reply posted.");
  });
}

/* ================================================================
   COUPONS
   Same store (alt_admin_coupons_v1) the Reward Vault writes scratch-
   card winnings into, so this one list covers both manually-created
   codes and reward-issued ones — the Customer column and search box
   are what make "which customer got which coupon" answerable here
   instead of only in the Reward Vault's Cards tab.
   ================================================================ */
const couponsState = { search: "" };
VIEW_RENDERERS.coupons = function(){
  document.getElementById("view-coupons").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Coupons</h2>
      <button id="cpn-add" class="adm-btn adm-btn-primary">Create Coupon</button>
    </div>
    <p class="text-sm text-[var(--alt-muted)] mb-4" data-enter>Active coupons here are honored at checkout automatically — the storefront checks this list alongside its built-in codes. Codes won from a scratch card are locked to the customer shown and can only be used once.</p>
    <input id="cpn-search" type="text" placeholder="Search code or customer…" class="adm-input w-full mb-4" style="max-width:320px;" value="${escapeHTML(couponsState.search)}" data-enter>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th>Code</th><th>Customer</th><th>Type</th><th>Value</th><th>Min Purchase</th><th>Expiry</th><th>Usage</th><th>Active</th><th></th></tr></thead>
        <tbody id="cpn-tbody"></tbody>
      </table>
    </div>
  `;
  document.getElementById("cpn-add").addEventListener("click", () => openCouponEditor());
  document.getElementById("cpn-search").addEventListener("input", e => { couponsState.search = e.target.value; renderCouponsTable(); });
  renderCouponsTable();
};
function renderCouponsTable(){
  let coupons = allCoupons();
  if (couponsState.search.trim()){
    const q = couponsState.search.trim().toLowerCase();
    coupons = coupons.filter(c => `${c.code} ${c.customerId ? customerName(c.customerId) : ""}`.toLowerCase().includes(q));
  }
  document.getElementById("cpn-tbody").innerHTML = coupons.length ? coupons.map(c => `
    <tr>
      <td class="font-mono">${escapeHTML(c.code)}</td>
      <td class="text-xs">${c.customerId ? escapeHTML(customerName(c.customerId)) : `<span class="text-[var(--alt-muted)]">Anyone</span>`}</td>
      <td class="text-xs capitalize">${c.type.replace("-", " ")}</td>
      <td class="font-mono">${c.type === "percentage" ? c.value + "%" : c.type === "fixed" ? fmtMoney(c.value) : "—"}</td>
      <td class="font-mono text-xs">${c.minPurchase ? fmtMoney(c.minPurchase) : "—"}</td>
      <td class="text-xs text-[var(--alt-muted)]">${c.expiry ? new Date(c.expiry).toLocaleDateString() : "No expiry"}</td>
      <td class="text-xs font-mono">${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
      <td><button class="toggle cpn-toggle ${c.active ? "on" : ""}" data-code="${c.code}"><span class="toggle-knob"></span></button></td>
      <td class="flex items-center gap-1">
        <button class="adm-icon-btn cpn-edit" data-code="${c.code}" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
        <button class="adm-icon-btn cpn-delete" data-code="${c.code}" style="color:var(--alt-bad);" aria-label="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg></button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="text-center text-sm text-[var(--alt-muted)] py-10">No coupons match this search.</td></tr>`;
  document.querySelectorAll(".cpn-toggle").forEach(btn => btn.addEventListener("click", () => {
    const list = allCoupons();
    const c = list.find(x => x.code === btn.dataset.code);
    c.active = !c.active;
    saveCoupons(list);
    logAudit("Coupon toggled", `${c.code} → ${c.active ? "active" : "inactive"}`);
    renderCouponsTable();
  }));
  document.querySelectorAll(".cpn-edit").forEach(btn => btn.addEventListener("click", () => {
    const c = allCoupons().find(x => x.code === btn.dataset.code);
    if (c) openCouponEditor(c);
  }));
  document.querySelectorAll(".cpn-delete").forEach(btn => btn.addEventListener("click", () => {
    confirmAction({
      title: `Delete ${btn.dataset.code}?`, body: "Customers will no longer be able to redeem this code.",
      confirmLabel: "Delete Coupon", danger: true,
      onConfirm(){
        saveCoupons(allCoupons().filter(c => c.code !== btn.dataset.code));
        logAudit("Coupon deleted", btn.dataset.code);
        renderCouponsTable();
        adminToast("Coupon deleted.");
      },
    });
  }));
}
/* Pass an existing coupon to edit it in place (code included — the
   offer AND the code itself both need to stay easily changeable from
   here, including for scratch-card-won codes); omit it to create new. */
function openCouponEditor(existing){
  const isEdit = !!existing;
  const body = `
    ${isEdit && existing.customerId ? `<div class="mb-4 text-xs px-3 py-2 rounded-lg" style="background:var(--alt-surface);">Locked to <strong>${escapeHTML(customerName(existing.customerId))}</strong> — won from a scratch card.</div>` : ""}
    <div class="mb-4"><label class="field-label">Code</label><input id="cp-code" class="field-input font-mono" placeholder="SUMMER20" value="${isEdit ? escapeHTML(existing.code) : ""}"></div>
    <div class="mb-4"><label class="field-label">Type</label>
      <select id="cp-type" class="field-input">
        <option value="percentage" ${isEdit && existing.type === "percentage" ? "selected" : ""}>Percentage Discount</option>
        <option value="fixed" ${isEdit && existing.type === "fixed" ? "selected" : ""}>Fixed Discount</option>
        <option value="free-shipping" ${isEdit && existing.type === "free-shipping" ? "selected" : ""}>Free Shipping</option>
      </select>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Value</label><input id="cp-value" type="number" min="0" class="field-input" value="${isEdit ? existing.value : 10}"></div>
      <div><label class="field-label">Min Purchase (৳)</label><input id="cp-min" type="number" min="0" class="field-input" value="${isEdit ? (existing.minPurchase || 0) : 0}"></div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div><label class="field-label">Usage Limit</label><input id="cp-limit" type="number" min="0" class="field-input" placeholder="No limit" value="${isEdit && existing.usageLimit ? existing.usageLimit : ""}"></div>
      <div><label class="field-label">Expiry Date</label><input id="cp-expiry" type="date" class="field-input" value="${isEdit && existing.expiry ? new Date(existing.expiry).toISOString().slice(0, 10) : ""}"></div>
    </div>
  `;
  const foot = `<button id="cp-save" class="adm-btn adm-btn-primary flex-1">${isEdit ? "Save Changes" : "Create Coupon"}</button>`;
  openDrawer(isEdit ? "Edit Coupon" : "Create Coupon", body, foot);
  document.getElementById("cp-save").addEventListener("click", () => {
    const code = document.getElementById("cp-code").value.trim().toUpperCase();
    if (!code){ adminToast("Enter a coupon code."); return; }
    const list = allCoupons();
    const clash = list.find(c => c.code === code);
    if (clash && (!isEdit || clash.code !== existing.code)){ adminToast("That code already exists."); return; }
    const fields = {
      code, type: document.getElementById("cp-type").value,
      value: Number(document.getElementById("cp-value").value) || 0,
      minPurchase: Number(document.getElementById("cp-min").value) || 0,
      usageLimit: Number(document.getElementById("cp-limit").value) || null,
      expiry: document.getElementById("cp-expiry").value ? new Date(document.getElementById("cp-expiry").value).getTime() : null,
    };
    if (isEdit){
      const c = list.find(x => x.code === existing.code);
      Object.assign(c, fields);
      saveCoupons(list);
      logAudit("Coupon edited", code);
      adminToast("Coupon updated.");
    } else {
      list.push(Object.assign({ usedCount: 0, active: true }, fields));
      saveCoupons(list);
      logAudit("Coupon created", code);
      adminToast("Coupon created.");
    }
    closeDrawer();
    renderCouponsTable();
  });
}

/* ================================================================
   NOTIFICATIONS
   ================================================================ */
const notifState = { category: "all", search: "" };
VIEW_RENDERERS.notifications = function(){
  document.getElementById("view-notifications").innerHTML = `
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3" data-enter>
      <h2 class="font-display text-2xl font-medium">Notifications</h2>
      <button id="notif-read-all" class="adm-btn adm-btn-ghost">Mark All Read</button>
    </div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <input id="notif-search" type="text" placeholder="Search notifications…" class="adm-input" style="min-width:220px;">
      ${["all","New Orders","Low Stock","Support Tickets","Customer Messages","Custom Requests","Returns"].map(c => `<button class="adm-chip notif-chip ${notifState.category === c || (c === "all" && notifState.category === "all") ? "active" : ""}" data-cat="${c}">${c === "all" ? "All" : c}</button>`).join("")}
    </div>
    <div id="notif-list" class="space-y-2" data-enter></div>
  `;
  document.getElementById("notif-read-all").addEventListener("click", () => {
    adminNotifications().forEach(n => markNotifRead(n.id));
    renderNotifList();
    renderSidebar();
  });
  document.getElementById("notif-search").addEventListener("input", e => { notifState.search = e.target.value; renderNotifList(); });
  document.querySelectorAll(".notif-chip").forEach(btn => btn.addEventListener("click", () => { notifState.category = btn.dataset.cat; VIEW_RENDERERS.notifications(); }));
  renderNotifList();
};
function renderNotifList(){
  let list = adminNotifications();
  if (notifState.category !== "all") list = list.filter(n => n.category === notifState.category);
  if (notifState.search.trim()){
    const q = notifState.search.trim().toLowerCase();
    list = list.filter(n => (n.title + n.body).toLowerCase().includes(q));
  }
  document.getElementById("notif-list").innerHTML = list.length ? list.map(n => `
    <div class="panel flex items-start gap-3" style="padding:16px;">
      <span class="badge-dot mt-1.5" style="width:8px;height:8px;border-radius:999px;background:${n.read ? "var(--alt-border)" : "var(--alt-black)"};flex-shrink:0;"></span>
      <div class="flex-1 min-w-0">
        <p class="text-sm ${n.read ? "" : "font-medium"}">${escapeHTML(n.title)}</p>
        <p class="text-xs text-[var(--alt-muted)] mt-0.5">${escapeHTML(n.body)} · ${timeAgo(n.at)}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${!n.read ? `<button class="adm-icon-btn notif-read" data-id="${n.id}" aria-label="Mark read"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg></button>` : ""}
        <button class="adm-icon-btn notif-archive" data-id="${n.id}" aria-label="Archive"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/></svg></button>
      </div>
    </div>
  `).join("") : `<p class="text-sm text-[var(--alt-muted)]">Nothing here.</p>`;
  document.querySelectorAll(".notif-read").forEach(b => b.addEventListener("click", () => { markNotifRead(b.dataset.id); renderNotifList(); renderSidebar(); }));
  document.querySelectorAll(".notif-archive").forEach(b => b.addEventListener("click", () => { archiveNotif(b.dataset.id); renderNotifList(); renderSidebar(); }));
}

/* ================================================================
   SUPPORT
   ================================================================ */
const supportState = { status: "all", priority: "all", search: "" };
VIEW_RENDERERS.support = function(){
  document.getElementById("view-support").innerHTML = `
    <div class="mb-5" data-enter><h2 class="font-display text-2xl font-medium">Support Center</h2><p class="text-sm text-[var(--alt-muted)] mt-1">Every ticket submitted through the storefront's Contact page, across all customers.</p></div>
    <div class="flex items-center gap-2 mb-4 flex-wrap" data-enter>
      <input id="sup-search" type="text" placeholder="Search tickets…" class="adm-input" style="min-width:220px;">
      <button class="adm-chip sup-status ${supportState.status === "all" ? "active" : ""}" data-status="all">All</button>
      <button class="adm-chip sup-status ${supportState.status === "Open" ? "active" : ""}" data-status="Open">Open</button>
      <button class="adm-chip sup-status ${supportState.status === "Resolved" ? "active" : ""}" data-status="Resolved">Resolved</button>
    </div>
    <div class="adm-table-wrap" data-enter>
      <table class="adm-table">
        <thead><tr><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody id="sup-tbody"></tbody>
      </table>
    </div>
  `;
  document.getElementById("sup-search").addEventListener("input", e => { supportState.search = e.target.value; renderSupportTable(); });
  document.querySelectorAll(".sup-status").forEach(btn => btn.addEventListener("click", () => { supportState.status = btn.dataset.status; VIEW_RENDERERS.support(); }));
  renderSupportTable();
};
function renderSupportTable(){
  let list = allTickets();
  const meta = ticketMeta();
  if (supportState.status !== "all") list = list.filter(t => t.status === supportState.status);
  if (supportState.search.trim()){
    const q = supportState.search.trim().toLowerCase();
    list = list.filter(t => (t.subject + t.message).toLowerCase().includes(q));
  }
  document.getElementById("sup-tbody").innerHTML = list.length ? list.map(t => {
    const m = meta[t.id] || { priority: "Normal" };
    return `
      <tr>
        <td><p class="text-sm">${escapeHTML(t.subject)}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${t.id}</p></td>
        <td class="text-xs">${customerName(t.userId)}</td>
        <td><span class="badge ${m.priority === "Urgent" ? "badge-bad" : m.priority === "High" ? "badge-warn" : "badge-neutral"}"><span class="badge-dot"></span>${m.priority}</span></td>
        <td>${t.status === "Open" ? `<span class="badge badge-warn"><span class="badge-dot"></span>Open</span>` : `<span class="badge badge-good"><span class="badge-dot"></span>Resolved</span>`}</td>
        <td class="text-xs text-[var(--alt-muted)]">${new Date(t.at).toLocaleDateString()}</td>
        <td><button class="adm-icon-btn sup-view" data-id="${t.id}" data-user="${t.userId}" aria-label="View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg></button></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6" class="text-center text-sm text-[var(--alt-muted)] py-10">No tickets match this filter.</td></tr>`;
  document.querySelectorAll(".sup-view").forEach(btn => btn.addEventListener("click", () => openTicketDetail(btn.dataset.id, btn.dataset.user)));
}
function openTicketDetail(id, userId){
  const list = allTickets();
  const t = list.find(x => x.id === id && x.userId === userId);
  if (!t) return;
  const meta = ticketMeta();
  const m = meta[id] || { priority: "Normal" };
  const body = `
    <p class="text-xs text-[var(--alt-muted)] font-mono mb-1">${t.id} · ${customerName(userId)}</p>
    <p class="font-display text-lg mb-3">${escapeHTML(t.subject)}</p>
    <p class="text-sm text-[var(--alt-muted)] mb-5">${escapeHTML(t.message)}</p>
    <div class="mb-4">
      <label class="field-label">Priority</label>
      <select id="tk-priority" class="field-input">
        ${["Low","Normal","High","Urgent"].map(p => `<option ${m.priority === p ? "selected" : ""}>${p}</option>`).join("")}
      </select>
    </div>
    <div><label class="field-label">Status</label>
      <select id="tk-status" class="field-input">
        <option ${t.status === "Open" ? "selected" : ""}>Open</option>
        <option ${t.status === "Resolved" ? "selected" : ""}>Resolved</option>
      </select>
    </div>
  `;
  const foot = `<button id="tk-save" class="adm-btn adm-btn-primary flex-1">Save Changes</button>`;
  openDrawer("Support Ticket", body, foot);
  document.getElementById("tk-save").addEventListener("click", () => {
    t.status = document.getElementById("tk-status").value;
    saveTicket(Object.assign({ userId }, t));
    setTicketMeta(id, { priority: document.getElementById("tk-priority").value });
    logAudit("Ticket updated", `${t.id} → ${t.status}`);
    closeDrawer();
    renderSupportTable();
    renderSidebar();
    adminToast("Ticket updated.");
  });
}

/* ================================================================
   STAFF — future-ready preview only; single-owner session today.
   ================================================================ */
const STAFF_ROLES = [
  { role: "Owner", perms: [1,1,1,1,1,1] },
  { role: "Administrator", perms: [1,1,1,1,1,0] },
  { role: "Manager", perms: [1,1,1,0,1,0] },
  { role: "Customer Support", perms: [0,1,0,0,1,0] },
  { role: "Warehouse", perms: [0,0,1,0,0,0] },
  { role: "Marketing", perms: [0,0,0,1,0,1] },
];
const STAFF_PERM_COLS = ["Orders","Customers","Inventory","Coupons","Support","Analytics"];
VIEW_RENDERERS.staff = function(){
  document.getElementById("view-staff").innerHTML = `
    <div class="mb-5" data-enter>
      <h2 class="font-display text-2xl font-medium">Staff Management <span class="future-tag ml-1">Future</span></h2>
      <p class="text-sm text-[var(--alt-muted)] mt-1">Multi-admin accounts and enforced permissions aren't wired up yet — today's session always runs as Owner. This previews the intended role model.</p>
    </div>
    <div class="adm-table-wrap mb-5" data-enter>
      <table class="adm-table">
        <thead><tr><th>Role</th>${STAFF_PERM_COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>
          ${STAFF_ROLES.map(r => `<tr><td class="text-sm">${r.role}</td>${r.perms.map(p => `<td>${p ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--alt-good)" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>` : `<span class="text-[var(--alt-border)]">—</span>`}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
    <button id="staff-invite" class="adm-btn adm-btn-ghost" data-enter>Invite Teammate</button>
  `;
  document.getElementById("staff-invite").addEventListener("click", () => adminToast("Multi-admin invites are coming soon."));
};

/* ================================================================
   SETTINGS
   ================================================================ */
VIEW_RENDERERS.settings = function(){
  const s = storeSettings();
  document.getElementById("view-settings").innerHTML = `
    <div class="mb-6" data-enter><h2 class="font-display text-2xl font-medium">Settings</h2></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Store & Brand</p>
        <div class="mb-3"><label class="field-label">Store Name</label><input id="st-name" class="field-input" value="${s.storeName}"></div>
        <div class="mb-3"><label class="field-label">Support Email</label><input id="st-email" type="email" class="field-input" value="${s.supportEmail}"></div>
        <div class="mb-3"><label class="field-label">Language</label>
          <select id="st-lang" class="field-input"><option ${s.language==="English"?"selected":""}>English</option><option ${s.language==="Bengali"?"selected":""}>Bengali</option><option ${s.language==="Spanish"?"selected":""}>Spanish</option></select>
        </div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Shipping, Tax & Currency</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div><label class="field-label">Currency</label>
            <select id="st-currency" class="field-input"><option ${s.currency==="USD"?"selected":""}>USD</option><option ${s.currency==="BDT"?"selected":""}>BDT</option><option ${s.currency==="EUR"?"selected":""}>EUR</option></select>
          </div>
          <div><label class="field-label">Tax Rate (%)</label><input id="st-tax" type="number" min="0" class="field-input" value="${s.taxRate}"></div>
        </div>
        <div class="mb-4"><label class="field-label">Free Shipping Over (৳)</label><input id="st-freeship" type="number" min="0" class="field-input" value="${s.freeShippingThreshold}"></div>
        <p class="field-label mb-2">Delivery Methods — priced by zone</p>
        <div class="grid grid-cols-[1fr_1fr_70px_70px] gap-2 text-xs text-[var(--alt-muted)] mb-1 px-1">
          <span>Label</span><span>ETA text</span><span>Dhaka ৳</span><span>Outside ৳</span>
        </div>
        <div class="grid grid-cols-[1fr_1fr_70px_70px] gap-2 mb-2">
          <input id="st-dm-standard-label" class="field-input" value="${(s.deliveryMethods[0]||{}).label || "Standard Delivery"}">
          <input id="st-dm-standard-eta" class="field-input" value="${(s.deliveryMethods[0]||{}).eta || "3–5 business days"}">
          <input id="st-dm-standard-price-dhaka" type="number" min="0" class="field-input" value="${(s.deliveryMethods[0]||{}).priceDhaka ?? 60}">
          <input id="st-dm-standard-price-outside" type="number" min="0" class="field-input" value="${(s.deliveryMethods[0]||{}).priceOutside ?? 120}">
        </div>
        <div class="grid grid-cols-[1fr_1fr_70px_70px] gap-2">
          <input id="st-dm-express-label" class="field-input" value="${(s.deliveryMethods[1]||{}).label || "Express Delivery"}">
          <input id="st-dm-express-eta" class="field-input" value="${(s.deliveryMethods[1]||{}).eta || "1–2 business days"}">
          <input id="st-dm-express-price-dhaka" type="number" min="0" class="field-input" value="${(s.deliveryMethods[1]||{}).priceDhaka ?? 120}">
          <input id="st-dm-express-price-outside" type="number" min="0" class="field-input" value="${(s.deliveryMethods[1]||{}).priceOutside ?? 200}">
        </div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Notification Preferences</p>
        <div class="flex items-center justify-between mb-3"><span class="text-sm">New order alerts</span><button class="toggle st-toggle ${s.notifyNewOrders ? "on" : ""}" data-key="notifyNewOrders"><span class="toggle-knob"></span></button></div>
        <div class="flex items-center justify-between mb-3"><span class="text-sm">Low stock alerts</span><button class="toggle st-toggle ${s.notifyLowStock ? "on" : ""}" data-key="notifyLowStock"><span class="toggle-knob"></span></button></div>
        <div class="flex items-center justify-between"><span class="text-sm">Support ticket alerts</span><button class="toggle st-toggle ${s.notifyTickets ? "on" : ""}" data-key="notifyTickets"><span class="toggle-knob"></span></button></div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Manual Wallet Payments</p>
        <p class="text-sm text-[var(--alt-muted)] mb-3">No live payment gateway is connected yet. Customers send money straight to these numbers and submit a Transaction ID at checkout — you verify it against what you actually receive from each order's detail panel.</p>
        <div class="mb-3"><label class="field-label">bKash Number</label><input id="st-wn-bkash" class="field-input" value="${s.walletNumbers.bkash}" placeholder="01XXXXXXXXX"></div>
        <div class="mb-3"><label class="field-label">Nagad Number</label><input id="st-wn-nagad" class="field-input" value="${s.walletNumbers.nagad}" placeholder="01XXXXXXXXX"></div>
        <div class="mb-4"><label class="field-label">Rocket Number</label><input id="st-wn-rocket" class="field-input" value="${s.walletNumbers.rocket}" placeholder="01XXXXXXXXX"></div>
        <div class="flex items-center justify-between mb-2"><span class="text-sm">Card Gateway API Keys</span><span class="future-tag">Future</span></div>
        <div class="flex items-center justify-between"><span class="text-sm">Email Template Delivery</span><span class="future-tag">Future</span></div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Custom Product Requests</p>
        <p class="text-sm text-[var(--alt-muted)] mb-3">The percentage of a quotation's total customers must pay upfront to confirm a custom order. Applied automatically to every new quotation.</p>
        <label class="field-label">Required Advance Payment (%)</label>
        <input id="st-cr-advance" type="number" min="1" max="100" class="field-input max-w-xs" value="${s.customRequestAdvancePercent}">
      </div>
      <div class="panel" data-enter>
        <div class="flex items-center justify-between mb-3">
          <p class="panel-title">Loyalty Points</p>
          <button class="toggle st-toggle ${s.loyaltyEnabled ? "on" : ""}" data-key="loyaltyEnabled"><span class="toggle-knob"></span></button>
        </div>
        <p class="text-sm text-[var(--alt-muted)] mb-3">Customers earn points automatically once an order is delivered, and can redeem them for a discount at checkout.</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div><label class="field-label">Earn 1 point per (৳)</label><input id="st-loyalty-earn" type="number" min="1" class="field-input" value="${s.loyaltyEarnRateBDT}"></div>
          <div><label class="field-label">Each point worth (৳)</label><input id="st-loyalty-value" type="number" min="0.01" step="0.01" class="field-input" value="${s.loyaltyPointValueBDT}"></div>
        </div>
        <label class="field-label">Minimum points balance to redeem</label>
        <input id="st-loyalty-min" type="number" min="0" class="field-input max-w-xs" value="${s.loyaltyMinRedeemPoints}">
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Returns &amp; Exchanges</p>
        <p class="text-sm text-[var(--alt-muted)] mb-3">How many days after delivery a customer can still request a return or exchange.</p>
        <label class="field-label">Return Window (days)</label>
        <input id="st-return-window" type="number" min="1" class="field-input max-w-xs" value="${s.returnWindowDays}">
      </div>
    </div>
    <button id="st-save" class="adm-btn adm-btn-primary mt-5" data-enter>Save Settings</button>
  `;
  document.querySelectorAll(".st-toggle").forEach(btn => btn.addEventListener("click", () => btn.classList.toggle("on")));
  document.getElementById("st-save").addEventListener("click", () => {
    const patch = {
      storeName: document.getElementById("st-name").value.trim(),
      supportEmail: document.getElementById("st-email").value.trim(),
      language: document.getElementById("st-lang").value,
      currency: document.getElementById("st-currency").value,
      taxRate: Number(document.getElementById("st-tax").value) || 0,
      freeShippingThreshold: Number(document.getElementById("st-freeship").value) || 0,
      deliveryMethods: [
        { id: "standard", label: document.getElementById("st-dm-standard-label").value.trim() || "Standard Delivery", eta: document.getElementById("st-dm-standard-eta").value.trim(), priceDhaka: Number(document.getElementById("st-dm-standard-price-dhaka").value) || 0, priceOutside: Number(document.getElementById("st-dm-standard-price-outside").value) || 0, etaDays: 5 },
        { id: "express", label: document.getElementById("st-dm-express-label").value.trim() || "Express Delivery", eta: document.getElementById("st-dm-express-eta").value.trim(), priceDhaka: Number(document.getElementById("st-dm-express-price-dhaka").value) || 0, priceOutside: Number(document.getElementById("st-dm-express-price-outside").value) || 0, etaDays: 2 },
      ],
      walletNumbers: {
        bkash: document.getElementById("st-wn-bkash").value.trim(),
        nagad: document.getElementById("st-wn-nagad").value.trim(),
        rocket: document.getElementById("st-wn-rocket").value.trim(),
      },
      customRequestAdvancePercent: Math.min(100, Math.max(1, Number(document.getElementById("st-cr-advance").value) || 25)),
      loyaltyEarnRateBDT: Math.max(1, Number(document.getElementById("st-loyalty-earn").value) || 100),
      loyaltyPointValueBDT: Math.max(0.01, Number(document.getElementById("st-loyalty-value").value) || 1),
      loyaltyMinRedeemPoints: Math.max(0, Number(document.getElementById("st-loyalty-min").value) || 0),
      returnWindowDays: Math.max(1, Number(document.getElementById("st-return-window").value) || 14),
    };
    document.querySelectorAll(".st-toggle").forEach(btn => { patch[btn.dataset.key] = btn.classList.contains("on"); });
    saveSettings(patch);
    logAudit("Settings updated", Object.keys(patch).join(", "));
    adminToast("Settings saved.");
  });
};

/* ================================================================
   BACKUP & RECOVERY
   ================================================================ */
const BACKUP_KEYS = ["alt_orders_v1","alt_tickets_v1","alt_users_v1","alt_admin_coupons_v1","alt_admin_reviews_v1","alt_admin_product_overrides_v1","alt_admin_extra_products_v1","alt_store_settings_v1","alt_wishlist_v1","alt_cart_v1","alt_admin_customer_notes_v1","alt_admin_ticket_meta_v1","alt_custom_requests_v1","alt_loyalty_v1","alt_returns_v1","alt_reward_templates_v1","alt_scratch_cards_v1","alt_promo_codes_v1","alt_promo_claims_v1"];
VIEW_RENDERERS.backup = function(){
  document.getElementById("view-backup").innerHTML = `
    <div class="mb-6" data-enter><h2 class="font-display text-2xl font-medium">Backup & Recovery</h2></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="panel" data-enter>
        <p class="panel-title mb-2">Export Store Data</p>
        <p class="text-sm text-[var(--alt-muted)] mb-4">Downloads every order, customer, product edit, coupon, and ticket as one JSON file.</p>
        <button id="bk-export" class="adm-btn adm-btn-primary">Export Now</button>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-2">Import Store Data</p>
        <p class="text-sm text-[var(--alt-muted)] mb-4">Restores from a previously exported file. This overwrites current data — export a fresh backup first.</p>
        <input type="file" id="bk-import-file" accept="application/json" class="text-sm mb-3">
        <br><button id="bk-import" class="adm-btn adm-btn-danger">Import & Restore</button>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-2">Automatic Backups <span class="future-tag ml-1">Future</span></p>
        <p class="text-sm text-[var(--alt-muted)]">Scheduled, server-stored backups need a backend and aren't available in this browser-only prototype.</p>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-2">Restore From Server Backup <span class="future-tag ml-1">Future</span></p>
        <p class="text-sm text-[var(--alt-muted)]">Use Import Store Data above for a local file restore in the meantime.</p>
      </div>
    </div>
  `;
  document.getElementById("bk-export").addEventListener("click", () => {
    const dump = {};
    BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v) dump[k] = v; });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `alt-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
    logAudit("Store data exported", `${Object.keys(dump).length} keys`);
    adminToast("Backup downloaded.");
  });
  document.getElementById("bk-import").addEventListener("click", () => {
    const file = document.getElementById("bk-import-file").files[0];
    if (!file){ adminToast("Choose a backup file first."); return; }
    confirmAction({
      title: "Overwrite current store data?",
      body: `This replaces orders, customers, products, coupons, and tickets with the contents of "${file.name}". This can't be undone.`,
      confirmLabel: "Import & Overwrite", danger: true,
      onConfirm(){
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
            logAudit("Store data imported", file.name);
            adminToast("Backup restored. Reloading…");
            setTimeout(() => location.reload(), 1200);
          } catch (e){ adminToast("That file isn't valid backup JSON."); }
        };
        reader.readAsText(file);
      },
    });
  });
};

/* ================================================================
   SECURITY
   ================================================================ */
VIEW_RENDERERS.security = function(){
  const history = AdminAuth.history();
  const audit = auditLog();
  document.getElementById("view-security").innerHTML = `
    <div class="mb-6" data-enter><h2 class="font-display text-2xl font-medium">Security</h2></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Change Admin Password</p>
        <div class="mb-3"><label class="field-label">Current Password</label><input id="sec-current" type="password" class="field-input" autocomplete="current-password"></div>
        <div class="mb-3"><label class="field-label">New Password</label><input id="sec-new" type="password" class="field-input" autocomplete="new-password"></div>
        <p id="sec-error" class="text-xs text-[var(--alt-bad)] mb-2" style="display:none;"></p>
        <button id="sec-save" class="adm-btn adm-btn-primary">Update Password</button>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Two-Factor Authentication <span class="future-tag ml-1">Future</span></p>
        <p class="text-sm text-[var(--alt-muted)] mb-3">Not available without a backend to deliver codes. Sensitive actions in this dashboard already require an explicit confirmation dialog.</p>
        <div class="flex items-center justify-between"><span class="text-sm">Device Sessions</span><span class="future-tag">Future</span></div>
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Login History</p>
        ${history.length ? history.map(h => `<div class="flex items-center justify-between text-sm mb-2"><span class="text-xs text-[var(--alt-muted)] font-mono">${h.device}</span><span class="text-xs text-[var(--alt-muted)]">${new Date(h.at).toLocaleString()}</span></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No history yet.</p>`}
      </div>
      <div class="panel" data-enter>
        <p class="panel-title mb-4">Audit Log</p>
        <div class="max-h-64 overflow-y-auto no-scrollbar">
          ${audit.length ? audit.map(a => `<div class="mb-2"><p class="text-sm">${a.action}</p><p class="text-xs text-[var(--alt-muted)] font-mono">${a.detail} · ${timeAgo(a.at)}</p></div>`).join("") : `<p class="text-sm text-[var(--alt-muted)]">No actions logged yet this session.</p>`}
        </div>
      </div>
    </div>
  `;
  document.getElementById("sec-save").addEventListener("click", async () => {
    const err = document.getElementById("sec-error");
    const res = await AdminAuth.changePassword(document.getElementById("sec-current").value, document.getElementById("sec-new").value);
    if (!res.ok){ err.textContent = res.error; err.style.display = "block"; return; }
    err.style.display = "none";
    logAudit("Admin password changed", "");
    adminToast("Password updated.");
    document.getElementById("sec-current").value = ""; document.getElementById("sec-new").value = "";
  });
};

/* ================================================================
   COMMAND PALETTE (⌘K)
   ================================================================ */
let cmdkHighlight = 0;
function buildCommandIndex(){
  const items = [];
  ADMIN_NAV.forEach(g => g.items.forEach(it => items.push({ tag: "Go to", label: it.label, action: () => setAdminView(it.key) })));
  allOrders().slice(0, 40).forEach(o => items.push({ tag: "Order", label: `${o.id} — ${customerNameForOrder(o)}`, action: () => { setAdminView("orders"); setTimeout(() => openOrderDetail(o.id), 250); } }));
  Auth.users().forEach(u => items.push({ tag: "Customer", label: `${u.firstName} ${u.lastName} — ${u.email}`, action: () => { setAdminView("customers"); setTimeout(() => openCustomerDetail(u.id), 250); } }));
  effectiveProducts().forEach(p => items.push({ tag: "Product", label: p.name, action: () => { setAdminView("products"); setTimeout(() => openProductEditor(p.id), 250); } }));
  allCoupons().forEach(c => items.push({ tag: "Coupon", label: c.code, action: () => setAdminView("coupons") }));
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
   SHELL WIRING
   ================================================================ */
document.getElementById("admin-sidebar-open").addEventListener("click", openAdminSidebar);
document.getElementById("admin-sidebar-close").addEventListener("click", closeAdminSidebar);
document.getElementById("admin-sidebar-overlay").addEventListener("click", closeAdminSidebar);
document.getElementById("admin-cmdk-trigger").addEventListener("click", openCmdk);
document.getElementById("adm-drawer-close").addEventListener("click", closeDrawer);
document.getElementById("adm-drawer-overlay").addEventListener("click", closeDrawer);
document.getElementById("admin-logout-btn").addEventListener("click", () => {
  confirmAction({
    title: "Sign out of the admin dashboard?", body: "You'll need the admin password again to get back in.",
    confirmLabel: "Sign Out",
    onConfirm(){ AdminAuth.logout(); location.reload(); },
  });
});
document.getElementById("admin-notif-trigger").addEventListener("click", () => setAdminView("notifications"));
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("adm-drawer").classList.contains("open")) closeDrawer(); });

/* ================================================================
   LOGIN GATE + INIT
   ================================================================ */
document.querySelectorAll(".demo-cred-copy").forEach(btn => {
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(btn.dataset.value); }
    catch (e){ /* clipboard permission denied — the value is still visible to copy by hand */ }
    const original = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = original; }, 1200);
  });
});

document.getElementById("admin-login-submit").addEventListener("click", async () => {
  const email = document.getElementById("admin-login-email").value;
  const password = document.getElementById("admin-login-password").value;
  const res = await AdminAuth.login(email, password);
  const err = document.getElementById("admin-login-error");
  if (!res.ok){ err.textContent = res.error; err.style.display = "block"; return; }
  err.style.display = "none";
  const redirectTo = new URLSearchParams(location.search).get("redirect");
  if (redirectTo){ window.location.href = redirectTo; return; }
  await bootAdminShell();
});
document.getElementById("admin-login-password").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("admin-login-submit").click(); });

async function bootAdminShell(){
  document.getElementById("admin-login-root").style.display = "none";
  document.getElementById("admin-shell-root").style.display = "block";
  requestAnimationFrame(() => document.getElementById("admin-shell-root").classList.add("settled"));
  await seedDemoDataIfNeeded();
  const rec = AdminAuth.record();
  document.getElementById("admin-avatar").textContent = (rec.name || "O")[0].toUpperCase();
  renderSidebar();
  const startView = (location.hash || "#overview").slice(1);
  setAdminView(VIEW_RENDERERS[startView] ? startView : "overview");
  setInterval(renderSidebar, 15000);
}

// The login screen's own [data-enter] blocks (brand headline, form panel)
// need their .in class added too — setAdminView() only reveals view-scoped
// [data-enter] elements inside #admin-content, which doesn't exist yet here.
document.querySelectorAll("#admin-login-root [data-enter]").forEach(el => {
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
});

(async function initAdmin(){
  await AdminAuth.ensureSeeded();
  if (AdminAuth.isLoggedIn()){
    document.getElementById("admin-login-root").style.display = "none";
    await bootAdminShell();
  }
})();
