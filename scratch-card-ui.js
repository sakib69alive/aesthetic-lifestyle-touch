/* ================================================================
   MYSTERY REWARD — scratch-card UI
   A self-contained canvas widget: mountScratchCard(container, card,
   onRevealed) draws the reward underneath and a scratchable foil
   layer on top, tracks how much has been cleared, and calls
   onRevealed(card) once enough of it has been scratched away (or the
   customer taps the accessible "Reveal Instantly" fallback — also the
   only path for prefers-reduced-motion, keyboard users, and screen
   readers, since dragging a finger across a canvas isn't operable by
   any of those).
   Depends on rewards-engine.js (scratchCard()) and cart.js (bdt) —
   load this file after both, on any page that shows a card.
   ================================================================ */

const REWARD_TYPE_ICON = {
  percentage: `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/>`,
  fixed:       `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/>`,
  "free-shipping": `<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>`,
  coins:       `<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>`,
  "free-gift": `<path d="M4 8h16v12H4z"/><path d="M4 8l8-5 8 5"/><path d="M12 3v17"/>`,
  nothing:     `<circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M8 15s1.5 2 4 2 4-2 4-2"/>`,
};
function rewardCardRewardText(reward){
  if (reward.type === "percentage") return `${reward.value}% OFF`;
  if (reward.type === "fixed") return `${bdt(reward.value)} OFF`;
  if (reward.type === "free-shipping") return "Free Shipping";
  if (reward.type === "coins") return `${reward.value} Coins`;
  if (reward.type === "free-gift") return "Free Gift";
  return "Better Luck Next Time";
}

/* Renders the front face — what's revealed underneath the foil. Kept
   separate from the canvas so screen readers and the reduced-motion
   path can read/show it directly without ever touching <canvas>. */
function scratchCardFaceHTML(card){
  const reward = card.rewardSnapshot;
  const hasCoupon = !!reward.couponCode;
  return `
    <div class="sc-face">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--alt-black)" stroke-width="1.4" class="mb-3">${REWARD_TYPE_ICON[reward.type] || REWARD_TYPE_ICON.nothing}</svg>
      <p class="font-display text-xl font-medium">${rewardCardRewardText(reward)}</p>
      ${hasCoupon ? `
        <div class="sc-coupon-row">
          <span class="font-mono">${reward.couponCode}</span>
          <button type="button" class="sc-copy-btn" data-code="${reward.couponCode}">Copy</button>
        </div>
        <p class="sc-fineprint">${reward.minPurchase ? `Min. spend ${bdt(reward.minPurchase)} · ` : ""}Expires ${new Date(reward.expiry).toLocaleDateString()}</p>
      ` : reward.type === "coins" ? `<p class="sc-fineprint">Added to your Coin balance</p>` : reward.type === "nothing" ? `<p class="sc-fineprint">No reward this time — try again next order</p>` : ""}
    </div>
  `;
}
function wireScratchCardCopyButtons(root){
  root.querySelectorAll(".sc-copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.code); }
      catch (e) { /* clipboard permission denied — code is still visible to copy by hand */ }
      const original = btn.textContent;
      btn.textContent = "✓ Copied";
      setTimeout(() => { btn.textContent = original; }, 1400);
    });
  });
}

/* Lightweight confetti burst — plain divs, not a library, so it stays
   consistent with the rest of this project's zero-dependency JS. */
