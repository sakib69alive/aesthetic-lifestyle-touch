/* ================================================================
   MOBILE UI — shared mobile-only behaviour (≤767px).
   Loaded (blocking, small) on customer pages right after mobile-nav.js,
   so page inline scripts can call into it while they render.
   Everything here must be a no-op at ≥768px: guard with isMobile().
   Contents: reveal fail-safe, bottom sheet, load-more bar.
   ================================================================ */
(function () {
  "use strict";

  const mq = window.matchMedia("(max-width: 767px)");
  const isMobile = () => mq.matches;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- reveal fail-safe (Phase 1.7) ----------------
     Pages hide [data-reveal] / [data-enter] blocks until their own
     IntersectionObserver adds `.in`. When a phone user jumps down the page
     (anchor tap, fast fling, restored scroll) a block can end up in view —
     or already scrolled past — without ever having been revealed, which
     leaves a blank screen. This pass adds `.in` to anything that is in the
     viewport or above it and still hidden: once shortly after load, then
     whenever scrolling settles. Below-the-fold blocks keep their normal
     scroll-in animation. */
  const REVEAL_SEL = "[data-reveal]:not(.in), [data-enter]:not(.in)";

  function flushReveals() {
    if (!isMobile()) return;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll(REVEAL_SEL).forEach((el) => {
      if (el.getBoundingClientRect().top < vh) el.classList.add("in");
    });
  }

  let settleTimer = null;
  window.addEventListener("scroll", () => {
    if (!isMobile()) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(flushReveals, 150);
  }, { passive: true });
  window.addEventListener("load", () => setTimeout(flushReveals, 2500));

  /* ---------------- bottom sheet (Phase 3+) ----------------
     openSheet({ title, content, footer, className, onClose }) → { close, el, body, footerEl }
     content / footer: HTML string or Node. Backdrop tap, Esc, the close
     button and a swipe-down on the grab zone all close it; page scroll is
     locked while it is open. Styles: .m-sheet* in mobile.css. */
  let openCount = 0;

  function openSheet(opts) {
    opts = opts || {};
    const backdrop = document.createElement("div");
    backdrop.className = "m-sheet-backdrop";
    const sheet = document.createElement("div");
    sheet.className = "m-sheet " + (opts.className || "");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    if (opts.title) sheet.setAttribute("aria-label", opts.title);
    sheet.innerHTML =
      '<div class="m-sheet-grab" aria-hidden="true"><span></span></div>' +
      '<div class="m-sheet-head">' +
        '<h2 class="m-sheet-title">' + (opts.title || "") + "</h2>" +
        '<button type="button" class="m-sheet-close" aria-label="Close">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="m-sheet-body"></div>' +
      '<div class="m-sheet-footer"></div>';
    const body = sheet.querySelector(".m-sheet-body");
    const footerEl = sheet.querySelector(".m-sheet-footer");
    const put = (host, c) => { if (c == null) return; if (typeof c === "string") host.innerHTML = c; else host.appendChild(c); };
    put(body, opts.content);
    put(footerEl, opts.footer);
    if (!opts.footer) footerEl.style.display = "none";

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    if (openCount++ === 0) document.documentElement.style.overflow = "hidden";

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      backdrop.classList.remove("open");
      sheet.classList.remove("open");
      sheet.style.transform = "";
      document.removeEventListener("keydown", onKey);
      if (--openCount === 0) document.documentElement.style.overflow = "";
      setTimeout(() => { backdrop.remove(); sheet.remove(); }, reduced() ? 0 : 450);
      if (typeof opts.onClose === "function") opts.onClose();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", close);
    sheet.querySelector(".m-sheet-close").addEventListener("click", close);

    /* swipe down on the grab zone / header */
    let startY = null, dy = 0, t0 = 0;
    const dragZone = [sheet.querySelector(".m-sheet-grab"), sheet.querySelector(".m-sheet-head")];
    dragZone.forEach((z) => {
      z.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY; dy = 0; t0 = Date.now();
        sheet.style.transition = "none";
      }, { passive: true });
      z.addEventListener("touchmove", (e) => {
        if (startY == null) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        sheet.style.transform = "translateY(" + dy + "px)";
      }, { passive: true });
      z.addEventListener("touchend", () => {
        if (startY == null) return;
        const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
        sheet.style.transition = "";
        startY = null;
        if (dy > 110 || fast && dy > 30) close(); else sheet.style.transform = "";
      });
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      backdrop.classList.add("open");
      sheet.classList.add("open");
    }));
    return { close: close, el: sheet, body: body, footerEl: footerEl };
  }

  /* ---------------- load-more bar (Phase 3 / 4) ----------------
     createLoadMore(afterEl, { onMore, label }) → { update(shown, total), el }
     Renders "Showing 12 of 40" + an outline "Load more" pill after `afterEl`.
     Hidden when everything is already shown. */
  function createLoadMore(afterEl, opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "m-loadmore";
    el.hidden = true;
    el.innerHTML = '<p class="m-loadmore-count" aria-live="polite"></p>' +
      '<button type="button" class="m-loadmore-btn">' + (opts.label || "Load more") + "</button>";
    afterEl.insertAdjacentElement("afterend", el);
    const count = el.querySelector(".m-loadmore-count");
    el.querySelector(".m-loadmore-btn").addEventListener("click", () => { if (opts.onMore) opts.onMore(); });
    return {
      el: el,
      update: function (shown, total) {
        const show = isMobile() && total > shown;
        el.hidden = !show;
        if (show) count.textContent = "Showing " + shown + " of " + total;
      },
    };
  }

  /* ---------------- legal pages: "On this page" TOC (Phase 8) ----------------
     Terms / Privacy: give each h2 an id and build a collapsible TOC above the
     text. Hidden on desktop by mobile.css, so nothing visible changes there. */
  function buildLegalToc() {
    const prose = document.querySelector(".lg-prose");
    if (!prose || document.querySelector(".lg-toc")) return;
    const heads = Array.from(prose.querySelectorAll("h2"));
    if (heads.length < 3) return;
    heads.forEach((h, i) => { if (!h.id) h.id = "sec-" + (i + 1); });
    const toc = document.createElement("details");
    toc.className = "lg-toc";
    toc.innerHTML = "<summary>On this page<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"M6 9l6 6 6-6\"/></svg></summary><ol>" +
      heads.map((h) => "<li><a href=\"#" + h.id + "\">" + h.textContent.replace(/^\d+\.\s*/, "") + "</a></li>").join("") + "</ol>";
    prose.parentNode.insertBefore(toc, prose);
    toc.addEventListener("click", (e) => { if (e.target.closest("a")) toc.open = false; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildLegalToc);
  else buildLegalToc();

  window.MobileUI = {
    isMobile: isMobile, mq: mq, flushReveals: flushReveals,
    openSheet: openSheet, createLoadMore: createLoadMore,
  };
})();
