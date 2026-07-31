/* ================================================================
   REWARD VAULT — gamified scratch-card reward system.
   Same architecture as every other feature this project has: plain
   localStorage datasets, read/written only through these functions,
   shared by request-... no wait, by checkout.html/dashboard.html
   (customer) and admin.js (staff). Depends on cart.js (bdt, the
   alt_admin_coupons_v1 coupon store), order-service.js
   (pushCustomerNotification), and loyalty.js (this system's "Coins"
   balance IS the existing loyalty balance — see the note above
   loyaltyTier() below for why these were merged instead of building
   a second parallel currency). Load this file after all three.

   Branding: the hub page/section is "Reward Vault"; the individual
   scratch-off unit is a "Mystery Reward" card — matches the vault/gift
   metaphor from the brief without repeating "Reward" in both names.
   ================================================================ */

/* ================================================================
   REWARD TEMPLATES — admin-defined pool, each with a probability
   weight. Selection normalizes weights at draw time, so they never
   have to sum to exactly 100.
   ================================================================ */
const REWARD_TEMPLATES_KEY = "alt_reward_templates_v1";
const REWARD_TYPES = [
  { slug: "percentage",     label: "Percentage Discount" },
  { slug: "fixed",          label: "Fixed Amount Discount" },
  { slug: "free-shipping",  label: "Free Shipping" },
  { slug: "coins",          label: "Coins" },
  { slug: "free-gift",      label: "Free Gift" },
  { slug: "nothing",        label: "Better Luck Next Time" },
];

function defaultRewardTemplates(){
  return [
    { id: "tpl_5off",    label: "5% Off",        type: "percentage", value: 5,   probability: 45, expiryDays: 30, minPurchase: 0,    maxDiscount: null, active: true },
    { id: "tpl_10off",   label: "10% Off",       type: "percentage", value: 10,  probability: 25, expiryDays: 30, minPurchase: 1000, maxDiscount: 1000, active: true },
    { id: "tpl_15off",   label: "15% Off",       type: "percentage", value: 15,  probability: 10, expiryDays: 20, minPurchase: 2000, maxDiscount: 1500, active: true },
    { id: "tpl_20off",   label: "20% Off",       type: "percentage", value: 20,  probability: 4,  expiryDays: 14, minPurchase: 3000, maxDiscount: 2000, active: true },
    { id: "tpl_freeship",label: "Free Shipping", type: "free-shipping", value: 0, probability: 6, expiryDays: 21, minPurchase: 0,    maxDiscount: null, active: true },
    { id: "tpl_c100",    label: "100 Coins",     type: "coins",      value: 100, probability: 6,  active: true },
    { id: "tpl_c500",    label: "500 Coins",     type: "coins",      value: 500, probability: 2,  active: true },
    { id: "tpl_nothing", label: "Better Luck Next Time", type: "nothing", value: 0, probability: 2, active: true },
  ];
}
function allRewardTemplates(){
  try {
    const saved = JSON.parse(localStorage.getItem(REWARD_TEMPLATES_KEY) || "null");
    return Array.isArray(saved) ? saved : defaultRewardTemplates();
  } catch (e) { return defaultRewardTemplates(); }
}
function saveRewardTemplates(list){ localStorage.setItem(REWARD_TEMPLATES_KEY, JSON.stringify(list)); }

function drawRewardTemplate(pool){
  const candidates = (pool || allRewardTemplates()).filter(t => t.active);
  const totalWeight = candidates.reduce((s, t) => s + (Number(t.probability) || 0), 0);
  if (totalWeight <= 0) return candidates[0] || null;
  let roll = Math.random() * totalWeight;
  for (const t of candidates){
    roll -= (Number(t.probability) || 0);
    if (roll <= 0) return t;
  }
  return candidates[candidates.length - 1];
}

/* ================================================================
   COUPON GENERATION — writes into the SAME alt_admin_coupons_v1 store
   cart.js's getAdminCoupon()/checkout already read, so a reward-issued
   code works at checkout with zero extra plumbing. customerId locks
   it to whoever won it (see the cart.js patch below).
   ================================================================ */
