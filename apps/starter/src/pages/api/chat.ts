/**
 * POST /api/chat — Chatbot AI endpoint.
 *
 * Active only when client has the chatbot_basic / chatbot_pro / chatbot_premium addon
 * enabled (feature flag check against hub, cached in KV per-klient).
 *
 * Uses Workers AI binding (env.AI) for basic/pro, Anthropic API for premium.
 */

import type { APIRoute } from "astro";

import { runChatbot, type ChatMessage, type ChatbotTier } from "@mixturemarketing/web-core/chatbot";

import clientConfig from "../../client.config.ts";

export const prerender = false;

interface RuntimeEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AI?: any;
  ANTHROPIC_API_KEY?: string;
  CHATBOT_TIER?: ChatbotTier;
  /** Set by provisioning when chatbot addon is active. "true" enables endpoint. */
  CHATBOT_ENABLED?: string;
}

const MAX_MESSAGE_LEN = 500;
const MAX_HISTORY = 20;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: RuntimeEnv } })?.runtime?.env;
  if (!env) return json({ ok: false, error: "Runtime not available" }, 500);

  if ((env.CHATBOT_ENABLED ?? "").toLowerCase() !== "true") {
    return json({ ok: false, error: "Chatbot not enabled for this site" }, 403);
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ ok: false, error: "messages required" }, 400);

  // Validate / sanitize
  const sanitized: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    if (!m || typeof m.content !== "string") continue;
    if (m.role !== "user" && m.role !== "assistant") continue;
    sanitized.push({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LEN),
    });
  }
  if (sanitized.length === 0 || sanitized[sanitized.length - 1]!.role !== "user") {
    return json({ ok: false, error: "Last message must be from user" }, 400);
  }

  const tier = env.CHATBOT_TIER ?? "basic";

  const profile = {
    businessName: clientConfig.business.name,
    industry: clientConfig.business.industry,
    description: clientConfig.business.description,
    services: clientConfig.services.map((s) => ({
      name: s.name,
      description: s.description,
      priceFrom: s.priceFrom,
    })),
    hours: clientConfig.hours,
    address: clientConfig.address
      ? {
          street: clientConfig.address.street,
          city: clientConfig.address.city,
          postalCode: clientConfig.address.postalCode,
        }
      : undefined,
    phone: clientConfig.contact?.phone,
    email: clientConfig.contact?.email,
    primaryDomain: clientConfig.domain?.primary,
  };

  const result = await runChatbot(env, profile, { messages: sanitized, tier });

  return json({ ok: true, data: result }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
