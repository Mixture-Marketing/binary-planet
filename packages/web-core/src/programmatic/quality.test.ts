import { describe, expect, it } from "vitest";

import { countWords, lintPage, totalWordCount } from "./quality.js";
import { DEFAULT_THRESHOLDS, type ProgrammaticSlots } from "./types.js";

function makeSlots(overrides: Partial<ProgrammaticSlots> = {}): ProgrammaticSlots {
  return {
    title: "Awaryjne otwieranie zamków Rzeszów — Ślusarz 24/7",
    description:
      "Awaryjne otwieranie zamków w Rzeszowie. Dojazd 30 minut. Bez uszkodzenia drzwi. Ślusarz dyżurny 24/7 dla mieszkań, samochodów i firm.",
    h1: "Awaryjne otwieranie zamków w Rzeszowie",
    hero: "Przyjadę w 30 minut, otworzę zamek bez uszkodzenia drzwi.",
    body: `Działam jako ślusarz w Rzeszowie od 20 lat. Specjalizuję się w awaryjnym otwieraniu zamków w drzwiach, samochodach i meblach. Dojazd do klienta zwykle w ciągu 30 minut, pracuję 24/7. ${"Specjalizacja w awaryjnym otwieraniu zamków drzwiowych oraz dorabianiu kluczy stanowi główny obszar mojej działalności zawodowej w regionie. ".repeat(10)} ${"Profesjonalna obsługa klienta to nasz znak rozpoznawczy. Pracujemy z zachowaniem najwyższych standardów branżowych i pełnej dyskrecji. ".repeat(10)} Klienci doceniają moją uczciwość, profesjonalizm i szybkość reakcji w sytuacjach awaryjnych.`,
    faqs: [
      { question: "Ile czasu zajmuje otwarcie zamka?", answer: "Zwykle 5-15 minut od przyjazdu." },
      { question: "Czy uszkadza Pan drzwi?", answer: "Nie. Metody są zawsze nieinwazyjne." },
      { question: "Czy pracuje Pan w nocy?", answer: "Tak, 24/7 w Rzeszowie i okolicach." },
    ],
    testimonials: [
      { author: "Anna M.", rating: 5, text: "Otworzył zamek w 5 minut, nocą. Polecam.", date: "2026-03-12" },
      { author: "Marek T.", rating: 5, text: "Profesjonalna obsługa, uczciwa cena.", date: "2026-02-28" },
      { author: "Beata K.", rating: 5, text: "Bardzo dobry kontakt i szybki dojazd.", date: "2026-01-15" },
    ],
    landmarks: [
      { name: "Stadion Resovia", context: "5 minut od głównego stadionu w Rzeszowie" },
    ],
    ctaText: "Zadzwoń teraz",
    ...overrides,
  };
}

describe("countWords", () => {
  it("strips markdown code fences", () => {
    expect(countWords("hello ```code with words``` world")).toBe(2);
  });

  it("strips inline code", () => {
    expect(countWords("hello `code` world")).toBe(2);
  });

  it("keeps link text", () => {
    expect(countWords("[hello world](https://example.com)")).toBe(2);
  });

  it("ignores images", () => {
    expect(countWords("![alt](https://example.com/img.png) hello")).toBe(1);
  });
});

describe("totalWordCount", () => {
  it("includes body + faqs + testimonials", () => {
    const wc = totalWordCount(makeSlots());
    expect(wc).toBeGreaterThan(100);
  });
});

describe("lintPage", () => {
  it("no errors for well-formed slots", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots(),
      // Relaxed minWordsPerPage — fixture is structurally complete but ~350 words.
      // Tests exercise structural checks, not content depth (covered by engine.test).
      thresholds: { ...DEFAULT_THRESHOLDS, minWordsPerPage: 100 },
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("detects low word count", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ body: "Very short body.", faqs: [], testimonials: [] }),
      thresholds: { ...DEFAULT_THRESHOLDS, requireFaqs: 0, requireTestimonials: 0 },
    });
    expect(issues.find((i) => i.code === "word_count_below_min")).toBeDefined();
  });

  it("detects insufficient FAQs", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ faqs: [{ question: "a", answer: "b" }] }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(issues.find((i) => i.code === "faqs_below_min")).toBeDefined();
  });

  it("detects insufficient testimonials", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ testimonials: [] }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(issues.find((i) => i.code === "testimonials_below_min")).toBeDefined();
  });

  it("detects missing landmarks", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ landmarks: [] }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(issues.find((i) => i.code === "landmarks_below_min")).toBeDefined();
  });

  it("detects missing H1 as error", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ h1: "" }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    const h1Issue = issues.find((i) => i.code === "missing_h1");
    expect(h1Issue?.severity).toBe("error");
  });

  it("warns on title too long", () => {
    const longTitle = "x".repeat(120);
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ title: longTitle }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    const titleIssue = issues.find((i) => i.code === "title_too_long");
    expect(titleIssue?.severity).toBe("warning");
  });

  it("warns on description out of range", () => {
    const { issues } = lintPage({
      slug: "/x",
      slots: makeSlots({ description: "too short" }),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(issues.find((i) => i.code === "description_out_of_range")).toBeDefined();
  });
});
