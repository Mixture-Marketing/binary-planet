import { describe, expect, it } from "vitest";

import {
  CURRENT_CONSENT_VERSION,
  isKnownConsentVersion,
  listConsentVersions,
  renderConsentText,
} from "./rodo.js";

describe("RODO consent templates", () => {
  it("CURRENT_CONSENT_VERSION is v1.0", () => {
    expect(CURRENT_CONSENT_VERSION).toBe("v1.0");
    expect(isKnownConsentVersion("v1.0")).toBe(true);
    expect(isKnownConsentVersion("v999")).toBe(false);
  });

  it("lists known versions", () => {
    const versions = listConsentVersions();
    expect(versions).toContain("v1.0");
  });

  it("renders v1.0 with business name + domain", async () => {
    const out = await renderConsentText("v1.0", {
      businessName: "Ślusarz Kowalski",
      primaryDomain: "kowalski.pl",
      showMarketing: false,
    });
    expect(out.version).toBe("v1.0");
    expect(out.processingHtml).toContain("Ślusarz Kowalski");
    expect(out.processingHtml).toContain("kowalski.pl");
    expect(out.marketingHtml).toBeUndefined();
    expect(out.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes marketing text when requested", async () => {
    const out = await renderConsentText("v1.0", {
      businessName: "X",
      primaryDomain: "x.pl",
      showMarketing: true,
    });
    expect(out.marketingHtml).toBeDefined();
    expect(out.marketingHtml).toContain("marketingow");
  });

  it("hash differs when input differs", async () => {
    const a = await renderConsentText("v1.0", {
      businessName: "A",
      primaryDomain: "a.pl",
      showMarketing: false,
    });
    const b = await renderConsentText("v1.0", {
      businessName: "B",
      primaryDomain: "b.pl",
      showMarketing: false,
    });
    expect(a.hash).not.toBe(b.hash);
  });

  it("hash same for same input", async () => {
    const input = { businessName: "X", primaryDomain: "x.pl", showMarketing: false };
    const a = await renderConsentText("v1.0", input);
    const b = await renderConsentText("v1.0", input);
    expect(a.hash).toBe(b.hash);
  });

  it("throws on unknown version", async () => {
    await expect(
      renderConsentText("v999", { businessName: "X", primaryDomain: "x.pl", showMarketing: false }),
    ).rejects.toThrow(/Unknown consent/);
  });

  it("escapes HTML chars in business name", async () => {
    const out = await renderConsentText("v1.0", {
      businessName: '<script>alert("xss")</script>',
      primaryDomain: "x.pl",
      showMarketing: false,
    });
    expect(out.processingHtml).not.toContain("<script>");
    expect(out.processingHtml).toContain("&lt;script&gt;");
  });
});
