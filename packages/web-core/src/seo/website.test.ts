import { describe, expect, it } from "vitest";

import { webSiteSchema } from "./website.js";

describe("webSiteSchema", () => {
  it("emits minimal WebSite JSON-LD", () => {
    const out = webSiteSchema({ url: "https://example.pl", name: "Example" });
    expect(out["@type"]).toBe("WebSite");
    expect(out["@id"]).toBe("https://example.pl");
    expect(out.url).toBe("https://example.pl");
    expect(out.name).toBe("Example");
    expect(out.potentialAction).toBeUndefined();
  });

  it("includes SearchAction when configured", () => {
    const out = webSiteSchema({
      url: "https://example.pl",
      name: "Example",
      searchAction: {
        target: "https://example.pl/szukaj?q={search_term_string}",
      },
    });
    expect(out.potentialAction).toEqual({
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://example.pl/szukaj?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    });
  });

  it("throws if SearchAction target missing placeholder", () => {
    expect(() =>
      webSiteSchema({
        url: "https://x.pl",
        name: "X",
        searchAction: { target: "https://x.pl/szukaj?q=NO_PLACEHOLDER" },
      }),
    ).toThrow(/placeholder/);
  });

  it("supports custom queryInput name", () => {
    const out = webSiteSchema({
      url: "https://x.pl",
      name: "X",
      searchAction: { target: "https://x.pl/?keyword={q}", queryInput: "q" },
    });
    expect(out.potentialAction?.["query-input"]).toBe("required name=q");
  });

  it("includes publisher when provided", () => {
    const out = webSiteSchema({
      url: "https://x.pl",
      name: "X",
      publisher: { name: "MM", url: "https://mm.pl" },
    });
    expect(out.publisher).toEqual({ "@type": "Organization", name: "MM", url: "https://mm.pl" });
  });

  it("throws on missing required fields", () => {
    expect(() => webSiteSchema({ url: "https://x.pl", name: "" })).toThrow(/name/);
    expect(() => webSiteSchema({ url: "", name: "X" })).toThrow(/url/);
  });
});
