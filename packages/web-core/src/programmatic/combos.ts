/**
 * Combo generation: services × locations cartesian product with prioritization + cap.
 *
 * Strategy: priority = service.priority + location.priority (both 1-10).
 * Pages with highest combined priority included first; remainder dropped (cappedOut).
 *
 * Slug generation:
 *   service-slug + "/" + location-slug
 *   "/awaryjne-otwieranie-zamkow/rzeszow"
 *
 * Polish slugify: removes diacritics, lowercases, replaces non-alphanumeric with -.
 */

import type { LocationInput, PageCombo, ServiceInput } from "./types.js";

export interface BuildCombosInput {
  services: ReadonlyArray<ServiceInput>;
  locations: ReadonlyArray<string | LocationInput>;
  maxPages: number;
  basePath?: string;
}

export interface BuildCombosOutput {
  selected: PageCombo[];
  cappedOut: PageCombo[];
}

export function buildCombos(input: BuildCombosInput): BuildCombosOutput {
  const basePath = input.basePath?.replace(/\/+$/, "") ?? "/uslugi";
  const normalizedLocations: LocationInput[] = input.locations.map((l) =>
    typeof l === "string" ? { name: l } : l,
  );

  const combos: PageCombo[] = [];
  for (const service of input.services) {
    for (const location of normalizedLocations) {
      const servicePriority = service.priority ?? 5;
      const locationPriority = location.priority ?? 5;
      const slug = buildSlug(basePath, service, location);
      combos.push({
        service,
        location,
        slug,
        priority: servicePriority + locationPriority,
      });
    }
  }

  // Sort by priority DESC, stable secondary by slug for determinism
  combos.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.slug.localeCompare(b.slug);
  });

  const selected = combos.slice(0, input.maxPages);
  const cappedOut = combos.slice(input.maxPages);

  return { selected, cappedOut };
}

export function buildSlug(basePath: string, service: ServiceInput, location: LocationInput): string {
  const serviceSlug = ensureSlug(service.slug);
  const locationSlug = location.slug ?? slugifyPolish(location.name);
  return `${basePath}/${serviceSlug}/${locationSlug}`;
}

/**
 * Slugify Polish text: remove diacritics, lowercase, replace non-alphanumeric with hyphens.
 *
 * Examples:
 *   "Rzeszów" → "rzeszow"
 *   "Bielsko-Biała" → "bielsko-biala"
 *   "Świętokrzyskie" → "swietokrzyskie"
 */
export function slugifyPolish(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/ł/g, "l") // ł doesn't decompose via NFD
    .replace(/Ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function ensureSlug(value: string): string {
  if (/^[a-z0-9-]+$/.test(value)) return value;
  return slugifyPolish(value);
}

/** Detect duplicate slugs in a list — usually indicates slugify collision. */
export function findDuplicateSlugs(combos: ReadonlyArray<PageCombo>): string[] {
  const counts = new Map<string, number>();
  for (const combo of combos) {
    counts.set(combo.slug, (counts.get(combo.slug) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug);
}
