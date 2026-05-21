/**
 * Color palette generator — Material Color Utilities wrapper.
 *
 * Z 1 brand HEX generuje pełny scheme (light + dark) z 12+ tonów + WCAG-safe text colors.
 * Klient w panelu wpisuje "ulubiony kolor firmy", system dobiera resztę.
 *
 * Stack: @material/material-color-utilities (Google, MIT, ~8KB gzipped, Workers-compatible).
 * Używa HCT color space (Hue, Chroma, Tone) — perceptually uniform, lepsze dla brand color
 * generation niż RGB/HSL.
 *
 * Decision: see design-briefs/05-color-system.md
 */

import {
  themeFromSourceColor,
  hexFromArgb,
  argbFromHex,
} from "@material/material-color-utilities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeTokens {
  /** Brand color — main accent for CTAs, links, focus rings. */
  brand: string;
  /** Foreground color used on brand background (auto-contrast). */
  brandFg: string;
  /** Secondary accent for call-outs, badges, "promo" tags. */
  accent: string;
  /** Page background. */
  surface: string;
  /** Muted background for cards, sections. */
  surfaceMuted: string;
  /** Primary text color. */
  text: string;
  /** Secondary text color (muted, captions). */
  textMuted: string;
  /** Border color for cards, dividers, inputs. */
  border: string;
}

export interface PaletteOptions {
  /** Required brand color (HEX). */
  brand: string;
  /** Optional accent override. If omitted, generated as secondary. */
  accent?: string;
  /** Generate dark mode variant instead of light. */
  dark?: boolean;
  /**
   * Surface "warmth" bias per styl. Higher values = warmer cream surface.
   *   Czysty: 0 (cool/pure)
   *   Elegancki: 5 (slight cream)
   *   Dynamiczny: 0 (high contrast)
   *   Magazynowy: 8 (warm cream)
   */
  surfaceBias?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate full ThemeTokens from 1-2 brand colors using Material Color Utilities.
 * Falls back to safe defaults if generation fails.
 */
export function generatePaletteFromBrand(opts: PaletteOptions): ThemeTokens {
  const { brand, accent, dark = false, surfaceBias = 0 } = opts;

  try {
    const theme = themeFromSourceColor(argbFromHex(brand));
    const scheme = dark ? theme.schemes.dark : theme.schemes.light;
    const palettes = theme.palettes;

    // Surface: use light tonal palette ton 99 + warmth bias for non-Czysty styles
    const surfaceTone = dark ? 6 : Math.max(95, 99 - surfaceBias);
    const surfaceMutedTone = dark ? 12 : Math.max(90, 95 - surfaceBias);
    const borderTone = dark ? 25 : 90;

    return {
      brand: brand, // Klient explicitly chose — respect literal HEX
      brandFg: hexFromArgb(scheme.onPrimary),
      accent: accent ?? hexFromArgb(scheme.secondary),
      surface: hexFromArgb(palettes.neutral.tone(surfaceTone)),
      surfaceMuted: hexFromArgb(palettes.neutralVariant.tone(surfaceMutedTone)),
      text: hexFromArgb(scheme.onSurface),
      textMuted: hexFromArgb(scheme.onSurfaceVariant),
      border: hexFromArgb(palettes.neutralVariant.tone(borderTone)),
    };
  } catch {
    // Fallback if Material library fails for any reason
    return safeDefaults(dark);
  }
}

/**
 * Generate both light + dark variants in one call. Klient panel uses this for
 * full theme save (data-theme="auto" switches between them via prefers-color-scheme).
 */
export function generateDualPalette(opts: PaletteOptions): {
  light: ThemeTokens;
  dark: ThemeTokens;
} {
  return {
    light: generatePaletteFromBrand({ ...opts, dark: false }),
    dark: generatePaletteFromBrand({ ...opts, dark: true }),
  };
}

// ---------------------------------------------------------------------------
// WCAG contrast utilities
// ---------------------------------------------------------------------------

/** Compute WCAG relative luminance of HEX color. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const toLin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** WCAG contrast ratio between two HEX colors (1.0 = no contrast, 21.0 = max). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG 2.2 AA compliance level for body text on background. */
export function wcagLevel(
  ratio: number,
): "FAIL" | "AA-large" | "AA" | "AAA" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "FAIL";
}

/** Pick #000 or #fff as contrast text color for given background. */
export function contrastFg(bg: string): string {
  return luminance(bg) > 0.179 ? "#0a0a0a" : "#ffffff";
}

// ---------------------------------------------------------------------------
// Safe defaults (fallback if Material library fails)
// ---------------------------------------------------------------------------

function safeDefaults(dark: boolean): ThemeTokens {
  if (dark) {
    return {
      brand: "#3b82f6",
      brandFg: "#ffffff",
      accent: "#fbbf24",
      surface: "#0a0a0a",
      surfaceMuted: "#171717",
      text: "#fafafa",
      textMuted: "#a3a3a3",
      border: "#262626",
    };
  }
  return {
    brand: "#2563eb",
    brandFg: "#ffffff",
    accent: "#f59e0b",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0a0a0a",
    textMuted: "#475569",
    border: "#e2e8f0",
  };
}
