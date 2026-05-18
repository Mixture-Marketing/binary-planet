/**
 * craftsman theme color tokens — 3 variants.
 * Injected into BaseLayout as inline CSS custom properties.
 */

export interface ThemeTokens {
  brand: string;
  brandFg: string;
  accent: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
}

export const CRAFTSMAN_VARIANTS: Record<string, ThemeTokens> = {
  "red-bold": {
    brand: "#c0392b",
    brandFg: "#ffffff",
    accent: "#f39c12",
    surface: "#ffffff",
    surfaceMuted: "#f8f5f0",
    text: "#1a1a1a",
    textMuted: "#5a5a5a",
    border: "#e5e0d8",
  },
  "blue-trust": {
    brand: "#1e40af",
    brandFg: "#ffffff",
    accent: "#f59e0b",
    surface: "#ffffff",
    surfaceMuted: "#f3f6fb",
    text: "#0f172a",
    textMuted: "#475569",
    border: "#dbe2ec",
  },
  "green-ground": {
    brand: "#15803d",
    brandFg: "#ffffff",
    accent: "#d97706",
    surface: "#ffffff",
    surfaceMuted: "#f0f5f1",
    text: "#171f1c",
    textMuted: "#4d5b54",
    border: "#dde6e0",
  },
};

export function tokensCss(variant: string): string {
  const t = CRAFTSMAN_VARIANTS[variant] ?? CRAFTSMAN_VARIANTS["red-bold"];
  if (!t) return "";
  return `--color-brand:${t.brand};--color-brand-fg:${t.brandFg};--color-accent:${t.accent};--color-surface:${t.surface};--color-surface-muted:${t.surfaceMuted};--color-text:${t.text};--color-text-muted:${t.textMuted};--color-border:${t.border};`;
}
