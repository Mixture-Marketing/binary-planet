import { describe, expect, it } from "vitest";

import { buildOfflineConversionsCsv } from "./google-ads-oct.js";

describe("buildOfflineConversionsCsv", () => {
  it("emits Google-format CSV with headers", () => {
    const csv = buildOfflineConversionsCsv([
      {
        gclid: "Cj0KCQjw_test",
        conversionName: "Lead - Phone Quote",
        conversionTime: new Date("2026-05-19T14:00:00Z"),
        conversionValue: 250,
      },
    ]);
    expect(csv).toContain("Parameters:TimeZone=Europe/Warsaw");
    expect(csv).toContain("Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency");
    expect(csv).toContain("Cj0KCQjw_test");
    expect(csv).toContain("Lead - Phone Quote");
    expect(csv).toContain("250");
    expect(csv).toContain("PLN");
  });

  it("escapes commas + quotes in CSV fields", () => {
    const csv = buildOfflineConversionsCsv([
      {
        gclid: "abc",
        conversionName: 'Lead, "Premium"',
        conversionTime: new Date(),
        conversionValue: 100,
      },
    ]);
    expect(csv).toContain('"Lead, ""Premium"""');
  });

  it("uses default PLN currency when omitted", () => {
    const csv = buildOfflineConversionsCsv([
      {
        gclid: "x",
        conversionName: "y",
        conversionTime: new Date(),
        conversionValue: 50,
      },
    ]);
    expect(csv.split("\n").pop()).toContain("PLN");
  });

  it("custom currency override", () => {
    const csv = buildOfflineConversionsCsv([
      {
        gclid: "x",
        conversionName: "y",
        conversionTime: new Date(),
        conversionValue: 50,
        currency: "EUR",
      },
    ]);
    expect(csv).toContain("EUR");
  });

  it("formats conversion time", () => {
    const csv = buildOfflineConversionsCsv([
      {
        gclid: "x",
        conversionName: "y",
        conversionTime: new Date("2026-05-19T14:30:45Z"),
        conversionValue: 100,
      },
    ]);
    expect(csv).toMatch(/2026-05-19 14:30:45/);
  });

  it("handles multiple rows", () => {
    const csv = buildOfflineConversionsCsv([
      { gclid: "g1", conversionName: "Lead 1", conversionTime: new Date(), conversionValue: 100 },
      { gclid: "g2", conversionName: "Lead 2", conversionTime: new Date(), conversionValue: 200 },
    ]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(4); // Parameters + header + 2 data rows
  });
});
