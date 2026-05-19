/**
 * Chatbot Basic — Workers AI Llama 3.1 8B integration.
 *
 * Activated as addon `chatbot_basic` (30 zł/mc) or `chatbot_pro` / `chatbot_premium`.
 *
 * Knowledge base = klient.config.ts (business name, services, hours, NAP).
 * No RAG — context-window approach: pack business profile into system prompt.
 *
 * Lead capture: when bot detects "kupić/wycenić/zadzwonić" intent in user input
 * or asks for callback in answer, returns lead_capture_cta=true → widget renders
 * a "Zostaw numer" mini-form below the bot bubble.
 *
 * Per-tier model choice:
 *   - basic   → @cf/meta/llama-3.1-8b-instruct (Workers AI free tier)
 *   - pro     → @cf/meta/llama-3.3-70b-instruct-fp8-fast (Workers AI paid)
 *   - premium → anthropic/claude-haiku-4-5 (external API — needs ANTHROPIC_API_KEY)
 */

export type ChatbotTier = "basic" | "pro" | "premium";

export interface ChatbotBusinessProfile {
  businessName: string;
  industry: string;
  description?: string;
  services?: Array<{ name: string; description?: string; priceFrom?: string }>;
  hours?: Partial<Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", string>> & { note?: string };
  address?: { street?: string; city: string; postalCode?: string };
  phone?: string;
  email?: string;
  primaryDomain?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tier?: ChatbotTier;
  /** Optional: max tokens to generate (Llama default 256). */
  maxTokens?: number;
}

export interface ChatResponse {
  reply: string;
  lead_capture_cta: boolean;
  /** Suggestions a klient can click to continue conversation. */
  quick_replies: string[];
  tier_used: ChatbotTier;
  model_used: string;
  /** "ok" or rate-limited / over-quota. */
  status: "ok" | "rate_limited" | "quota_exceeded" | "error";
}

const TIER_MODELS: Record<ChatbotTier, string> = {
  basic: "@cf/meta/llama-3.1-8b-instruct",
  pro: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  premium: "claude-haiku-4-5",
};

const DAY_LABELS_PL: Record<string, string> = {
  monday: "Pon", tuesday: "Wt", wednesday: "Śr", thursday: "Czw",
  friday: "Pt", saturday: "Sob", sunday: "Nd",
};

export function buildSystemPrompt(profile: ChatbotBusinessProfile): string {
  const lines: string[] = [];

  lines.push(`Jesteś inteligentnym asystentem firmy "${profile.businessName}".`);
  lines.push(`Branża: ${profile.industry}.`);
  if (profile.description) lines.push(`O firmie: ${profile.description}`);
  if (profile.address) {
    const addr = [profile.address.street, profile.address.city, profile.address.postalCode].filter(Boolean).join(", ");
    lines.push(`Adres: ${addr}.`);
  }
  if (profile.phone) lines.push(`Telefon: ${profile.phone}.`);
  if (profile.email) lines.push(`Email: ${profile.email}.`);

  if (profile.services?.length) {
    lines.push("Usługi które oferujemy:");
    for (const s of profile.services.slice(0, 12)) {
      const price = s.priceFrom ? ` (od ${s.priceFrom})` : "";
      const desc = s.description ? ` — ${s.description}` : "";
      lines.push(`- ${s.name}${price}${desc}`);
    }
  }

  if (profile.hours) {
    const days = Object.entries(profile.hours)
      .filter(([k]) => k !== "note")
      .map(([day, h]) => `${DAY_LABELS_PL[day] ?? day}: ${h}`)
      .join(", ");
    if (days) lines.push(`Godziny otwarcia: ${days}.`);
    if (profile.hours.note) lines.push(`Uwaga godzinowa: ${profile.hours.note}.`);
  }

  lines.push("");
  lines.push("ZASADY:");
  lines.push("1. Odpowiadaj WYŁĄCZNIE po polsku. Zwięźle (max 3-4 zdania).");
  lines.push("2. NIE zmyślaj usług, cen ani godzin których nie ma wyżej. Jeśli nie wiesz — powiedz że klient zadzwoni i sprawdzi.");
  lines.push("3. Jeśli pytanie wykracza poza branżę firmy — uprzejmie odmów i podaj telefon.");
  lines.push("4. Zawsze gdy klient pyta o cenę, dostępność, lub umówienie wizyty — zachęć do kontaktu: telefon lub formularz na stronie.");
  lines.push("5. Bądź miły i pomocny. Używaj formy 'Ty' a nie 'Pan/Pani'.");

  return lines.join("\n");
}

