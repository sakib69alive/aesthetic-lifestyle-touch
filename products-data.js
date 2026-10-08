/* ================================================================
   SHARED PRODUCT DATA
   Single source of truth for Store (store.html) and Product Details
   (product.html). Swap this for an API response later without
   touching any render logic on either page.
   ================================================================ */

/* Escapes user-submitted text before it's interpolated into an innerHTML
   template — reviews, ticket subjects/messages, order notes, customer
   names, etc. are all typed by site visitors, so without this any of
   them could inject a working <script>/onerror handler into another
   visitor's — or the admin's — browser (stored XSS). Call it at the
   point of render, not at the point of storage, so search/CSV/audit
   consumers still get the original, unescaped value. */
function escapeHTML(str){
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Right-sized images: grids and thumbnails ask Unsplash for the width they
   actually display instead of the 900-1000px hero version (a 40-card store
   grid was downloading ~40 full-size photos). Non-Unsplash URLs (admin
   uploads, data: URLs) pass through untouched. */
function thumb(url, w){
  if (typeof url !== "string" || url.indexOf("images.unsplash.com") === -1) return url;
  return url.replace(/([?&])w=\d+/, "$1w=" + w).replace(/([?&])q=\d+/, "$1q=72");
}

const CONTEXT_IMG = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80&auto=format&fit=crop";
const DETAIL_IMG  = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1000&q=80&auto=format&fit=crop";

/* Demo/test inventory — for trying out the storefront and admin panel.
   Replace or remove these from Admin → Products (or CMS → Products)
   once real inventory is ready; admin-added products are stored
   separately (see productExtras() below) and work exactly the same. */
const PRODUCTS = [
  { id: 1,  name: "Aura Headphones",     brand: "Aesthetic Lifestyle Touch", price: 20790, rating: 4.8, reviews: 124, stock: 32, tags: ["tech","new-arrivals"],            badge: "New",      desc: "Matte ceramic shell with adaptive spatial audio, tuned for long, quiet listening.", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#C9C2B4","#E8E6E1"],
    specs: { Dimensions: "18 × 16 × 7 cm", Weight: "270 g", Material: "Ceramic composite, memory foam", Compatibility: "Bluetooth 5.3, USB-C", "Country of Origin": "Assembled in Vietnam", Warranty: "2-Year Limited" } },
  { id: 2,  name: "Halo Desk Lamp",      brand: "Aesthetic Lifestyle Touch", price: 10560,  rating: 4.6, reviews: 98,  stock: 41, tags: ["desk-setup","trending"],          badge: "Trending", desc: "Anodized aluminum arm with three warmth settings and a weighted, silent base.", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#8A8A8A"],
    specs: { Dimensions: "48 cm height, 22 cm base", Weight: "1.1 kg", Material: "Anodized aluminum, weighted steel base", Compatibility: "USB-C powered, 100–240V", "Country of Origin": "Assembled in Taiwan", Warranty: "2-Year Limited" } },
  { id: 3,  name: "Orbit Watch",         brand: "Aesthetic Lifestyle Touch", price: 27390, rating: 4.9, reviews: 210, stock: 4,  tags: ["tech","new-arrivals","best-sellers"], badge: "New",  desc: "Sapphire face, ten-day battery, and a clasp machined from a single block of steel.", img: "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#C9C2B4"],
    specs: { Dimensions: "42 mm case", Weight: "58 g", Material: "Sapphire crystal, stainless steel", Compatibility: "iOS & Android", "Country of Origin": "Assembled in Switzerland", Warranty: "2-Year Limited" } },
  { id: 4,  name: "Dune Vase",           brand: "Aesthetic Lifestyle Touch", price: 7480,  rating: 4.7, reviews: 56,  stock: 19, tags: ["room-decor","lifestyle"],         badge: null,       desc: "Hand-poured stoneware with a soft matte finish, no two exactly alike.", img: "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=900&q=80&auto=format&fit=crop", colors: ["#E8E6E1","#C9C2B4"],
    specs: { Dimensions: "24 × 14 cm", Weight: "820 g", Material: "Hand-poured stoneware", Compatibility: "—", "Country of Origin": "Handmade in Portugal", Warranty: "30-Day Quality Guarantee" } },
  { id: 5,  name: "Tray Charger",        brand: "Aesthetic Lifestyle Touch", price: 8690,  rating: 4.5, reviews: 77,  stock: 27, tags: ["desk-setup","gadgets","new-arrivals"], badge: "New", desc: "Three-in-one wireless charging tray finished in woven performance fabric.", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#E8E6E1"],
    specs: { Dimensions: "20 × 12 × 1.2 cm", Weight: "180 g", Material: "Woven performance fabric, aluminum core", Compatibility: "Qi wireless, 3-in-1", "Country of Origin": "Assembled in Vietnam", Warranty: "1-Year Limited" } },
  { id: 6,  name: "Echo Speaker",        brand: "Aesthetic Lifestyle Touch", price: 14190, salePrice: 10890, rating: 4.6, reviews: 143, stock: 22, tags: ["tech","trending","best-sellers"], badge: "Trending", desc: "360° sound from a compact woven shell that looks at home anywhere.", img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&q=80&auto=format&fit=crop", colors: ["#C9C2B4","#0A0A0A"],
    specs: { Dimensions: "16 × 16 × 18 cm", Weight: "980 g", Material: "Woven acoustic fabric, aluminum", Compatibility: "Bluetooth 5.3, Wi-Fi", "Country of Origin": "Assembled in Vietnam", Warranty: "2-Year Limited" } },
  { id: 7,  name: "Fold Wallet",         brand: "Aesthetic Lifestyle Touch", price: 5940,  rating: 4.4, reviews: 61,  stock: 38, tags: ["accessories","lifestyle"],        badge: null,       desc: "Full-grain leather, RFID-shielded, breaks in beautifully over the first month.", img: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=900&q=80&auto=format&fit=crop", colors: ["#0A0A0A","#8A8A8A","#C9C2B4"],
    specs: { Dimensions: "11 × 8.5 × 1.5 cm", Weight: "70 g", Material: "Full-grain leather, RFID shield", Compatibility: "Holds up to 8 cards", "Country of Origin": "Handmade in Italy", Warranty: "1-Year Craftsmanship" } },
  { id: 8,  name: "Ember Candle",        brand: "Aesthetic Lifestyle Touch", price: 4620,  rating: 4.8, reviews: 189, stock: 54, tags: ["room-decor","best-sellers"],     badge: null,       desc: "Poured into a matte concrete vessel; sixty hours of clean, quiet burn.", img: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=900&q=80&auto=format&fit=crop", colors: ["#E8E6E1"],
    specs: { Dimensions: "9 × 9 × 10 cm", Weight: "620 g", Material: "Concrete vessel, soy-coconut wax", Compatibility: "60-hour burn time", "Country of Origin": "Hand-poured in-house", Warranty: "Satisfaction Guarantee" } },
];

