import { describe, expect, it } from "vitest";

import { buildLlmsTxt, buildLocalBusinessLlmsTxt } from "./llms-txt.js";

describe("buildLlmsTxt", () => {
  it("emits H1 + summary blockquote + sections", () => {
    const out = buildLlmsTxt({
      name: "Kowalski Ślusarz",
      summary: "Ślusarz w Rzeszowie z 20-letnim doświadczeniem.",
      sections: [
        {
          title: "Strony główne",
          links: [
            { url: "https://kowalski.pl/", label: "Strona główna" },
            { url: "https://kowalski.pl/kontakt", label: "Kontakt", description: "Dane kontaktowe" },
          ],
        },
      ],
    });
    expect(out).toContain("# Kowalski Ślusarz");
    expect(out).toContain("> Ślusarz w Rzeszowie z 20-letnim doświadczeniem.");
    expect(out).toContain("## Strony główne");
    expect(out).toContain("- [Strona główna](https://kowalski.pl/)");
    expect(out).toContain("- [Kontakt](https://kowalski.pl/kontakt): Dane kontaktowe");
  });

  it("throws on missing required fields", () => {
    expect(() =>
      buildLlmsTxt({ name: "", summary: "x", sections: [] }),
    ).toThrow(/name/);
    expect(() =>
      buildLlmsTxt({ name: "x", summary: " ", sections: [] }),
    ).toThrow(/summary/);
  });

  it("skips sections without links", () => {
    const out = buildLlmsTxt({
      name: "Test",
      summary: "x",
      sections: [
        { title: "Empty section", links: [] },
        { title: "Good section", links: [{ url: "https://x.pl/", label: "Home" }] },
      ],
    });
    expect(out).not.toContain("Empty section");
    expect(out).toContain("Good section");
  });

  it("appends Notes section if provided", () => {
    const out = buildLlmsTxt({
      name: "Test",
      summary: "x",
      sections: [{ title: "Main", links: [{ url: "https://x.pl/", label: "Home" }] }],
      notes: "Polish-language site.",
    });
    expect(out).toContain("## Notes");
    expect(out).toContain("Polish-language site.");
  });
});

describe("buildLocalBusinessLlmsTxt", () => {
  it("builds typical layout from convenience helper", () => {
    const out = buildLocalBusinessLlmsTxt({
      name: "Kowalski Ślusarz",
      summary: "Ślusarz w Rzeszowie.",
      homepageUrl: "https://kowalski.pl/",
      servicesUrl: "https://kowalski.pl/uslugi",
      aboutUrl: "https://kowalski.pl/o-firmie",
      contactUrl: "https://kowalski.pl/kontakt",
    });
    expect(out).toContain("## Strony główne");
    expect(out).toContain("Strona główna");
    expect(out).toContain("Usługi");
    expect(out).toContain("O firmie");
    expect(out).toContain("Kontakt");
  });

  it("skips optional sections when not provided", () => {
    const out = buildLocalBusinessLlmsTxt({
      name: "Test",
      summary: "x",
      homepageUrl: "https://t.pl/",
    });
    expect(out).toContain("Strona główna");
    expect(out).not.toContain("Usługi");
    expect(out).not.toContain("Kontakt");
  });

  it("adds blog under 'Dodatkowe' section when provided", () => {
    const out = buildLocalBusinessLlmsTxt({
      name: "Test",
      summary: "x",
      homepageUrl: "https://t.pl/",
      blogUrl: "https://t.pl/blog",
    });
    expect(out).toContain("## Dodatkowe");
    expect(out).toContain("Blog");
  });
});
