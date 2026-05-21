// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // platformProxy enabled by default in @astrojs/cloudflare v13 — adapter reads
    // wrangler.jsonc for D1/KV/R2 bindings during dev. Type defs lag the runtime.
    imageService: "compile",
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  site: "https://panel.mixturemarketing.pl",
  trailingSlash: "never",
});
