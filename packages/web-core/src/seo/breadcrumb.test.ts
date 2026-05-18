import { describe, expect, it } from "vitest";

import { breadcrumbSchema } from "./breadcrumb.js";

describe("breadcrumbSchema", () => {
  it("emits BreadcrumbList with positions", () => {
    const out = breadcrumbSchema([
      { name: "Home", url: "https://example.pl/" },
      { name: "Oferta", url: "https://example.pl/oferta" },
      { name: "Otwieranie zamków" },
    ]);
    expect(out["@type"]).toBe("BreadcrumbList");
    expect(out.itemListElement).toHaveLength(3);
    expect(out.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://example.pl/",
    });
    expect(out.itemListElement[2]?.item).toBeUndefined();
  });

  it("throws on empty list", () => {
    expect(() => breadcrumbSchema([])).toThrow(/at least one/);
  });

  it("throws on single-item list (pointless)", () => {
    expect(() => breadcrumbSchema([{ name: "Home" }])).toThrow(/useless/);
  });

  it("position is 1-indexed", () => {
    const out = breadcrumbSchema([
      { name: "A", url: "https://x/a" },
      { name: "B", url: "https://x/b" },
      { name: "C" },
    ]);
    expect(out.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });
});
