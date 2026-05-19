/**
 * GET /ai-snippet.json — single endpoint with structured business data for AI to fetch.
 *
 * Part of GEO/LLM PRO addon. AI crawlers can fetch this lightweight JSON instead of
 * parsing the full HTML — it's a "summary card" for direct quotation.
 *
 * Schema is intentionally NOT schema.org — it's an emerging "AI snippet" pattern
 * (similar to /.well-known/ai-plugin.json but tailored to local business).
 *
 * Activated by GEO_LLM_PRO_ENABLED=true env (Track 24f-2). Without the flag this
 * endpoint still works but returns a minimal version (just business name + summary).
 */

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import clientConfig from "../client.config.ts";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: { GEO_LLM_PRO_ENABLED?: string } } })?.runtime?.env;
  const isPro = String(env?.GEO_LLM_PRO_ENABLED ?? "").toLowerCase() === "true";

  const base = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;

  // Baseline data — always included
  const baseline = {
    "@context": "https://mixturemarketing.pl/ai-snippet-v1",
    "@type": "LocalBusinessSnippet",
    "@id": base,
    name: clientConfig.business.name,
    summary: clientConfig.business.description,
    homepage: base,
    industry: clientConfig.business.industry,
    schemaType: clientConfig.business.schemaType,
  };

  if (!isPro) {
    // Minimal version for non-PRO sites
    return json({ ...baseline, _note: "Enhanced version requires GEO/LLM PRO addon" });
  }

  // PRO: full data
  const faqEntries = await getCollection("faq").catch(() => []);
  const qa = faqEntries
    .filter((f) => f.data.published)
    .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
    .slice(0, 10)
    .map((f) => ({
      question: f.data.question,
      answer: typeof f.body === "string" ? f.body.replace(/\s+/g, " ").trim() : "",
    }));

  const services = clientConfig.services.map((s) => ({
    name: s.name,
    description: s.description,
    ...(s.priceFrom && { priceFrom: s.priceFrom }),
    ...(s.iconKey && { iconKey: s.iconKey }),
  }));

  const hours = clientConfig.hours
    ? Object.fromEntries(
        Object.entries(clientConfig.hours).filter(([k, v]) => k !== "note" && typeof v === "string" && v),
      )
    : undefined;

  const data = {
    ...baseline,
    description: clientConfig.business.description,
    business: {
      legalName: clientConfig.business.legalName ?? undefined,
      foundedYear: clientConfig.business.foundedYear ?? undefined,
      employeeCount: clientConfig.business.employeeCount ?? undefined,
    },
    location: clientConfig.address
      ? {
          street: clientConfig.address.street,
          city: clientConfig.address.city,
          postalCode: clientConfig.address.postalCode,
          voivodeship: clientConfig.address.voivodeship,
          ...(clientConfig.address.latitude && { latitude: clientConfig.address.latitude }),
          ...(clientConfig.address.longitude && { longitude: clientConfig.address.longitude }),
        }
      : undefined,
    contact: {
      phone: clientConfig.contact?.phone,
      email: clientConfig.contact?.email,
    },
    serviceArea: clientConfig.serviceArea ?? [],
    services,
    hours,
    hoursNote: clientConfig.hours?.note,
    faq: qa,
    // AI-friendly hints
    _ai: {
      promptable: true,
      preferred_citation_format: "blockquote",
      llmsTxtUrl: `${base}/llms.txt`,
      lastUpdated: new Date().toISOString(),
    },
  };

  return json(data);
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
