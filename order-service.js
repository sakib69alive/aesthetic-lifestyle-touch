/* ================================================================
   ORDER SERVICE
   The one place checkout.html, dashboard.html, and admin.js create,
   read, and update orders. Everything writes to the same
   alt_orders_v1 key (per-user store: { [userId]: Order[] }, "guest"
   for anyone not signed in) so there is exactly one order dataset in
   the whole project — no separate admin/customer copies to drift.

   Sections below: Order Service, Inventory Service, Invoice Service,
   Notification Service, Validation Service.
   ================================================================ */

const ORDERS_KEY = "alt_orders_v1";
const ORDER_SEQ_KEY = "alt_order_seq_v1";
const ORDER_STATUSES = [
  { slug: "pending",           label: "Pending" },
  { slug: "confirmed",         label: "Confirmed" },
  { slug: "packed",            label: "Packed" },
  { slug: "shipped",           label: "Shipped" },
  { slug: "out-for-delivery",  label: "Out for Delivery" },
  { slug: "delivered",         label: "Delivered" },
  { slug: "cancelled",         label: "Cancelled" },
  { slug: "returned",          label: "Returned" },
  { slug: "refunded",          label: "Refunded" },
];
/* Color per status, shared by dashboard.html's inline-styled .status-dot
   and admin.js's .badge-* classes. */
const ORDER_STATUS_META = {
  pending:            { label: "Pending",           color: "var(--alt-warn)",  badgeClass: "badge-warn" },
  confirmed:          { label: "Confirmed",         color: "var(--alt-black)", badgeClass: "badge-neutral" },
  packed:             { label: "Packed",            color: "var(--alt-black)", badgeClass: "badge-neutral" },
  shipped:            { label: "Shipped",           color: "var(--alt-black)", badgeClass: "badge-neutral" },
  "out-for-delivery": { label: "Out for Delivery",  color: "var(--alt-warn)",  badgeClass: "badge-warn" },
  delivered:          { label: "Delivered",         color: "var(--alt-good)", badgeClass: "badge-good" },
  cancelled:          { label: "Cancelled",         color: "var(--alt-bad)",  badgeClass: "badge-bad" },
  returned:           { label: "Returned",          color: "var(--alt-bad)",  badgeClass: "badge-bad" },
  refunded:           { label: "Refunded",          color: "var(--alt-bad)",  badgeClass: "badge-bad" },
  /* legacy demo-data statuses (pre-Step-18 seeded orders) — kept so old
     seed data still renders sensibly instead of showing "undefined". */
  processing:         { label: "Processing",        color: "var(--alt-warn)", badgeClass: "badge-warn" },
};
function orderStatusMeta(slug){ return ORDER_STATUS_META[slug] || { label: slug || "Unknown", color: "var(--alt-muted)", badgeClass: "badge-neutral" }; }

const TIMELINE_STEPS = ["Order Placed", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"];
/* Maps a status slug to how far along TIMELINE_STEPS it should mark as done. */
const STATUS_TIMELINE_INDEX = { pending: 0, confirmed: 1, packed: 2, shipped: 3, "out-for-delivery": 4, delivered: 5 };

/* ================================================================
   STORAGE — same on-disk shape admin.js/dashboard.html already used
   ({ [userId]: Order[] }), just under names that won't collide with
   admin.js's generic readUserStore/writeUserStore (still used there
   for tickets etc.) or dashboard.html's own local readUserStore.
   ================================================================ */
function readOrdersRaw(){ try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "{}"); } catch (e) { return {}; } }
function writeOrdersRaw(store){ localStorage.setItem(ORDERS_KEY, JSON.stringify(store)); }

/* ================================================================
   STORE SETTINGS — read-only mirror of admin.js's Settings view
   (alt_store_settings_v1). admin.js remains the only writer; this
   just lets checkout.html/dashboard.html consume admin-configured
   delivery pricing and manual-wallet numbers without loading the
   whole admin app. Named siteSettings() (not storeSettings()) so it
   can never collide with admin.js's own reader on pages that load both. */
