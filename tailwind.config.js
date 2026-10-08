/* Used only to REBUILD tailwind.css (see tailwind.input.css). The site loads
   the pre-built tailwind.css, not the runtime CDN script. */
module.exports = {
  content: ["./*.html", "./*.js", "!./tailwind.config.js"],
  theme: { extend: {} },
  plugins: [],
};
