/* ================================================================
   INERTIA SCROLL — "heavy rod on a flat road" feel
   A wheel flick gives the page a push; it keeps gliding and slowly
   coasts to a stop instead of halting the instant the wheel stops.

   - Mouse-wheel / trackpad only. Touch scrolling is left native (phones
     already have their own fling momentum, and intercepting touch is
     what makes pages feel stuck).
   - Never hijacks: inner scrollable boxes, modals/drawers (html
     overflow hidden), ctrl+wheel zoom, horizontal scroll,
     prefers-reduced-motion.
   - Keyboard, anchors, scrollIntoView, window.scrollTo(...) all keep
     working: any scroll we didn't cause re-syncs the position.
   ================================================================ */
(function(){
  if (window.__altInertiaScroll) return;
  window.__altInertiaScroll = true;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(pointer: fine)").matches) return; // touch-first devices: stay native

  var PUSH = 1.15;      // how hard one wheel notch pushes
  var TAU = 0.30;       // seconds; bigger = heavier, longer glide
  var STOP_AT = 0.4;    // px; below this the glide has ended

  var current = window.scrollY;
  var target = current;
  var rafId = 0;
  var lastT = 0;

  function maxScroll(){
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clamp(v){ return Math.min(maxScroll(), Math.max(0, v)); }

  function insideScrollableBox(el){
    while (el && el !== document.body && el !== document.documentElement){
      if (el.nodeType === 1){
        var cs = getComputedStyle(el);
        var oy = cs.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function locked(){
    return getComputedStyle(document.documentElement).overflow === "hidden" ||
           getComputedStyle(document.body).overflow === "hidden" && document.body.style.overflow === "hidden";
  }

  function step(now){
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    var diff = target - current;
    if (Math.abs(diff) <= STOP_AT){
      current = target;
      window.scrollTo(0, current);
      rafId = 0;
      return;
    }
    current += diff * (1 - Math.exp(-dt / TAU));
    window.scrollTo(0, current);
    rafId = requestAnimationFrame(step);
  }

  function onWheel(e){
    if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;          // horizontal gesture
    if (locked()) return;
    if (insideScrollableBox(e.target)) return;

    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 32;
    else if (e.deltaMode === 2) dy *= window.innerHeight;

    if (!rafId){ current = window.scrollY; target = current; }

    var next = clamp(target + dy * PUSH);
    // already at the edge and pushing further out: let the browser handle it
    if (next === target && (window.scrollY <= 0 || window.scrollY >= maxScroll() - 1)) return;

    e.preventDefault();
    target = next;
    if (!rafId){ lastT = performance.now(); rafId = requestAnimationFrame(step); }
  }

  // Anything else that moves the page (keyboard, anchors, scrollbar drag,
  // programmatic smooth scroll) must win over a stale glide target.
  // (scroll events fire a frame AFTER scrollTo, so a flag can't tell ours
  // apart — compare against the position we last set instead.)
  window.addEventListener("scroll", function(){
    if (Math.abs(window.scrollY - current) < 2) return;
    if (rafId){ cancelAnimationFrame(rafId); rafId = 0; }
    current = target = window.scrollY;
  }, { passive: true });

  window.addEventListener("wheel", onWheel, { passive: false });
})();