/* More demo variety (ids 9+). Compact factory so each line stays readable;
   the resulting objects have exactly the same shape as the entries above.
   spec = [Dimensions, Weight, Material, Compatibility, Origin, Warranty] */
function demoProduct(id, name, price, rating, reviews, stock, tags, badge, desc, photo, colors, spec, salePrice){
  const p = {
    id, name, brand: "Aesthetic Lifestyle Touch", price, rating, reviews, stock, tags, badge, desc,
    img: "https://images.unsplash.com/photo-" + photo + "?w=900&q=80&auto=format&fit=crop",
    colors,
    specs: { Dimensions: spec[0], Weight: spec[1], Material: spec[2], Compatibility: spec[3], "Country of Origin": spec[4], Warranty: spec[5] },
  };
  if (salePrice) p.salePrice = salePrice;
  return p;
}
PRODUCTS.push(
  demoProduct(9,  "Noir ANC Headphones",   24990, 4.8, 167, 18, ["tech","new-arrivals","best-sellers"], "New",      "Over-ear active noise cancelling with a 40-hour battery and soft protein-leather cushions.", "1546435770-a3e426bf472b", ["#0A0A0A","#8A8A8A"], ["19 × 17 × 8 cm","254 g","Protein leather, aluminum","Bluetooth 5.3, USB-C, 3.5 mm","Assembled in Vietnam","2-Year Limited"]),
  demoProduct(10, "Monitor Headphones",    12990, 4.5, 84,  26, ["tech","desk-setup"],                   null,       "Closed-back studio drivers with a flat, honest response — made for long edits and long evenings.", "1583394838336-acd977736f90", ["#8A8A8A","#0A0A0A"], ["20 × 18 × 9 cm","310 g","ABS, memory foam","3.5 mm / 6.3 mm wired","Assembled in China","1-Year Limited"]),
  demoProduct(11, "Studio Wired Headphones", 6490, 4.3, 52,  44, ["tech","accessories"],                  null,       "Lightweight on-ear pair with a tangle-resistant cable and a folding frame for the bag.", "1572536147248-ac59a8abfa4b", ["#0A0A0A"], ["17 × 15 × 6 cm","180 g","ABS, foam","3.5 mm wired","Assembled in China","1-Year Limited"]),
  demoProduct(12, "Pulse Earbuds",          8790, 4.4, 119, 60, ["tech","gadgets","trending"],            "Trending", "True-wireless earbuds with a pocket-size charging case and 28 hours of total playtime.", "1606220588913-b3aacb4d2f46", ["#0A0A0A","#C9C2B4"], ["6 × 5 × 2.5 cm (case)","48 g with case","Matte polycarbonate","Bluetooth 5.3","Assembled in Vietnam","1-Year Limited"], 6990),
  demoProduct(13, "Pebble Smart Watch",    16490, 4.6, 93,  21, ["tech","gadgets","new-arrivals"],       "New",      "A quiet, round AMOLED face tracking sleep, steps and heart rate for seven days per charge.", "1523275335684-37898b6baf30", ["#E8E6E1","#0A0A0A"], ["42 mm case","46 g","Aluminum, silicone strap","iOS & Android","Assembled in China","1-Year Limited"]),
  demoProduct(14, "Rosé Classic Watch",    19990, 4.7, 71,  9,  ["accessories","lifestyle","best-sellers"], null,    "Slim rose-gold case on a woven strap — the dressy one you'll reach for every day.", "1524592094714-0f0654e20314", ["#C9C2B4","#0A0A0A"], ["38 mm case","42 g","Stainless steel, sapphire glass","Quartz movement","Assembled in Japan","2-Year Limited"]),
  demoProduct(15, "Potting Trowel",          2490, 4.5, 64,  48, ["lifestyle","new-arrivals"],              "New",      "A forged, teal-enamelled trowel with a deep scoop and a comfortable grip — for balcony pots and window boxes.", "1416879595882-3373a0480b5b", ["#8A8A8A"], ["31 × 8 × 5 cm","240 g","Forged steel, powder-coat enamel","Fits most pots & planters","Made in Germany","2-Year Limited"]),
  demoProduct(16, "Glide Wireless Mouse",   3990, 4.4, 138, 70, ["desk-setup","gadgets","best-sellers"],  null,       "Whisper-quiet clicks, a sculpted palm shape, and three months on a single charge.", "1527864550417-7fd91fc51a46", ["#0A0A0A","#8A8A8A"], ["11 × 6.5 × 3.8 cm","92 g","Soft-touch ABS","Bluetooth 5.1 / 2.4 GHz","Assembled in China","1-Year Limited"]),
  demoProduct(17, "Dot Grid Notebook",      1490, 4.7, 205, 120, ["desk-setup","lifestyle"],              null,       "Lay-flat binding and 120 gsm ivory paper that takes fountain pen without bleeding.", "1531346878377-a5be20888e57", ["#0A0A0A","#E8E6E1"], ["21 × 14.8 cm","310 g","120 gsm ivory paper, cloth cover","A5, 160 pages","Made in Italy","Satisfaction Guarantee"]),
  demoProduct(18, "Arc Task Lamp",          9290, 4.6, 88,  33, ["desk-setup","room-decor"],              null,       "A counterweighted steel arm that holds any angle, with a warm, glare-free LED head.", "1507473885765-e6ed057f782c", ["#0A0A0A","#8A8A8A"], ["62 cm reach, 20 cm base","1.4 kg","Powder-coated steel","100–240V, E27 LED included","Assembled in Taiwan","2-Year Limited"]),
  demoProduct(19, "Cluster Pendant Light", 15490, 4.8, 47,  12, ["room-decor","lifestyle","new-arrivals"], "New",     "Three glass-and-brass pendants on adjustable cords — instant atmosphere over a table or island.", "1507089947368-19c1da9775ae", ["#C9C2B4","#0A0A0A"], ["Drop up to 120 cm, ⌀ 18 cm each","2.1 kg","Brass, hand-blown glass","E27, 100–240V","Handmade in Portugal","2-Year Limited"]),
  demoProduct(20, "Teal Dome Pendant",      7990, 4.4, 39,  25, ["room-decor"],                           null,       "A bold enamel dome that throws a soft pool of light and a good dose of colour.", "1513506003901-1e6a229e2d15", ["#8A8A8A","#0A0A0A"], ["⌀ 32 cm, drop up to 100 cm","1.3 kg","Enameled steel","E27, 100–240V","Assembled in Poland","1-Year Limited"]),
  demoProduct(21, "Cone Pendant Lamp",      5990, 4.5, 58,  40, ["room-decor","best-sellers"],            null,       "A minimalist matte-black cone with a bright inner shade, sized for hallways and reading corners.", "1565814329452-e1efa11c5b89", ["#0A0A0A"], ["⌀ 25 cm, drop up to 110 cm","0.9 kg","Powder-coated steel","E27, 100–240V","Assembled in China","1-Year Limited"]),
  demoProduct(22, "Slate Vase Trio",        6890, 4.7, 73,  29, ["room-decor","lifestyle"],               null,       "Three matte stoneware vases in graduated heights — arrange together or scatter across a room.", "1565193566173-7a0ee3dbe261", ["#8A8A8A","#C9C2B4"], ["Tallest 28 cm","1.6 kg (set)","Matte stoneware","—","Handmade in Portugal","30-Day Quality Guarantee"]),
  demoProduct(23, "Mint Succulent Planter", 2490, 4.6, 112, 80, ["room-decor","lifestyle","trending"],      "Trending", "A glazed mint pot with a drainage plug and saucer — comes ready for any small succulent.", "1485955900006-10f4d324d411", ["#E8E6E1","#C9C2B4"], ["12 × 12 × 12 cm","340 g","Glazed ceramic","Drainage plug included","Handmade in Portugal","30-Day Quality Guarantee"]),
  demoProduct(24, "Rattan Lounge Chair",   32990, 4.8, 36,  6,  ["room-decor","lifestyle","new-arrivals"], "New",     "A sculpted rattan frame with a deep cushion — the chair everyone ends up fighting over.", "1519947486511-46149fa0a254", ["#C9C2B4","#0A0A0A"], ["72 × 70 × 78 cm","6.8 kg","Natural rattan, solid ash","Cushion included","Handwoven in Indonesia","2-Year Limited"]),
  demoProduct(25, "Moss Velvet Sofa",      74990, 4.9, 22,  3,  ["room-decor","lifestyle","best-sellers"], null,     "A deep three-seater in dense performance velvet, on solid beech legs.", "1555041469-a586c61ea9bc", ["#4F6B52"], ["210 × 90 × 80 cm","48 kg","Performance velvet, beech frame","Seats 3","Made in Poland","3-Year Limited"]),
  demoProduct(26, "Sand Leather Sofa",     89990, 4.9, 18,  2,  ["room-decor","lifestyle"],               null,       "Full-grain aniline leather that darkens and softens with age — the last sofa you'll buy.", "1578500494198-246f612d3b3d", ["#C9C2B4"], ["220 × 95 × 82 cm","55 kg","Full-grain leather, oak frame","Seats 3","Made in Italy","5-Year Limited"]),
  demoProduct(27, "Mustard Armchair",      28990, 4.7, 41,  8,  ["room-decor","trending"],                "Trending", "A compact armchair in saturated mustard fabric that carries a whole corner on its own.", "1586023492125-27b2c045efd7", ["#C9C2B4"], ["74 × 78 × 80 cm","11 kg","Textured weave, solid oak","Seats 1","Made in Denmark","2-Year Limited"]),
  demoProduct(28, "Pale Blue Stool",        4290, 4.3, 49,  34, ["room-decor"],                            null,       "A simple, stackable stool in a powdery blue lacquer — side table, seat or plant stand.", "1503602642458-232111445657", ["#E8E6E1"], ["32 × 32 × 46 cm","2.4 kg","Lacquered birch","Max load 120 kg","Made in Latvia","1-Year Limited"]),
  demoProduct(29, "Oak Shoe Cabinet",      18990, 4.6, 27,  10, ["room-decor"],                            null,       "Slim-profile storage in warm oak veneer, with tilt-out shelves for twelve pairs.", "1595428774223-ef52624120d2", ["#C9C2B4"], ["80 × 24 × 120 cm","22 kg","Oak veneer, steel hardware","Holds 12 pairs","Made in Germany","2-Year Limited"]),
  demoProduct(30, "Sunburst Mirror Duo",    8490, 4.5, 31,  17, ["room-decor","new-arrivals"],             "New",      "Two round mirrors in a woven rattan sunburst frame, made to hang as a pair.", "1631679706909-1844bbd07221", ["#C9C2B4"], ["⌀ 45 cm and ⌀ 30 cm","1.8 kg (pair)","Rattan, mirror glass","Wall hooks included","Handwoven in Indonesia","30-Day Quality Guarantee"]),
  demoProduct(31, "Cloud Ceramic Mug",      1890, 4.8, 264, 150, ["lifestyle","best-sellers"],             null,       "A generous 350 ml mug in thick matte porcelain with a handle your fingers actually fit.", "1514228742587-6b1558fcca3d", ["#E8E6E1","#0A0A0A"], ["9 × 12 × 9.5 cm","360 g","Matte porcelain","Dishwasher & microwave safe","Made in Portugal","30-Day Quality Guarantee"]),
  demoProduct(32, "Brew Cup Set",           3290, 4.6, 98,  45, ["lifestyle","new-arrivals"],              "New",      "Set of four double-walled cups that keep coffee hot and the outside cool to the touch.", "1495474472287-4d71bcdd2085", ["#E8E6E1","#C9C2B4"], ["⌀ 8 × 9 cm each","900 g (set of 4)","Borosilicate glass","Dishwasher safe","Made in Germany","1-Year Limited"]),
  demoProduct(33, "Lavender Hand Cream",    1290, 4.7, 156, 90, ["lifestyle","best-sellers"],              null,       "A non-greasy, fast-absorbing hand cream with shea butter and a calm lavender scent.", "1556228720-195a672e8a03", ["#C9C2B4"], ["12 × 4 × 3 cm","75 ml","Shea butter, lavender oil","All skin types","Made in France","Use within 12 months"]),
  demoProduct(34, "Botanical Skincare Set", 7490, 4.8, 82,  24, ["lifestyle","new-arrivals"],              "New",      "Cleanser, serum and moisturiser in amber glass — a three-step routine in one gift box.", "1612817288484-6f916006741a", ["#C9C2B4"], ["22 × 14 × 8 cm (box)","540 g","Plant-based formulas, amber glass","All skin types","Made in South Korea","Use within 12 months"]),
  demoProduct(35, "Blush Makeup Set",       5290, 4.4, 67,  31, ["lifestyle","trending"],                  "Trending", "A soft-focus neutral palette: lip, cheek and brush in one travel-size pouch.", "1596462502278-27bfdc403348", ["#C9C2B4"], ["20 × 12 × 4 cm","320 g","Mineral pigments, vegan brushes","Suitable for all skin tones","Made in Italy","Use within 24 months"]),
  demoProduct(36, "Frame Sunglasses",       4890, 4.5, 102, 52, ["accessories","lifestyle"],               null,       "Classic acetate frames with UV400 polarised lenses and a hard travel case.", "1572635196237-14b3f281503f", ["#0A0A0A"], ["14.5 cm width","32 g","Acetate, polarised glass","UV400","Made in Italy","1-Year Craftsmanship"]),
  demoProduct(37, "Everyday Tee",           1990, 4.6, 238, 200, ["accessories","lifestyle","best-sellers"], null,    "Heavyweight 240 gsm organic cotton with a relaxed cut that gets better every wash.", "1521572163474-6864f9cf17ab", ["#E8E6E1","#0A0A0A"], ["Sizes S – XXL","240 g","100% organic cotton","Machine wash cold","Made in Portugal","30-Day Quality Guarantee"]),
  demoProduct(38, "Navy Daypack",           6990, 4.6, 91,  37, ["accessories","lifestyle","trending"],    "Trending", "Water-resistant 20 L pack with a padded 15-inch laptop sleeve and hidden back pocket.", "1553062407-98eeb64c6a62", ["#0A0A0A","#8A8A8A"], ["44 × 30 × 15 cm","720 g","Recycled ripstop nylon","Fits 15-inch laptops","Assembled in Vietnam","3-Year Limited"]),
  demoProduct(39, "Crimson Handbag",       11990, 4.7, 56,  14, ["accessories","new-arrivals"],            "New",      "A structured top-handle bag in grained leather, with a detachable strap and suede lining.", "1584917865442-de89df76afd3", ["#0A0A0A","#C9C2B4"], ["26 × 11 × 19 cm","640 g","Grained leather, suede lining","Fits phone, wallet, keys","Handmade in Italy","1-Year Craftsmanship"]),
  demoProduct(40, "Teal Derby Shoes",      14990, 4.5, 33,  11, ["accessories","lifestyle"],               null,       "Hand-finished suede derbies on a cushioned leather sole — dressy without the stiffness.", "1560343090-f0409e92791a", ["#8A8A8A"], ["EU 39 – 45","780 g (pair)","Suede, leather sole","—","Handmade in Portugal","1-Year Craftsmanship"])
);

