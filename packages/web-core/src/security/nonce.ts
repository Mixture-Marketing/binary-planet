/**
 * CSP nonce — one per request, attached to inline <script>/<style>.
 *
 * Conventions:
 *   - 16 bytes of crypto random, base64-encoded → 22 chars
 *   - Generated once per request, attached to:
 *     - CSP header: `script-src 'nonce-<value>'`
 *     - Every inline <script nonce="<value>">
 *   - Astro: store in `Astro.locals.nonce`, render via `<script set:html={`...`} nonce={Astro.locals.nonce}>`
 *   - Hono: store in c.set('nonce', ...), access in templates
 */

const NONCE_BYTES = 16;

/** Generate a fresh CSP nonce. Returns base64-encoded string (~22 chars). */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Quote a nonce for use in CSP directive.
 * Output: `'nonce-<value>'` (with surrounding single quotes per CSP spec).
 */
export function quoteNonce(nonce: string): string {
  return `'nonce-${nonce}'`;
}
