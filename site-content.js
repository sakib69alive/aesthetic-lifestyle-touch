/* ================================================================
   WEBSITE CONTENT — read-only on the storefront. Written by cms.js's
   Website Content section (alt_cms_website_v1); every storefront page
   that wants to reflect those edits reads it from here instead of
   keeping its own copy of the defaults.
   ================================================================ */
const WEBSITE_CONTENT_KEY = "alt_cms_website_v1";
const DEFAULT_WEBSITE_CONTENT = {
  heroHeadline: "Designed to elevate everyday living.",
  heroSubtext: "We curate rare, premium lifestyle objects from designers and makers around the world — chosen for form, material, and the quiet way they improve a room.",
  heroCtaLabel: "Shop Now",
  heroFeaturedProductIds: [1, 2, 8],
  announcement: "",
  announcementActive: false,
  contactEmail: "aestheticlifestyletouch@gmail.com",
  contactPhone: "01313667726",
};
function websiteContent(){
  try { return Object.assign({}, DEFAULT_WEBSITE_CONTENT, JSON.parse(localStorage.getItem(WEBSITE_CONTENT_KEY) || "{}")); }
  catch (e) { return DEFAULT_WEBSITE_CONTENT; }
}
