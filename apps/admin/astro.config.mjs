// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // platformProxy enabled by default in @astrojs/cloudflare v13 — adapter reads
    // wrangler.jsonc to set up D1/KV/R2 bindings in dev. Type defs lag the docs;
    // see https://docs.astro.build/en/guides/integrations-guide/cloudflare/
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  site: "https://app.mixturemarketing.pl",
  trailingSlash: "never",
});