function fireConfetti(container){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#C9C2B4", "#0A0A0A", "#8A8A8A", "#F5F4F1"];
  for (let i = 0; i < 24; i++){
    const piece = document.createElement("div");
    const size = 5 + Math.random() * 5;
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 70;
    piece.style.cssText = `position:absolute; left:50%; top:40%; width:${size}px; height:${size * 0.6}px; background:${colors[i % colors.length]}; border-radius:2px; pointer-events:none; opacity:1; transform:translate(-50%,-50%) rotate(0deg); transition: transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease;`;
    container.appendChild(piece);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      piece.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) rotate(${Math.random() * 360}deg)`;
      piece.style.opacity = "0";
    }));
    setTimeout(() => piece.remove(), 1000);
  }
}

/* container: an element with a fixed size (set via CSS, e.g. .sc-card).
   onRevealed(card): called exactly once, whether by scratching or by
   the accessible fallback button. */
function mountScratchCard(container, card, onRevealed){
  let revealed = false;
  container.innerHTML = `
    <div class="sc-face-wrap">${scratchCardFaceHTML(card)}</div>
    <canvas class="sc-canvas"></canvas>
    <div class="sc-hint">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" stroke-width="1.6"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>
      <p>Scratch to reveal your Mystery Reward</p>
    </div>
    <button type="button" class="sc-reveal-fallback">Reveal Instantly</button>
  `;
  wireScratchCardCopyButtons(container);

  let hintHidden = false;
  // Fired on the very first scratch stroke — the center "Scratch to
  // reveal" text sits directly over the reward text underneath, so as
  // soon as the customer starts clearing foil it has to get out of the
  // way, or the two overlap/merge (worst in light mode, where both are
  // dark text). The fallback button lives outside .sc-hint now and is
  // untouched by this, staying available until the reveal itself.
  function hideHint(){
    if (hintHidden) return;
    hintHidden = true;
    const hint = container.querySelector(".sc-hint");
    if (!hint) return;
    hint.style.opacity = "0";
    setTimeout(() => hint.remove(), 350);
  }

  function finishReveal(){
    if (revealed) return;
    revealed = true;
    const canvas = container.querySelector(".sc-canvas");
    const hint = container.querySelector(".sc-hint");
    const fallbackBtn = container.querySelector(".sc-reveal-fallback");
    [canvas, hint, fallbackBtn].forEach(el => { if (el) el.style.transition = "opacity 0.5s ease"; });
    if (canvas) canvas.style.opacity = "0";
    if (hint) hint.style.opacity = "0";
    if (fallbackBtn) fallbackBtn.style.opacity = "0";
    setTimeout(() => { if (canvas) canvas.remove(); if (hint) hint.remove(); if (fallbackBtn) fallbackBtn.remove(); }, 500);
    fireConfetti(container);
    scratchCard(card.id, card.userId);
    if (onRevealed) onRevealed(card);
  }

  container.querySelector(".sc-reveal-fallback").addEventListener("click", finishReveal);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    // No canvas scratching at all for reduced-motion — the fallback
    // button above is the only interaction, already wired.
    container.querySelector(".sc-canvas").remove();
    return;
  }

  const canvas = container.querySelector(".sc-canvas");
  // offsetWidth/offsetHeight are the element's own layout size, unaffected
  // by any transform:scale() an ancestor happens to be mid-transition on
  // (the reveal popup fades/scales in) — getBoundingClientRect() reflects
  // that animated scale instead, so sizing the canvas from it produced a
  // buffer smaller than the settled card, leaving an uncovered sliver on
  // the right/bottom edges. The CSS width/height below stay percentages
  // for the same reason: always match the live container, never a
  // snapshot taken mid-animation.
  const cssWidth = container.offsetWidth;
  const cssHeight = container.offsetHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const grad = ctx.createLinearGradient(0, 0, cssWidth, cssHeight);
  grad.addColorStop(0, "#d8d8dc");
  grad.addColorStop(0.5, "#f4f4f6");
  grad.addColorStop(1, "#c7c7cc");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  let scratching = false;
  let lastCheck = 0;
  const BRUSH_RADIUS = 11; // was 22 — cleared the card in just a couple of swipes

  function pointFromEvent(e){
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  function scratchAt(x, y){
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  function scratchedPercent(){
    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    for (let i = 3; i < sample.length; i += 4 * 37){ if (sample[i] === 0) clear++; } // stride-sampled alpha channel, not every pixel — plenty accurate, far cheaper
    return clear / (sample.length / (4 * 37));
  }
  function handleMove(e){
    if (!scratching) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    scratchAt(p.x, p.y);
    const now = Date.now();
    if (now - lastCheck > 120){
      lastCheck = now;
      // Auto-reveal only once the foil is almost entirely gone — a real
      // scratch card doesn't pop the answer at barely-half-scratched; the
      // "Reveal Instantly" fallback stays there for anyone who wants to skip it.
      if (scratchedPercent() > 0.95) finishReveal();
    }
  }
  canvas.addEventListener("pointerdown", (e) => { scratching = true; hideHint(); const p = pointFromEvent(e); scratchAt(p.x, p.y); });
  window.addEventListener("pointermove", handleMove, { passive: false });
  window.addEventListener("pointerup", () => { scratching = false; });
  canvas.addEventListener("touchstart", (e) => { scratching = true; hideHint(); const p = pointFromEvent(e); scratchAt(p.x, p.y); }, { passive: true });
  canvas.addEventListener("touchmove", handleMove, { passive: false });
  canvas.addEventListener("touchend", () => { scratching = false; });
}
