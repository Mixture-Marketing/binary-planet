import { describe, expect, it } from "vitest";

import { buildHreflangTags, isValidHreflangCode, verifyHreflangConsistency } from "./hreflang.js";

describe("isValidHreflangCode", () => {
  it("accepts BCP 47 codes", () => {
    expect(isValidHreflangCode("pl")).toBe(true);
    expect(isValidHreflangCode("pl-PL")).toBe(true);
    expect(isValidHreflangCode("en-US")).toBe(true);
    expect(isValidHreflangCode("zh-Hant-HK")).toBe(true);
    expect(isValidHreflangCode("x-default")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(isValidHreflangCode("PL")).toBe(false); // uppercase lang
    expect(isValidHreflangCode("pl-us")).toBe(false); // lowercase region
    expect(isValidHreflangCode("pl_PL")).toBe(false); // underscore
  });
});

describe("buildHreflangTags", () => {
  it("emits link rel=alternate tags", () => {
    const { tags, warnings } = buildHreflangTags([
      { hreflang: "pl-PL", href: "https://example.pl/" },
      { hreflang: "en-US", href: "https://example.com/" },
      { hreflang: "x-default", href: "https://example.com/" },
    ]);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toEqual({
      kind: "link",
      rel: "alternate",
      href: "https://example.pl/",
      hreflang: "pl-PL",
    });
    expect(warnings).toHaveLength(0);
  });

  it("warns on missing x-default", () => {
    const { warnings } = buildHreflangTags([
      { hreflang: "pl-PL", href: "https://example.pl/" },
      { hreflang: "en-US", href: "https://example.com/" },
    ]);
    expect(warnings.some((w) => w.includes("x-default"))).toBe(true);
  });

  it("warns on relative URL", () => {
    const { warnings } = buildHreflangTags([
      { hreflang: "pl-PL", href: "/oferta" },
      { hreflang: "en-US", href: "https://example.com/" },
      { hreflang: "x-default", href: "https://example.com/" },
    ]);
    expect(warnings.some((w) => w.includes("absolute"))).toBe(true);
  });

  it("warns on duplicate hreflang values", () => {
    const { warnings } = buildHreflangTags([
      { hreflang: "pl-PL", href: "https://a.pl/" },
      { hreflang: "pl-PL", href: "https://b.pl/" },
      { hreflang: "x-default", href: "https://a.pl/" },
    ]);
    expect(warnings.some((w) => w.includes("Duplicate"))).toBe(true);
  });
});

describe("verifyHreflangConsistency", () => {
  it("returns empty for consistent setup", () => {
    const pages = [
      {
        url: "https://example.pl/",
        alternates: [
          { hreflang: "pl-PL", href: "https://example.pl/" },
          { hreflang: "en-US", href: "https://example.com/" },
        ],
      },
      {
        url: "https://example.com/",
        alternates: [
          { hreflang: "pl-PL", href: "https://example.pl/" },
          { hreflang: "en-US", href: "https://example.com/" },
        ],
      },
    ];
    expect(verifyHreflangConsistency(pages)).toEqual([]);
  });

  it("detects missing self-reference", () => {
    const pages = [
      {
        url: "https://example.pl/",
        alternates: [{ hreflang: "en-US", href: "https://example.com/" }],
      },
      {
        url: "https://example.com/",
        alternates: [
          { hreflang: "pl-PL", href: "https://example.pl/" },
          { hreflang: "en-US", href: "https://example.com/" },
        ],
      },
    ];
    const errors = verifyHreflangConsistency(pages);
    expect(errors.some((e) => e.includes("self-reference"))).toBe(true);
  });

  it("detects asymmetric linking", () => {
    const pages = [
      {
        url: "https://example.pl/",
        alternates: [
          { hreflang: "pl-PL", href: "https://example.pl/" },
          { hreflang: "en-US", href: "https://example.com/" },
        ],
      },
      {
        url: "https://example.com/",
        alternates: [
          // does not link back to .pl
          { hreflang: "en-US", href: "https://example.com/" },
        ],
      },
    ];
    const errors = verifyHreflangConsistency(pages);
    expect(errors.some((e) => e.includes("Asymmetric"))).toBe(true);
  });
});
