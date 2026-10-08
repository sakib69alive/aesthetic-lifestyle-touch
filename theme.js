/* ================================================================
   DARK / LIGHT MODE
   The FOUC-prevention step (reading the saved choice and stamping
   data-theme onto <html> before first paint) is a tiny inline
   <script> at the very top of each page's <head> — waiting for this
   file to load would show a flash of the wrong theme. This file only
   handles the toggle control itself and persisting future changes.
   ================================================================ */
const THEME_KEY = "alt_theme_v1";
function getTheme(){
  try { return localStorage.getItem(THEME_KEY) || "light"; } catch (e) { return "light"; }
}
function setTheme(mode){
  document.documentElement.setAttribute("data-theme", mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* no-op */ }
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
  });
}
function toggleTheme(){ setTheme(getTheme() === "dark" ? "light" : "dark"); }

function wireThemeToggles(){
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    if (btn.dataset.themeWired) return;
    btn.dataset.themeWired = "1";
    btn.setAttribute("aria-pressed", getTheme() === "dark" ? "true" : "false");
    btn.addEventListener("click", toggleTheme);
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireThemeToggles);
else wireThemeToggles();
// mobile-nav.js injects its own toggle button into the menu overlay
// after this file has already run once — re-wire whenever it appears.
document.addEventListener("site-loader-dismissed", wireThemeToggles);
