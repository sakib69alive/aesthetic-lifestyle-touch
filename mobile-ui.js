/* ================================================================
   MOBILE UI — shared mobile-only behaviour (≤767px).
   Loaded with `defer` on customer pages, after mobile-nav.js.
   Everything here must be a no-op at ≥768px: guard with isMobile().
   Planned contents (see MOBILE_PLAN.md): bottom sheet, load-more,
   carousel dots. Already here: the reveal fail-safe.
   ================================================================ */
(function () {
  "use strict";

  const mq = window.matchMedia("(max-width: 767px)");
  const isMobile = () => mq.matches;

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

  window.MobileUI = { isMobile: isMobile, mq: mq, flushReveals: flushReveals };
})();
