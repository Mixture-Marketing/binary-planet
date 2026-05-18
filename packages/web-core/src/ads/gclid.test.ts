// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  captureAllClickIds,
  captureGclid,
  parseClickIds,
  readAllStoredClickIds,
  readStoredGclid,
} from "./gclid.js";

describe("parseClickIds", () => {
  it("extracts all known click IDs from URLSearchParams", () => {
    const sp = new URLSearchParams("gclid=abc&fbclid=xyz&ttclid=tt1&msclkid=ms1&extra=foo");
    const out = parseClickIds(sp);
    expect(out.gclid).toBe("abc");
    expect(out.fbclid).toBe("xyz");
    expect(out.ttclid).toBe("tt1");
    expect(out.msclkid).toBe("ms1");
  });

  it("returns empty object when no click IDs", () => {
    expect(parseClickIds(new URLSearchParams("utm_source=foo"))).toEqual({});
  });

  it("captures gbraid and wbraid (iOS Privacy)", () => {
    const sp = new URLSearchParams("gbraid=gb1&wbraid=wb1");
    const out = parseClickIds(sp);
    expect(out.gbraid).toBe("gb1");
    expect(out.wbraid).toBe("wb1");
  });
});

describe("captureGclid + readStoredGclid", () => {
  beforeEach(() => {
    document.cookie = "_gcl_aw=; Path=/; Max-Age=0";
  });

  afterEach(() => {
    document.cookie = "_gcl_aw=; Path=/; Max-Age=0";
    // Reset URL
    window.history.replaceState({}, "", "/");
  });

  it("captures gclid from URL → cookie", () => {
    window.history.replaceState({}, "", "/?gclid=abc123");
    const captured = captureGclid();
    expect(captured).toBe("abc123");
    expect(readStoredGclid()).toBe("abc123");
  });

  it("returns undefined when no gclid in URL", () => {
    window.history.replaceState({}, "", "/?utm=foo");
    expect(captureGclid()).toBeUndefined();
  });

  it("custom cookie name persists + reads back", () => {
    window.history.replaceState({}, "", "/?gclid=zzz");
    captureGclid({ cookieName: "_custom_gclid" });
    expect(readStoredGclid({ cookieName: "_custom_gclid" })).toBe("zzz");
  });
});

describe("captureAllClickIds + readAllStoredClickIds", () => {
  beforeEach(() => {
    // Clear all click ID cookies
    for (const name of ["_gcl_aw", "_gcl_gb", "_gcl_wb", "_fbc", "_msclkid", "_ttp"]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("captures all IDs from URL into separate cookies", () => {
    window.history.replaceState({}, "", "/?gclid=g1&fbclid=fb1&msclkid=ms1");
    const captured = captureAllClickIds();
    expect(captured.gclid).toBe("g1");
    expect(captured.fbclid).toBe("fb1");
    expect(captured.msclkid).toBe("ms1");
  });

  it("reads back all stored IDs", () => {
    window.history.replaceState({}, "", "/?gclid=g1&fbclid=fb1");
    captureAllClickIds();
    const stored = readAllStoredClickIds();
    expect(stored.gclid).toBe("g1");
    expect(stored.fbclid).toBe("fb1");
  });

  it("fbclid stored as Meta _fbc format (fb.1.<ts>.<fbclid>)", () => {
    window.history.replaceState({}, "", "/?fbclid=fb1");
    captureAllClickIds();
    const cookie = document.cookie;
    expect(cookie).toContain("_fbc=fb.1.");
    expect(cookie).toContain(".fb1");
  });
});
