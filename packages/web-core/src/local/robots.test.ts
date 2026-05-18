import { describe, expect, it } from "vitest";

import { buildRobotsTxt } from "./robots.js";

describe("buildRobotsTxt", () => {
  it("default policy allows crawling with admin/api disallowed", () => {
    const txt = buildRobotsTxt();
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /api/");
  });

  it("allow=false blocks everything", () => {
    const txt = buildRobotsTxt({ allow: false });
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Disallow: /");
    expect(txt).not.toContain("Disallow: /admin");
  });

  it("includes sitemap directive", () => {
    const txt = buildRobotsTxt({ sitemap: "https://example.pl/sitemap.xml" });
    expect(txt).toContain("Sitemap: https://example.pl/sitemap.xml");
  });

  it("supports multiple sitemap URLs", () => {
    const txt = buildRobotsTxt({
      sitemap: ["https://example.pl/sitemap-pages.xml", "https://example.pl/sitemap-blog.xml"],
    });
    expect(txt).toContain("https://example.pl/sitemap-pages.xml");
    expect(txt).toContain("https://example.pl/sitemap-blog.xml");
  });

  it("custom disallow paths override defaults", () => {
    const txt = buildRobotsTxt({ disallow: ["/internal/"] });
    expect(txt).toContain("Disallow: /internal/");
    expect(txt).not.toContain("Disallow: /admin");
  });

  it("per-bot rules emit separate groups", () => {
    const txt = buildRobotsTxt({
      perBot: [
        { userAgent: "AhrefsBot", disallow: ["/"] },
        { userAgent: "MJ12bot", disallow: ["/"] },
      ],
    });
    expect(txt).toContain("User-agent: AhrefsBot");
    expect(txt).toContain("User-agent: MJ12bot");
  });

  it("crawl delay included", () => {
    const txt = buildRobotsTxt({ crawlDelay: 5 });
    expect(txt).toContain("Crawl-delay: 5");
  });
});
