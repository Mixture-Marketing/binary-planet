import { describe, expect, it } from "vitest";

import { buildSitemap, buildSitemapIndex } from "./sitemap.js";

describe("buildSitemap", () => {
  it("emits valid XML with required fields", () => {
    const xml = buildSitemap([
      { loc: "https://example.pl/" },
      { loc: "https://example.pl/uslugi", lastmod: "2026-05-18", changefreq: "weekly", priority: 0.8 },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain("<loc>https://example.pl/</loc>");
    expect(xml).toContain("<lastmod>2026-05-18</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });

  it("escapes XML special chars in loc", () => {
    const xml = buildSitemap([{ loc: "https://example.pl/?a=1&b=2" }]);
    expect(xml).toContain("https://example.pl/?a=1&amp;b=2");
  });

  it("rejects empty entries", () => {
    expect(() => buildSitemap([])).toThrow(/empty/);
  });

  it("rejects non-absolute URL", () => {
    expect(() => buildSitemap([{ loc: "/relative" }])).toThrow(/absolute/);
  });

  it("rejects priority out of range", () => {
    expect(() => buildSitemap([{ loc: "https://example.pl/", priority: 1.5 }])).toThrow(/priority/);
  });

  it("rejects malformed lastmod", () => {
    expect(() => buildSitemap([{ loc: "https://example.pl/", lastmod: "yesterday" }])).toThrow(
      /lastmod/,
    );
  });

  it("accepts datetime lastmod", () => {
    const xml = buildSitemap([
      { loc: "https://example.pl/", lastmod: "2026-05-18T14:23:11Z" },
    ]);
    expect(xml).toContain("<lastmod>2026-05-18T14:23:11Z</lastmod>");
  });

  it("non-pretty mode produces single-line output", () => {
    const xml = buildSitemap([{ loc: "https://example.pl/" }], { pretty: false });
    expect(xml).not.toContain("\n  ");
  });
});

describe("buildSitemapIndex", () => {
  it("emits sitemapindex element", () => {
    const xml = buildSitemapIndex([
      { loc: "https://example.pl/sitemap-pages.xml" },
      { loc: "https://example.pl/sitemap-blog.xml", lastmod: "2026-05-18" },
    ]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<sitemap>");
    expect(xml).toContain("https://example.pl/sitemap-pages.xml");
    expect(xml).toContain("https://example.pl/sitemap-blog.xml");
  });
});
