/**
 * robots.txt builder.
 *
 * Default policy for MM client sites:
 *  - Allow all crawlers
 *  - Block /admin, /api/* (internal), /_actions/* (Astro server actions)
 *  - Sitemap link
 *
 * Per-client overrides via options.
 */

export interface RobotsOptions {
  /** Allow crawling? Default true. Set false for staging/preview deploys. */
  allow?: boolean;
  /** Absolute sitemap URL (omit if no sitemap yet). */
  sitemap?: string | readonly string[];
  /** Paths to disallow for all user-agents. Defaults below. */
  disallow?: readonly string[];
  /** Per-bot rules — e.g. block AhrefsBot, MJ12bot to reduce noise. */
  perBot?: ReadonlyArray<{ userAgent: string; allow?: readonly string[]; disallow?: readonly string[] }>;
  /** Crawl-delay seconds (non-Google). */
  crawlDelay?: number;
}

const DEFAULT_DISALLOW: readonly string[] = ["/admin", "/admin/", "/api/", "/_actions/", "/_image/"];

/**
 * Build a robots.txt string. Empty entries / undefined options collapse cleanly.
 */
export function buildRobotsTxt(options: RobotsOptions = {}): string {
  const lines: string[] = [];

  if (options.allow === false) {
    lines.push("User-agent: *");
    lines.push("Disallow: /");
    appendSitemap(lines, options.sitemap);
    return lines.join("\n") + "\n";
  }

  // Default group
  lines.push("User-agent: *");
  const disallow = options.disallow ?? DEFAULT_DISALLOW;
  for (const path of disallow) {
    lines.push(`Disallow: ${path}`);
  }
  if (options.crawlDelay !== undefined) {
    lines.push(`Crawl-delay: ${options.crawlDelay}`);
  }
  lines.push("");

  // Per-bot rules
  if (options.perBot) {
    for (const bot of options.perBot) {
      lines.push(`User-agent: ${bot.userAgent}`);
      if (bot.disallow) {
        for (const p of bot.disallow) lines.push(`Disallow: ${p}`);
      }
      if (bot.allow) {
        for (const p of bot.allow) lines.push(`Allow: ${p}`);
      }
      lines.push("");
    }
  }

  appendSitemap(lines, options.sitemap);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function appendSitemap(lines: string[], sitemap: RobotsOptions["sitemap"]): void {
  if (sitemap === undefined) return;
  const list = typeof sitemap === "string" ? [sitemap] : sitemap;
  for (const s of list) {
    lines.push(`Sitemap: ${s}`);
  }
}

/**
 * Convenience: block known SEO scraper bots that consume crawl budget without value.
 * Use sparingly — some clients may want Ahrefs/SEMrush analytics.
 */
export const NOISY_SEO_BOTS: readonly string[] = [
  "AhrefsBot",
  "MJ12bot",
  "SemrushBot",
  "DotBot",
  "PetalBot",
  "MegaIndex.ru",
];
