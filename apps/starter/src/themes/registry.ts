/**
 * Theme registry — Hybrid (Opcja C) per Track 26.
 *
 * 4 stylów (NIE branżowych) \xd7 3 wariant\xf3w kolor\xf3w \xd7 2-3 par font\xf3w
 * + opcjonalne custom brand color (auto-generation przez Material Color Utilities).
 *
 * Polskie nazwy w UI klienta:
 *   - minimalist → Czysty
 *   - elegant    → Elegancki
 *   - dynamic    → Dynamiczny
 *   - editorial  → Magazynowy
 *
 * Decyzje 2026-05-20: zob. design-briefs/00-master-design-system.md + per-styl briefs.
 */

import {
  generatePaletteFromBrand,
  generateDualPalette,
  type ThemeTokens,
} from "@mixturemarketing/web-core/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ThemeTokens };

export const THEME_PRESETS = ["minimalist", "elegant", "dynamic", "editorial"] as const;
export type ThemePresetSlug = (typeof THEME_PRESETS)[number];

export interface FontPair {
  /** Display / headings — Google Fonts family name. */
  display: string;
  /** Body — Google Fonts family name. */
  body: string;
  /** Optional monospace for code/numerics. */
  mono?: string;
  /** href to Google Fonts stylesheet (preloaded in <head>). */
  href: string;
  /** Short label for picker UI. */
  label: string;
}

/**
 * Home page section composition keys.
 *
 * `sections` = the config-driven optional sections block (gallery/menu/history/...).
 * Order of these 6 elements differs per theme to reinforce theme personality:
 *   - dynamic puts hours/status near top (urgency)
 *   - editorial puts narrative sections (history) early
 *   - elegant delays hours till near footer (atmosphere first)
 */
export type HomeSectionKey = "hero" | "services" | "reviews" | "sections" | "hours" | "contact";

export interface ThemeDef {
  slug: ThemePresetSlug;
  /** Polish UI label. */
  labelPl: string;
  /** Polish tagline (1 sentence). */
  taglinePl: string;
  /** Industries this style fits best (used in wizard suggestions). */
  industries: string[];
  variants: Record<string, ThemeTokens>;
  variantsDark: Record<string, ThemeTokens>;
  defaultVariant: string;
  /** Available font pairs (klient picks one — first is default). */
  fontPairs: FontPair[];
  /** Default Hero layout. */
  defaultHero: "centered" | "split" | "image-bg" | "asymmetric";
  /** Default accent style for buttons. */
  defaultAccent: "bold" | "soft" | "outline";
  /** Surface warmth bias for Material Color Utilities (0-10). */
  surfaceBias: number;
  /** Order of homepage section slots — must include all 6 HomeSectionKey values. */
  homeSectionOrder: readonly HomeSectionKey[];
}

