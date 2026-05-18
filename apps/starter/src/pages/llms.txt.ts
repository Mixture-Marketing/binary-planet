import { buildLocalBusinessLlmsTxt } from "@mixturemarketing/web-core/local";
import type { APIRoute } from "astro";

import clientConfig from "../client.config.ts";

export const prerender = false;

export const GET: APIRoute = () => {
  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
  const txt = buildLocalBusinessLlmsTxt({
    name: clientConfig.business.name,
    summary: clientConfig.business.description,
    homepageUrl: `${base}/`,
    servicesUrl: `${base}/oferta`,
    aboutUrl: `${base}/o-firmie`,
    contactUrl: `${base}/kontakt`,
  });
  return new Response(txt, {
    status: 200,
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
