import { describe, expect, it } from "vitest";

import {
  isValidPolishPostalCode,
  normalizePolishPostalCode,
  normalizeVoivodeship,
} from "./address.js";

describe("Polish postal code", () => {
  it("accepts canonical NN-NNN form", () => {
    expect(isValidPolishPostalCode("35-060")).toBe(true);
    expect(isValidPolishPostalCode("00-001")).toBe(true);
  });

  it("rejects wrong formats", () => {
    expect(isValidPolishPostalCode("35060")).toBe(false);
    expect(isValidPolishPostalCode("3-5060")).toBe(false);
    expect(isValidPolishPostalCode("35--060")).toBe(false);
    expect(isValidPolishPostalCode("ABCDE")).toBe(false);
  });

  it("normalizes 5-digit form to canonical", () => {
    expect(normalizePolishPostalCode("35060")).toBe("35-060");
    expect(normalizePolishPostalCode("35-060")).toBe("35-060");
    expect(normalizePolishPostalCode(" 35-060 ")).toBe("35-060");
  });

  it("returns null for unrecognized formats", () => {
    expect(normalizePolishPostalCode("ABCDE")).toBeNull();
    expect(normalizePolishPostalCode("3-5060")).toBeNull();
  });
});

describe("voivodeship normalization", () => {
  it("returns canonical form for canonical input", () => {
    expect(normalizeVoivodeship("mazowieckie")).toBe("mazowieckie");
    expect(normalizeVoivodeship("podkarpackie")).toBe("podkarpackie");
  });

  it("handles uppercase + with 'województwo' prefix", () => {
    expect(normalizeVoivodeship("MAZOWIECKIE")).toBe("mazowieckie");
    expect(normalizeVoivodeship("Województwo Mazowieckie")).toBe("mazowieckie");
  });

  it("maps EN names", () => {
    expect(normalizeVoivodeship("Lesser Poland")).toBe("małopolskie");
    expect(normalizeVoivodeship("Lower Silesia")).toBe("dolnośląskie");
    expect(normalizeVoivodeship("Greater Poland")).toBe("wielkopolskie");
    expect(normalizeVoivodeship("Subcarpathian")).toBe("podkarpackie");
  });

  it("maps REGON abbreviations", () => {
    expect(normalizeVoivodeship("MAZ")).toBe("mazowieckie");
    expect(normalizeVoivodeship("pdk")).toBe("podkarpackie");
    expect(normalizeVoivodeship("WLKP")).toBe("wielkopolskie");
  });

  it("returns null for unrecognized", () => {
    expect(normalizeVoivodeship("Bavaria")).toBeNull();
    expect(normalizeVoivodeship("xyz123")).toBeNull();
  });
});