const STORE_SETTINGS_KEY = "alt_store_settings_v1";
const DEFAULT_STORE_SETTINGS = {
  deliveryMethods: [
    { id: "standard", label: "Standard Delivery", eta: "3–5 business days", priceDhaka: 60, priceOutside: 120, etaDays: 5 },
    { id: "express",  label: "Express Delivery",  eta: "1–2 business days", priceDhaka: 120, priceOutside: 200, etaDays: 2 },
  ],
  freeShippingThreshold: 15000,
  walletNumbers: { bkash: "", nagad: "", rocket: "" },
  customRequestAdvancePercent: 25,
  /* Loyalty Points — earn 1 point per loyaltyEarnRateBDT spent (on
     delivery), redeemable at loyaltyPointValueBDT each. Read via
     loyalty.js's loyaltySettings(), never hardcoded. */
  loyaltyEnabled: true,
  loyaltyEarnRateBDT: 100,
  loyaltyPointValueBDT: 1,
  loyaltyMinRedeemPoints: 100,
  /* Return/Exchange eligibility window — read via returnWindowDays() in
     returns.js, matches the promise on the About page's FAQ. */
  returnWindowDays: 14,
};
function siteSettings(){
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_SETTINGS_KEY) || "{}"); } catch (e) { saved = {}; }
  return Object.assign({}, DEFAULT_STORE_SETTINGS, saved, {
    walletNumbers: Object.assign({}, DEFAULT_STORE_SETTINGS.walletNumbers, saved.walletNumbers || {}),
  });
}
function getDeliveryMethods(){
  const s = siteSettings();
  return Array.isArray(s.deliveryMethods) && s.deliveryMethods.length ? s.deliveryMethods : DEFAULT_STORE_SETTINGS.deliveryMethods;
}
function getFreeShippingThreshold(){ return Number(siteSettings().freeShippingThreshold) || 0; }
function getWalletNumber(methodId){ return (siteSettings().walletNumbers || {})[methodId] || ""; }

/* ================================================================
   ORDER SERVICE
   ================================================================ */
function allOrders(){
  const store = readOrdersRaw();
  const out = [];
  Object.keys(store).forEach(userId => {
    (store[userId] || []).forEach(o => out.push(Object.assign({ userId }, o)));
  });
  return out.sort((a, b) => b.placedAt - a.placedAt);
}
function ordersForUser(userId){
  return (readOrdersRaw()[userId] || []).slice().sort((a, b) => b.placedAt - a.placedAt);
}
function getOrderById(id){ return allOrders().find(o => o.id === id) || null; }

function saveOrder(order){
  const store = readOrdersRaw();
  const list = store[order.userId] || [];
  const idx = list.findIndex(o => o.id === order.id);
  const clean = Object.assign({}, order); delete clean.userId;
  if (idx > -1) list[idx] = clean; else list.unshift(clean);
  store[order.userId] = list;
  writeOrdersRaw(store);
}

/* Sequential, human-readable, never-repeating: ALT-2026-000124. A plain
   incrementing counter is enough here — this is a single-browser
   prototype, not a multi-writer system, so no locking is needed. */
function nextOrderId(){
  let seq = 0;
  try { seq = parseInt(localStorage.getItem(ORDER_SEQ_KEY) || "0", 10) || 0; } catch (e) { seq = 0; }
  seq += 1;
  localStorage.setItem(ORDER_SEQ_KEY, String(seq));
  return `ALT-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`;
}

/* Whether the store has ever had a real (non-demo) order — once true,
   every page hides seeded demo orders instead of mixing them in. */
function hasAnyRealOrders(){ return allOrders().some(o => !o.demo); }

/* Prefer the amount frozen on the order at purchase time (real orders);
   fall back to recomputing from current product prices only for legacy
   demo-seeded orders that predate this field. */
function orderAmount(order){
  if (typeof order.total === "number") return order.total;
  return (order.items || []).reduce((sum, it) => {
    const p = (typeof getAllProductsWithOverrides === "function" ? getAllProductsWithOverrides() : PRODUCTS).find(pp => pp.id === it.productId);
    return sum + (p ? (p.salePrice || p.price) * it.qty : 0);
  }, 0);
}
/* Prefer the customer name captured on the order itself (real orders,
   including guests with no account); fall back to the Auth lookup used
   by pre-Step-18 demo orders. */
