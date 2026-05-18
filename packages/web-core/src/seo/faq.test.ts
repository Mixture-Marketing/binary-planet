import { describe, expect, it } from "vitest";

import { faqPageSchema } from "./faq.js";

describe("faqPageSchema", () => {
  it("emits FAQPage with Question/Answer entities", () => {
    const out = faqPageSchema({
      items: [
        { question: "Ile to kosztuje?", answer: "Od 100 zł, zależnie od zakresu." },
        { question: "Pracujecie w nocy?", answer: "Tak, 24/7 z dojazdem 30 minut." },
      ],
    });
    expect(out["@type"]).toBe("FAQPage");
    expect(out.mainEntity).toHaveLength(2);
    expect(out.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Ile to kosztuje?",
      acceptedAnswer: { "@type": "Answer", text: "Od 100 zł, zależnie od zakresu." },
    });
  });

  it("includes optional @id when url passed", () => {
    const out = faqPageSchema({
      url: "https://example.pl/kontakt",
      items: [{ question: "Q", answer: "A" }],
    });
    expect(out["@id"]).toBe("https://example.pl/kontakt");
  });

  it("throws on empty items", () => {
    expect(() => faqPageSchema({ items: [] })).toThrow(/at least one/);
  });

  it("throws on empty question or answer", () => {
    expect(() => faqPageSchema({ items: [{ question: "  ", answer: "ok" }] })).toThrow(/question/);
    expect(() => faqPageSchema({ items: [{ question: "ok", answer: "  " }] })).toThrow(/answer/);
  });
});
