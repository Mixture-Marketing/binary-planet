import { describe, expect, it } from "vitest";

import {
  jaccardSimilarity,
  pairwiseSimilarity,
  shingles,
  textSimilarity,
  tokenize,
} from "./similarity.js";

describe("tokenize", () => {
  it("lowercases + strips diacritics + drops short tokens", () => {
    expect(tokenize("Ślusarz w Rzeszowie")).toEqual(["slusarz", "rzeszowie"]);
  });

  it("drops numeric-only tokens", () => {
    expect(tokenize("call 123 phone")).toEqual(["call", "phone"]);
  });

  it("splits on punctuation", () => {
    expect(tokenize("hello, world!")).toEqual(["hello", "world"]);
  });
});

describe("shingles", () => {
  it("produces k-grams", () => {
    const s = shingles(["a", "b", "c", "d"], 3);
    expect(s).toContain("a b c");
    expect(s).toContain("b c d");
    expect(s.size).toBe(2);
  });

  it("falls back to unigrams when text shorter than k", () => {
    const s = shingles(["a", "b"], 3);
    expect(s.has("a")).toBe(true);
    expect(s.has("b")).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical sets", () => {
    expect(jaccardSimilarity(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccardSimilarity(new Set([1, 2]), new Set([3, 4]))).toBe(0);
  });

  it("returns 0.5 for half-overlap", () => {
    expect(jaccardSimilarity(new Set([1, 2]), new Set([2, 3]))).toBeCloseTo(1 / 3, 5);
  });

  it("returns 1 when both empty", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  it("returns 0 when one empty", () => {
    expect(jaccardSimilarity(new Set(), new Set([1]))).toBe(0);
  });
});

describe("textSimilarity", () => {
  it("near-identical text → high similarity", () => {
    const a =
      "Awaryjne otwieranie zamków w Rzeszowie. Pracujemy 24/7 z dojazdem 30 minut. Bez uszkodzenia drzwi.";
    const b =
      "Awaryjne otwieranie zamków w Rzeszowie. Pracujemy 24/7 z dojazdem 30 minut. Bez uszkodzenia drzwi.";
    expect(textSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  it("city swap → high similarity (HCU trigger)", () => {
    // Realistic-length spam pattern: only city name swapped between paragraphs
    const base =
      "Awaryjne otwieranie zamków pracujemy 24/7 z dojazdem 30 minut bez uszkodzenia drzwi wieloletnie doświadczenie tysiące zadowolonych klientów uczciwe ceny pełna gwarancja na wszystkie usługi nasza specjalizacja to drzwi mieszkaniowe samochody i sejfy serwisujemy zamki bębenkowe wpustowe elektromechaniczne klasy B oraz C plus dla firm karty serwisowe preferencyjne stawki kontakt 24/7 wystarczy telefon. ";
    const a = `${base} Otwieramy zamki w Rzeszowie. Adres Rzeszów ulica Główna.`;
    const b = `${base} Otwieramy zamki w Łańcucie. Adres Łańcut ulica Główna.`;
    const sim = textSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.7);
  });

  it("unrelated text → low similarity", () => {
    const a = "Awaryjne otwieranie zamków w Rzeszowie. Dojazd 30 minut.";
    const b = "Biuro rachunkowe w Krakowie. Pomagamy z PIT-em.";
    expect(textSimilarity(a, b)).toBeLessThan(0.2);
  });
});

describe("pairwiseSimilarity", () => {
  it("returns all unique pairs sorted desc", () => {
    const pages = [
      { slug: "a", text: "alfa beta gamma delta" },
      { slug: "b", text: "alfa beta gamma delta epsilon" }, // very similar to a
      { slug: "c", text: "ze zupelnie innym tekstem o czym innym" }, // unrelated
    ];
    const pairs = pairwiseSimilarity(pages);
    expect(pairs).toHaveLength(3); // 3 choose 2 = 3 pairs
    // First pair should be the similar one
    const first = pairs[0]!;
    expect((first.slugA === "a" && first.slugB === "b") || (first.slugA === "b" && first.slugB === "a")).toBe(true);
    // Last pair should be lowest ratio
    expect(pairs[2]?.ratio).toBeLessThan(pairs[0]?.ratio ?? 1);
  });
});
