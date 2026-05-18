import { describe, expect, it } from "vitest";

import { buildMetaTags, renderMetaTagsHtml } from "./meta.js";

const base = {
  title: "Strona testowa — opis który mieści się w limicie SERP",
  description:
    "Opis testowy w prawidłowej długości — między 120 a 160 znaków co Google rekomenduje dla SERP snippets. Wpis spełnia wszystkie wymagania.",
  canonicalUrl: "https://example.pl/strona",
};

describe("buildMetaTags", () => {
  it("emits title, description, canonical", () => {
    const { tags } = buildMetaTags(base);
    expect(tags.find((t) => t.kind === "title")).toBeTruthy();
    expect(tags.some((t) => t.kind === "meta" && t.name === "description")).toBe(true);
    expect(tags.some((t) => t.kind === "link" && t.rel === "canonical" && t.href === base.canonicalUrl)).toBe(true);
  });

  it("emits Open Graph defaults", () => {
    const { tags } = buildMetaTags(base);
    expect(tags.some((t) => t.kind === "meta" && t.property === "og:type" && t.content === "website")).toBe(true);
    expect(tags.some((t) => t.kind === "meta" && t.property === "og:title" && t.content === base.title)).toBe(true);
    expect(tags.some((t) => t.kind === "meta" && t.property === "og:locale" && t.content === "pl_PL")).toBe(true);
  });

  it("emits Twitter card defaults to 'summary' without image", () => {
    const { tags } = buildMetaTags(base);
    const card = tags.find((t) => t.kind === "meta" && t.name === "twitter:card");
    expect(card?.kind === "meta" && card.content).toBe("summary");
  });

  it("Twitter card upgrades to summary_large_image with image", () => {
    const { tags } = buildMetaTags({
      ...base,
      og: { image: { url: "https://example.pl/og.png", width: 1200, height: 630, alt: "test" } },
    });
    const card = tags.find((t) => t.kind === "meta" && t.name === "twitter:card");
    expect(card?.kind === "meta" && card.content).toBe("summary_large_image");
    expect(tags.some((t) => t.kind === "meta" && t.property === "og:image:width" && t.content === "1200")).toBe(true);
  });

  it("article type adds article:* meta", () => {
    const { tags } = buildMetaTags({
      ...base,
      og: {
        type: "article",
        publishedTime: "2026-05-18T12:00:00Z",
        modifiedTime: "2026-05-19T10:00:00Z",
        author: "Jan Kowalski",
        tags: ["seo", "local"],
      },
    });
    expect(tags.some((t) => t.kind === "meta" && t.property === "article:published_time")).toBe(true);
    expect(tags.some((t) => t.kind === "meta" && t.property === "article:author" && t.content === "Jan Kowalski")).toBe(true);
    const tagTags = tags.filter((t) => t.kind === "meta" && t.property === "article:tag");
    expect(tagTags).toHaveLength(2);
  });

  it("robots meta emits noindex/nofollow when requested", () => {
    const { tags } = buildMetaTags({ ...base, robots: { noindex: true, nofollow: true } });
    const robots = tags.find((t) => t.kind === "meta" && t.name === "robots");
    expect(robots?.kind === "meta" && robots.content).toContain("noindex");
    expect(robots?.kind === "meta" && robots.content).toContain("nofollow");
  });

  it("warnings: title too long", () => {
    const { warnings } = buildMetaTags({ ...base, title: "x".repeat(120) });
    expect(warnings.find((w) => w.field === "title")).toBeDefined();
  });

  it("warnings: description out of range", () => {
    const { warnings } = buildMetaTags({ ...base, description: "too short" });
    expect(warnings.find((w) => w.field === "description")).toBeDefined();
  });

  it("warnings: relative canonical URL", () => {
    const { warnings } = buildMetaTags({ ...base, canonicalUrl: "/relative" });
    expect(warnings.find((w) => w.field === "canonicalUrl")).toBeDefined();
  });

  it("icons + theme color emitted", () => {
    const { tags } = buildMetaTags({
      ...base,
      icons: { svg: "/favicon.svg", appleTouch: "/apple-touch-icon.png" },
      themeColor: "#c0392b",
    });
    expect(tags.some((t) => t.kind === "link" && t.rel === "icon" && t.type === "image/svg+xml")).toBe(true);
    expect(tags.some((t) => t.kind === "link" && t.rel === "apple-touch-icon")).toBe(true);
    expect(tags.some((t) => t.kind === "meta" && t.name === "theme-color" && t.content === "#c0392b")).toBe(true);
  });
});

describe("renderMetaTagsHtml", () => {
  it("renders title/meta/link tags as HTML", () => {
    const { tags } = buildMetaTags(base);
    const html = renderMetaTagsHtml(tags);
    expect(html).toContain("<title>");
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<link rel="canonical"');
  });

  it("escapes attributes", () => {
    const html = renderMetaTagsHtml([{ kind: "meta", name: "description", content: '<script>alert("x")</script>' }]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
