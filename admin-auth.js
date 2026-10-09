/* ================================================================
   ADMIN AUTH — shared by admin.html and cms.html, so one login
   session covers both. Separate from the customer Auth in auth.js on
   purpose. Same SubtleCrypto hashing approach (via Auth.hash), own
   session key, so admin access never depends on which customer
   happens to be logged into this browser.
   ================================================================ */
const ADMIN_KEY = "alt_admin_v1";
const ADMIN_SESSION_KEY = "alt_admin_session_v1";
const ADMIN_LOGIN_HISTORY_KEY = "alt_admin_login_history_v1";
const ADMIN_LOCKOUT_KEY = "alt_admin_lockout_v1";
const ADMIN_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // re-login required after 24h
const ADMIN_LOCKOUT_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;   // failed attempts older than this don't count
const ADMIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // how long a lockout lasts

/* TEMPORARY: while true, anyone who opens admin.html / cms.html goes straight
   in with no login. Set back to false to restore the normal password gate
   (nothing else needs to change — login, lockout and sessions are intact). */
const ADMIN_LOCK_OFF = false;

/* The owner login. Signing in on account.html with these credentials goes
   straight to the admin panel (see AdminAuth.loginOwner). Only the SHA-256
   hash of the password is stored here, but note that this is a static site:
   everything in this file is public, so a short password can be guessed. */
const ADMIN_OWNER_EMAIL = "sakib69alive@gmail.com";
const ADMIN_OWNER_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
const ADMIN_OLD_SEED_EMAIL = "owner@aestheticlifestyletouch.com";

const AdminAuth = {
  record(){ try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || "null"); } catch (e) { return null; } },
  save(rec){ localStorage.setItem(ADMIN_KEY, JSON.stringify(rec)); },
  session(){
    let s;
    try { s = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null"); } catch (e) { return null; }
    if (!s) return null;
    if (s.expiresAt && Date.now() > s.expiresAt){ this.logout(); return null; }
    return s;
  },
  isLoggedIn(){ return ADMIN_LOCK_OFF || !!this.session(); },
  ownerRecord(createdAt){
    return { email: ADMIN_OWNER_EMAIL, name: "Store Owner", role: "Owner", passwordHash: ADMIN_OWNER_HASH, createdAt: createdAt || Date.now() };
  },
  async ensureSeeded(){
    const rec = this.record();
    // fresh browser, or the old placeholder owner account -> the real owner login
    if (!rec || rec.email === ADMIN_OLD_SEED_EMAIL) this.save(this.ownerRecord(rec && rec.createdAt));
  },
  /* Used by account.html's sign-in form: returns { handled:false } when the
     email isn't the owner's (the normal customer sign-in then runs). */
  async loginOwner(identifier, password){
    if (String(identifier || "").trim().toLowerCase() !== ADMIN_OWNER_EMAIL) return { handled: false };
    await this.ensureSeeded();
    const res = await this.login(identifier, password);
    return Object.assign({ handled: true }, res);
  },
  /* ---------------- brute-force lockout ---------------- */
  lockoutState(){ try { return JSON.parse(localStorage.getItem(ADMIN_LOCKOUT_KEY) || "null"); } catch (e) { return null; } },
  lockoutRemainingMs(){
    const s = this.lockoutState();
    if (!s || !s.lockedUntil) return 0;
    return Math.max(0, s.lockedUntil - Date.now());
  },
  recordFailedAttempt(){
    const now = Date.now();
    let s = this.lockoutState();
    if (!s || now - s.firstFailAt > ADMIN_LOCKOUT_WINDOW_MS) s = { count: 0, firstFailAt: now, lockedUntil: 0 };
    s.count += 1;
    if (s.count >= ADMIN_LOCKOUT_MAX_ATTEMPTS) s.lockedUntil = now + ADMIN_LOCKOUT_DURATION_MS;
    localStorage.setItem(ADMIN_LOCKOUT_KEY, JSON.stringify(s));
  },
  clearLockout(){ localStorage.removeItem(ADMIN_LOCKOUT_KEY); },
  async login(email, password){
    const remaining = this.lockoutRemainingMs();
    if (remaining > 0){
      const mins = Math.ceil(remaining / 60000);
      return { ok: false, error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
    }
    const rec = this.record();
    if (!rec){ this.recordFailedAttempt(); return { ok: false, error: "No admin account exists yet." }; }
    if (email.trim().toLowerCase() !== rec.email.toLowerCase()){ this.recordFailedAttempt(); return { ok: false, error: "Incorrect email or password." }; }
    const hash = await Auth.hash(password);
    if (hash !== rec.passwordHash){ this.recordFailedAttempt(); return { ok: false, error: "Incorrect email or password." }; }
    this.clearLockout();
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ loggedInAt: Date.now(), expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_MS }));
    this.logHistory();
    return { ok: true };
  },
  logout(){ localStorage.removeItem(ADMIN_SESSION_KEY); },
  logHistory(){
    const list = this.history();
    list.unshift({ at: Date.now(), device: navigator.userAgent.slice(0, 70) });
    localStorage.setItem(ADMIN_LOGIN_HISTORY_KEY, JSON.stringify(list.slice(0, 12)));
  },
  history(){ try { return JSON.parse(localStorage.getItem(ADMIN_LOGIN_HISTORY_KEY) || "[]"); } catch (e) { return []; } },
  async changePassword(current, next){
    const rec = this.record();
    if (await Auth.hash(current) !== rec.passwordHash) return { ok: false, error: "Current password is incorrect." };
    rec.passwordHash = await Auth.hash(next);
    this.save(rec);
    return { ok: true };
  },
};

/* ---------------- shared audit log (both apps write to the same trail) ---------------- */
const AUDIT_KEY = "alt_admin_audit_v1";
function auditLog(){ try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch (e) { return []; } }
function logAudit(action, detail){
  const list = auditLog();
  list.unshift({ at: Date.now(), action, detail: detail || "" });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 300)));
}
