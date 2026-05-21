import { describe, expect, it } from "vitest";

import { buildNewsletterHtml } from "./index.js";

describe("newsletter — buildNewsletterHtml", () => {
  it("renders sticky widget with form", () => {
    const html = buildNewsletterHtml({
      title: "Subskrybuj",
      body: "Otrzymuj nowości",
      brandColor: "#047857",
    });
    expect(html).toContain('id="mm-newsletter"');
    expect(html).toContain("Subskrybuj");
    expect(html).toContain("Otrzymuj nowości");
    expect(html).toContain('type="email"');
  });

  it("shows phone field when collectPhone=true", () => {
    const html = buildNewsletterHtml({
      title: "T", body: "B", brandColor: "#000", collectPhone: true,
    });
    expect(html).toMatch(/"collectPhone":true/);
  });

  it("hides phone field by default", () => {
    const html = buildNewsletterHtml({ title: "T", body: "B", brandColor: "#000" });
    expect(html).toMatch(/"collectPhone":false/);
  });

  it("supports inline mode", () => {
    const html = buildNewsletterHtml({ title: "T", body: "B", brandColor: "#000", mode: "inline" });
    expect(html).toMatch(/"mode":"inline"/);
  });

  it("default cooldown is 14 days", () => {
    const html = buildNewsletterHtml({ title: "T", body: "B", brandColor: "#000" });
    expect(html).toMatch(/"cooldownDays":14/);
  });
});
