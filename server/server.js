/* ================================================================
   PAYMENT SERVER
   The one piece of Aesthetic Lifestyle Touch that isn't a static
   file — everything else (auth, cart, orders, reviews, custom
   requests, admin) stays exactly as it was, running purely in the
   browser against localStorage. This server exists only to do the
   one thing a browser can never safely do alone: talk to SSLCommerz
   with real credentials and confirm that money actually moved.
   ================================================================ */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const paymentRoutes = require("./routes/payment");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // SSLCommerz posts success/fail/cancel/IPN as form data

app.use("/api/payment", paymentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, sslcommerzConfigured: !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_ID !== "your_sandbox_store_id") });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Payment server running on http://localhost:${PORT}`);
  if (!process.env.SSLCOMMERZ_STORE_ID || process.env.SSLCOMMERZ_STORE_ID === "your_sandbox_store_id"){
    console.log("⚠ SSLCommerz credentials not set — copy .env.example to .env and fill them in (see that file for the free sandbox signup link).");
  }
});
