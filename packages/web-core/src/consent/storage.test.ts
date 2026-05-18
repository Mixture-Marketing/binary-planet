import { describe, expect, it } from "vitest";

import {
  buildConsentCookie,
  fillState,
  readConsent,
} from "./storage.js";
import { DEFAULT_DENIED_STATE, FULLY_GRANTED_STATE, type ConsentRecord } from "./types.js";

const sampleRecord: ConsentRecord = {
  version: "v1.0",
  timestamp: "2026-05-19T10:00:00.000Z",
  state: FULLY_GRANTED_STATE,
  explicit: true,
};

describe("buildConsentCookie", () => {
  it("emits canonical cookie string with defaults", () => {
    const cookie = buildConsentCookie(sampleRecord);
    expect(cookie).toContain("mm_consent_v1=");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("respects custom name + domain + maxAge", () => {
    const cookie = buildConsentCookie(sampleRecord, {
      name: "custom_consent",
      domain: ".mixturemarketing.pl",
      maxAgeSec: 60,
      sameSite: "Strict",
      secure: false,
    });
    expect(cookie).toContain("custom_consent=");
    expect(cookie).toContain("Domain=.mixturemarketing.pl");
    expect(cookie).toContain("Max-Age=60");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("Secure");
  });

  it("URL-encodes JSON value", () => {
    const cookie = buildConsentCookie(sampleRecord);
    // Should not contain raw { or }
    expect(cookie).not.toContain('{"version"');
    expect(cookie).toContain("%22"); // encoded "
  });
});

describe("readConsent", () => {
  it("parses saved cookie round-trip", () => {
    const cookie = buildConsentCookie(sampleRecord);
    // Convert Set-Cookie to Cookie header (just value)
    const cookieValue = cookie.split(";")[0]!; // "mm_consent_v1=..."
    const parsed = readConsent(cookieValue, { expectedVersion: "v1.0" });
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe("v1.0");
    expect(parsed?.state).toEqual(FULLY_GRANTED_STATE);
    expect(parsed?.explicit).toBe(true);
  });

  it("returns null on empty / null cookie header", () => {
    expect(readConsent(null, { expectedVersion: "v1.0" })).toBeNull();
    expect(readConsent("", { expectedVersion: "v1.0" })).toBeNull();
  });

  it("returns null on missing target cookie", () => {
    expect(readConsent("other_cookie=value", { expectedVersion: "v1.0" })).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(readConsent("mm_consent_v1=not-json", { expectedVersion: "v1.0" })).toBeNull();
  });

  it("returns null on version mismatch (forces re-prompt)", () => {
    const cookie = buildConsentCookie(sampleRecord);
    const cookieValue = cookie.split(";")[0]!;
    expect(readConsent(cookieValue, { expectedVersion: "v2.0" })).toBeNull();
  });

  it("returns null on missing required field (invalid record)", () => {
    const bad = encodeURIComponent(JSON.stringify({ version: "v1.0" })); // missing state, timestamp
    expect(readConsent(`mm_consent_v1=${bad}`, { expectedVersion: "v1.0" })).toBeNull();
  });

  it("returns null on invalid signal value", () => {
    const bad = encodeURIComponent(
      JSON.stringify({
        version: "v1.0",
        timestamp: "2026-05-19T00:00:00Z",
        explicit: true,
        state: { ...FULLY_GRANTED_STATE, ad_storage: "maybe" },
      }),
    );
    expect(readConsent(`mm_consent_v1=${bad}`, { expectedVersion: "v1.0" })).toBeNull();
  });

  it("handles multi-cookie header (parses correct one)", () => {
    const cookie = buildConsentCookie(sampleRecord).split(";")[0]!;
    const header = `other=foo; ${cookie}; another=bar`;
    expect(readConsent(header, { expectedVersion: "v1.0" })).not.toBeNull();
  });
});

describe("fillState", () => {
  it("fills missing signals as denied except essentials", () => {
    const state = fillState({ analytics_storage: "granted" });
    expect(state.analytics_storage).toBe("granted");
    expect(state.ad_storage).toBe("denied");
    expect(state.functionality_storage).toBe("granted");
    expect(state.security_storage).toBe("granted");
  });

  it("empty partial → defaults to DEFAULT_DENIED_STATE shape", () => {
    expect(fillState({})).toEqual(DEFAULT_DENIED_STATE);
  });
});
