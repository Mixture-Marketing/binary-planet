/**
 * WCAG contrast ratio calculator.
 *
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter relative luminance.
 * Reference: https://www.w3.org/TR/WCAG21/#contrast-minimum
 *
 * Compliance thresholds:
 *   - AA normal text:  4.5:1
 *   - AA large text:   3.0:1
 *   - AAA normal text: 7.0:1
 *   - AAA large text:  4.5:1
 *
 * Large text = 18pt regular OR 14pt bold (~24px/19px CSS).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse hex color string to RGB object.
 * Accepts: #RGB, #RRGGBB, #RRGGBBAA (alpha ignored).
 */
export function parseHex(hex: string): RGB {
  const cleaned = hex.replace(/^#/, "");
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
  } else if (cleaned.length === 6 || cleaned.length === 8) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    throw new Error(`parseHex: invalid hex color "${hex}"`);
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error(`parseHex: invalid hex color "${hex}"`);
  }
  return { r, g, b };
}

/**
 * Parse CSS color string. Supports:
 *   - #hex
 *   - rgb(r, g, b)
 *   - rgba(r, g, b, a) — alpha ignored
 */
export function parseColor(input: string): RGB {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) return parseHex(trimmed);
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]!, 10),
      g: parseInt(rgbMatch[2]!, 10),
      b: parseInt(rgbMatch[3]!, 10),
    };
  }
  throw new Error(`parseColor: unsupported format "${input}"`);
}

/**
 * Relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(rgb: RGB): number {
  const channel = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute WCAG contrast ratio between two colors. Returns number ≥ 1.0.
 * Inputs can be hex (#rgb / #rrggbb), rgb(...), or RGB objects.
 */
export function contrastRatio(fg: string | RGB, bg: string | RGB): number {
  const fgRgb = typeof fg === "string" ? parseColor(fg) : fg;
  const bgRgb = typeof bg === "string" ? parseColor(bg) : bg;
  const lum1 = relativeLuminance(fgRgb);
  const lum2 = relativeLuminance(bgRgb);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA pass — normal text. */
export function meetsAA(ratio: number): boolean {
  return ratio >= 4.5;
}

/** WCAG AA pass — large text (≥18pt or ≥14pt bold). */
export function meetsAALarge(ratio: number): boolean {
  return ratio >= 3.0;
}

/** WCAG AAA pass — normal text. */
export function meetsAAA(ratio: number): boolean {
  return ratio >= 7.0;
}

/** WCAG AAA pass — large text. */
export function meetsAAALarge(ratio: number): boolean {
  return ratio >= 4.5;
}

export interface ContrastReport {
  ratio: number;
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
  aaaLarge: boolean;
  grade: "AAA" | "AA" | "AA-large-only" | "fail";
}

/**
 * Full WCAG compliance report for a color pair.
 * Use in build-time lint to verify theme tokens before deploy.
 */
export function checkContrast(fg: string | RGB, bg: string | RGB): ContrastReport {
  const ratio = contrastRatio(fg, bg);
  const aa = meetsAA(ratio);
  const aaLarge = meetsAALarge(ratio);
  const aaa = meetsAAA(ratio);
  const aaaLarge = meetsAAALarge(ratio);

  let grade: ContrastReport["grade"];
  if (aaa) grade = "AAA";
  else if (aa) grade = "AA";
  else if (aaLarge) grade = "AA-large-only";
  else grade = "fail";

  return { ratio: Math.round(ratio * 100) / 100, aa, aaLarge, aaa, aaaLarge, grade };
}
