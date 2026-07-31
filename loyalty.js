/* ================================================================
   LOYALTY / REWARD POINTS
   Same architecture as order-service.js/custom-requests.js: one
   localStorage-backed dataset (alt_loyalty_v1, per-user store),
   read/written through these functions everywhere. Depends on
   order-service.js (siteSettings, pushCustomerNotification) — load
   this file after it.

   Earning: 1 point per loyaltyEarnRateBDT spent, awarded once an
   order is actually delivered (not just placed — a cancelled or
   returned order never earned anything real).
   Redeeming: applied as a straight discount at checkout, worth
   loyaltyPointValueBDT each. The balance is only ever debited once
   an order is actually created, mirroring how the online-payment
   flow only creates the order after payment is confirmed — a
   checkout that's abandoned mid-way never loses points for it.
   ================================================================ */

const LOYALTY_KEY = "alt_loyalty_v1";

function loyaltySettings(){
  const s = (typeof siteSettings === "function") ? siteSettings() : {};
  return {
    enabled: s.loyaltyEnabled !== false,
    earnRateBDT: Number(s.loyaltyEarnRateBDT) > 0 ? Number(s.loyaltyEarnRateBDT) : 100,
    pointValueBDT: Number(s.loyaltyPointValueBDT) > 0 ? Number(s.loyaltyPointValueBDT) : 1,
    minRedeemPoints: Number(s.loyaltyMinRedeemPoints) >= 0 ? Number(s.loyaltyMinRedeemPoints) : 100,
  };
}

function readLoyaltyRaw(){ try { return JSON.parse(localStorage.getItem(LOYALTY_KEY) || "{}"); } catch (e) { return {}; } }
function writeLoyaltyRaw(store){ localStorage.setItem(LOYALTY_KEY, JSON.stringify(store)); }

function loyaltyAccount(userId){
  const store = readLoyaltyRaw();
  return store[userId] || { balance: 0, history: [] };
}

function pointsToBDT(points){ return Math.round(points * loyaltySettings().pointValueBDT); }
function bdtToMaxPoints(amountBDT){ return Math.floor(amountBDT / loyaltySettings().pointValueBDT); }

/* Called from order-service.js's advanceOrderStatus() the moment an
   order reaches "delivered" — see the hook there. Idempotent per
   order (checks history first) so a status re-save never double-pays. */
function earnLoyaltyPoints(userId, orderId, orderTotalBDT){
  const settings = loyaltySettings();
  if (!settings.enabled || !userId || userId === "guest") return;
  const store = readLoyaltyRaw();
  const account = store[userId] || { balance: 0, history: [] };
  if (account.history.some(h => h.type === "earned" && h.orderId === orderId)) return; // already awarded

  const points = Math.floor(orderTotalBDT / settings.earnRateBDT);
  if (points <= 0) return;
  account.balance += points;
  account.history.unshift({ type: "earned", points, orderId, at: Date.now() });
  store[userId] = account;
  writeLoyaltyRaw(store);

  pushCustomerNotification(userId, {
    category: "Order Updates",
    title: `You earned ${points} reward point${points === 1 ? "" : "s"}.`,
    body: `From order ${orderId} — worth ${bdt(pointsToBDT(points))} toward your next purchase.`,
    orderId,
  });
}

/* Debits the account immediately (called once checkout has actually
   created the order — see checkout.html) and logs the redemption
   against that order for the history view. */
function redeemLoyaltyPoints(userId, points, orderId){
  if (!userId || userId === "guest" || points <= 0) return { ok: false };
  const store = readLoyaltyRaw();
  const account = store[userId] || { balance: 0, history: [] };
  if (points > account.balance) return { ok: false, error: "Not enough points." };
  account.balance -= points;
  account.history.unshift({ type: "redeemed", points, orderId, at: Date.now() });
  store[userId] = account;
  writeLoyaltyRaw(store);
  return { ok: true, discountBDT: pointsToBDT(points) };
}

/* How many points a customer could redeem right now, capped by both
   their balance and the order total itself (can't discount below ৳0). */
function maxRedeemablePoints(userId, orderTotalBDT){
  const settings = loyaltySettings();
  if (!settings.enabled) return 0;
  const account = loyaltyAccount(userId);
  if (account.balance < settings.minRedeemPoints) return 0;
  return Math.min(account.balance, bdtToMaxPoints(orderTotalBDT));
}

/* General-purpose credit, not tied to a delivered order — used for the
   store-credit refund path in returns.js (and available for any future
   manual admin adjustment). */
function creditLoyaltyPoints(userId, points, note){
  if (!userId || userId === "guest" || points <= 0) return;
  const store = readLoyaltyRaw();
  const account = store[userId] || { balance: 0, history: [] };
  account.balance += points;
  account.history.unshift({ type: "earned", points, orderId: note || null, at: Date.now() });
  store[userId] = account;
  writeLoyaltyRaw(store);
}
