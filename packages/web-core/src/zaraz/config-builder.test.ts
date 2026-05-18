import { describe, expect, it } from "vitest";

import { buildZarazTools } from "./config-builder.js";

describe("buildZarazTools", () => {
  it("empty flags → empty tools + warning", () => {
    const { tools, warnings } = buildZarazTools({});
    expect(tools).toEqual([]);
    expect(warnings.some((w) => w.includes("no integrations"))).toBe(true);
  });

  it("plausible enabled → 1 tool", () => {
    const { tools } = buildZarazTools({ plausible: true });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.type).toBe("plausible");
  });

  it("plausible with custom origin object", () => {
    const { tools } = buildZarazTools({
      plausible: { origin: "https://analytics.mixturemarketing.pl" },
    });
    expect(tools[0]?.settings["origin"]).toBe("https://analytics.mixturemarketing.pl");
  });

  it("multiple integrations → multiple tools", () => {
    const { tools } = buildZarazTools({
      plausible: true,
      ga4: "G-TEST",
      googleAds: { conversionId: "AW-12345" },
      metaPixel: "1234567890",
      tiktokPixel: "C123",
    });
    expect(tools).toHaveLength(5);
    const types = tools.map((t) => t.type);
    expect(types).toContain("plausible");
    expect(types).toContain("googleanalytics");
    expect(types).toContain("googleads");
    expect(types).toContain("facebookpixel");
    expect(types).toContain("tiktokpixel");
  });

  it("invalid ga4 measurementId → warning, no tool", () => {
    const { tools, warnings } = buildZarazTools({ ga4: "UA-123" });
    expect(tools).toHaveLength(0);
    expect(warnings.some((w) => w.startsWith("ga4"))).toBe(true);
  });

  it("invalid googleAds → warning", () => {
    const { tools, warnings } = buildZarazTools({
      googleAds: { conversionId: "INVALID" },
    });
    expect(tools).toHaveLength(0);
    expect(warnings.some((w) => w.startsWith("googleAds"))).toBe(true);
  });

  it("invalid metaPixel → warning, no crash", () => {
    const { tools, warnings } = buildZarazTools({ metaPixel: "abc" });
    expect(tools).toHaveLength(0);
    expect(warnings.some((w) => w.startsWith("metaPixel"))).toBe(true);
  });

  it("customHtml passes through with purposes", () => {
    const { tools } = buildZarazTools({
      customHtml: [{ name: "Custom", html: "<script>x</script>", purposes: ["analytics"] }],
    });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.consent.purposes).toEqual(["analytics"]);
  });
});
