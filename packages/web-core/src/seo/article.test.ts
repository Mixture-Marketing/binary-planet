import { describe, expect, it } from "vitest";

import { articleSchema } from "./article.js";

const baseInput = {
  url: "https://example.pl/blog/jak-dobrac-zamek",
  headline: "Jak dobrać zamek do drzwi mieszkania",
  description: "Praktyczny przewodnik wyboru zamka klasy B/C/C+ dla mieszkań i lokali użytkowych.",
  datePublished: "2026-05-18",
  author: { name: "Jan Kowalski", jobTitle: "Ślusarz z 20-letnim stażem" },
  publisher: { name: "Ślusarz Kowalski", logo: { url: "https://example.pl/logo.png" } },
};

describe("articleSchema", () => {
  it("emits minimal Article JSON-LD", () => {
    const out = articleSchema(baseInput);
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("Article");
    expect(out["@id"]).toBe(baseInput.url);
    expect(out.headline).toBe(baseInput.headline);
    expect(out.datePublished).toBe("2026-05-18");
    expect(out.author).toEqual({
      "@type": "Person",
      name: "Jan Kowalski",
      jobTitle: "Ślusarz z 20-letnim stażem",
    });
    expect(out.publisher.name).toBe("Ślusarz Kowalski");
    expect(out.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": baseInput.url });
  });

  it("supports BlogPosting + NewsArticle subtypes", () => {
    expect(articleSchema({ ...baseInput, type: "BlogPosting" })["@type"]).toBe("BlogPosting");
    expect(articleSchema({ ...baseInput, type: "NewsArticle" })["@type"]).toBe("NewsArticle");
  });

  it("supports Organization author", () => {
    const out = articleSchema({
      ...baseInput,
      author: { type: "Organization", name: "MixtureMarketing", url: "https://mm.pl" },
    });
    expect(out.author).toEqual({
      "@type": "Organization",
      name: "MixtureMarketing",
      url: "https://mm.pl",
    });
  });

  it("emits single image object when one image", () => {
    const out = articleSchema({
      ...baseInput,
      image: { url: "https://example.pl/img.jpg", width: 1200, height: 630, caption: "test" },
    });
    expect(out.image).toEqual({
      "@type": "ImageObject",
      url: "https://example.pl/img.jpg",
      width: 1200,
      height: 630,
      caption: "test",
    });
  });

  it("emits image array when multiple images", () => {
    const out = articleSchema({
      ...baseInput,
      image: { url: "https://example.pl/main.jpg" },
      additionalImages: [{ url: "https://example.pl/alt1.jpg" }, { url: "https://example.pl/alt2.jpg" }],
    });
    expect(Array.isArray(out.image)).toBe(true);
    expect(out.image).toEqual([
      "https://example.pl/main.jpg",
      "https://example.pl/alt1.jpg",
      "https://example.pl/alt2.jpg",
    ]);
  });

  it("joins keywords with comma per schema.org convention", () => {
    const out = articleSchema({ ...baseInput, keywords: ["zamki", "bezpieczeństwo", "klasa C"] });
    expect(out.keywords).toBe("zamki, bezpieczeństwo, klasa C");
  });

  it("throws on missing required fields", () => {
    expect(() => articleSchema({ ...baseInput, headline: "" })).toThrow(/headline/);
    expect(() => articleSchema({ ...baseInput, description: "" })).toThrow(/description/);
  });

  it("preserves dateModified + word count + language", () => {
    const out = articleSchema({
      ...baseInput,
      dateModified: "2026-05-19T10:00:00Z",
      wordCount: 800,
      inLanguage: "pl-PL",
    });
    expect(out.dateModified).toBe("2026-05-19T10:00:00Z");
    expect(out.wordCount).toBe(800);
    expect(out.inLanguage).toBe("pl-PL");
  });
});
