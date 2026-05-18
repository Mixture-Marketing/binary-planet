/**
 * Hub-side ID generators. Each entity has a prefix for visual grep + debugging.
 */

const PREFIX = {
  lead: "lead",
  client: "clk",
  subscription: "sub",
  payment: "pmt",
  invoice: "inv",
  webhook: "whk",
  alert: "alt",
  prospect: "prsp",
  rodo: "rodoreq",
  secret: "sec",
  citation: "cit",
  review: "rev",
  blogDraft: "bd",
  job: "job",
} as const;

export type EntityKind = keyof typeof PREFIX;

/** Generate a fresh ID with the given prefix. ~16 chars random suffix (base36). */
export function newId(kind: EntityKind): string {
  return `${PREFIX[kind]}_${randomSlug(16)}`;
}

/** Random base36 slug — case-insensitive, URL-safe, no ambiguous chars. */
export function randomSlug(length: number): string {
  // Use crypto.getRandomValues for safety (Math.random not suitable for IDs)
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) {
    // map byte to base36 (0-9a-z) — bias OK since IDs not used as keys to anything cryptographic
    out += (b % 36).toString(36);
  }
  return out;
}
