import { describe, expect, it } from "vitest";

import {
  defaultConsentScript,
  defaultConsentScriptTag,
} from "./default-state.js";
import { DEFAULT_DENIED_STATE, FULLY_GRANTED_STATE } from "./types.js";

describe("defaultConsentScript", () => {
  it("uses DEFAULT_DENIED_STATE by default", () => {
    const script = defaultConsentScript();
    expect(script).toContain("ad_storage");
    expect(script).toContain('"denied"');
    expect(script).toContain("functionality_storage");
    // functionality_storage MUST be granted (essential)
    expect(script).toMatch(/functionality_storage["']?\s*:\s*["']granted["']/);
  });

  it("includes gtag definition", () => {
    const script = defaultConsentScript();
    expect(script).toContain("window.dataLayer");
    expect(script).toContain("function gtag");
    expect(script).toContain("gtag('consent','default'");
  });

  it("includes ads_data_redaction by default", () => {
    expect(defaultConsentScript()).toContain("ads_data_redaction");
  });

  it("omits ads_data_redaction when disabled", () => {
    expect(defaultConsentScript({ adsDataRedaction: false })).not.toContain("ads_data_redaction");
  });

  it("includes url_passthrough by default", () => {
    expect(defaultConsentScript()).toContain("url_passthrough");
  });

  it("uses provided state override", () => {
    const script = defaultConsentScript({ state: FULLY_GRANTED_STATE });
    // All non-essential signals should be granted
    expect(script).toContain('"ad_storage":"granted"');
    expect(script).toContain('"analytics_storage":"granted"');
  });

  it("state serialization stable + valid JSON", () => {
    const script = defaultConsentScript({ state: DEFAULT_DENIED_STATE });
    const match = /gtag\('consent','default',({[^)]+})\)/.exec(script);
    expect(match).not.toBeNull();
    const json = match![1]!;
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("defaultConsentScriptTag", () => {
  it("wraps in <script> tag without nonce", () => {
    const tag = defaultConsentScriptTag();
    expect(tag.startsWith("<script>")).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });

  it("includes nonce attribute when provided", () => {
    const tag = defaultConsentScriptTag({ nonce: "abc123" });
    expect(tag).toContain('nonce="abc123"');
  });

  it("escapes nonce", () => {
    const tag = defaultConsentScriptTag({ nonce: 'evil"injection' });
    expect(tag).not.toContain('evil"injection');
    expect(tag).toContain("&quot;");
  });
});
