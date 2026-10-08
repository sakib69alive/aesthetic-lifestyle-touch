/* ================================================================
   DATABASE — SQLite via Node's built-in node:sqlite (Node 22+), so
   there's no native module to compile on any machine this runs on.
   One table: every payment attempt this server has ever initiated,
   plus its confirmed outcome. The site's own order/cart/customer data
   stays exactly where it already lives — this table only exists to
   let the frontend ask "did this specific transaction actually get
   confirmed by SSLCommerz?" without trusting a URL query string.
   ================================================================ */
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const db = new DatabaseSync(path.join(__dirname, "payments.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    tran_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    val_id TEXT,
    card_type TEXT,
    bank_tran_id TEXT,
    purpose TEXT NOT NULL DEFAULT 'order',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

function insertTransaction(row){
  const now = Date.now();
  db.prepare(`
    INSERT INTO transactions (tran_id, order_id, amount, currency, customer_name, customer_email, customer_phone, purpose, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(row.tranId, row.orderId, row.amount, row.currency || "BDT", row.customerName || "", row.customerEmail || "", row.customerPhone || "", row.purpose || "order", now, now);
}

function getTransaction(tranId){
  return db.prepare(`SELECT * FROM transactions WHERE tran_id = ?`).get(tranId) || null;
}

function markTransactionStatus(tranId, status, extra){
  const t = getTransaction(tranId);
  if (!t) return null;
  db.prepare(`
    UPDATE transactions SET status = ?, val_id = ?, card_type = ?, bank_tran_id = ?, updated_at = ?
    WHERE tran_id = ?
  `).run(status, extra?.valId || t.val_id, extra?.cardType || t.card_type, extra?.bankTranId || t.bank_tran_id, Date.now(), tranId);
  return getTransaction(tranId);
}

module.exports = { db, insertTransaction, getTransaction, markTransactionStatus };
