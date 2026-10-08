/* ================================================================
   MOBILE UI — shared mobile-only behaviour (≤767px).
   Loaded with `defer` on customer pages, after mobile-nav.js.
   Everything here must be a no-op at ≥768px: guard with isMobile().
   Planned contents (see MOBILE_PLAN.md): bottom sheet, load-more,
   carousel dots, reveal fail-safe.
   ================================================================ */
(function () {
  "use strict";

  const mq = window.matchMedia("(max-width: 767px)");
  const isMobile = () => mq.matches;

  window.MobileUI = { isMobile: isMobile, mq: mq };
})();
