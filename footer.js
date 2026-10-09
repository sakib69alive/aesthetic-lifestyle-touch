/* ================================================================
   SITE FOOTER
   Builds and injects the shared footer + scroll-to-top button at the
   end of <body> on every page. Everything lives inside one function
   with no other top-level bindings, so this file can never collide
   with a page's own script (see the searchDebounce incident this
   project already hit once — this file is written defensively).
   Depends on products-data.js (categoryLabel) and, where loaded,
   auth.js (Auth) for the Account link's dynamic destination.
   ================================================================ */
function initSiteFooter(){

  const NEWSLETTER_KEY = "alt_newsletter_subscribed_v1";
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const wc = (typeof websiteContent === "function") ? websiteContent() : null;

  /* ---------------- announcement bar ----------------
     Off by default (nothing below changes when inactive — zero layout
     risk to the existing site). When the CMS turns it on, this is the
     one place that nudges the fixed header + page content down by the
     bar's real rendered height, so it works the same on every page
     without needing per-page tuning. */
  if (wc && wc.announcementActive && wc.announcement){
    const bar = document.createElement("div");
    bar.id = "site-announcement";
    bar.innerHTML = `<p>${wc.announcement}</p><button type="button" id="announcement-close" aria-label="Dismiss announcement">✕</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
    const header = document.querySelector("header");
    function pinBelowBar(){
      const h = bar.offsetHeight;
      document.body.style.paddingTop = h + "px";
      if (header) header.style.top = h + "px";
    }
    pinBelowBar(); // offsetHeight below forces layout synchronously — no need to wait for a paint frame
    window.addEventListener("resize", pinBelowBar);
    document.getElementById("announcement-close").addEventListener("click", () => {
      bar.remove();
      document.body.style.paddingTop = "";
      if (header) header.style.top = "0";
    });
  }

  const SHOP_LINKS = [
    { label: "New Arrivals", href: "store.html?category=new-arrivals" },
    { label: "Collections",  href: "collections.html" },
    { label: "Trending",     href: "store.html?category=trending" },
    { label: "Gift Ideas",   href: "store.html?category=lifestyle" },
  ];
  const COMPANY_LINKS = [
    { label: "About",    href: "about.html" },
    { label: "Wishlist", href: "wishlist.html" },
    { label: "Account",  href: (typeof Auth !== "undefined" && Auth.currentUser()) ? "dashboard.html" : "account.html" },
    { label: "Request a Product", href: "request-product.html" },
  ];
  const SUPPORT_LINKS = [
    { label: "Help Center",        href: "about.html#faq" },
    { label: "Shipping Information", soon: true },
    { label: "Returns & Refunds",  soon: true },
    { label: "Track Order",        href: "dashboard.html" },
    { label: "Frequently Asked Questions", href: "about.html#faq" },
    { label: "Privacy Policy",     href: "privacy.html" },
    { label: "Terms & Conditions", href: "terms.html" },
    { label: "Contact Support",    href: "contact.html" },
  ];

  const SOCIALS = [
    { label: "Instagram", icon: `<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>` },
    { label: "Facebook",  icon: `<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M14 9h-2a1 1 0 0 0-1 1v2h3M11 12v6"/>` },
    { label: "TikTok",    icon: `<path d="M14 4v9.5a3 3 0 1 1-2-2.83"/><path d="M14 4c.3 2 1.7 3.5 4 3.8"/>` },
    { label: "Pinterest", icon: `<circle cx="12" cy="12" r="9"/><path d="M9.5 17l2-9.5c0-1.5 1-2.5 2.5-2.5s2.5 1.2 2.5 3c0 2-1 4-3 4-.8 0-1.3-.4-1.5-1"/>` },
    { label: "YouTube",   icon: `<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M11 10l3 2-3 2v-4z" fill="currentColor" stroke="none"/>` },
    { label: "LinkedIn",  icon: `<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M8 12v5M12 12v5m0-3c0-1.5 1-2 2-2s2 .8 2 2v3"/>` },
  ];

  const PAYMENTS = ["Visa", "Mastercard", "American Express", "bKash", "Nagad", "Rocket", "Cash on Delivery"];

  const TRUST = [
    { label: "Secure Checkout",           icon: `<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>` },
    { label: "Encrypted Payments",        icon: `<path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>` },
    { label: "Fast Delivery",             icon: `<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.4"/><circle cx="17.5" cy="18" r="1.4"/>` },
    { label: "Easy Returns",              icon: `<path d="M4 4v6h6M20 20v-6h-6"/><path d="M4.5 15a8 8 0 0 0 14 4.2M19.5 9A8 8 0 0 0 5.5 4.8"/>` },
    { label: "Verified Store",            icon: `<path d="M20 6L9 17l-5-5"/>` },
    { label: "Premium Customer Support",  icon: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4 1-1.4 2.2M12 17h.01"/>` },
  ];

  /* ---------------- link list renderer (shared by all 3 groups) ---------------- */
  function linkListHTML(links){
    return links.map(l => l.soon
      ? `<button type="button" class="ft-link" data-ft-soon="${l.label}" style="text-align:left; background:none; border:none; cursor:pointer;">${l.label}</button>`
      : `<a href="${l.href}" class="ft-link">${l.label}</a>`
    ).join("");
  }

  function accordionHTML(title, body){
    return `
      <details class="ft-group">
        <summary><span class="ft-group-title">${title}</span>
          <svg class="ft-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        ${body}
      </details>
    `;
  }

  function groupHTML(title, links){
    const body = `<div class="ft-group-body space-y-0">${linkListHTML(links)}</div>`;
    if (isDesktop){
      return `<div><p class="ft-group-title mb-4">${title}</p>${body}</div>`;
    }
    return accordionHTML(title, body);
  }

  /* Contact / payments / trust: two-column blocks on desktop (unchanged),
     accordions in one continuous list with the link groups on mobile —
     one long stack of open blocks was what made the footer ~1,900px tall. */
  const contactBodyHTML = `
    <div class="space-y-2 text-sm text-[var(--alt-muted)]">
      <p>Email: <span style="color:var(--alt-black)">${(wc && wc.contactEmail) || "aestheticlifestyletouch@gmail.com"}</span></p>
      <p>Phone: <span style="color:var(--alt-black)">${(wc && wc.contactPhone) || "01313667726"}</span></p>
      <p>Hours: <span style="color:var(--alt-black)">Sat–Thu, 10am–7pm (GMT+6)</span></p>
      <p>Address: <span style="color:var(--alt-black)">Dhaka, Bangladesh</span></p>
    </div>`;

  const middleHTML = isDesktop ? `
        <!-- Contact + Social -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-10 py-14 border-b border-[var(--alt-border)]">
          <div>
            <p class="ft-group-title mb-4">Contact</p>
            ${contactBodyHTML}
          </div>
          <div class="md:text-right">
            <p class="ft-group-title mb-4 md:text-right">Follow</p>
            <div class="flex md:justify-end gap-2.5" id="ft-social-row"></div>
          </div>
        </div>

        <!-- Payments + Trust -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-10 py-14 border-b border-[var(--alt-border)]">
          <div>
            <p class="ft-group-title mb-4">Payment Methods</p>
            <div class="flex flex-wrap gap-2" id="ft-payment-row"></div>
          </div>
          <div>
            <p class="ft-group-title mb-4">Why Trust Us</p>
            <div class="grid grid-cols-2 gap-3" id="ft-trust-row"></div>
          </div>
        </div>

        <!-- Region selector (future-ready) -->
        <div class="flex items-center gap-3 py-8 border-b border-[var(--alt-border)] flex-wrap">
          <span class="ft-soon">Future Ready</span>
          <select class="ft-region-select" disabled><option>Bangladesh</option></select>
          <select class="ft-region-select" disabled><option>BDT (৳)</option></select>
          <select class="ft-region-select" disabled><option>English</option></select>
        </div>
  ` : `
        <!-- Follow (the contact / payments / trust accordions are appended to #ft-groups) -->
        <div class="ft-block-follow">
          <p class="ft-group-title">Follow</p>
          <div class="flex gap-2.5" id="ft-social-row"></div>
        </div>
  `;

  /* ---------------- build + inject ---------------- */
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <footer id="site-footer" aria-label="Site footer">
      <div class="ft-inner max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-20">

        <!-- Brand + Newsletter -->
        <div class="ft-block-brand grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 pb-14 border-b border-[var(--alt-border)]">
          <div>
            <p class="ft-font-display text-lg font-medium tracking-tight mb-4">
              AESTHETIC <span class="text-[var(--alt-muted)] font-normal">LIFESTYLE TOUCH</span>
            </p>
            <p class="text-sm text-[var(--alt-muted)] max-w-sm leading-relaxed mb-4">
              Thoughtfully curated products designed to elevate everyday living.
            </p>
            <p class="ft-brand-long text-sm text-[var(--alt-muted)] max-w-md leading-relaxed">
              We believe that beautiful design and everyday functionality should exist together. Every product is selected with intention, quality, and purpose.
            </p>
          </div>
          <div>
            <h2 class="ft-font-display text-xl font-medium tracking-tight mb-2">${(wc && wc.newsletterHeadline) || "Stay Inspired."}</h2>
            <p class="ft-news-desc text-sm text-[var(--alt-muted)] mb-6 max-w-sm">Updates on new collections, exclusive launches, limited editions, and design inspiration — nothing else.</p>
            <div id="ft-newsletter-form" class="flex flex-col sm:flex-row gap-3">
              <input id="ft-newsletter-email" type="email" placeholder="you@email.com" class="ft-news-input flex-1" aria-label="Email address">
              <button id="ft-newsletter-submit" class="px-7 py-3.5 rounded-full bg-[var(--alt-black)] text-[var(--alt-white)] text-sm font-medium shrink-0">Subscribe</button>
            </div>
            <p id="ft-newsletter-success" class="text-sm mt-3" style="display:none; color:#3F8F5F;">You're on the list — thank you.</p>
            <p id="ft-newsletter-error" class="text-xs mt-2" style="display:none; color:#B23B3B;">Enter a valid email address.</p>
          </div>
        </div>

        <!-- Nav groups -->
        <div class="ft-block-groups grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 py-14 border-b border-[var(--alt-border)]" id="ft-groups"></div>

        ${middleHTML}

        <!-- Copyright -->
        <div class="ft-legal flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-[var(--alt-muted)]">
          <p id="ft-copyright"></p>
          <div class="flex items-center gap-5">
            ${(wc && wc.footerLinks || []).map(l => `<a href="${l.href}" class="ft-link" style="padding:0; display:inline;">${l.label}</a>`).join("")}
            <a href="privacy.html" class="ft-link" style="padding:0; display:inline;">Privacy</a>
            <a href="terms.html" class="ft-link" style="padding:0; display:inline;">Terms</a>
            <button type="button" class="ft-link" style="padding:0; display:inline;" data-ft-soon="Cookies">Cookies</button>
            <button type="button" class="ft-link" style="padding:0; display:inline;" data-ft-soon="Accessibility">Accessibility</button>
          </div>
        </div>
      </div>
    </footer>

    <button id="scroll-to-top" aria-label="Back to top">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
  `;
  document.body.appendChild(wrap);

  /* ---------------- fill dynamic bits ---------------- */
  document.getElementById("ft-groups").innerHTML =
    groupHTML("Shop", SHOP_LINKS) + groupHTML("Company", COMPANY_LINKS) + groupHTML("Customer Support", SUPPORT_LINKS)
    + (isDesktop ? "" :
        accordionHTML("Contact", `<div class="ft-group-body">${contactBodyHTML}</div>`)
      + accordionHTML("Payment Methods", `<div class="ft-group-body"><div class="flex flex-wrap gap-2" id="ft-payment-row"></div></div>`)
      + accordionHTML("Why Trust Us", `<div class="ft-group-body"><div class="grid grid-cols-2 gap-3" id="ft-trust-row"></div></div>`));

  document.getElementById("ft-social-row").innerHTML = SOCIALS.map(s => `
    <button type="button" class="ft-icon-btn" aria-label="${s.label} (coming soon)" data-ft-soon="${s.label}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${s.icon}</svg>
    </button>
  `).join("");

  document.getElementById("ft-payment-row").innerHTML = PAYMENTS.map(p => `<span class="ft-pay-chip">${p}</span>`).join("");

  document.getElementById("ft-trust-row").innerHTML = TRUST.map(t => `
    <div class="ft-trust-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.5">${t.icon}</svg>
      <span class="text-xs text-[var(--alt-muted)]">${t.label}</span>
    </div>
  `).join("");

  document.getElementById("ft-copyright").textContent = `© ${new Date().getFullYear()} Aesthetic Lifestyle Touch. All Rights Reserved.`;

  /* ---------------- "coming soon" links (honest — these pages don't exist yet) ---------------- */
  document.querySelectorAll("[data-ft-soon]").forEach(el => {
    el.addEventListener("click", () => {
      const label = el.dataset.ftSoon;
      if (typeof showCartToast === "function") showCartToast(`${label} is coming soon.`);
    });
  });

  /* ---------------- newsletter (same store as Collections' — one subscription, not two) ---------------- */
  if (localStorage.getItem(NEWSLETTER_KEY)){
    document.getElementById("ft-newsletter-form").style.display = "none";
    document.getElementById("ft-newsletter-success").style.display = "block";
  }
  document.getElementById("ft-newsletter-submit").addEventListener("click", () => {
    const input = document.getElementById("ft-newsletter-email");
    const email = input.value.trim();
    const errEl = document.getElementById("ft-newsletter-error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      input.classList.add("invalid");
      errEl.style.display = "block";
      return;
    }
    input.classList.remove("invalid");
    errEl.style.display = "none";
    localStorage.setItem(NEWSLETTER_KEY, email);
    document.getElementById("ft-newsletter-form").style.display = "none";
    document.getElementById("ft-newsletter-success").style.display = "block";
  });

  /* ---------------- fade-in on scroll into view ---------------- */
  const footerEl = document.getElementById("site-footer");
  new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){ footerEl.classList.add("in"); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.1 }).observe(footerEl);

  /* ---------------- scroll to top ---------------- */
  const scrollBtn = document.getElementById("scroll-to-top");
  window.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("show", window.scrollY > 600);
  }, { passive: true });
  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSiteFooter);
else initSiteFooter();
