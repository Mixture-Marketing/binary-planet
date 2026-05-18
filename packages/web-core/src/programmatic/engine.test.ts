import { describe, expect, it } from "vitest";

import { generateProgrammaticPages } from "./engine.js";
import { assertProgrammaticQuality, formatReport, ProgrammaticQualityError } from "./linter.js";
import type { GenerateInput, ProgrammaticSlots } from "./types.js";

function richSlots(combo: { service: { name: string }; location: { name: string } }): ProgrammaticSlots {
  return {
    title: `${combo.service.name} ${combo.location.name} — Profesjonalnie 24/7`,
    description: `Najlepsze ${combo.service.name.toLowerCase()} w ${combo.location.name}. Dojazd 30 minut. Bez uszkodzeń. Wieloletnie doświadczenie i tysiące zadowolonych klientów.`,
    h1: `${combo.service.name} ${combo.location.name}`,
    hero: `Profesjonalna obsługa ${combo.service.name.toLowerCase()} w ${combo.location.name} z dojazdem w 30 minut.`,
    body: bodyForCombo(combo),
    faqs: [
      { question: `Ile kosztuje ${combo.service.name.toLowerCase()} w ${combo.location.name}?`, answer: `Zaczyna się od 100 zł, ostateczna wycena zależy od zakresu.` },
      { question: `Czy dojeżdża Pan do ${combo.location.name}?`, answer: `Tak, dojeżdżam wszędzie w ${combo.location.name} i okolicach.` },
      { question: `Czy pracuje Pan w nocy?`, answer: `Tak, 24/7 dla awaryjnych wezwań w ${combo.location.name}.` },
    ],
    testimonials: [
      { author: `Anna M. z ${combo.location.name}`, rating: 5, text: "Bardzo szybko, profesjonalnie, polecam.", date: "2026-03-12" },
      { author: `Marek T. z ${combo.location.name}`, rating: 5, text: "Cena uczciwa, kontakt świetny.", date: "2026-02-28" },
      { author: `Beata K. z ${combo.location.name}`, rating: 5, text: "Bardzo dobre wrażenie, na pewno polecę.", date: "2026-01-15" },
    ],
    landmarks: [
      { name: `Centrum ${combo.location.name}`, context: `5 minut od głównego placu w ${combo.location.name}` },
    ],
    ctaText: "Zadzwoń teraz",
  };
}

function bodyForCombo(combo: { service: { name: string }; location: { name: string } }): string {
  // Long enough to easily exceed 500 word minimum.
  // Use lots of location-specific text so cross-location similarity stays low.
  const loc = combo.location.name;
  const svc = combo.service.name;
  return `${svc} w mieście ${loc} — pełna oferta usług dla mieszkańców i firm.
Pracujemy w okolicach ${loc} od kilkunastu lat. Znamy każdą ulicę i dzielnicę zabudowy w ${loc}.
${`Lokalna społeczność ${loc} zaufała naszemu doświadczeniu w realizacji najtrudniejszych zleceń w mieście ${loc}. `.repeat(16)}
${`Specyfika miasta ${loc} wymaga znajomości warunków lokalnych ${loc} które zdobyliśmy w terenie. `.repeat(16)}
${`Pracujemy z firmami i osobami prywatnymi w ${loc} oraz miejscowościach koło ${loc}. `.repeat(16)}
${svc} wykonujemy zgodnie z najwyższymi standardami branżowymi obowiązującymi w Polsce.
Wieloletnie doświadczenie w obsłudze klientów z ${loc} pozwala nam dostosować rozwiązania do indywidualnych potrzeb.`;
}

const baseInput: GenerateInput = {
  services: [
    { slug: "otwieranie-zamkow", name: "Otwieranie zamków", priority: 9 },
    { slug: "dorabianie-kluczy", name: "Dorabianie kluczy", priority: 7 },
  ],
  locations: ["Rzeszów", "Łańcut", "Tyczyn"],
  slotProvider: (combo) => richSlots(combo),
};

