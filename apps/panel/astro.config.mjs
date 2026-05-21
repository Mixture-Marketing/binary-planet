// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    
    imageService: "compile",
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  site: "https://panel.mixturemarketing.pl",
  trailingSlash: "never",
});
