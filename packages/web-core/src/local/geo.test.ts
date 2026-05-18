import { describe, expect, it } from "vitest";

import { distanceKm, POLISH_CITY_COORDS, validateGeo } from "./geo.js";

describe("validateGeo", () => {
  it("accepts coords in Poland bbox", () => {
    expect(validateGeo({ latitude: 50.0413, longitude: 21.999 })).toEqual({ valid: true });
    expect(validateGeo({ latitude: 52.2297, longitude: 21.0122 })).toEqual({ valid: true });
  });

  it("rejects coords out of range", () => {
    const r = validateGeo({ latitude: 91, longitude: 21 });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/latitude/i);
  });

  it("warns on coords outside Poland bbox but technically valid", () => {
    const r = validateGeo({ latitude: 48.8566, longitude: 2.3522 }); // Paris
    expect(r.valid).toBe(true);
    expect(r.warning).toContain("outside Poland");
  });
});

describe("distanceKm", () => {
  it("Warszawa-Kraków ~252km (±5km)", () => {
    const wawa = POLISH_CITY_COORDS["Warszawa"]!;
    const kr = POLISH_CITY_COORDS["Kraków"]!;
    const d = distanceKm(wawa, kr);
    expect(d).toBeGreaterThan(247);
    expect(d).toBeLessThan(257);
  });

  it("Rzeszów-Warszawa ~250km (±10km)", () => {
    const rz = POLISH_CITY_COORDS["Rzeszów"]!;
    const wawa = POLISH_CITY_COORDS["Warszawa"]!;
    const d = distanceKm(rz, wawa);
    expect(d).toBeGreaterThan(240);
    expect(d).toBeLessThan(260);
  });

  it("distance to self is 0", () => {
    const wawa = POLISH_CITY_COORDS["Warszawa"]!;
    expect(distanceKm(wawa, wawa)).toBeLessThan(0.001);
  });
});