const LEAD_INTENT_PATTERNS = [
  /\b(zad?zwo[nń]|telefon|kontakt|odd?zwo[nń])/i,
  /\b(ile (kosztuje|zapłacę|to)|cen[aęy]|wycen)/i,
  /\b(umó?wić|umó?w|rezerw|zapis|wizyt)/i,
  /\b(kiedy mog[ęe]|dostępno|wolny termin|jutro|dzisiaj|jak najszybciej)/i,
];

export function detectLeadIntent(text: string): boolean {
  return LEAD_INTENT_PATTERNS.some((re) => re.test(text));
}

/**
 * Worker-side: run the chat via env.AI binding (Workers AI) for basic/pro,
 * or via Anthropic API for premium tier.
 *
 * Caller must validate addon is active (feature flag) before invoking this.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runChatbot(env: { AI?: any; ANTHROPIC_API_KEY?: string }, profile: ChatbotBusinessProfile, req: ChatRequest): Promise<ChatResponse> {
  const tier = req.tier ?? "basic";
  const model = TIER_MODELS[tier];

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(profile) },
    ...req.messages.filter((m) => m.role !== "system").slice(-10),
  ];

  const lastUser = req.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const userIntentLead = detectLeadIntent(lastUser);

  // Tier-specific dispatch
  try {
    let reply = "";
    if (tier === "premium") {
      if (!env.ANTHROPIC_API_KEY) {
        return errorResponse(tier, model, "Premium tier requires ANTHROPIC_API_KEY");
      }
      reply = await callAnthropic(env.ANTHROPIC_API_KEY, messages, req.maxTokens ?? 400);
    } else {
      if (!env.AI) {
        return errorResponse(tier, model, "Workers AI binding missing");
      }
      // env.AI.run returns { response: string } for chat models
      const out = (await env.AI.run(model, {
        messages,
        max_tokens: req.maxTokens ?? 300,
      })) as { response?: string };
      reply = (out.response ?? "").trim();
    }

    if (!reply) {
      return errorResponse(tier, model, "Empty response from model");
    }

    const replyAsksForContact = /(zadzwo|telefon|kontakt|zostaw\s+(numer|telefon|kontakt))/i.test(reply);
    const lead_capture_cta = userIntentLead || replyAsksForContact;

    return {
      reply,
      lead_capture_cta,
      quick_replies: lead_capture_cta
        ? ["Zostaw mi numer telefonu", "Wolę zadzwonić"]
        : ["Jakie są ceny?", "Kiedy mogę przyjść?"],
      tier_used: tier,
      model_used: model,
      status: "ok",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rate.?limit|too many/i.test(msg)) return errorResponse(tier, model, msg, "rate_limited");
    if (/quota|exceeded/i.test(msg)) return errorResponse(tier, model, msg, "quota_exceeded");
    return errorResponse(tier, model, msg);
  }
}

function errorResponse(tier: ChatbotTier, model: string, message: string, status: ChatResponse["status"] = "error"): ChatResponse {
  return {
    reply: status === "rate_limited" || status === "quota_exceeded"
      ? "Przepraszam, asystent jest tymczasowo niedostępny. Zadzwoń do nas — chętnie pomożemy."
      : `Przepraszam, wystąpił problem. Spróbuj ponownie lub zadzwoń do nas.`,
    lead_capture_cta: true,
    quick_replies: ["Zostaw mi numer", "Wolę zadzwonić"],
    tier_used: tier,
    model_used: model,
    status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(message && ({ _debug: message } as any)),
  };
}

async function callAnthropic(apiKey: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const systemContent = messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      system: systemContent,
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  return (json.content?.[0]?.text ?? "").trim();
}
export * from "./widget.js";
