/* ================================================================
   RETURN / EXCHANGE REQUEST SERVICE
   Same architecture as custom-requests.js: one localStorage-backed
   dataset (alt_returns_v1, per-user store), read/written through
   these functions everywhere — dashboard.html (customer) and
   admin.js (staff) both go through here, never touch the raw key.
   Depends on order-service.js (siteSettings, pushCustomerNotification)
   and loyalty.js (creditLoyaltyPoints, for the store-credit refund
   path) — load this file after both.
   ================================================================ */

const RETURNS_KEY = "alt_returns_v1";
const RETURN_SEQ_KEY = "alt_return_seq_v1";

const RETURN_STATUSES = [
  { slug: "requested",         label: "Requested" },
  { slug: "under-review",      label: "Under Review" },
  { slug: "approved",          label: "Approved" },
  { slug: "awaiting-shipment", label: "Awaiting Your Shipment" },
  { slug: "item-received",     label: "Item Received" },
  { slug: "quality-check",     label: "Quality Check" },
  { slug: "resolved",          label: "Resolved" },
  { slug: "completed",         label: "Completed" },
];
const RETURN_TERMINAL_STATUSES = [
  { slug: "rejected",  label: "Rejected" },
  { slug: "cancelled", label: "Cancelled" },
];
const RETURN_ALL_STATUSES = RETURN_STATUSES.concat(RETURN_TERMINAL_STATUSES);
const RETURN_STATUS_INDEX = {};
RETURN_STATUSES.forEach((s, i) => { RETURN_STATUS_INDEX[s.slug] = i; });

const RETURN_STATUS_BADGE_CLASS = {
  requested: "badge-neutral", "under-review": "badge-warn", approved: "badge-good",
  "awaiting-shipment": "badge-warn", "item-received": "badge-warn", "quality-check": "badge-warn",
  resolved: "badge-good", completed: "badge-good", rejected: "badge-bad", cancelled: "badge-bad",
};
function returnStatusMeta(slug){
  const s = RETURN_ALL_STATUSES.find(x => x.slug === slug);
  return { slug, label: s ? s.label : slug, badgeClass: RETURN_STATUS_BADGE_CLASS[slug] || "badge-neutral" };
}

const RETURN_TYPES = [
  { slug: "return",   label: "Return for Refund" },
  { slug: "exchange", label: "Exchange for Another Size/Color" },
];
const RETURN_REASONS = [
  "Damaged or Defective", "Wrong Item Received", "Doesn't Fit", "Not as Described", "Changed My Mind", "Other",
];
const REFUND_METHODS = [
  { slug: "original-payment", label: "Refund to Original Payment Method" },
  { slug: "store-credit",     label: "Store Credit (Reward Points)" },
];

/* ================================================================
   ELIGIBILITY — matches the 14-day window already promised on the
   About page's FAQ; configurable so that promise and this code never
   drift apart silently.
   ================================================================ */
function returnWindowDays(){
  const s = (typeof siteSettings === "function") ? siteSettings() : {};
  const n = Number(s.returnWindowDays);
  return n > 0 ? n : 14;
}
function orderDeliveredAt(order){
  const step = (order.timeline || []).find(t => t.label === "Delivered" && t.done);
  return step ? step.at : null;
}
function isOrderReturnEligible(order){
  if (order.status !== "delivered") return false;
  const deliveredAt = orderDeliveredAt(order);
  if (!deliveredAt) return false;
  return (Date.now() - deliveredAt) <= returnWindowDays() * 86400000;
}

/* ================================================================
   STORAGE
   ================================================================ */
function readReturnsRaw(){ try { return JSON.parse(localStorage.getItem(RETURNS_KEY) || "{}"); } catch (e) { return {}; } }
function writeReturnsRaw(store){ localStorage.setItem(RETURNS_KEY, JSON.stringify(store)); }