// Every product borrows the same two neutral "in context" / "detail" shots
// for gallery slots 2–3 until real multi-angle photography is available.
PRODUCTS.forEach(p => { p.gallery = [p.img, CONTEXT_IMG, DETAIL_IMG]; });

const CATEGORIES = [
  { label: "All",            slug: "all" },
  { label: "New Arrivals",   slug: "new-arrivals" },
  { label: "Trending",       slug: "trending" },
  { label: "Best Sellers",   slug: "best-sellers" },
  { label: "Accessories",    slug: "accessories" },
  { label: "Lifestyle",      slug: "lifestyle" },
  { label: "Tech",           slug: "tech" },
  { label: "Desk Setup",     slug: "desk-setup" },
  { label: "Room Decor",     slug: "room-decor" },
  { label: "Gadgets",        slug: "gadgets" },
];

function starString(rating){
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function categoryLabel(slug){
  const found = CATEGORIES.find(c => c.slug === slug);
  return found ? found.label : "Shop";
}

/* ================================================================
   BANGLADESH DIVISION -> DISTRICT MAP (representative subset)
   Shared by Checkout's shipping address and the Dashboard's saved
   addresses so both use the same geography data.
   ================================================================ */
const BD_DIVISIONS = {
  "Dhaka":        ["Dhaka","Gazipur","Narayanganj","Tangail","Manikganj","Munshiganj","Narsingdi"],
  "Chattogram":   ["Chattogram","Cox's Bazar","Cumilla","Feni","Noakhali","Rangamati","Bandarban"],
  "Rajshahi":     ["Rajshahi","Bogura","Pabna","Sirajganj","Naogaon","Natore"],
  "Khulna":       ["Khulna","Jessore","Satkhira","Bagerhat","Kushtia","Jhenaidah"],
  "Barishal":     ["Barishal","Patuakhali","Bhola","Pirojpur","Barguna"],
  "Sylhet":       ["Sylhet","Moulvibazar","Habiganj","Sunamganj"],
  "Rangpur":      ["Rangpur","Dinajpur","Kurigram","Gaibandha","Lalmonirhat"],
  "Mymensingh":   ["Mymensingh","Jamalpur","Netrokona","Sherpur"],
};

/* ================================================================
   ADMIN/CMS PRODUCT OVERLAY — the one place every page (storefront
   AND the admin/CMS tools) reads and writes admin-made product
   edits, so a change made in admin.html or cms.html is visible
   everywhere else without a rebuild.
   ================================================================ */
const PRODUCT_OVERRIDES_KEY = "alt_admin_product_overrides_v1";
const PRODUCT_EXTRAS_KEY = "alt_admin_extra_products_v1";
function productOverrides(){ try { return JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY) || "{}"); } catch (e) { return {}; } }
function saveProductOverrides(obj){ localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(obj)); }
function productExtras(){ try { return JSON.parse(localStorage.getItem(PRODUCT_EXTRAS_KEY) || "[]"); } catch (e) { return []; } }
function saveProductExtras(list){ localStorage.setItem(PRODUCT_EXTRAS_KEY, JSON.stringify(list)); }

