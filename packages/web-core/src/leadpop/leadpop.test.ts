import { describe, expect, it } from "vitest";

import { buildLeadpopHtml } from "./index.js";

describe("leadpop — buildLeadpopHtml", () => {
  it("returns valid HTML with required script", () => {
    const html = buildLeadpopHtml({
      title: "Promocja",
      body: "Zostaw email",
      discountCode: "TEST10",
      brandColor: "#047857",
    });
    expect(html).toContain('id="mm-leadpop"');
    expect(html).toContain('TEST10');
    expect(html).toContain('triggerAfterSec');
    expect(html).toContain('Promocja');
    expect(html).toContain('Zostaw email');
  });

  it("uses default trigger values when not provided", () => {
    const html = buildLeadpopHtml({
      title: "T",
      body: "B",
      discountCode: "X",
      brandColor: "#000",
    });
    expect(html).toMatch(/"triggerAfterSec":25/);
    expect(html).toMatch(/"triggerScrollPct":60/);
    expect(html).toMatch(/"cooldownDays":7/);
  });

  it("uses custom triggers when provided", () => {
    const html = buildLeadpopHtml({
      title: "T",
      body: "B",
      discountCode: "X",
      brandColor: "#000",
      triggerAfterSec: 10,
      triggerScrollPct: 40,
      cooldownDays: 14,
    });
    expect(html).toMatch(/"triggerAfterSec":10/);
    expect(html).toMatch(/"triggerScrollPct":40/);
    expect(html).toMatch(/"cooldownDays":14/);
  });
});