// ---------------------------------------------------------------------------
// 1. CZYSTY (Minimalist)
// ---------------------------------------------------------------------------
const minimalist: ThemeDef = {
  slug: "minimalist",
  labelPl: "Czysty",
  taglinePl: "Dla tych, kt\xf3rzy chcą wyglądać poważnie i profesjonalnie",
  industries: ["prawnik", "adwokat", "lekarz", "księgowy", "architekt", "doradca", "IT", "konsultant"],
  variants: {
    "mono-blue": {
      brand: "#0a4cff", brandFg: "#ffffff", accent: "#ff5c1f",
      surface: "#ffffff", surfaceMuted: "#f7f8fa",
      text: "#0a0a0a", textMuted: "#4a4a4a", border: "#e6e8ec",
    },
    "mono-black": {
      brand: "#0a0a0a", brandFg: "#ffffff", accent: "#fbbf24",
      surface: "#ffffff", surfaceMuted: "#fafafa",
      text: "#0a0a0a", textMuted: "#525252", border: "#e5e5e5",
    },
    "mono-emerald": {
      brand: "#0d5d3b", brandFg: "#ffffff", accent: "#b8945f",
      surface: "#ffffff", surfaceMuted: "#f4f7f5",
      text: "#0d1b15", textMuted: "#475e52", border: "#dde6e0",
    },
  },
  variantsDark: {
    "mono-blue": {
      brand: "#3b82f6", brandFg: "#ffffff", accent: "#fb923c",
      surface: "#0a0a0a", surfaceMuted: "#171717",
      text: "#fafafa", textMuted: "#a3a3a3", border: "#262626",
    },
    "mono-black": {
      brand: "#fafafa", brandFg: "#0a0a0a", accent: "#fbbf24",
      surface: "#0a0a0a", surfaceMuted: "#171717",
      text: "#fafafa", textMuted: "#a3a3a3", border: "#262626",
    },
    "mono-emerald": {
      brand: "#34d399", brandFg: "#052e1c", accent: "#fbbf24",
      surface: "#0a1410", surfaceMuted: "#17241c",
      text: "#f0f5f1", textMuted: "#a3b3a8", border: "#2a3a30",
    },
  },
  defaultVariant: "mono-blue",
  fontPairs: [
    // Space Grotesk ma charakterystyczne, geometric glyphs (alt. 'a', 'g') —
    // distinct identity vs. utility Inter. Audit fix: 'Inter feels flat'.
    {
      label: "Space Grotesk + Inter + JetBrains Mono (domyślnie — geometric distinct)",
      display: "Space Grotesk", body: "Inter", mono: "JetBrains Mono",
      href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap",
    },
    {
      label: "Inter Tight + JetBrains Mono (Linear/Vercel utility)",
      display: "Inter Tight", body: "Inter", mono: "JetBrains Mono",
      href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap",
    },
    {
      label: "Geist + Geist Mono (tech vibe)",
      display: "Geist", body: "Geist", mono: "Geist Mono",
      href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
    },
    {
      label: "Manrope + JetBrains Mono (warmer)",
      display: "Manrope", body: "Manrope", mono: "JetBrains Mono",
      href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
    },
  ],
  defaultHero: "split",
  defaultAccent: "bold",
  surfaceBias: 0,
  // Minimalist: trust-building flow. Stats (baked-in) renders inside `sections`
  // block. Reviews before hours = social proof before logistics.
  homeSectionOrder: ["hero", "services", "sections", "reviews", "hours", "contact"],
};

// ---------------------------------------------------------------------------
// 2. ELEGANCKI (Elegant)
// ---------------------------------------------------------------------------
const elegant: ThemeDef = {
  slug: "elegant",
  labelPl: "Elegancki",
  taglinePl: "Dla tych, kt\xf3rzy sprzedają atmosferę i premium feel",
  industries: ["salon", "kosmetyczka", "spa", "fryzjer", "fotograf", "butik", "hotel", "restauracja fine"],
  variants: {
    "rose-cream": {
      brand: "#c4546d", brandFg: "#ffffff", accent: "#b08d57",
      surface: "#fdfaf6", surfaceMuted: "#f5ebe4",
      text: "#2a1d1f", textMuted: "#6b525a", border: "#e8d8d4",
    },
    "sage-ivory": {
      brand: "#5d7560", brandFg: "#ffffff", accent: "#c9a96e",
      surface: "#fbf9f4", surfaceMuted: "#efeae0",
      text: "#1f2820", textMuted: "#5a6358", border: "#ddd5c4",
    },
    "mocha-blush": {
      brand: "#6b4423", brandFg: "#fdf6ee", accent: "#d4a574",
      surface: "#fcf6ef", surfaceMuted: "#e8d9c8",
      text: "#2a1810", textMuted: "#6e4d35", border: "#d9c5b0",
    },
  },
  variantsDark: {
    "rose-cream": {
      brand: "#e8a4b5", brandFg: "#2a1d1f", accent: "#d4a574",
      surface: "#1a1410", surfaceMuted: "#241d1f",
      text: "#fdfaf6", textMuted: "#c4a8b0", border: "#3a2d2f",
    },
    "sage-ivory": {
      brand: "#a3bda6", brandFg: "#1f2820", accent: "#e0b97d",
      surface: "#1a1f1a", surfaceMuted: "#252b25",
      text: "#fbf9f4", textMuted: "#b8c4ba", border: "#3a4438",
    },
    "mocha-blush": {
      brand: "#d4a574", brandFg: "#2a1810", accent: "#e8c498",
      surface: "#1a120a", surfaceMuted: "#241e15",
      text: "#fcf6ef", textMuted: "#c4a890", border: "#3a2e1f",
    },
  },
  defaultVariant: "rose-cream",
  fontPairs: [
    {
      label: "Cormorant Garamond + Inter Tight (domyślnie — Aman/Aesop)",
      display: "Cormorant Garamond", body: "Inter Tight",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Inter+Tight:wght@400;500;600&display=swap",
    },
    {
      label: "Playfair Display + Lora (klasyk premium)",
      display: "Playfair Display", body: "Lora",
      href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Lora:wght@400;500&display=swap",
    },
    {
      label: "Fraunces + Inter (modern retro)",
      display: "Fraunces", body: "Inter",
      href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500&display=swap",
    },
  ],
  defaultHero: "image-bg",
  defaultAccent: "soft",
  surfaceBias: 5,
  // Elegant: atmosphere-first. Reviews + sections (gallery/team) build aspiration
  // before logistics. Hours pushed near footer — luxury doesn't lead with "we open at 9".
  homeSectionOrder: ["hero", "services", "reviews", "sections", "hours", "contact"],
};