function allReturnRequests(){
  const store = readReturnsRaw();
  const out = [];
  Object.keys(store).forEach(userId => (store[userId] || []).forEach(r => out.push(Object.assign({ userId }, r))));
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
function returnRequestsForUser(userId){
  return (readReturnsRaw()[userId] || []).slice().sort((a, b) => b.createdAt - a.createdAt);
}
function getReturnRequestById(id){ return allReturnRequests().find(r => r.id === id) || null; }

function saveReturnRequest(request){
  const store = readReturnsRaw();
  const list = store[request.userId] || [];
  const idx = list.findIndex(r => r.id === request.id);
  const clean = Object.assign({}, request); delete clean.userId;
  if (idx > -1) list[idx] = clean; else list.unshift(clean);
  store[request.userId] = list;
  writeReturnsRaw(store);
}
function nextReturnRequestId(){
  let seq = 0;
  try { seq = parseInt(localStorage.getItem(RETURN_SEQ_KEY) || "0", 10) || 0; } catch (e) { seq = 0; }
  seq += 1;
  localStorage.setItem(RETURN_SEQ_KEY, String(seq));
  return `RET-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

/* One request per order per item-set is not enforced — a customer
   could reasonably file twice for different items on the same order —
   but the same exact still-open request shouldn't be resubmitted. */
function hasOpenReturnRequest(userId, orderId){
  return returnRequestsForUser(userId).some(r => r.orderId === orderId && !["completed", "rejected", "cancelled"].includes(r.status));
}

/* ================================================================
   SUBMIT
   ================================================================ */
function submitReturnRequest(payload){
  const errors = [];
  if (!payload.userId || payload.userId === "guest") errors.push("Please sign in to submit a request.");
  if (!payload.orderId) errors.push("Choose which order this is for.");
  if (!RETURN_TYPES.some(t => t.slug === payload.type)) errors.push("Choose return or exchange.");
  if (!payload.reason || !payload.reason.trim()) errors.push("Tell us the reason.");
  if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push("Select at least one item.");
  if (payload.type === "exchange" && !payload.exchangeFor) errors.push("Choose what you'd like to exchange it for.");
  if (errors.length) return { ok: false, errors };

  const now = Date.now();
  const request = {
    id: nextReturnRequestId(),
    userId: payload.userId,
    orderId: payload.orderId,
    items: payload.items,
    type: payload.type,
    reasonCategory: payload.reasonCategory || "Other",
    reason: payload.reason.trim(),
    exchangeFor: payload.type === "exchange" ? payload.exchangeFor : null,
    images: Array.isArray(payload.images) ? payload.images.slice(0, 4) : [],
    status: "requested",
    statusHistory: [{ status: "requested", at: now, note: "" }],
    refundMethod: null,
    refundAmount: null,
    internalNotes: [],
    createdAt: now,
    updatedAt: now,
  };
  saveReturnRequest(request);
  pushCustomerNotification(payload.userId, {
    category: "Order Updates",
    title: `${request.type === "exchange" ? "Exchange" : "Return"} request ${request.id} received.`,
    body: `We'll review your request for order ${request.orderId} and follow up here.`,
    orderId: request.orderId,
  });
  return { ok: true, request };
}

/* ================================================================
   STATUS PROGRESSION
   ================================================================ */
const RETURN_STATUS_NOTIFY_BODY = {
  "under-review": "Our team is taking a closer look at your request.",
  approved: "Your request was approved — see the next step in your Returns tab.",
  "awaiting-shipment": "Please send the item back using the instructions in your Returns tab.",
  "item-received": "We've received your item and will inspect it shortly.",
  "quality-check": "We're inspecting the returned item now.",
  resolved: "Your refund or replacement has been processed.",
  completed: "This request is complete — thank you.",
  rejected: "See the note on your request for details.",
  cancelled: "This request has been cancelled.",
};
function advanceReturnStatus(request, newSlug, note){
  const now = Date.now();
  request.status = newSlug;
  request.statusHistory = request.statusHistory || [];
  request.statusHistory.push({ status: newSlug, at: now, note: note || "" });
  request.updatedAt = now;
  saveReturnRequest(request);
  pushCustomerNotification(request.userId, {
    category: "Order Updates",
    title: `${request.type === "exchange" ? "Exchange" : "Return"} ${request.id} is now ${returnStatusMeta(newSlug).label}.`,
    body: RETURN_STATUS_NOTIFY_BODY[newSlug] || "Track the latest status from Returns.",
    orderId: request.orderId,
  });
  return request;
}

function canCancelReturnRequest(request){
  return ["requested", "under-review"].includes(request.status);
}
function cancelReturnRequest(request){
  if (!canCancelReturnRequest(request)) return { ok: false };
  advanceReturnStatus(request, "cancelled", "Cancelled by customer.");
  return { ok: true };
}

/* ================================================================
   RESOLUTION — admin picks the refund method and amount once the
   returned item has passed inspection.
   ================================================================ */
function resolveReturnRequest(request, { refundMethod, refundAmount, note }){
  request.refundMethod = REFUND_METHODS.some(m => m.slug === refundMethod) ? refundMethod : "original-payment";
  request.refundAmount = Math.max(0, Number(refundAmount) || 0);
  saveReturnRequest(request);

  if (request.type === "return" && request.refundMethod === "store-credit" && request.refundAmount > 0 && typeof creditLoyaltyPoints === "function"){
    creditLoyaltyPoints(request.userId, bdtToMaxPoints(request.refundAmount), `Store credit for ${request.id}`);
  }
  advanceReturnStatus(request, "resolved", note || "Refund/exchange processed.");
}
