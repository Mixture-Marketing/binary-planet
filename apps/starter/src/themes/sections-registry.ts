/**
 * Sections registry — definicja wszystkich opcjonalnych sekcji + metadata.
 * Klient w /ustawienia → Sekcje strony widzi tę listę z PL labels.
 *
 * Per-styl rekomendacje (pre-checkbox enabled defaults):
 *   minimalist: pricing, team
 *   elegant:    gallery, history, team
 *   dynamic:    pricing, video
 *   editorial:  history, gallery, video, team
 */

export const SECTION_KINDS = [
  "pricing", "team", "history", "video", "gallery", "menu",
  "publications", "trust-badges", "consultation",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface SectionDef {
  kind: SectionKind;
  /** PL label dla UI klienta. */
  label: string;
  /** Krótki opis (pokazany pod label). */
  description: string;
  /** Jaki pakiet jest wymagany (lub "free" dla wszystkich). */
  tier: "starter" | "standard" | "premium" | "professional" | "free";
  /** Wymaga CMS Sveltia (rich content)? */
  cmsRequired: boolean;
  /** Pre-checked dla tych stylów. */
  recommendedFor: ReadonlyArray<"minimalist" | "elegant" | "dynamic" | "editorial">;
  /** Anti-recommend dla tych stylów (warning gdy klient włącza). */
  antiRecommend?: ReadonlyArray<"minimalist" | "elegant" | "dynamic" | "editorial">;
}

export const SECTIONS_REGISTRY: Record<SectionKind, SectionDef> = {
  pricing: {
    kind: "pricing",
    label: "Cennik",
    description: "Tabelaryczny cennik usług z cenami. Transparentne ceny budują zaufanie.",
    tier: "free",
    cmsRequired: false,
    recommendedFor: ["minimalist", "dynamic"],
    antiRecommend: ["editorial"],
  },
  team: {
    kind: "team",
    label: "Zespół",
    description: "Wizytówki członków zespołu — imię, rola, krótki opis, zdjęcie.",
    tier: "free",
    cmsRequired: true,
    recommendedFor: ["minimalist", "elegant", "editorial"],
  },
  history: {
    kind: "history",
    label: "Historia firmy",
    description: "Narracja o powstaniu firmy. Storytelling buduje atmosferę premium.",
    tier: "free",
    cmsRequired: true,
    recommendedFor: ["elegant", "editorial"],
    antiRecommend: ["dynamic"],
  },
  video: {
    kind: "video",
    label: "Wideo",
    description: "Embed YouTube/Vimeo — film firmowy, manifest, demo produktu.",
    tier: "free",
    cmsRequired: false,
    recommendedFor: ["dynamic", "editorial"],
  },
  gallery: {
    kind: "gallery",
    label: "Galeria zdjęć",
    description: "Grid zdjęć — portfolio, przed-po, wnętrze firmy. Wymaga CMS Sveltia.",
    tier: "standard",
    cmsRequired: true,
    recommendedFor: ["elegant", "editorial"],
  },
  menu: {
    kind: "menu",
    label: "Menu / Karta dań",
    description: "Karta dań z cenami i opisami. Dla restauracji, kawiarni, cateringu.",
    tier: "standard",
    cmsRequired: true,
    recommendedFor: ["editorial"],
  },
  publications: {
    kind: "publications",
    label: "Publikacje i wystąpienia",
    description: "Lista publikacji prasowych, książek, wystąpień. Buduje autorytet eksperta.",
    tier: "professional",
    cmsRequired: false,
    recommendedFor: ["minimalist", "editorial"],
  },
  "trust-badges": {
    kind: "trust-badges",
    label: "Trust badges (uprawnienia)",
    description: "Numer wpisu na listę, polisa OC, certyfikaty. Wymagane dla branż regulowanych.",
    tier: "professional",
    cmsRequired: false,
    recommendedFor: ["minimalist", "editorial"],
  },
  consultation: {
    kind: "consultation",
    label: "Płatna konsultacja online",
    description: "Embed Cal.com lub Calendly. Klient książe konsultację bezpośrednio z Twojej strony.",
    tier: "professional",
    cmsRequired: false,
    recommendedFor: ["minimalist", "editorial"],
  },
};

/**
 * Default sections per styl — używane jako pre-checkbox dla nowych klientów.
 */
export function defaultSectionsForStyle(
  style: "minimalist" | "elegant" | "dynamic" | "editorial",
): Array<{ kind: SectionKind; enabled: boolean }> {
  return SECTION_KINDS.map((kind) => ({
    kind,
    enabled: SECTIONS_REGISTRY[kind].recommendedFor.includes(style),
  }));
}

/**
 * Pakiety klienta — mapping czy może użyć sekcji.
 * 'free' = każdy pakiet; 'standard' = Standard+, 'premium' = Premium+, itd.
 */
export function isSectionAvailableForTier(
  kind: SectionKind,
  tier: "starter" | "standard" | "premium" | "professional",
): boolean {
  const required = SECTIONS_REGISTRY[kind].tier;
  if (required === "free") return true;
  const order = ["starter", "standard", "premium", "professional"] as const;
  return order.indexOf(tier) >= order.indexOf(required);
}
