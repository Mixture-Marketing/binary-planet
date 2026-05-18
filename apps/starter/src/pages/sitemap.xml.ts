import { buildSitemap, type SitemapEntry } from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";

import clientConfig from "../client.config.ts";

export const prerender = false;

export const GET: APIRoute = () => {
  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
  const today = new Date().toISOString().slice(0, 10);

  const entries: SitemapEntry[] = [
    { loc: `${base}/`, lastmod: today, priority: 1.0, changefreq: "weekly" },
    { loc: `${base}/oferta`, lastmod: today, priority: 0.9, changefreq: "weekly" },
    { loc: `${base}/o-firmie`, lastmod: today, priority: 0.7, changefreq: "monthly" },
    { loc: `${base}/kontakt`, lastmod: today, priority: 0.8, changefreq: "monthly" },
  ];

  const xml = buildSitemap(entries);
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
