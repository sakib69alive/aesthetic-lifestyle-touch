/* ================================================================
   SSLCOMMERZ PAYMENT ROUTES
   One integration covers bKash, Nagad, Rocket, and cards — SSLCommerz
   is the aggregator, the customer picks their method on SSLCommerz's
   own hosted payment page. This file only ever talks to SSLCommerz's
   server directly for anything that decides real money changed hands
   (session init + validation) — the browser redirect alone is never
   trusted, exactly per the spec's "verify payments through secure
   payment gateway webhooks" requirement.
   ================================================================ */
const express = require("express");
const { insertTransaction, getTransaction, markTransactionStatus } = require("../db");

const router = express.Router();

const isLive = String(process.env.SSLCOMMERZ_IS_LIVE).toLowerCase() === "true";
const GATEWAY_HOST = isLive ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
const STORE_ID = process.env.SSLCOMMERZ_STORE_ID;
const STORE_PASSWD = process.env.SSLCOMMERZ_STORE_PASSWD;
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:4000";
const SITE_BASE_URL = process.env.SITE_BASE_URL || "http://localhost:5500";

function credentialsConfigured(){
  return !!(STORE_ID && STORE_PASSWD && STORE_ID !== "your_sandbox_store_id");
}

/* ---------------- 1. INITIATE ----------------
   Frontend calls this with the order it already built (in localStorage)
   — the server never needs to know about products, cart lines, or
   accounts, it just needs an amount and something to call back with. */
router.post("/init", async (req, res) => {
  if (!credentialsConfigured()){
    return res.status(503).json({ ok: false, error: "SSLCommerz credentials aren't set up yet — see server/.env.example." });
  }
  const { orderId, amount, customerName, customerEmail, customerPhone, purpose } = req.body || {};
  if (!orderId || !amount || Number(amount) <= 0){
    return res.status(400).json({ ok: false, error: "orderId and a positive amount are required." });
  }

  const tranId = `TXN-${orderId}-${Date.now()}`;
  insertTransaction({ orderId, tranId, amount: Number(amount), customerName, customerEmail, customerPhone, purpose });

  const payload = new URLSearchParams({
    store_id: STORE_ID,
    store_passwd: STORE_PASSWD,
    total_amount: String(Number(amount)),
    currency: "BDT",
    tran_id: tranId,
    success_url: `${SERVER_BASE_URL}/api/payment/success`,
    fail_url: `${SERVER_BASE_URL}/api/payment/fail`,
    cancel_url: `${SERVER_BASE_URL}/api/payment/cancel`,
    ipn_url: `${SERVER_BASE_URL}/api/payment/ipn`,
    shipping_method: "NO",
    product_name: purpose === "custom-request" ? "Custom Product Request" : "Store Order",
    product_category: "General",
    product_profile: "general",
    cus_name: customerName || "Customer",
    cus_email: customerEmail || "customer@example.com",
    cus_add1: "N/A",
    cus_city: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: customerPhone || "01700000000",
  });

  try {
    const resp = await fetch(`${GATEWAY_HOST}/gwprocess/v4/api.php`, { method: "POST", body: payload });
    const data = await resp.json();
    if (data.status !== "SUCCESS" || !data.GatewayPageURL){
      return res.status(502).json({ ok: false, error: data.failedreason || "SSLCommerz rejected the session." });
    }
    res.json({ ok: true, gatewayUrl: data.GatewayPageURL, tranId });
  } catch (err) {
    res.status(502).json({ ok: false, error: "Could not reach SSLCommerz: " + err.message });
  }
});

/* ---------------- 2. VALIDATE ----------------
   Shared by the redirect handlers and the IPN handler below — the one
   place that actually asks SSLCommerz "did this val_id really clear?"
   instead of trusting whatever the browser or a POST body claims. */
async function validateWithSslcommerz(valId){
  const params = new URLSearchParams({ val_id: valId, store_id: STORE_ID, store_passwd: STORE_PASSWD, format: "json" });
  const resp = await fetch(`${GATEWAY_HOST}/validator/api/validationserverAPI.php?${params.toString()}`);
  return resp.json();
}

async function handleGatewayCallback(req, res, outcome){
  const body = req.body || {};
  const tranId = body.tran_id;
  const t = tranId ? getTransaction(tranId) : null;

  if (outcome === "success" && t && body.val_id){
    try {
      const validation = await validateWithSslcommerz(body.val_id);
      const amountMatches = Math.abs(Number(validation.amount) - t.amount) < 1;
      const genuinelyValid = (validation.status === "VALID" || validation.status === "VALIDATED") && amountMatches;
      markTransactionStatus(tranId, genuinelyValid ? "success" : "failed", {
        valId: body.val_id, cardType: validation.card_type, bankTranId: validation.bank_tran_id,
      });
    } catch (err) {
      markTransactionStatus(tranId, "failed");
    }
  } else if (t) {
    markTransactionStatus(tranId, outcome);
  }

  res.redirect(302, `${SITE_BASE_URL}/checkout.html?payment_return=1&tran_id=${encodeURIComponent(tranId || "")}`);
}

router.post("/success", (req, res) => handleGatewayCallback(req, res, "success"));
router.post("/fail", (req, res) => handleGatewayCallback(req, res, "failed"));
router.post("/cancel", (req, res) => handleGatewayCallback(req, res, "cancelled"));

/* ---------------- 3. IPN ----------------
   SSLCommerz calls this server-to-server regardless of whether the
   customer's browser ever makes it back to success_url (closed tab,
   flaky connection, etc.) — the more reliable of the two signals. */
router.post("/ipn", async (req, res) => {
  const body = req.body || {};
  const tranId = body.tran_id;
  const t = tranId ? getTransaction(tranId) : null;
  if (t && body.val_id && body.status === "VALID"){
    try {
      const validation = await validateWithSslcommerz(body.val_id);
      const amountMatches = Math.abs(Number(validation.amount) - t.amount) < 1;
      const genuinelyValid = (validation.status === "VALID" || validation.status === "VALIDATED") && amountMatches;
      markTransactionStatus(tranId, genuinelyValid ? "success" : "failed", {
        valId: body.val_id, cardType: validation.card_type, bankTranId: validation.bank_tran_id,
      });
    } catch (err) { /* IPN retries on SSLCommerz's side if this fails silently */ }
  }
  res.sendStatus(200);
});

/* ---------------- 4. STATUS ----------------
   The frontend's only real source of truth after returning from the
   gateway — never read "success" off the URL query string alone. */
router.get("/status/:tranId", (req, res) => {
  const t = getTransaction(req.params.tranId);
  if (!t) return res.status(404).json({ ok: false, error: "Unknown transaction." });
  res.json({ ok: true, status: t.status, orderId: t.order_id, amount: t.amount, tranId: t.tran_id });
});

module.exports = router;