/* Every product, overrides applied, minus anything admin deleted — used by
   admin.html/cms.html so they can see and manage drafts/archived items too. */
function getAllProductsWithOverrides(){
  const overrides = productOverrides();
  const base = PRODUCTS.map(p => Object.assign({}, p, overrides[p.id] || {}));
  const extra = productExtras().map(p => Object.assign({}, p, overrides[p.id] || {}));
  return base.concat(extra).filter(p => !p.deleted);
}

/* What customers should actually see: hides Draft/Review/Archived/Rejected,
   and Scheduled items whose publish date/time hasn't arrived yet. Every
   storefront page's product grid/lookup should read from this, not PRODUCTS
   directly, so admin/CMS edits show up on the live site immediately. */
function getStorefrontProducts(){
  const now = Date.now();
  return getAllProductsWithOverrides().filter(p => {
    if (p.status === "Draft" || p.status === "Archived" || p.status === "Rejected" || p.status === "Review") return false;
    if (p.status === "Scheduled" && p.scheduledAt && new Date(p.scheduledAt).getTime() > now) return false;
    return true;
  });
}

/* Single lookup + the two write paths (edit-in-place via override, or a
   brand new admin/CMS-added SKU). Moved here from admin.js/cms.js (where
   they used to be duplicated) so checkout — which needs to decrement
   stock on every order — can use the exact same functions without
   pulling in the whole admin app. */
