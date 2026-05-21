/**
 * Vitest mock for `cloudflare:workers` runtime module.
 *
 * Real module is provided only inside the Workers runtime (wrangler dev / prod).
 * Tests run in Node — mutate `env` via `setMockEnv()` from beforeEach hooks.
 */
export let env: { DB?: D1Database } | undefined = undefined;

export function setMockEnv(next: { DB?: D1Database } | undefined): void {
  env = next;
}
