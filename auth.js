/* ================================================================
   SHARED AUTH / SESSION MODULE
   Prototype-only identity layer for a static, no-backend site.
   Passwords are hashed client-side with SubtleCrypto (SHA-256, no
   salt) purely so nothing is stored in plain text in localStorage —
   this is NOT production security. A real deployment needs a server:
   salted+peppered password hashing (bcrypt/argon2), HTTPS, CSRF
   protection, server-side sessions, and input sanitization on the
   backend. Everything here is UI/UX scaffolding for that later work.
   ================================================================ */

const AUTH_USERS_KEY = "alt_users_v1";
const AUTH_SESSION_KEY = "alt_session_v1";
const AUTH_LOGIN_HISTORY_KEY = "alt_login_history_v1";

/* ================================================================
   LIGHTWEIGHT BOT DETERRENT
   Not a real CAPTCHA — that needs a server to issue/verify a challenge
   token. This is what a static site can honestly offer: a honeypot
   field (real visitors never fill it in, simple bots that auto-fill
   every field do) plus a submit-too-fast heuristic. Only when one of
   those trips do we show a visible human-check, so real visitors never
   see any extra friction.
   ================================================================ */
const BOT_CHECK_PAGE_LOADED_AT = Date.now();
function isSuspiciousSubmission(honeypotEl){
  const honeypotFilled = !!(honeypotEl && honeypotEl.value.trim());
  const tooFast = (Date.now() - BOT_CHECK_PAGE_LOADED_AT) < 1200;
  return honeypotFilled || tooFast;
}
function runHumanCheck(containerEl, onVerified){
  const a = 1 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 8);
  const box = document.createElement("div");
  box.style.cssText = "margin-top:12px;padding:14px;border:1px solid var(--alt-border);border-radius:14px;background:var(--alt-surface);";
  box.innerHTML = `
    <label class="field-label" style="display:block;margin-bottom:8px;">Quick check — what is ${a} + ${b}?</label>
    <div style="display:flex;gap:8px;">
      <input type="text" inputmode="numeric" class="field-input" style="flex:1;" id="hc-answer" autocomplete="off">
      <button type="button" class="btn-primary font-display bg-[var(--alt-black)] text-[var(--alt-white)] text-sm font-medium px-5 rounded-full" id="hc-verify">Verify</button>
    </div>
    <p id="hc-error" style="display:none;color:var(--alt-bad);font-size:11.5px;margin-top:6px;">That's not quite right — try again.</p>
  `;
  containerEl.appendChild(box);
  document.getElementById("hc-answer").focus();
  function verify(){
    const val = Number(document.getElementById("hc-answer").value);
    if (val === a + b){ box.remove(); onVerified(); }
    else { document.getElementById("hc-error").style.display = "block"; }
  }
  document.getElementById("hc-verify").addEventListener("click", verify);
  document.getElementById("hc-answer").addEventListener("keydown", e => { if (e.key === "Enter") verify(); });
}