/* Product IDs from the URL/DOM arrive as strings, but admin/CMS-added
   products keep string IDs (e.g. "a_1735993528123") while the older
   demo catalog used numeric ones — so a blind Number(id) turns a new
   product's ID into NaN and every lookup silently fails. Try Number()
   first (for legacy numeric IDs) and fall back to the raw string. */
function idOf(rawId){ const n = Number(rawId); return Number.isNaN(n) ? rawId : n; }
function getProduct(id){ return getAllProductsWithOverrides().find(p => p.id === id); }
function isExtraProduct(id){ return productExtras().some(p => p.id === id); }
function updateProduct(id, patch){
  const overrides = productOverrides();
  overrides[id] = Object.assign({}, overrides[id] || {}, patch);
  saveProductOverrides(overrides);
}
function addProduct(product){
  const extras = productExtras();
  extras.push(product);
  saveProductExtras(extras);
  return product;
}

/* ================================================================
   REVIEWS — single source of truth for admin.js's moderation queue
   AND the storefront's real per-product review display/submission.
   Every review already carries a real productId, so a customer's
   approved review just shows up on that exact product page — no
   separate demo/real split needed the way orders required.
   ================================================================ */
const REVIEWS_KEY = "alt_admin_reviews_v1";
function allReviews(){ try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]"); } catch (e) { return []; } }
function saveReviews(list){ localStorage.setItem(REVIEWS_KEY, JSON.stringify(list)); }
function reviewsForProduct(productId){
  return allReviews().filter(r => r.productId === productId && r.status === "approved")
    .sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
}

