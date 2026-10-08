/* ================================================================
   SITE LOADER
   Times the exit of the #site-loader element that already exists in
   each page's HTML. Honors prefers-reduced-motion by skipping straight
   to dismissal. Dispatches "site-loader-dismissed" on document in case
   a page wants to defer something non-critical until after it's gone.
   ================================================================ */
function initSiteLoader(){
  // This file is loaded from <head>, same as cart.js/auth.js/search.js —
  // #site-loader (first child of <body>) doesn't exist yet at that point,
  // so everything here waits for DOMContentLoaded rather than running
  // immediately at parse time.
  const loaderEl = document.getElementById("site-loader");
  if (!loaderEl) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    loaderEl.remove();
    document.dispatchEvent(new CustomEvent("site-loader-dismissed"));
    return;
  }

  const MIN_VISIBLE_MS = 500;
  const startedAt = Date.now();
  const fill = loaderEl.querySelector(".sl-progress-fill");

  // Progress is illustrative, not tied to real byte counts — this is a
  // static site with no meaningful network request to track — but it
  // still needs to feel like it's moving rather than sitting idle.
  requestAnimationFrame(() => { if (fill) fill.style.width = "70%"; });

  function dismiss(){
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    setTimeout(() => {
      if (fill) fill.style.width = "100%";
      setTimeout(() => {
        loaderEl.classList.add("hide");
        setTimeout(() => loaderEl.remove(), 650);
        document.dispatchEvent(new CustomEvent("site-loader-dismissed"));
      }, 180);
    }, remaining);
  }

  let dismissed = false;
  function dismissOnce(){ if (dismissed) return; dismissed = true; dismiss(); }

  if (document.readyState === "complete") dismissOnce();
  else window.addEventListener("load", dismissOnce);

  // Safety net: a blocked/slow sub-resource (e.g. the manifest link under
  // file:// origins, where its CORS fetch can stall) must never leave the
  // loader stuck on screen forever.
  setTimeout(dismissOnce, 2500);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSiteLoader);
else initSiteLoader();