// ---------------------------------------------------------------------------
// 3. DYNAMICZNY (Dynamic)
// ---------------------------------------------------------------------------
const dynamic: ThemeDef = {
  slug: "dynamic",
  labelPl: "Dynamiczny",
  taglinePl: "Dla tych, kt\xf3rzy chcą żeby klient dzwonił TERAZ",
  industries: ["ślusarz", "mechanik", "hydraulik", "elektryk", "kurier", "fast-food", "siłownia", "kursy"],
  variants: {
    "red-action": {
      brand: "#dc2626", brandFg: "#ffffff", accent: "#fbbf24",
      surface: "#ffffff", surfaceMuted: "#fef2f2",
      text: "#0a0a0a", textMuted: "#525252", border: "#fecaca",
    },
    "electric-blue": {
      brand: "#1d4ed8", brandFg: "#ffffff", accent: "#ec4899",
      surface: "#ffffff", surfaceMuted: "#eff6ff",
      text: "#0a0a0a", textMuted: "#475569", border: "#dbeafe",
    },
    "neon-noir": {
      brand: "#00ffd1", brandFg: "#0a0a0a", accent: "#ff9500",
      surface: "#0a0a0a", surfaceMuted: "#171717",
      text: "#fafafa", textMuted: "#a3a3a3", border: "#262626",
    },
  },
  variantsDark: {
    "red-action": {
      brand: "#ef4444", brandFg: "#ffffff", accent: "#fbbf24",
      surface: "#0a0a0a", surfaceMuted: "#171717",
      text: "#fafafa", textMuted: "#a3a3a3", border: "#3a1a1a",
    },
    "electric-blue": {
      brand: "#3b82f6", brandFg: "#ffffff", accent: "#f472b6",
      surface: "#0a0a14", surfaceMuted: "#17172a",
      text: "#fafafa", textMuted: "#a3a3b3", border: "#1a2a4a",
    },
    "neon-noir": {
      brand: "#00ffd1", brandFg: "#0a0a0a", accent: "#ff9500",
      surface: "#0a0a0a", surfaceMuted: "#171717",
      text: "#fafafa", textMuted: "#a3a3a3", border: "#262626",
    },
  },
  defaultVariant: "red-action",
  fontPairs: [
    {
      label: "Bricolage Grotesque + Inter + JetBrains Mono (domyślnie — Stripe/Notion)",
      display: "Bricolage Grotesque", body: "Inter", mono: "JetBrains Mono",
      href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap",
    },
    {
      label: "Barlow Condensed + Inter (uniwersalne)",
      display: "Barlow Condensed", body: "Inter",
      href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
    },
    {
      label: "Archivo Black + Archivo (heaviest impact)",
      display: "Archivo Black", body: "Archivo",
      href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600&display=swap",
    },
  ],
  defaultHero: "split",
  defaultAccent: "bold",
  surfaceBias: 0,
  // Dynamic: urgency. Hours/status tile near top — "open NOW call us".
  // Contact follows reviews so user has socjal-proof BEFORE form.
  homeSectionOrder: ["hero", "hours", "services", "reviews", "sections", "contact"],
};

