import { buildRobotsTxt, NOISY_SEO_BOTS } from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";

import clientConfig from "../client.config.ts";

export const prerender = false;

export const GET: APIRoute = () => {
  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
  const txt = buildRobotsTxt({
    sitemap: `${base}/sitemap.xml`,
    perBot: NOISY_SEO_BOTS.map((bot) => ({
      userAgent: bot,
      disallow: ["/"],
    })),
  });
  return new Response(txt, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
