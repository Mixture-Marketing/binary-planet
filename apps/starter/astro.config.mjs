// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "compile",
  }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Workers crypto compat (Astro polyfills node:crypto by default in some build modes)
      },
    },
  },
  site: "https://kowalski-slusarz.pl",
  trailingSlash: "never",
  build: {
    // "always" — zinline'uje wszystkie CSS bundle (Astro 5). Naprawia 6 render-blocking <link rel=stylesheet>
    // z PSI audit (2026-05-20). Pliki są małe (~2-6KB each), inline lepszy niż async fetch.
    inlineStylesheets: "always",
  },
  prefetch: {
    defaultStrategy: "viewport",
  },
  // NOTE 2026-05-21: Astro 6 `security.csp` próbowane — meta http-equiv NIE jest
  // emitowane dla SSR routes (tylko prerender). Powrót do `allowAstroInlineScripts`
  // w middleware. Native View Transitions (CSS @view-transition w globals.css) zostają —
  // działają niezależnie od CSP. Re-evaluate gdy Astro 6 CSP wesprze SSR pages.
});