/* Reviews are gated to verified purchasers, one review per product per
   customer — hasPurchasedProduct() needs ordersForUser() from
   order-service.js, loaded on product.html alongside this file. */
function hasPurchasedProduct(userId, productId){
  if (!userId || userId === "guest" || typeof ordersForUser === "undefined") return false;
  return ordersForUser(userId).some(o => o.status === "delivered" && (o.items || []).some(it => it.productId === productId));
}
function hasReviewedProduct(userId, productId){
  if (!userId) return false;
  return allReviews().some(r => r.productId === productId && r.userId === userId);
}
function submitReview({ productId, productName, userId, author, rating, text, photos }){
  const errors = [];
  if (!hasPurchasedProduct(userId, productId)) errors.push("Only customers who've received this product can leave a review.");
  else if (hasReviewedProduct(userId, productId)) errors.push("You've already reviewed this product.");
  if (!author || !author.trim()) errors.push("Enter your name.");
  if (!rating || rating < 1 || rating > 5) errors.push("Choose a star rating.");
  if (!text || !text.trim()) errors.push("Write a few words about the product.");
  if (errors.length) return { ok: false, errors };

  const list = allReviews();
  list.unshift({
    id: "rev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    productId, productName, userId, author: author.trim(), rating, text: text.trim(),
    photos: Array.isArray(photos) ? photos.slice(0, 3) : [],
    helpfulBy: [],
    at: Date.now(), status: "pending", pinned: false, reply: null,
  });
  saveReviews(list);
  return { ok: true };
}