const Auth = {
  users(){
    try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]"); }
    catch (e) { return []; }
  },
  saveUsers(list){ localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(list)); },

  session(){
    try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null"); }
    catch (e) { return null; }
  },
  saveSession(session){
    if (session) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_SESSION_KEY);
  },

  currentUser(){
    const s = this.session();
    if (!s) return null;
    return this.users().find(u => u.id === s.userId) || null;
  },
  isLoggedIn(){ return !!this.currentUser(); },

  async hash(text){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  },

  async signup({ firstName, lastName, email, phone, password, newsletter }){
    const users = this.users();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())){
      return { ok: false, error: "An account with this email already exists." };
    }
    const user = {
      id: "u_" + Date.now(),
      firstName, lastName, email, phone,
      passwordHash: await this.hash(password),
      newsletter: !!newsletter,
      avatar: null,
      emailVerified: false,
      twoFA: false,
      marketingPrefs: { promotions: !!newsletter, restock: true, orderUpdates: true },
      createdAt: Date.now(),
    };
    users.push(user);
    this.saveUsers(users);
    this.saveSession({ userId: user.id, rememberMe: true, loggedInAt: Date.now() });
    this.logLoginHistory(user.id);
    return { ok: true, user };
  },

  async login({ identifier, password, rememberMe }){
    const clean = identifier.trim().toLowerCase();
    const user = this.users().find(u => u.email.toLowerCase() === clean || u.phone === identifier.trim());
    if (!user) return { ok: false, error: "We couldn't find an account with that email or phone number." };
    const hash = await this.hash(password);
    if (hash !== user.passwordHash) return { ok: false, error: "That password doesn't match this account." };
    this.saveSession({ userId: user.id, rememberMe: !!rememberMe, loggedInAt: Date.now() });
    this.logLoginHistory(user.id);
    return { ok: true, user };
  },

  logout(){ this.saveSession(null); },

  updateUser(userId, patch){
    const users = this.users();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    this.saveUsers(users);
    return users[idx];
  },

  async changePassword(userId, currentPassword, newPassword){
    const users = this.users();
    const user = users.find(u => u.id === userId);
    if (!user) return { ok: false, error: "User not found." };
    if (await this.hash(currentPassword) !== user.passwordHash){
      return { ok: false, error: "Your current password is incorrect." };
    }
    user.passwordHash = await this.hash(newPassword);
    this.saveUsers(users);
    return { ok: true };
  },

  // No email backend exists, so "reset" just finds the account and lets the
  // UI collect a new password directly — the intended flow (emailed token
  // link) is the hook point for when a real mail/API service is wired up.
  findByIdentifier(identifier){
    const clean = identifier.trim().toLowerCase();
    return this.users().find(u => u.email.toLowerCase() === clean || u.phone === identifier.trim()) || null;
  },
  async resetPassword(identifier, newPassword){
    const users = this.users();
    const user = users.find(u => u.email.toLowerCase() === identifier.trim().toLowerCase() || u.phone === identifier.trim());
    if (!user) return { ok: false, error: "No account matches that email or phone number." };
    user.passwordHash = await this.hash(newPassword);
    this.saveUsers(users);
    return { ok: true };
  },

  /* ---------------- login history / active sessions (demo) ---------------- */
  loginHistory(userId){
    try {
      const all = JSON.parse(localStorage.getItem(AUTH_LOGIN_HISTORY_KEY) || "{}");
      return all[userId] || [];
    } catch (e) { return []; }
  },
  logLoginHistory(userId){
    const all = JSON.parse(localStorage.getItem(AUTH_LOGIN_HISTORY_KEY) || "{}");
    const ua = navigator.userAgent;
    const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
    const device = /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop";
    const entry = { time: Date.now(), device, browser };
    all[userId] = [entry, ...(all[userId] || [])].slice(0, 8);
    localStorage.setItem(AUTH_LOGIN_HISTORY_KEY, JSON.stringify(all));
  },

  /* ---------------- password strength (used by the signup form) ---------------- */
  passwordStrength(pw){
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    score = Math.min(score, 4);
    const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
    return { score, label: labels[score] };
  },
};

/* ================================================================
   HEADER ACCOUNT ICON — shared across Home/Store/Product/Dashboard.
   Points to the Dashboard if signed in, otherwise to the Auth page.
   ================================================================ */
function wireAccountIcon(){
  const icon = document.getElementById("account-icon");
  if (!icon) return;
  const user = Auth.currentUser();
  icon.href = user ? "dashboard.html" : "account.html";
  icon.setAttribute("aria-label", user ? `Account — signed in as ${user.firstName}` : "Sign in");
}

/* ================================================================
   HEADER MESSAGES ICON — only shown to signed-in customers. Reads the
   same alt_notifications_v1 store dashboard.html's Notifications tab
   already renders (order placed/confirmed/shipped/payment updates,
   etc.) and just surfaces an unread count + deep-links there.
   ================================================================ */
function wireMessagesIcon(){
  const icon = document.getElementById("messages-icon");
  if (!icon) return;
  const user = Auth.currentUser();
  if (!user){ icon.style.display = "none"; return; }
  icon.style.display = "";
  let unread = 0;
  try {
    const store = JSON.parse(localStorage.getItem("alt_notifications_v1") || "{}");
    unread = (store[user.id] || []).filter(n => !n.read).length;
  } catch (e) { /* no-op — badge just stays at 0 */ }
  const badge = document.getElementById("messages-badge");
  if (badge){
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.style.display = unread > 0 ? "flex" : "none";
  }
}

function wireHeaderIcons(){ wireAccountIcon(); wireMessagesIcon(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireHeaderIcons);
else wireHeaderIcons();
