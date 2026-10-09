/* ================================================================
   PREMIUM MOBILE NAVIGATION
   Full-screen animated menu + floating bottom nav bar + a minimal
   offline banner (PWA-readiness placeholder). Everything lives inside
   initMobileNav() — no other top-level bindings — so this file can't
   collide with any page's own inline script.
   ================================================================ */
function initMobileNav(){
  if (document.getElementById("mnav-bottombar") || document.getElementById("mnav-overlay")) return;

  const header = document.querySelector("header");
  if (!header) return;

  const hasDashboardShell = !!document.getElementById("sidebar-toggle");
  const hasProductMobileBar = !!document.getElementById("mobile-bar");

  const path = (location.pathname.split("/").pop() || "home.html").toLowerCase();
  function isCurrent(file){
    if (!file) return false;
    const f = file.toLowerCase();
    if (f === "home.html") return path === "" || path === "home.html" || path === "index.html";
    return path === f;
  }

  /* ================================================================
     FULL-SCREEN MENU
     ================================================================ */
  function buildMenuOverlay(){
    const desktopLinks = Array.from(header.querySelectorAll("nav a.nav-link"));
    const linksHTML = desktopLinks.map(a => `
      <a href="${a.getAttribute("href")}" class="mnav-link ${a.classList.contains("active") ? "active" : ""}">${a.textContent.trim()}</a>
    `).join("");

    const loggedIn = typeof Auth !== "undefined" && Auth.isLoggedIn();
    /* product.html has no bottom bar, and on phones its header drops the
       search icon (see mobile.css) — so the menu carries Search there. */
    const menuSearch = hasProductMobileBar && window.matchMedia("(max-width: 767px)").matches;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="mnav-overlay" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="mnav-glow" aria-hidden="true"></div>
        <button id="mnav-close" type="button" aria-label="Close menu" class="mnav-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <nav class="mnav-links" aria-label="Main">${linksHTML}</nav>
        <div class="mnav-divider" aria-hidden="true"></div>
        <div class="mnav-quick">
          ${menuSearch ? `<button type="button" class="mnav-quick-link" data-mnav-search>Search</button>` : ""}
          <a href="account.html" class="mnav-quick-link">${loggedIn ? "My Account" : "Sign In / Register"}</a>
          <a href="wishlist.html" class="mnav-quick-link">Wishlist</a>
          <a href="dashboard.html" class="mnav-quick-link">${loggedIn ? "My Orders" : "Track Order"}</a>
          <a href="request-product.html" class="mnav-quick-link">Request a Product</a>
          <button type="button" class="mnav-quick-link theme-toggle-btn" aria-label="Toggle dark mode">
            <span class="theme-label-light">Switch to Dark Mode</span>
            <span class="theme-label-dark">Switch to Light Mode</span>
          </button>
        </div>
        <p class="mnav-tag">AESTHETIC <span>LIFESTYLE TOUCH</span></p>
      </div>
    `;
    document.body.appendChild(wrap);
    const menuSearchBtn = wrap.querySelector("[data-mnav-search]");
    if (menuSearchBtn) menuSearchBtn.addEventListener("click", () => { if (typeof Search !== "undefined") Search.open(); });
  }

  function openMenu(){
    const trigger = document.getElementById("mnav-trigger");
    document.getElementById("mnav-overlay").classList.add("open");
    if (trigger){ trigger.classList.add("open"); trigger.setAttribute("aria-expanded", "true"); }
    document.documentElement.style.overflow = "hidden";
    const firstLink = document.querySelector(".mnav-link");
    if (firstLink && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) firstLink.focus({ preventScroll: true });
  }
  function closeMenu(){
    const trigger = document.getElementById("mnav-trigger");
    document.getElementById("mnav-overlay").classList.remove("open");
    if (trigger){ trigger.classList.remove("open"); trigger.setAttribute("aria-expanded", "false"); }
    document.documentElement.style.overflow = "";
  }

  function wireMenuTrigger(){
    let trigger = header.querySelector('button[aria-label="Menu"]');
    const iconRow = header.querySelector(".flex.items-center.gap-5");
    if (trigger){
      trigger.setAttribute("aria-label", "Open menu");
    } else if (iconRow){
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.setAttribute("aria-label", "Open menu");
      trigger.className = "md:hidden";
      iconRow.appendChild(trigger);
    } else {
      return;
    }

    trigger.id = "mnav-trigger";
    trigger.classList.add("mnav-trigger");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="mnav-bar"></span><span class="mnav-bar"></span><span class="mnav-bar"></span>`;

    trigger.addEventListener("click", () => {
      const overlay = document.getElementById("mnav-overlay");
      if (overlay.classList.contains("open")) closeMenu(); else openMenu();
    });
    document.getElementById("mnav-close").addEventListener("click", closeMenu);
    document.getElementById("mnav-overlay").addEventListener("click", (e) => {
      if (e.target.id === "mnav-overlay") closeMenu();
    });
    document.querySelectorAll(".mnav-link, .mnav-quick-link").forEach(a => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("mnav-overlay").classList.contains("open")) closeMenu();
    });
    window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => { if (e.matches) closeMenu(); });
  }

  /* ================================================================
     FLOATING BOTTOM NAV
     ================================================================ */
  function buildBottomNav(){
    const loggedIn = typeof Auth !== "undefined" && Auth.isLoggedIn();
    const accountHref = loggedIn ? "dashboard.html" : "account.html";
    const items = [
      { label: "Home", href: "Home.html", icon: `<path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9h12v-9"/>` },
      { label: "Store", href: "store.html", icon: `<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 016 0"/>` },
      { label: "Search", href: null, action: "search", icon: `<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>` },
      { label: "Wishlist", href: "wishlist.html", icon: `<path d="M12 21s-7.5-4.9-10-9.3C.4 8.1 2 4 6 4c2 0 3.5 1 4.5 2.6C11.5 5 13 4 15 4c4 0 5.6 4.1 4 7.7C19.5 16.1 12 21 12 21z"/>`, badge: "mnav-wishlist-badge" },
      { label: "Account", href: accountHref, icon: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"/>` },
      { label: "Cart", href: null, action: "cart", icon: `<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L4.5 2.5H2"/><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none"/>`, badge: "mnav-cart-badge" },
    ];

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <nav id="mnav-bottombar" aria-label="Mobile navigation">
        ${items.map(it => {
          const active = it.href && isCurrent(it.href) ? "active" : "";
          const tagOpen = it.href ? `<a href="${it.href}"` : `<button type="button"`;
          const tagClose = it.href ? "a" : "button";
          return `
            ${tagOpen} class="mnav-bb-item ${active}" ${it.action ? `data-action="${it.action}"` : ""} aria-label="${it.label}">
              <span class="mnav-bb-icon">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${it.icon}</svg>
                ${it.badge ? `<span id="${it.badge}" class="mnav-bb-badge">0</span>` : ""}
              </span>
              <span class="mnav-bb-label">${it.label}</span>
            </${tagClose}>
          `;
        }).join("")}
      </nav>
    `;
    document.body.appendChild(wrap);

    const searchBtn = document.querySelector('#mnav-bottombar [data-action="search"]');
    if (searchBtn) searchBtn.addEventListener("click", () => { if (typeof Search !== "undefined") Search.open(); });
    const cartBtn = document.querySelector('#mnav-bottombar [data-action="cart"]');
    if (cartBtn) cartBtn.addEventListener("click", () => { if (typeof Cart !== "undefined") Cart.open(); });

    if (typeof Cart !== "undefined" && typeof Cart.syncBadges === "function") Cart.syncBadges();
    if (typeof syncWishlistBadge === "function") syncWishlistBadge();

    wireBottomNavAutoHide();
  }

  /* Dynamic-Island-style auto-hide: a bar pinned to the bottom of the
     screen for the entire visit blocks whatever sits at the true
     bottom of the page (footer links, last content row) — especially
     bad on pages that are mostly scrolling. Show it on any scroll
     movement, then ease it back down after 4s of no further scrolling.
     Reduced-motion users get the bar permanently visible instead of a
     motion-based show/hide they didn't ask for. */
  function wireBottomNavAutoHide(){
    const bar = document.getElementById("mnav-bottombar");
    if (!bar) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hideTimer = null;
    function reveal(){
      bar.classList.remove("mnav-bb-hidden");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bar.classList.add("mnav-bb-hidden"), 2000);
    }
    window.addEventListener("scroll", reveal, { passive: true });
    reveal();
  }

  /* ================================================================
     OFFLINE BANNER — PWA-readiness placeholder, no service worker yet
     ================================================================ */
  function buildOfflineBanner(){
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div id="mnav-offline" role="status">You're offline — showing what's already loaded.</div>`;
    document.body.appendChild(wrap);
    const banner = document.getElementById("mnav-offline");
    function update(){ banner.classList.toggle("show", !navigator.onLine); }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  buildOfflineBanner();
  if (!hasProductMobileBar) buildBottomNav();
  if (!hasDashboardShell){
    buildMenuOverlay();
    wireMenuTrigger();
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMobileNav);
else initMobileNav();
