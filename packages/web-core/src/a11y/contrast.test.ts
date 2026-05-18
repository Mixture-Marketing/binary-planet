import { describe, expect, it } from "vitest";

import {
  checkContrast,
  contrastRatio,
  meetsAA,
  meetsAAA,
  parseColor,
  parseHex,
  relativeLuminance,
} from "./contrast.js";

describe("parseHex", () => {
  it("parses 6-char hex", () => {
    expect(parseHex("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("parses 3-char shorthand", () => {
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
  });

  it("accepts no hash prefix", () => {
    expect(parseHex("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("ignores alpha in 8-char", () => {
    expect(parseHex("#ff000080")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("throws on invalid format", () => {
    expect(() => parseHex("nope")).toThrow();
    expect(() => parseHex("#abcd")).toThrow();
  });
});

describe("parseColor", () => {
  it("delegates to parseHex for #", () => {
    expect(parseColor("#000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses rgb()", () => {
    expect(parseColor("rgb(255, 128, 0)")).toEqual({ r: 255, g: 128, b: 0 });
  });

  it("parses rgba()", () => {
    expect(parseColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("throws on unsupported", () => {
    expect(() => parseColor("hsl(120, 50%, 50%)")).toThrow();
  });
});

describe("relativeLuminance", () => {
  it("white = 1.0", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });

  it("black = 0", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("monotonic — brighter → higher", () => {
    const dark = relativeLuminance({ r: 50, g: 50, b: 50 });
    const mid = relativeLuminance({ r: 128, g: 128, b: 128 });
    const light = relativeLuminance({ r: 200, g: 200, b: 200 });
    expect(dark).toBeLessThan(mid);
    expect(mid).toBeLessThan(light);
  });
});

describe("contrastRatio", () => {
  it("white on black = 21:1 (max)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("same color = 1:1 (min)", () => {
    expect(contrastRatio("#abcdef", "#abcdef")).toBe(1);
  });

  it("symmetric (fg/bg order doesn't matter)", () => {
    const a = contrastRatio("#c0392b", "#ffffff");
    const b = contrastRatio("#ffffff", "#c0392b");
    expect(a).toBeCloseTo(b, 5);
  });

  it("craftsman red-bold brand on white meets AA", () => {
    const ratio = contrastRatio("#c0392b", "#ffffff");
    expect(meetsAA(ratio)).toBe(true);
  });

  it("light gray on white fails AA (common mistake)", () => {
    const ratio = contrastRatio("#bbbbbb", "#ffffff");
    expect(meetsAA(ratio)).toBe(false);
  });
});

describe("checkContrast", () => {
  it("reports AAA for max contrast", () => {
    const r = checkContrast("#000000", "#ffffff");
    expect(r.grade).toBe("AAA");
    expect(r.aaa).toBe(true);
  });

  it("reports fail for low contrast", () => {
    const r = checkContrast("#cccccc", "#dddddd");
    expect(r.grade).toBe("fail");
    expect(r.aa).toBe(false);
  });

  it("rounds ratio to 2 decimals", () => {
    const r = checkContrast("#000000", "#ffffff");
    expect(Number.isFinite(r.ratio)).toBe(true);
    expect(r.ratio.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it("AAA threshold 7.0 for normal text", () => {
    expect(meetsAAA(7.0)).toBe(true);
    expect(meetsAAA(6.99)).toBe(false);
  });
});