function generateUniqueCouponCode(){
  const existing = new Set((JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]")).map(c => c.code));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read off a screen
  let code;
  do {
    code = Array.from({ length: 7 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existing.has(code));
  return code;
}
function issueCouponForTemplate(template, userId){
  const list = JSON.parse(localStorage.getItem("alt_admin_coupons_v1") || "[]");
  const code = generateUniqueCouponCode();
  const now = Date.now();
  list.push({
    code,
    type: template.type,
    value: template.value,
    minPurchase: template.minPurchase || 0,
    maxDiscount: template.maxDiscount || null,
    expiry: template.expiryDays ? now + template.expiryDays * 86400000 : null,
    usageLimit: 1,
    usedCount: 0,
    active: true,
    customerId: userId,
    singleUse: true,
    source: "reward",
    createdAt: now,
    redeemedAt: null,
  });
  localStorage.setItem("alt_admin_coupons_v1", JSON.stringify(list));
  return code;
}

/* ================================================================
   SCRATCH CARDS — per-user store, one issued per order (idempotent —
   re-advancing an order to "delivered" twice never issues a second
   card) or per successful promo-code claim.
   ================================================================ */
const SCRATCH_CARDS_KEY = "alt_scratch_cards_v1";
const SCRATCH_SEQ_KEY = "alt_scratch_card_seq_v1";

function readScratchCardsRaw(){ try { return JSON.parse(localStorage.getItem(SCRATCH_CARDS_KEY) || "{}"); } catch (e) { return {}; } }
function writeScratchCardsRaw(store){ localStorage.setItem(SCRATCH_CARDS_KEY, JSON.stringify(store)); }
function scratchCardsForUser(userId){ return (readScratchCardsRaw()[userId] || []).slice().sort((a, b) => b.createdAt - a.createdAt); }
function saveScratchCard(card){
  const store = readScratchCardsRaw();
  const list = store[card.userId] || [];
  const idx = list.findIndex(c => c.id === card.id);
  const clean = Object.assign({}, card); delete clean.userId;
  if (idx > -1) list[idx] = clean; else list.unshift(clean);
  store[card.userId] = list;
  writeScratchCardsRaw(store);
}
function nextScratchCardId(){
  let seq = 0;
  try { seq = parseInt(localStorage.getItem(SCRATCH_SEQ_KEY) || "0", 10) || 0; } catch (e) { seq = 0; }
  seq += 1;
  localStorage.setItem(SCRATCH_SEQ_KEY, String(seq));
  return `SCR-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

/* Idempotent per order — safe to call from advanceOrderStatus() even
   if a status gets re-saved without actually changing. */
function hasScratchCardForOrder(userId, orderId){
  return scratchCardsForUser(userId).some(c => c.source === "order" && c.sourceRef === orderId);
}
function issueScratchCard(userId, source, sourceRef, pool){
  if (!userId || userId === "guest") return null;
  const template = drawRewardTemplate(pool);
  if (!template) return null;
  const rewardSnapshot = { type: template.type, label: template.label, value: template.value };
  if (["percentage", "fixed", "free-shipping"].includes(template.type)){
    rewardSnapshot.couponCode = issueCouponForTemplate(template, userId);
    rewardSnapshot.expiry = template.expiryDays ? Date.now() + template.expiryDays * 86400000 : null;
    rewardSnapshot.minPurchase = template.minPurchase || 0;
  }
  const card = {
    id: nextScratchCardId(),
    userId,
    source, // "order" | "claim"
    sourceRef, // orderId or promo code
    templateId: template.id,
    rewardSnapshot,
    scratched: false,
    scratchedAt: null,
    createdAt: Date.now(),
  };
  saveScratchCard(card);
  pushCustomerNotification(userId, {
    category: "Order Updates",
    title: "You received a Mystery Reward!",
    body: "Scratch it to reveal what you won — find it in Account → Reward Vault.",
  });
  return card;
}

/* Reveals + applies the reward. coins/points credit immediately;
   coupon codes were already generated at issue time (so the code
   printed on the card never changes), this just marks it opened. */
function scratchCard(cardId, userId){
  const list = scratchCardsForUser(userId);
  const card = list.find(c => c.id === cardId);
  if (!card || card.scratched) return card;
  card.scratched = true;
  card.scratchedAt = Date.now();
  saveScratchCard(Object.assign({ userId }, card));
  if (card.rewardSnapshot.type === "coins" && typeof creditLoyaltyPoints === "function"){
    creditLoyaltyPoints(userId, card.rewardSnapshot.value, card.id);
  }
  return card;
}

/* ================================================================
   LOYALTY TIER — "Points/VIP Level" from the brief. Rather than a
   second parallel point balance, this is derived from the same
   loyalty.js ledger's lifetime earnings (coins earned ever, not the
   current spendable balance) — a customer who redeems coins for a
   discount doesn't lose their tier progress for having spent them.
   ================================================================ */
const LOYALTY_TIERS = [
  { slug: "bronze",  label: "Bronze",  minLifetime: 0 },
  { slug: "silver",  label: "Silver",  minLifetime: 500 },
  { slug: "gold",    label: "Gold",    minLifetime: 2000 },
  { slug: "diamond", label: "Diamond", minLifetime: 5000 },
  { slug: "vip",     label: "VIP",     minLifetime: 10000 },
];
function lifetimeCoinsEarned(userId){
  const account = (typeof loyaltyAccount === "function") ? loyaltyAccount(userId) : { history: [] };
  return account.history.filter(h => h.type === "earned").reduce((s, h) => s + h.points, 0);
}
function loyaltyTier(userId){
  const lifetime = lifetimeCoinsEarned(userId);
  let current = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (lifetime >= t.minLifetime) current = t;
  const next = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(current) + 1] || null;
  return { tier: current, next, lifetime, toNext: next ? next.minLifetime - lifetime : 0 };
}

/* ================================================================
   PROMOTIONAL / CLAIM CODES — admin-created (SUMMER25, EID2026…),
   redeemed once per customer in the Reward Vault's "Claim Reward" box.
   Distinct from the auto-issued single-use coupons above.
   ================================================================ */
const PROMO_CODES_KEY = "alt_promo_codes_v1";
const PROMO_CLAIMS_KEY = "alt_promo_claims_v1"; // { [code]: [userId, ...] }

function allPromoCodes(){ try { return JSON.parse(localStorage.getItem(PROMO_CODES_KEY) || "[]"); } catch (e) { return []; } }
function savePromoCodes(list){ localStorage.setItem(PROMO_CODES_KEY, JSON.stringify(list)); }
function getPromoCode(code){ return allPromoCodes().find(p => p.code === code.trim().toUpperCase()) || null; }

function promoClaimsFor(code){
  try { return (JSON.parse(localStorage.getItem(PROMO_CLAIMS_KEY) || "{}"))[code] || []; } catch (e) { return []; }
}
function recordPromoClaim(code, userId){
  const store = JSON.parse(localStorage.getItem(PROMO_CLAIMS_KEY) || "{}");
  store[code] = (store[code] || []).concat(userId);
  localStorage.setItem(PROMO_CLAIMS_KEY, JSON.stringify(store));
}

/* Simple client-side cooldown against rapid-fire code guessing — this
   is a deterrent, not real protection (a static, no-backend site has
   no way to see real client IPs or truly rate-limit server-side; see
   the honeypot/timing check in auth.js for the same honest tradeoff). */
const PROMO_CLAIM_COOLDOWN_MS = 3000;
let lastPromoClaimAttempt = 0;

/* Owner/QA faucet — not a real promo, never shown in the admin Promo
   Codes list, never claim-tracked. Lets the store owner spot-check the
   scratch-card pipeline any time without burning a real one-per-account
   code. Deliberately not gated by claim history — that's the whole
   point, it has to work again on the very next entry. */
const MASTER_TEST_PROMO_CODE = "SAKIB@";

function claimPromoCode(code, userId){
  const now = Date.now();
  if (now - lastPromoClaimAttempt < PROMO_CLAIM_COOLDOWN_MS) return { ok: false, error: "Please wait a moment before trying again." };
  lastPromoClaimAttempt = now;

  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Enter a code first." };

  if (trimmed === MASTER_TEST_PROMO_CODE){
    const card = issueScratchCard(userId, "claim", trimmed);
    if (!card) return { ok: false, error: "No rewards are currently configured." };
    return { ok: true, card };
  }

  const promo = getPromoCode(trimmed);
  if (!promo || !promo.active) return { ok: false, error: "That code isn't valid." };
  if (promo.expiry && promo.expiry < now) return { ok: false, error: "That code has expired." };
  const claims = promoClaimsFor(trimmed);
  if (promo.claimLimit && claims.length >= promo.claimLimit) return { ok: false, error: "This code has reached its claim limit." };
  if (claims.includes(userId)) return { ok: false, error: "You've already claimed this code." };
  if (promo.eligibility?.existingCustomersOnly && myOrdersCount(userId) === 0) return { ok: false, error: "This code is for existing customers only." };
  if (promo.eligibility?.firstPurchaseOnly && myOrdersCount(userId) > 0) return { ok: false, error: "This code is only for first-time customers." };

  recordPromoClaim(trimmed, userId);
  const pool = promo.templatePoolIds && promo.templatePoolIds.length
    ? allRewardTemplates().filter(t => promo.templatePoolIds.includes(t.id))
    : null;
  const card = issueScratchCard(userId, "claim", trimmed, pool);
  if (!card) return { ok: false, error: "No rewards are currently configured for this code." };
  return { ok: true, card };
}

/* Small helper so eligibility checks above don't need order-service.js's
   own function name memorized differently in this file. */
function myOrdersCount(userId){
  try { return (typeof ordersForUser === "function") ? ordersForUser(userId).length : 0; } catch (e) { return 0; }
}
