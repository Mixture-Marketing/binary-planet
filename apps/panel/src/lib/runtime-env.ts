/**
 * Astro 6 + @astrojs/cloudflare v13: `Astro.locals.runtime.env` was removed.
 * Use `import { env } from "cloudflare:workers"` instead — module-scoped, typed.
 *
 * Wrapper centralizes the import so 1 file changes if Cloudflare ever renames the module.
 */
import { env as cfEnv } from "cloudflare:workers";

export const env: RuntimeEnv = cfEnv;
