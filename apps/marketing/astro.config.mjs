import { defineConfig } from "astro/config";

// Static export deployed to Cloudflare Pages. The site URL is used for
// canonical/OG tags; override via `--site https://staging.smartphotobook.kreativekorna.com`
// in CI when needed.
export default defineConfig({
  site: "https://smartphotobook.kreativekorna.com",
  output: "static",
  trailingSlash: "never",
  build: {
    inlineStylesheets: "auto",
  },
});
