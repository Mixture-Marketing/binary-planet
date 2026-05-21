import { describe, expect, it } from "vitest";

import { buildSystemPrompt, detectLeadIntent } from "./index.js";

describe("chatbot — buildSystemPrompt", () => {
  it("includes business name + industry + rules", () => {
    const prompt = buildSystemPrompt({
      businessName: "Ślusarz Kowalski",
      industry: "locksmith",
      description: "Awaryjne 24/7",
    });
    expect(prompt).toContain("Ślusarz Kowalski");
    expect(prompt).toContain("locksmith");
    expect(prompt).toContain("Awaryjne 24/7");
    expect(prompt).toContain("Odpowiadaj WYŁĄCZNIE po polsku");
  });

  it("includes services with prices", () => {
    const prompt = buildSystemPrompt({
      businessName: "Test",
      industry: "locksmith",
      services: [
        { name: "Otwieranie zamków", description: "24/7", priceFrom: "150 zł" },
        { name: "Wymiana wkładki", description: "Klasa C" },
      ],
    });
    expect(prompt).toContain("Otwieranie zamków");
    expect(prompt).toContain("150 zł");
    expect(prompt).toContain("Wymiana wkładki");
  });

  it("includes hours when provided", () => {
    const prompt = buildSystemPrompt({
      businessName: "Test",
      industry: "locksmith",
      hours: { monday: "9:00-18:00", tuesday: "9:00-18:00", note: "Niedziela na telefon" },
    });
    expect(prompt).toContain("Pon: 9:00-18:00");
    expect(prompt).toContain("Niedziela na telefon");
  });

  it("includes contact info", () => {
    const prompt = buildSystemPrompt({
      businessName: "Test",
      industry: "locksmith",
      phone: "+48600100200",
      email: "test@firma.pl",
      address: { city: "Warszawa", street: "Marszałkowska 1", postalCode: "00-001" },
    });
    expect(prompt).toContain("+48600100200");
    expect(prompt).toContain("test@firma.pl");
    expect(prompt).toContain("Marszałkowska 1, Warszawa, 00-001");
  });

  it("limits services to 12 max", () => {
    const services = Array.from({ length: 20 }, (_, i) => ({
      name: `Usługa ${i}`,
      description: `Opis ${i}`,
    }));
    const prompt = buildSystemPrompt({ businessName: "Test", industry: "x", services });
    expect(prompt).toContain("Usługa 0");
    expect(prompt).toContain("Usługa 11");
    expect(prompt).not.toContain("Usługa 12");
  });
});

describe("chatbot — detectLeadIntent", () => {
  it("detects pricing questions", () => {
    expect(detectLeadIntent("ile to kosztuje")).toBe(true);
    expect(detectLeadIntent("Jaka cena?")).toBe(true);
    expect(detectLeadIntent("Proszę o wycenę")).toBe(true);
  });

  it("detects contact intent", () => {
    expect(detectLeadIntent("Zadzwońcie do mnie")).toBe(true);
    expect(detectLeadIntent("oddzwońcie proszę")).toBe(true);
    expect(detectLeadIntent("kontakt telefon")).toBe(true);
  });

  it("detects appointment booking", () => {
    expect(detectLeadIntent("chcę umówić wizytę")).toBe(true);
    expect(detectLeadIntent("rezerwacja proszę")).toBe(true);
    expect(detectLeadIntent("zapisać się na termin")).toBe(true);
  });

  it("detects availability questions", () => {
    expect(detectLeadIntent("kiedy mogę przyjść")).toBe(true);
    expect(detectLeadIntent("dostępność jutro?")).toBe(true);
    expect(detectLeadIntent("jak najszybciej proszę")).toBe(true);
  });

  it("returns false for generic chitchat", () => {
    expect(detectLeadIntent("dzień dobry")).toBe(false);
    expect(detectLeadIntent("co u was słychać")).toBe(false);
    expect(detectLeadIntent("dziękuję za informacje")).toBe(false);
  });
});
