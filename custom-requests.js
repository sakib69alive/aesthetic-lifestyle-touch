/* ================================================================
   CUSTOM PRODUCT REQUEST & ADVANCE PAYMENT SERVICE
   Same architecture as order-service.js: one localStorage-backed
   dataset (alt_custom_requests_v1, per-user store: { [userId]: Request[] })
   that request-product.html, dashboard.html, and admin.js all read and
   write through these functions — one source of truth, no drift.
   Depends on cart.js (bdt), order-service.js (siteSettings,
   pushCustomerNotification) — load this file after both.
   ================================================================ */

const CUSTOM_REQUESTS_KEY = "alt_custom_requests_v1";
const CR_SEQ_KEY = "alt_custom_request_seq_v1";

/* Full pipeline from the spec, in order — CR_STATUS_INDEX below is what
   lets the UI draw an accurate "how far along" progress timeline. */
const CR_STATUSES = [
  { slug: "submitted",             label: "Request Submitted" },
  { slug: "under-review",          label: "Under Review" },
  { slug: "awaiting-confirmation", label: "Waiting for Customer Confirmation" },
  { slug: "quotation-sent",        label: "Quotation Sent" },
  { slug: "advance-pending",       label: "Advance Payment Pending" },
  { slug: "advance-paid",          label: "Advance Paid" },
  { slug: "sourcing",              label: "Product Being Sourced" },
  { slug: "ordered",               label: "Ordered from Supplier" },
  { slug: "in-transit",            label: "In Transit" },
  { slug: "arrived",               label: "Arrived at Warehouse" },
  { slug: "quality-check",         label: "Quality Inspection" },
  { slug: "ready-for-final",       label: "Ready for Final Payment" },
  { slug: "final-pending",         label: "Final Payment Pending" },
  { slug: "final-paid",            label: "Final Payment Received" },
  { slug: "packed",                label: "Packed" },
  { slug: "shipped",               label: "Shipped" },
  { slug: "delivered",             label: "Delivered" },
  { slug: "completed",             label: "Completed" },
];
/* Terminal, off-the-happy-path outcomes — shown as their own badge
   colors, not slotted into the linear timeline above. */
const CR_TERMINAL_STATUSES = [
  { slug: "cancelled", label: "Cancelled" },
  { slug: "rejected",  label: "Rejected" },
];
const CR_ALL_STATUSES = CR_STATUSES.concat(CR_TERMINAL_STATUSES);
const CR_STATUS_INDEX = {};
CR_STATUSES.forEach((s, i) => { CR_STATUS_INDEX[s.slug] = i; });

const CR_STATUS_BADGE_CLASS = {
  submitted: "badge-neutral", "under-review": "badge-warn", "awaiting-confirmation": "badge-warn",
  "quotation-sent": "badge-warn", "advance-pending": "badge-warn", "advance-paid": "badge-good",
  sourcing: "badge-warn", ordered: "badge-warn", "in-transit": "badge-warn", arrived: "badge-warn",
  "quality-check": "badge-warn", "ready-for-final": "badge-warn", "final-pending": "badge-warn",
  "final-paid": "badge-good", packed: "badge-warn", shipped: "badge-warn", delivered: "badge-good",
  completed: "badge-good", cancelled: "badge-bad", rejected: "badge-bad",
};
function crStatusMeta(slug){
  const s = CR_ALL_STATUSES.find(x => x.slug === slug);
  return { slug, label: s ? s.label : slug, badgeClass: CR_STATUS_BADGE_CLASS[slug] || "badge-neutral" };
}

const CR_URGENCY_LEVELS = ["Low", "Normal", "High", "Urgent"];
const CR_REFUND_POLICIES = [
  { slug: "refundable",           label: "Fully Refundable" },
  { slug: "partially-refundable", label: "Partially Refundable" },
  { slug: "non-refundable",       label: "Non-Refundable" },
];

/* ================================================================
   STORAGE
   ================================================================ */
function readCustomRequestsRaw(){ try { return JSON.parse(localStorage.getItem(CUSTOM_REQUESTS_KEY) || "{}"); } catch (e) { return {}; } }
function writeCustomRequestsRaw(store){ localStorage.setItem(CUSTOM_REQUESTS_KEY, JSON.stringify(store)); }