/* "Helpful" reactions — one vote per visitor per review. Logged-in
   visitors vote under their account id; guests get a persistent
   anonymous id stored locally, so a reload doesn't reset their vote. */
function reviewVoterId(){
  if (typeof Auth !== "undefined" && Auth.isLoggedIn()) return "user_" + Auth.currentUser().id;
  let id;
  try { id = localStorage.getItem("alt_anon_voter_v1"); } catch (e) { id = null; }
  if (!id){
    id = "anon_" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem("alt_anon_voter_v1", id); } catch (e) { /* private browsing — vote just won't persist */ }
  }
  return id;
}
function reviewHelpfulState(review){
  const voter = reviewVoterId();
  const helpfulBy = Array.isArray(review.helpfulBy) ? review.helpfulBy : [];
  return { count: helpfulBy.length, active: helpfulBy.includes(voter) };
}
function toggleReviewHelpful(reviewId){
  const list = allReviews();
  const r = list.find(x => x.id === reviewId);
  if (!r) return null;
  if (!Array.isArray(r.helpfulBy)) r.helpfulBy = [];
  const voter = reviewVoterId();
  const idx = r.helpfulBy.indexOf(voter);
  if (idx > -1) r.helpfulBy.splice(idx, 1);
  else r.helpfulBy.push(voter);
  saveReviews(list);
  return { count: r.helpfulBy.length, active: idx === -1 };
}
