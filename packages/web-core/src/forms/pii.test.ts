import { describe, expect, it } from "vitest";

import {
  decodeKey,
  decryptString,
  encryptString,
  generateKey,
  normalizeEmail,
  normalizePhone,
  sha256Hex,
} from "./pii.js";

describe("sha256Hex", () => {
  it("is deterministic", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hello");
    expect(a).toBe(b);
  });

  it("differs by input", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("Hello");
    expect(a).not.toBe(b);
  });

  it("returns 64 hex chars", async () => {
    const h = await sha256Hex("x");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeEmail", () => {
  it("lowercases + trims", () => {
    expect(normalizeEmail("  Jan@Example.PL  ")).toBe("jan@example.pl");
  });
});

describe("normalizePhone", () => {
  it("strips non-digit/plus", () => {
    expect(normalizePhone("+48 504 123 456")).toBe("+48504123456");
    expect(normalizePhone("(48) 504-123-456")).toBe("48504123456");
  });

  it("converts 0048 prefix to +48", () => {
    expect(normalizePhone("0048504123456")).toBe("+48504123456");
  });

  it("adds +48 prefix to 9-digit number", () => {
    expect(normalizePhone("504123456")).toBe("+48504123456");
  });

  it("preserves existing +", () => {
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
  });

  it("empty input → empty", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("AES-GCM encrypt/decrypt", () => {
  it("roundtrips plaintext", async () => {
    const keyB64 = await generateKey();
    const key = await decodeKey(keyB64);
    const plain = "Ślusarz Jan Kowalski — informacje poufne";
    const cipher = await encryptString(plain, key);
    expect(cipher).not.toContain(plain);
    const decoded = await decryptString(cipher, key);
    expect(decoded).toBe(plain);
  });

  it("different IV per call → different ciphertext", async () => {
    const key = await decodeKey(await generateKey());
    const c1 = await encryptString("same input", key);
    const c2 = await encryptString("same input", key);
    expect(c1).not.toBe(c2);
  });

  it("wrong key fails decrypt", async () => {
    const k1 = await decodeKey(await generateKey());
    const k2 = await decodeKey(await generateKey());
    const cipher = await encryptString("secret", k1);
    await expect(decryptString(cipher, k2)).rejects.toThrow();
  });

  it("decodeKey rejects wrong-length key", async () => {
    // base64("short") = 5 bytes, not 32
    await expect(decodeKey("c2hvcnQ=")).rejects.toThrow(/32-byte/);
  });
});