function allCustomRequests(){
  const store = readCustomRequestsRaw();
  const out = [];
  Object.keys(store).forEach(userId => (store[userId] || []).forEach(r => out.push(Object.assign({ userId }, r))));
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
function customRequestsForUser(userId){
  return (readCustomRequestsRaw()[userId] || []).slice().sort((a, b) => b.createdAt - a.createdAt);
}
function getCustomRequestById(id){ return allCustomRequests().find(r => r.id === id) || null; }

function saveCustomRequest(request){
  const store = readCustomRequestsRaw();
  const list = store[request.userId] || [];
  const idx = list.findIndex(r => r.id === request.id);
  const clean = Object.assign({}, request); delete clean.userId;
  if (idx > -1) list[idx] = clean; else list.unshift(clean);
  store[request.userId] = list;
  writeCustomRequestsRaw(store);
}

/* Sequential and human-readable, same pattern as nextOrderId() in
   order-service.js — a single-browser prototype needs no locking. */
function nextCustomRequestId(){
  let seq = 0;
  try { seq = parseInt(localStorage.getItem(CR_SEQ_KEY) || "0", 10) || 0; } catch (e) { seq = 0; }
  seq += 1;
  localStorage.setItem(CR_SEQ_KEY, String(seq));
  return `CR-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

/* ================================================================
   CONFIGURABLE ADVANCE PERCENT — admin-set in Settings, never
   hardcoded. Falls back to 25% only if settings can't be read at all.
   ================================================================ */
function customRequestAdvancePercent(){
  const s = (typeof siteSettings === "function") ? siteSettings() : {};
  const n = Number(s.customRequestAdvancePercent);
  return (n > 0 && n <= 100) ? n : 25;
}

/* ================================================================
   SUBMIT
   ================================================================ */
function submitCustomRequest(payload){
  const errors = [];
  if (!payload.userId || payload.userId === "guest") errors.push("Please sign in to submit a product request.");
  if (!payload.productName || !payload.productName.trim()) errors.push("Enter the product name.");
  if (!payload.description || !payload.description.trim()) errors.push("Describe the product a little more.");
  if (payload.quantity && (Number(payload.quantity) < 1 || Number(payload.quantity) > 999)) errors.push("Enter a realistic quantity.");
  if (errors.length) return { ok: false, errors };

  const now = Date.now();
  const links = payload.links || {};
  const request = {
    id: nextCustomRequestId(),
    userId: payload.userId,
    customerName: (payload.customerName || "").trim(),
    customerEmail: (payload.customerEmail || "").trim(),
    customerPhone: (payload.customerPhone || "").trim(),
    productName: payload.productName.trim(),
    category: (payload.category || "").trim(),
    brand: (payload.brand || "").trim(),
    color: (payload.color || "").trim(),
    size: (payload.size || "").trim(),
    quantity: Math.max(1, Number(payload.quantity) || 1),
    budget: (payload.budget || "").trim(),
    description: payload.description.trim(),
    specialInstructions: (payload.specialInstructions || "").trim(),
    urgency: CR_URGENCY_LEVELS.includes(payload.urgency) ? payload.urgency : "Normal",
    links: {
      website: (links.website || "").trim(), instagram: (links.instagram || "").trim(),
      tiktok: (links.tiktok || "").trim(), facebook: (links.facebook || "").trim(),
      youtube: (links.youtube || "").trim(), marketplace: (links.marketplace || "").trim(),
    },
    images: Array.isArray(payload.images) ? payload.images.slice(0, 6) : [],
    status: "submitted",
    statusHistory: [{ status: "submitted", at: now, note: "" }],
    priority: "Normal",
    assignedStaff: null,
    internalNotes: [],
    quotation: null,
    advancePayment: null,
    finalPayment: null,
    duplicateOf: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  saveCustomRequest(request);
  pushCustomerNotification(payload.userId, {
    category: "Order Updates",
    title: `Request ${request.id} received.`,
    body: "Our team is reviewing your product request — we'll follow up here once we have an update.",
    customRequestId: request.id,
  });
  return { ok: true, request };
}

/* ================================================================
   STATUS PROGRESSION — every transition logs to statusHistory (the
   data the timeline UI renders from) and notifies the customer.
   ================================================================ */
const CR_STATUS_NOTIFY_BODY = {
  "under-review": "Our team is taking a closer look at your request.",
  "quotation-sent": "Review the price and delivery estimate in Custom Orders, then pay the advance to confirm.",
  "advance-paid": "Thanks — we're moving forward with sourcing your product.",
  sourcing: "We're actively sourcing your product now.",
  ordered: "Your product has been ordered from the supplier.",
  "in-transit": "Your product is on its way to our warehouse.",
  arrived: "Your product has arrived at our warehouse.",
  "quality-check": "We're inspecting your product before it ships to you.",
  "ready-for-final": "Your product passed inspection — pay the remaining balance in Custom Orders to start delivery.",
  shipped: "Your product is on its way to you.",
  delivered: "Hope you love it.",
  completed: "This custom order is complete — thank you.",
  rejected: "See the note on your request for details.",
  cancelled: "This request has been cancelled.",
};
function advanceCustomRequestStatus(request, newSlug, note){
  const now = Date.now();
  request.status = newSlug;
  request.statusHistory = request.statusHistory || [];
  request.statusHistory.push({ status: newSlug, at: now, note: note || "" });
  request.updatedAt = now;
  saveCustomRequest(request);
  pushCustomerNotification(request.userId, {
    category: "Order Updates",
    title: `Request ${request.id} is now ${crStatusMeta(newSlug).label}.`,
    body: CR_STATUS_NOTIFY_BODY[newSlug] || "Track the latest status from Custom Orders.",
    customRequestId: request.id,
  });
  return request;
}

/* Only allowed to cancel before the shop has committed money/time. */
function canCancelCustomRequest(request){
  return ["submitted", "under-review", "awaiting-confirmation"].includes(request.status);
}
function cancelCustomRequest(request){
  if (!canCancelCustomRequest(request)) return { ok: false };
  advanceCustomRequestStatus(request, "cancelled", "Cancelled by customer.");
  return { ok: true };
}

/* ================================================================
   QUOTATION — admin-built, advance % pulled live from settings so it
   is never hardcoded per the spec.
   ================================================================ */
function sendQuotation(request, q){
  const advancePercent = customRequestAdvancePercent();
  const productCost = Number(q.productCost) || 0;
  const shippingCost = Number(q.shippingCost) || 0;
  const importCost = Number(q.importCost) || 0;
  const serviceCharge = Number(q.serviceCharge) || 0;
  const taxRate = Number(q.taxRate) || 0;
  const subtotal = productCost + shippingCost + importCost + serviceCharge;
  const tax = Math.round(subtotal * (taxRate / 100));
  const total = subtotal + tax;
  const advanceAmount = Math.round(total * (advancePercent / 100));
  const remainingAmount = total - advanceAmount;
  request.quotation = {
    productCost, shippingCost, importCost, serviceCharge, taxRate, tax, subtotal, total,
    advancePercent, advanceAmount, remainingAmount,
    deliveryDays: Math.max(1, Number(q.deliveryDays) || 14),
    refundPolicy: CR_REFUND_POLICIES.some(p => p.slug === q.refundPolicy) ? q.refundPolicy : "non-refundable",
    notes: (q.notes || "").trim(),
    validUntil: Date.now() + Math.max(1, Number(q.validDays) || 7) * 86400000,
    sentAt: Date.now(),
    acknowledged: false,
  };
  advanceCustomRequestStatus(request, "quotation-sent", "Quotation sent to customer.");
}
function acknowledgeQuotation(request){
  if (!request.quotation) return;
  request.quotation.acknowledged = true;
  request.updatedAt = Date.now();
  saveCustomRequest(request);
}

/* ================================================================
   PAYMENTS — same manual-wallet-then-admin-verifies pattern already
   used for regular orders (verifyOrderPayment in order-service.js),
   reused here rather than inventing a second payment UI.
   ================================================================ */
function recordAdvancePaymentSubmission(request, { method, walletNumber, customerTxnId }){
  request.advancePayment = {
    method, walletNumber: (walletNumber || "").trim(), customerTxnId: (customerTxnId || "").trim(),
    amount: request.quotation.advanceAmount, status: "pending", submittedAt: Date.now(),
  };
  request.updatedAt = Date.now();
  saveCustomRequest(request);
  advanceCustomRequestStatus(request, "advance-pending", "Advance payment submitted — pending verification.");
}
function verifyAdvancePayment(request, { adminTxnId, amountReceived }){
  const ap = request.advancePayment || {};
  const txnMatch = (adminTxnId || "").trim().toLowerCase() === (ap.customerTxnId || "").trim().toLowerCase() && !!(adminTxnId || "").trim();
  const amountMatch = Math.abs((Number(amountReceived) || 0) - request.quotation.advanceAmount) < 1;
  if (!txnMatch || !amountMatch) return { ok: false, txnMatch, amountMatch };
  request.advancePayment = Object.assign({}, ap, { status: "verified", adminTxnId: adminTxnId.trim(), amountReceived: Number(amountReceived), verifiedAt: Date.now() });
  advanceCustomRequestStatus(request, "advance-paid", "Advance payment verified.");
  return { ok: true };
}
function rejectAdvancePayment(request, note){
  request.advancePayment = Object.assign({}, request.advancePayment, { status: "rejected", rejectedAt: Date.now(), rejectReason: note || "" });
  saveCustomRequest(request);
}

function recordFinalPaymentSubmission(request, { method, walletNumber, customerTxnId }){
  request.finalPayment = {
    method, walletNumber: (walletNumber || "").trim(), customerTxnId: (customerTxnId || "").trim(),
    amount: request.quotation.remainingAmount, status: "pending", submittedAt: Date.now(),
  };
  request.updatedAt = Date.now();
  saveCustomRequest(request);
  advanceCustomRequestStatus(request, "final-pending", "Final payment submitted — pending verification.");
}
function verifyFinalPayment(request, { adminTxnId, amountReceived }){
  const fp = request.finalPayment || {};
  const txnMatch = (adminTxnId || "").trim().toLowerCase() === (fp.customerTxnId || "").trim().toLowerCase() && !!(adminTxnId || "").trim();
  const amountMatch = Math.abs((Number(amountReceived) || 0) - request.quotation.remainingAmount) < 1;
  if (!txnMatch || !amountMatch) return { ok: false, txnMatch, amountMatch };
  request.finalPayment = Object.assign({}, fp, { status: "verified", adminTxnId: adminTxnId.trim(), amountReceived: Number(amountReceived), verifiedAt: Date.now() });
  advanceCustomRequestStatus(request, "final-paid", "Final payment verified.");
  return { ok: true };
}
function rejectFinalPayment(request, note){
  request.finalPayment = Object.assign({}, request.finalPayment, { status: "rejected", rejectedAt: Date.now(), rejectReason: note || "" });
  saveCustomRequest(request);
}

/* ================================================================
   INVOICE — same plain-text download pattern as buildInvoiceText()/
   downloadInvoice() in order-service.js.
   ================================================================ */
function buildCustomRequestInvoiceText(request){
  const q = request.quotation || {};
  return [
    "AESTHETIC LIFESTYLE TOUCH",
    `Custom Order Invoice — ${request.id}`,
    `Product: ${request.productName}`,
    `Customer: ${request.customerName || "—"}`,
    request.customerEmail ? `Email: ${request.customerEmail}` : null,
    request.customerPhone ? `Phone: ${request.customerPhone}` : null,
    "",
    `Product Cost: ${bdt(q.productCost || 0)}`,
    `Shipping Cost: ${bdt(q.shippingCost || 0)}`,
    q.importCost ? `Import Cost: ${bdt(q.importCost)}` : null,
    `Service Charge: ${bdt(q.serviceCharge || 0)}`,
    q.tax ? `Tax: ${bdt(q.tax)}` : null,
    `Total: ${bdt(q.total || 0)}`,
    "",
    `Advance Paid (${q.advancePercent || 0}%): ${bdt(q.advanceAmount || 0)}`,
    `Remaining Balance: ${bdt(q.remainingAmount || 0)}`,
    "",
    `Refund Policy: ${(CR_REFUND_POLICIES.find(p => p.slug === q.refundPolicy) || {}).label || "—"}`,
    `Estimated Delivery: ${q.deliveryDays ? q.deliveryDays + " days from advance payment" : "—"}`,
    "",
    "Thank you for your custom order.",
  ].filter(l => l !== null).join("\n");
}
function downloadCustomRequestInvoice(request){
  const blob = new Blob([buildCustomRequestInvoiceText(request)], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${request.id}-invoice.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   SUPPLIER MANAGEMENT (Future Ready)
   Not built yet — admin-only, no customer-facing surface. Architecture
   note for when it is: a separate alt_suppliers_v1 store keyed by
   supplier id, records shaped like
     { id, name, price, leadTimeDays, reliabilityScore, country, notes }
   with each custom request optionally carrying a `supplierId` once
   sourced, so the admin Custom Requests drawer can show which
   supplier is fulfilling a given order without changing the request
   schema itself.
   ================================================================ */
