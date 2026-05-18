import { describe, expect, it } from "vitest";

import {
  clarityTool,
  customHtmlTool,
  ga4Tool,
  googleAdsTool,
  metaPixelTool,
  plausibleTool,
  tiktokPixelTool,
} from "./tool-configs.js";

describe("plausibleTool", () => {
  it("defaults to plausible.io + necessary purpose", () => {
    const t = plausibleTool();
    expect(t.type).toBe("plausible");
    expect(t.settings["origin"]).toBe("https://plausible.io");
    expect(t.consent.required).toBe(false);
    expect(t.consent.purposes).toEqual(["necessary"]);
  });

  it("accepts custom origin (self-hosted)", () => {
    const t = plausibleTool({ origin: "https://analytics.mixturemarketing.pl", domain: "kowalski.pl" });
    expect(t.settings["origin"]).toBe("https://analytics.mixturemarketing.pl");
    expect(t.settings["domain"]).toBe("kowalski.pl");
  });
});

describe("ga4Tool", () => {
  it("validates G- prefix", () => {
    expect(() => ga4Tool({ measurementId: "UA-12345" })).toThrow(/G-/);
    expect(() => ga4Tool({ measurementId: "G-ABC123" })).not.toThrow();
  });

  it("has analytics purpose + standard events", () => {
    const t = ga4Tool({ measurementId: "G-TEST" });
    expect(t.consent.purposes).toEqual(["analytics"]);
    expect(t.consent.required).toBe(true);
    expect(t.events?.find((e) => e.eventName === "lead_form_submit")?.action).toBe("generate_lead");
  });
});

describe("googleAdsTool", () => {
  it("validates AW- prefix", () => {
    expect(() => googleAdsTool({ conversionId: "G-12345" })).toThrow(/AW-/);
    expect(() => googleAdsTool({ conversionId: "AW-1234567" })).not.toThrow();
  });

  it("has marketing purpose", () => {
    const t = googleAdsTool({ conversionId: "AW-1234" });
    expect(t.consent.purposes).toEqual(["marketing"]);
  });

  it("optional conversion label persists", () => {
    const t = googleAdsTool({ conversionId: "AW-1234", leadConversionLabel: "abc/xyz" });
    expect(t.settings["defaultConversionLabel"]).toBe("abc/xyz");
  });
});

describe("metaPixelTool", () => {
  it("validates numeric pixelId", () => {
    expect(() => metaPixelTool({ pixelId: "abc" })).toThrow(/numeric/);
    expect(() => metaPixelTool({ pixelId: "123456" })).not.toThrow();
  });

  it("standard events mapped to Meta conventions", () => {
    const t = metaPixelTool({ pixelId: "1234" });
    expect(t.events?.find((e) => e.eventName === "lead_form_submit")?.action).toBe("Lead");
    expect(t.events?.find((e) => e.eventName === "page_view")?.action).toBe("PageView");
  });
});

describe("tiktokPixelTool", () => {
  it("marketing purpose + SubmitForm action", () => {
    const t = tiktokPixelTool({ pixelId: "C123" });
    expect(t.consent.purposes).toEqual(["marketing"]);
    expect(t.events?.find((e) => e.eventName === "lead_form_submit")?.action).toBe("SubmitForm");
  });
});

describe("clarityTool", () => {
  it("analytics purpose (PII heatmaps still need consent)", () => {
    const t = clarityTool({ projectId: "abcd" });
    expect(t.consent.required).toBe(true);
    expect(t.consent.purposes).toEqual(["analytics"]);
  });
});

describe("customHtmlTool", () => {
  it("defaults to marketing purpose + required consent", () => {
    const t = customHtmlTool({ name: "Foo", html: "<script>...</script>" });
    expect(t.consent.purposes).toEqual(["marketing"]);
    expect(t.consent.required).toBe(true);
  });

  it("necessary purpose disables consent requirement", () => {
    const t = customHtmlTool({ name: "Foo", html: "x", purposes: ["necessary"] });
    expect(t.consent.required).toBe(false);
  });
});