describe("generateProgrammaticPages", () => {
  it("generates 6 pages (2 services × 3 locations) when uncapped", async () => {
    const result = await generateProgrammaticPages({
      ...baseInput,
      thresholds: { maxPages: 10 },
    });
    expect(result.pages.length + result.failed.length).toBe(6);
    expect(result.cappedOut).toEqual([]);
  });

  it("caps to maxPages, prioritizing by combined service+location priority", async () => {
    const result = await generateProgrammaticPages({
      ...baseInput,
      thresholds: { maxPages: 3 },
    });
    expect(result.pages.length + result.failed.length).toBe(3);
    expect(result.cappedOut).toHaveLength(3);
    // All selected should be the higher-priority service
    const selectedSlugs = [...result.pages, ...result.failed].map((p) => p.combo.service.slug);
    expect(selectedSlugs.every((s) => s === "otwieranie-zamkow")).toBe(true);
  });

  it("returns slug + slots + wordCount + issues", async () => {
    const result = await generateProgrammaticPages({
      ...baseInput,
      thresholds: { maxPages: 1 },
    });
    const page = [...result.pages, ...result.failed][0]!;
    expect(page.slug).toMatch(/^\/uslugi\/otwieranie-zamkow\//);
    expect(page.wordCount).toBeGreaterThan(100);
    expect(Array.isArray(page.issues)).toBe(true);
  });

  it("flags similarity_too_high when bodies near-identical", async () => {
    const result = await generateProgrammaticPages({
      services: [{ slug: "a", name: "A" }],
      locations: ["X", "Y"],
      slotProvider: (combo) => ({
        ...richSlots(combo),
        // Force identical bodies → high similarity
        body: "Identyczny tekst zawsze. ".repeat(100),
      }),
      thresholds: { maxPages: 10 },
    });
    const allIssues = result.allIssues;
    expect(allIssues.some((i) => i.code === "similarity_too_high")).toBe(true);
  });

  it("separates passed vs failed by error-severity issues", async () => {
    const result = await generateProgrammaticPages({
      services: [{ slug: "a", name: "A" }],
      locations: ["X"],
      slotProvider: () => ({
        title: "X",
        description: "X",
        h1: "X",
        hero: "X",
        body: "too short",
        faqs: [],
        testimonials: [],
        landmarks: [],
        ctaText: "Z",
      }),
    });
    expect(result.failed.length).toBe(1);
    expect(result.pages.length).toBe(0);
  });

  it("calls slot provider in parallel (async ok)", async () => {
    const callTimes: number[] = [];
    await generateProgrammaticPages({
      services: [{ slug: "a", name: "A" }, { slug: "b", name: "B" }],
      locations: ["X"],
      slotProvider: async (combo) => {
        callTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 50));
        return richSlots(combo);
      },
      thresholds: { maxPages: 10 },
    });
    // Both calls should start within a few ms of each other (parallel)
    expect(callTimes).toHaveLength(2);
    expect(Math.abs((callTimes[1] ?? 0) - (callTimes[0] ?? 0))).toBeLessThan(20);
  });

  it("returns capped-out combos when over maxPages", async () => {
    const result = await generateProgrammaticPages({
      services: [{ slug: "a", name: "A" }, { slug: "b", name: "B" }],
      locations: ["X", "Y", "Z"],
      slotProvider: richSlots,
      thresholds: { maxPages: 4 },
    });
    expect(result.cappedOut).toHaveLength(2);
  });
});

describe("assertProgrammaticQuality + formatReport", () => {
  it("throws ProgrammaticQualityError when failed pages present", async () => {
    const result = await generateProgrammaticPages({
      services: [{ slug: "a", name: "A" }],
      locations: ["X"],
      slotProvider: () => ({
        title: "X",
        description: "X",
        h1: "X",
        hero: "X",
        body: "too short",
        faqs: [],
        testimonials: [],
        landmarks: [],
        ctaText: "Z",
      }),
    });
    expect(() => assertProgrammaticQuality(result)).toThrow(ProgrammaticQualityError);
  });

  it("doesn't throw when only warnings", async () => {
    const result = await generateProgrammaticPages({
      ...baseInput,
      thresholds: { maxPages: 1 },
    });
    // Warnings may exist but no errors
    expect(() => assertProgrammaticQuality(result)).not.toThrow();
  });

  it("formatReport produces summary string", async () => {
    const result = await generateProgrammaticPages({
      ...baseInput,
      thresholds: { maxPages: 2 },
    });
    const report = formatReport(result);
    expect(report).toContain("Programmatic Pages Report");
    expect(report).toContain("Total combos generated");
  });
});