function customerNameForOrder(order){
  if (order.customer && order.customer.name) return order.customer.name;
  if (typeof Auth === "undefined") return "Guest Customer";
  const u = Auth.users().find(x => x.id === order.userId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : "Guest Customer";
}
function orderSearchText(order){
  const c = order.customer || {};
  const productNames = (order.items || []).map(it => it.name || "").join(" ");
  return [order.id, customerNameForOrder(order), c.email, c.phone, productNames, order.status].filter(Boolean).join(" ").toLowerCase();
}

/* ---------------- creation ---------------- */
/**
 * payload = {
 *   userId, customer:{name,email,phone}, shippingAddress, billingAddress,
 *   billingSameAsShipping, lines (Cart.lines() shape: [{line, product}]),
 *   coupon, totals ({subtotal,discount,shipping,tax,total}),
 *   paymentMethod, paymentStatus, deliveryMethod, deliveryEtaDays, notes
 * }
 */
function createOrder(payload){
  const validation = validateCheckoutPayload(payload);
  if (!validation.ok) return validation;

  const now = Date.now();
  const id = nextOrderId();
  const items = payload.lines.map(({ line, product }) => ({
    productId: product.id,
    name: product.name,
    img: product.img,
    color: line.color || null,
    size: line.size || null,
    qty: line.qty,
    unitPrice: product.salePrice || product.price,
  }));

  const order = {
    id,
    invoiceNumber: `INV-${id.replace("ALT-", "")}`,
    demo: false,
    userId: payload.userId || "guest",
    placedAt: now,
    customer: payload.customer,
    shippingAddress: payload.shippingAddress,
    billingAddress: payload.billingSameAsShipping ? payload.shippingAddress : (payload.billingAddress || payload.shippingAddress),
    billingSameAsShipping: !!payload.billingSameAsShipping,
    items,
    subtotal: payload.totals.subtotal,
    discount: payload.totals.discount,
    couponCode: payload.coupon || null,
    shipping: payload.totals.shipping,
    tax: payload.totals.tax,
    pointsRedeemed: payload.redeemedPoints || 0,
    pointsDiscount: payload.totals.pointsDiscount || 0,
    total: payload.totals.total,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus || "Pending",
    paymentVerification: payload.paymentVerification || null,
    deliveryMethod: payload.deliveryMethod,
    status: "pending",
    timeline: TIMELINE_STEPS.map((label, i) => ({ label, done: i === 0, at: i === 0 ? now : null })),
    trackingNumber: null,
    notes: payload.notes || "",
    eta: now + (payload.deliveryEtaDays || 5) * 86400000,
  };

  decrementStock(items);
  saveOrder(order);
  // Points are only ever debited once the order genuinely exists — same
  // "commit only when real" rule the online-payment flow follows, so an
  // abandoned or failed checkout never loses points for nothing.
  if (order.pointsRedeemed > 0 && typeof redeemLoyaltyPoints === "function"){
    redeemLoyaltyPoints(order.userId, order.pointsRedeemed, order.id);
  }
  pushCustomerNotification(order.userId, {
    category: "Order Updates",
    title: "Your order has been placed successfully.",
    body: `Order ${order.id} is confirmed — we'll keep you posted as it moves.`,
    orderId: order.id,
  });

  // One Mystery Reward scratch card per order, issued the moment it's
  // placed (not on delivery — this is the celebratory "you just bought
  // something" moment, separate from the loyalty coins earned later).
  if (typeof issueScratchCard === "function" && order.userId !== "guest"){
    issueScratchCard(order.userId, "order", order.id);
  }

  return { ok: true, order };
}

/* Admin-side status change: appends/updates the timeline and notifies
   the customer. `order` must be the full object (with userId) as
   returned by allOrders()/getOrderById(). */
function advanceOrderStatus(order, newSlug, note){
  const now = Date.now();
  order.status = newSlug;
  if (newSlug === "cancelled" || newSlug === "refunded") order.paymentStatus = "Refunded";
  if (newSlug === "returned") order.paymentStatus = "Refunded";

  const stepIndex = STATUS_TIMELINE_INDEX[newSlug];
  if (stepIndex !== undefined){
    order.timeline = order.timeline || TIMELINE_STEPS.map(label => ({ label, done: false, at: null }));
    order.timeline.forEach((step, i) => {
      if (i <= stepIndex && !step.done){ step.done = true; step.at = now; }
    });
  } else {
    // cancelled / returned / refunded aren't part of the linear happy-path
    // timeline — record them as a note instead of forcing a fake step.
    order.timeline = order.timeline || [];
    order.timeline.push({ label: orderStatusMeta(newSlug).label, done: true, at: now });
  }
  if (note) order.notes = (order.notes ? order.notes + "\n" : "") + note;

  if (newSlug === "cancelled" || newSlug === "returned"){
    restoreStock(order.items);
  }

  saveOrder(order);
  pushCustomerNotification(order.userId, {
    category: "Order Updates",
    title: `Order ${order.id} is now ${orderStatusMeta(newSlug).label}.`,
    body: newSlug === "delivered" ? "Hope you love it." : "Track the latest status from My Orders.",
    orderId: order.id,
  });
  if (newSlug === "delivered"){
    // One invite per distinct product — this is the only place a
    // customer is ever prompted to review, since Product pages only show
    // the review form once this exact check (delivered + this product)
    // is true, per hasPurchasedProduct() in products-data.js.
    const seenProducts = new Set();
    (order.items || []).forEach(item => {
      if (seenProducts.has(item.productId)) return;
      seenProducts.add(item.productId);
      pushCustomerNotification(order.userId, {
        category: "Order Updates",
        title: `How was your ${item.name}?`,
        body: "Now that it's arrived, write a quick review if you'd like — totally optional.",
        orderId: order.id,
        reviewProductId: item.productId,
      });
    });
    if (typeof earnLoyaltyPoints === "function") earnLoyaltyPoints(order.userId, order.id, orderAmount(order));
  }
  return order;
}

/* ================================================================
   MANUAL PAYMENT VERIFICATION
   Wallet orders (bKash/Nagad/Rocket) are placed with paymentStatus
   "Pending Verification" and a
   customer-submitted Transaction ID. The admin independently types in
   the Transaction ID + amount they actually received (from their own
   phone/app) — only if BOTH match does the order get marked Paid and
   auto-confirmed. This two-sided check is what stands in for a real
   gateway callback until one is wired up.
   ================================================================ */
function verifyOrderPayment(order, { adminTxnId, amountReceived }){
  const pv = order.paymentVerification || {};
  const txnMatch = (adminTxnId || "").trim().toLowerCase() === (pv.customerTxnId || "").trim().toLowerCase() && !!(adminTxnId || "").trim();
  const amountMatch = Math.abs((Number(amountReceived) || 0) - orderAmount(order)) < 0.01;
  if (!txnMatch || !amountMatch) return { ok: false, txnMatch, amountMatch };

  order.paymentVerification = Object.assign({}, pv, {
    status: "verified", adminTxnId: adminTxnId.trim(), amountReceived: Number(amountReceived), verifiedAt: Date.now(),
  });
  order.paymentStatus = "Paid";

  if (order.status === "pending") {
    advanceOrderStatus(order, "confirmed", "Payment verified — order confirmed.");
  } else {
    saveOrder(order);
    pushCustomerNotification(order.userId, {
      category: "Order Updates",
      title: `Payment verified for order ${order.id}.`,
      body: "Thanks — your payment has been confirmed.",
      orderId: order.id,
    });
  }
  return { ok: true, order };
}
function rejectOrderPayment(order, note){
  order.paymentVerification = Object.assign({}, order.paymentVerification || {}, {
    status: "rejected", rejectedAt: Date.now(), rejectReason: note || "",
  });
  saveOrder(order);
  pushCustomerNotification(order.userId, {
    category: "Order Updates",
    title: `We couldn't verify payment for order ${order.id}.`,
    body: note || "Please contact support with your transaction details.",
    orderId: order.id,
  });
  return order;
}

/* ================================================================
   INVENTORY SERVICE
   ================================================================ */
function decrementStock(items){
  items.forEach(it => {
    const p = getProduct(it.productId);
    if (!p) return;
    const nextStock = Math.max(0, (p.stock || 0) - it.qty);
    updateProduct(it.productId, { stock: nextStock });
  });
}
function restoreStock(items){
  (items || []).forEach(it => {
    const p = getProduct(it.productId);
    if (!p) return;
    updateProduct(it.productId, { stock: (p.stock || 0) + it.qty });
  });
}
/* Returns a list of { productId, name, requested, available } for any
   line that can't be fulfilled at current stock levels. Empty = OK. */
function checkStockAvailability(lines){
  const problems = [];
  lines.forEach(({ line, product }) => {
    const live = getProduct(product.id);
    const available = live ? live.stock : 0;
    if (line.qty > available) problems.push({ productId: product.id, name: product.name, requested: line.qty, available });
  });
  return problems;
}

/* ================================================================
   INVOICE SERVICE — one shared builder (checkout.html and
   dashboard.html each used to have their own, slightly different and
   slightly buggy, plain-text generator; this replaces both).
   ================================================================ */
/* bdt() now lives in cart.js, loaded on every page that loads this file. */
function buildInvoiceText(order){
  const lines = order.items.map(it => `${it.name}${it.color ? " · " + it.color : ""}${it.size ? " · " + it.size : ""}  x${it.qty}  ${bdt(it.unitPrice * it.qty)}`).join("\n");
  const c = order.customer || {};
  return [
    "AESTHETIC LIFESTYLE TOUCH",
    `Invoice ${order.invoiceNumber || order.id}`,
    `Order ${order.id}`,
    `Date: ${new Date(order.placedAt).toLocaleDateString()}`,
    c.name ? `Customer: ${c.name}` : null,
    c.email ? `Email: ${c.email}` : null,
    c.phone ? `Phone: ${c.phone}` : null,
    "",
    lines,
    "",
    `Subtotal: ${bdt(order.subtotal)}`,
    order.discount ? `Discount${order.couponCode ? " (" + order.couponCode + ")" : ""}: -${bdt(order.discount)}` : null,
    order.pointsDiscount ? `Reward Points (${order.pointsRedeemed} pts): -${bdt(order.pointsDiscount)}` : null,
    `Shipping: ${order.shipping ? bdt(order.shipping) : "Free"}`,
    `Tax: ${bdt(order.tax)}`,
    `Total: ${bdt(orderAmount(order))}`,
    "",
    `Payment: ${order.paymentMethod || "—"} (${order.paymentStatus || "—"})`,
    `Estimated Delivery: ${order.eta ? new Date(order.eta).toLocaleDateString() : "—"}`,
    "",
    "Thank you for your order.",
  ].filter(l => l !== null).join("\n");
}
function downloadInvoice(order){
  const blob = new Blob([buildInvoiceText(order)], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${order.id}-invoice.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   NOTIFICATION SERVICE
   (Admin's own "New Orders" notifications are already synthesized
   live from allOrders() in admin.js — nothing extra needed there.)
   ================================================================ */
function pushCustomerNotification(userId, { category, title, body, orderId, reviewProductId, customRequestId }){
  if (!userId || userId === "guest") return; // no account to notify
  try {
    const store = JSON.parse(localStorage.getItem("alt_notifications_v1") || "{}");
    const list = store[userId] || [];
    list.unshift({ id: "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), category, title, body, orderId: orderId || null, reviewProductId: reviewProductId || null, customRequestId: customRequestId || null, at: Date.now(), read: false });
    store[userId] = list;
    localStorage.setItem("alt_notifications_v1", JSON.stringify(store));
  } catch (e) { /* localStorage unavailable — notification is best-effort */ }
}

/* ================================================================
   VALIDATION SERVICE
   ================================================================ */
function validateCheckoutPayload(payload){
  const errors = [];
  const c = payload.customer || {};
  if (!c.name || !c.name.trim()) errors.push("Customer name is required.");
  if (!c.phone || !/^[0-9+\-\s]{7,}$/.test(c.phone.trim())) errors.push("A valid phone number is required.");
  const addr = payload.shippingAddress || {};
  if (!addr.street || !addr.street.trim()) errors.push("Shipping street address is required.");
  if (!addr.division || !addr.district) errors.push("Shipping division/district is required.");
  if (!payload.lines || payload.lines.length === 0) errors.push("Your cart is empty.");
  (payload.lines || []).forEach(({ line }) => { if (!line.qty || line.qty <= 0) errors.push("Every item needs a quantity of at least 1."); });
  const stockProblems = checkStockAvailability(payload.lines || []);
  stockProblems.forEach(p => errors.push(`Only ${p.available} of "${p.name}" left in stock (you have ${p.requested} in cart).`));
  if (payload.paymentVerification && !(payload.paymentVerification.customerTxnId || "").trim()) {
    errors.push("A Transaction ID is required for mobile wallet payments.");
  }
  const t = payload.totals || {};
  if (t.total == null || t.total < 0) errors.push("Order total is invalid.");
  return { ok: errors.length === 0, errors };
}
