import { describe, expect, it } from "vitest";

import { generateNonce, quoteNonce } from "./nonce.js";

describe("generateNonce", () => {
  it("returns ~22 char base64 string", () => {
    const n = generateNonce();
    expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("is unique per call (10k samples)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateNonce());
    expect(set.size).toBe(10_000);
  });
});

describe("quoteNonce", () => {
  it("wraps with 'nonce-' prefix and single quotes", () => {
    expect(quoteNonce("abc")).toBe("'nonce-abc'");
  });
});
