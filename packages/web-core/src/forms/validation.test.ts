import { describe, expect, it } from "vitest";

import { validateLeadInput } from "./validation.js";

const valid = {
  name: "Jan Kowalski",
  email: "Jan.Kowalski@Example.pl",
  phone: "+48 504 123 456",
  message: "Potrzebuję wyceny zamków w drzwiach",
  consent_processing: true,
  consent_text_version: "v1.0",
};

describe("validateLeadInput", () => {
  it("accepts valid input + normalizes email + phone", () => {
    const r = validateLeadInput(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.email).toBe("jan.kowalski@example.pl");
    expect(r.data.phone).toBe("+48504123456");
    expect(r.data.consent_processing).toBe(true);
    expect(r.data.consent_marketing).toBe(false);
  });

  it("rejects missing consent_processing", () => {
    const r = validateLeadInput({ ...valid, consent_processing: false });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.errors[0]?.path).toBe("consent_processing");
  });

  it("rejects invalid email", () => {
    const r = validateLeadInput({ ...valid, email: "not-email" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty name", () => {
    const r = validateLeadInput({ ...valid, name: "" });
    expect(r.ok).toBe(false);
  });

  it("coerces 'on' to true for consent (HTML form convention)", () => {
    const r = validateLeadInput({ ...valid, consent_processing: "on" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.consent_processing).toBe(true);
  });

  it("coerces 'tak' (Polish) and '1' to true", () => {
    expect(validateLeadInput({ ...valid, consent_processing: "tak" }).ok).toBe(true);
    expect(validateLeadInput({ ...valid, consent_processing: "1" }).ok).toBe(true);
  });

  it("phone optional — accepts empty string → undefined", () => {
    const r = validateLeadInput({ ...valid, phone: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.phone).toBeUndefined();
  });

  it("phone with bad format rejected", () => {
    const r = validateLeadInput({ ...valid, phone: "abc-def" });
    expect(r.ok).toBe(false);
  });

  it("rejects message over 2000 chars", () => {
    const r = validateLeadInput({ ...valid, message: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });

  it("strips unknown fields (strict)", () => {
    const r = validateLeadInput({ ...valid, malicious: "<script>" });
    expect(r.ok).toBe(false); // strict mode rejects unknowns
  });

  it("rejects honeypot when filled", () => {
    // Honeypot schema rejects non-empty strings
    const r = validateLeadInput({ ...valid, honeypot: "bot-filled-this" });
    expect(r.ok).toBe(false);
  });

  it("accepts empty honeypot", () => {
    const r = validateLeadInput({ ...valid, honeypot: "" });
    expect(r.ok).toBe(true);
  });

  it("coerces estimated_value_pln from string", () => {
    const r = validateLeadInput({ ...valid, estimated_value_pln: "500" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.estimated_value_pln).toBe(500);
  });
});
