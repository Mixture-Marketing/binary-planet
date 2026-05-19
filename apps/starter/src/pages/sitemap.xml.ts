import { buildSitemap, type SitemapEntry } from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import clientConfig from "../client.config.ts";
import { getProgrammaticPages } from "../lib/programmatic.ts";

export const prerender = false;

export const GET: APIRoute = async () => {
  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
  const today = new Date().toISOString().slice(0, 10);

  const entries: SitemapEntry[] = [
    { loc: `${base}/`, lastmod: today, priority: 1.0, changefreq: "weekly" },
    { loc: `${base}/oferta`, lastmod: today, priority: 0.9, changefreq: "weekly" },
    { loc: `${base}/o-firmie`, lastmod: today, priority: 0.7, changefreq: "monthly" },
    { loc: `${base}/kontakt`, lastmod: today, priority: 0.8, changefreq: "monthly" },
    { loc: `${base}/aktualnosci`, lastmod: today, priority: 0.7, changefreq: "weekly" },
    { loc: `${base}/faq`, lastmod: today, priority: 0.6, changefreq: "monthly" },
  ];

  // Add each published post
  const posts = (await getCollection("posts")).filter((p) => p.data.published);
  for (const post of posts) {
    entries.push({
      loc: `${base}/aktualnosci/${post.id}`,
      lastmod: post.data.date.toISOString().slice(0, 10),
      priority: 0.6,
      changefreq: "monthly",
    });
  }

  // Programmatic service × location pages
  entries.push({ loc: `${base}/uslugi`, lastmod: today, priority: 0.8, changefreq: "monthly" });
  const programmatic = await getProgrammaticPages();
  for (const page of programmatic.pages) {
    const sSlug = page.combo.service.slug;
    const lSlug = page.combo.location.slug ?? page.combo.location.name.toLowerCase();
    entries.push({
      loc: `${base}/uslugi/${sSlug}/${lSlug}`,
      lastmod: today,
      priority: 0.7,
      changefreq: "monthly",
    });
  }

  const xml = buildSitemap(entries);
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
