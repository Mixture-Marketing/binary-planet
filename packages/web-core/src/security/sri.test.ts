import { describe, expect, it } from "vitest";

import { generateSriHash, verifySriHash } from "./sri.js";

describe("generateSriHash", () => {
  it("produces sha384 by default", async () => {
    const hash = await generateSriHash({ content: "hello" });
    expect(hash).toMatch(/^sha384-[A-Za-z0-9+/]+={0,2}$/);
  });

  it("supports sha256 / sha512", async () => {
    const a = await generateSriHash({ content: "x", algorithm: "sha256" });
    const b = await generateSriHash({ content: "x", algorithm: "sha512" });
    expect(a).toMatch(/^sha256-/);
    expect(b).toMatch(/^sha512-/);
    expect(a).not.toBe(b);
  });

  it("multipleAlgos returns space-separated tokens", async () => {
    const h = await generateSriHash({ content: "x", multipleAlgos: true });
    const tokens = h.split(/\s+/);
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens[0]).toMatch(/^sha384-/);
  });

  it("deterministic for same input", async () => {
    const a = await generateSriHash({ content: "stable" });
    const b = await generateSriHash({ content: "stable" });
    expect(a).toBe(b);
  });

  it("differs by content", async () => {
    const a = await generateSriHash({ content: "a" });
    const b = await generateSriHash({ content: "b" });
    expect(a).not.toBe(b);
  });

  it("accepts Uint8Array + ArrayBuffer", async () => {
    const bytes = new TextEncoder().encode("test");
    const a = await generateSriHash({ content: bytes });
    const b = await generateSriHash({ content: bytes.buffer });
    const c = await generateSriHash({ content: "test" });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });
});

describe("verifySriHash", () => {
  it("returns true for matching hash", async () => {
    const hash = await generateSriHash({ content: "verify-me" });
    expect(await verifySriHash("verify-me", hash)).toBe(true);
  });

  it("returns false for mismatch", async () => {
    const hash = await generateSriHash({ content: "a" });
    expect(await verifySriHash("b", hash)).toBe(false);
  });

  it("accepts any matching token in multi-algo integrity", async () => {
    const multi = await generateSriHash({ content: "x", multipleAlgos: true });
    expect(await verifySriHash("x", multi)).toBe(true);
  });

  it("ignores unknown algos in integrity string", async () => {
    const real = await generateSriHash({ content: "x" });
    expect(await verifySriHash("x", `sha999-bogus ${real}`)).toBe(true);
  });
});
