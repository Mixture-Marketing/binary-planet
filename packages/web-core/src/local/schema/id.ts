/**
 * Canonical @id helper. Ensures stable JSON-LD entity ID across pages of the same site.
 *
 * Convention: @id = canonical URL + "#business" fragment, so multiple JSON-LD blocks
 * (e.g. on different pages) refer to the SAME entity in Google's knowledge graph.
 */

export function canonicalId(url: string): string {
  const u = new URL(url);
  // Strip trailing slash, query, hash. Keep origin + path.
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.origin}${path}#business`;
}
