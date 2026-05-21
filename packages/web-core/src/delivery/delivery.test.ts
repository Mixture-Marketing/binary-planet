import { describe, expect, it } from "vitest";

import { buildDeliveryHtml } from "./index.js";

describe("delivery — buildDeliveryHtml", () => {
  it("returns empty when deliveryUrl missing", () => {
    expect(buildDeliveryHtml({ deliveryUrl: "", brandColor: "#000" })).toBe("");
  });

  it("renders sticky CTA with delivery URL", () => {
    const html = buildDeliveryHtml({
      deliveryUrl: "https://wolt.com/pl/poland/warsaw/restaurant/test",
      brandColor: "#047857",
    });
    expect(html).toContain('id="mm-delivery"');
    expect(html).toContain("https://wolt.com/pl/poland/warsaw/restaurant/test");
    expect(html).toContain("Zamów online");
  });

  it("uses provider color when known", () => {
    const html = buildDeliveryHtml({
      deliveryUrl: "https://wolt.com/test",
      brandColor: "#000",
      provider: "wolt",
    });
    expect(html).toContain("#009DE0"); // Wolt brand color
  });

  it("falls back to brandColor for generic provider", () => {
    const html = buildDeliveryHtml({
      deliveryUrl: "https://example.com/test",
      brandColor: "#FF0000",
    });
    expect(html).toContain("#FF0000");
  });
});