// ---------------------------------------------------------------------------
// 4. MAGAZYNOWY (Editorial)
// ---------------------------------------------------------------------------
const editorial: ThemeDef = {
  slug: "editorial",
  labelPl: "Magazynowy",
  taglinePl: "Dla tych, kt\xf3rzy mają historię do opowiedzenia",
  industries: ["restauracja z historią", "winnica", "hotel butikowy", "rzemiosło premium", "marka osobista", "galeria"],
  variants: {
    "forest-amber": {
      brand: "#2d4a36", brandFg: "#fef8f0", accent: "#8a4f1e",
      surface: "#fef8f0", surfaceMuted: "#f0e6d4",
      text: "#1a1410", textMuted: "#5c4f3f", border: "#a89070",
    },
    "slate-rose": {
      brand: "#475569", brandFg: "#ffffff", accent: "#be5a6e",
      surface: "#f8f5f3", surfaceMuted: "#e8e2dd",
      text: "#1c1c20", textMuted: "#5a5460", border: "#d4ccc4",
    },
    "cream-cobalt": {
      brand: "#1e40af", brandFg: "#fef8f0", accent: "#a04d05",
      surface: "#fef8f0", surfaceMuted: "#ede4d3",
      text: "#0a1424", textMuted: "#475568", border: "#d8cebc",
    },
  },
  variantsDark: {
    "forest-amber": {
      brand: "#7fb893", brandFg: "#1a1410", accent: "#e89556",
      surface: "#1a1410", surfaceMuted: "#241d15",
      text: "#fef8f0", textMuted: "#c4b8a8", border: "#3a2e20",
    },
    "slate-rose": {
      brand: "#a3b3c4", brandFg: "#1c1c20", accent: "#e08c9d",
      surface: "#1a1a1f", surfaceMuted: "#252530",
      text: "#f8f5f3", textMuted: "#b4adb8", border: "#3a3540",
    },
    "cream-cobalt": {
      brand: "#60a5fa", brandFg: "#0a1424", accent: "#fbbf24",
      surface: "#0a1424", surfaceMuted: "#172033",
      text: "#fef8f0", textMuted: "#a8b4c4", border: "#1f2d4a",
    },
  },
  defaultVariant: "forest-amber",
  fontPairs: [
    {
      label: "Fraunces + Newsreader (domyślnie — NYT/Substack)",
      display: "Fraunces", body: "Newsreader",
      // Fraunces variable z opsz axis (optical size auto-adjust) — italic + roman
      href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500;1,9..144,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap",
    },
    {
      label: "Crimson Pro + Inter (GT Sectra free alt)",
      display: "Crimson Pro", body: "Inter",
      href: "https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap",
    },
    {
      label: "Cormorant Garamond + Inter (classical)",
      display: "Cormorant Garamond", body: "Inter",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
    },
  ],
  defaultHero: "asymmetric",
  defaultAccent: "outline",
  surfaceBias: 8,
  // Editorial: narrative-first. Sections block (history/publications) early as
  // the editorial story. Services = "the menu", reviews = "reader letters".
  homeSectionOrder: ["hero", "sections", "services", "reviews", "hours", "contact"],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const THEME_REGISTRY: Record<ThemePresetSlug, ThemeDef> = {
  minimalist,
  elegant,
  dynamic,
  editorial,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Variant slugs available for a given preset. */
export function variantsFor(preset: ThemePresetSlug): readonly string[] {
  return Object.keys(THEME_REGISTRY[preset].variants);
}

export interface TokenOptions {
  /** Optional brand override (HEX). Auto-generates accent via Material Color Utilities. */
  brandColor?: string;
  /** Optional explicit accent override (HEX). */
  accentColor?: string;
  /** Generate dark mode tokens instead of light. */
  dark?: boolean;
  /** Font pair index (0 = default). */
  fontPairIdx?: number;
}

/**
 * Resolve full theme tokens for preset + variant + optional custom HEX overrides.
 * Falls back to predefined variant if no custom colors given.
 */
export function resolveTokens(
  preset: ThemePresetSlug,
  variant: string,
  opts: TokenOptions = {},
): ThemeTokens {
  const def = THEME_REGISTRY[preset];

  // If custom brand color provided, use Material Color Utilities to generate full palette
  if (opts.brandColor) {
    return generatePaletteFromBrand({
      brand: opts.brandColor,
      ...(opts.accentColor && { accent: opts.accentColor }),
      dark: opts.dark ?? false,
      surfaceBias: def.surfaceBias,
    });
  }

  // Otherwise use predefined variant
  const variants = opts.dark ? def.variantsDark : def.variants;
  return variants[variant] ?? variants[def.defaultVariant]!;
}

/** Generate both light + dark tokens (for prefers-color-scheme auto mode). */
export function resolveDualTokens(
  preset: ThemePresetSlug,
  variant: string,
  opts: Omit<TokenOptions, "dark"> = {},
): { light: ThemeTokens; dark: ThemeTokens } {
  if (opts.brandColor) {
    return generateDualPalette({
      brand: opts.brandColor,
      ...(opts.accentColor && { accent: opts.accentColor }),
      surfaceBias: THEME_REGISTRY[preset].surfaceBias,
    });
  }
  return {
    light: resolveTokens(preset, variant, { ...opts, dark: false }),
    dark: resolveTokens(preset, variant, { ...opts, dark: true }),
  };
}

/** Build inline CSS for :root tokens (single variant, light or dark). */
export function tokensCss(
  preset: ThemePresetSlug,
  variant: string,
  opts: TokenOptions = {},
): string {
  const t = resolveTokens(preset, variant, opts);
  return Object.entries(t)
    .flatMap(([k, v]) => {
      const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return [`--color-${kebab}:${v}`, `--c-${kebab}:${v}`];
    })
    .join(";") + ";";
}

/**
 * Build CSS for both light and dark mode using :root + [data-theme="dark"].
 * Honors prefers-color-scheme automatically.
 */
export function dualTokensCss(
  preset: ThemePresetSlug,
  variant: string,
  opts: Omit<TokenOptions, "dark"> = {},
): string {
  const { light, dark } = resolveDualTokens(preset, variant, opts);
  const toCss = (t: ThemeTokens): string =>
    Object.entries(t)
      .flatMap(([k, v]) => {
        const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return [`--color-${kebab}:${v}`, `--c-${kebab}:${v}`];
      })
      .join(";");
  return `
:root{${toCss(light)}}
[data-theme="dark"]{${toCss(dark)}}
@media (prefers-color-scheme: dark){
  [data-theme="auto"]{${toCss(dark)}}
}
`;
}

/** Font pair CSS variables + per-styl font-feature-settings for OpenType features. */
export function fontsCss(preset: ThemePresetSlug, fontPairIdx: number = 0): string {
  const fp = THEME_REGISTRY[preset].fontPairs[fontPairIdx] ?? THEME_REGISTRY[preset].fontPairs[0]!;
  const parts = [
    `--font-display:'${fp.display}',ui-sans-serif,system-ui,sans-serif`,
    `--font-body:'${fp.body}',ui-sans-serif,system-ui,sans-serif`,
  ];
  if (fp.mono) parts.push(`--font-mono:'${fp.mono}',ui-monospace,monospace`);
  // OpenType features per styl — ligatury, kapitaliki, tabular nums, swashes
  // Editorial: pełne ligatury + discretionary + stylistic sets (Fraunces ma 'ss01'-'ss08')
  // Elegant: ligatury + small caps dla nav/labels
  // Czysty: tabular nums (mono numerals dla cennika)
  // Dynamiczny: bez features (bold sans, niewymagane)
  const features: Record<ThemePresetSlug, string> = {
    minimalist: '"liga", "tnum"',
    elegant: '"liga", "dlig", "smcp"',
    dynamic: '"liga"',
    editorial: '"liga", "dlig", "ss01", "swsh"',
  };
  parts.push(`--font-features:${features[preset]}`);
  return parts.join(";") + ";";
}

/** Google Fonts stylesheet URL. */
export function fontsHref(preset: ThemePresetSlug, fontPairIdx: number = 0): string {
  const fp = THEME_REGISTRY[preset].fontPairs[fontPairIdx] ?? THEME_REGISTRY[preset].fontPairs[0]!;
  return fp.href;
}

/** Recommend a preset based on klient's industry string. */
export function recommendPreset(industry: string): ThemePresetSlug {
  const lower = industry.toLowerCase();
  for (const preset of THEME_PRESETS) {
    const def = THEME_REGISTRY[preset];
    if (def.industries.some((kw) => lower.includes(kw))) return preset;
  }
  return "minimalist"; // default fallback (poprzednio: craftsman)
}
