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
    inlineStylesheets: "auto",
  },
  prefetch: {
    defaultStrategy: "viewport",
  },
});
