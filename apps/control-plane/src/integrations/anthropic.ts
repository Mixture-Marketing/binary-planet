/**
 * Anthropic Claude API client — minimal subset for Track 8 (AI blog drafts).
 *
 * Why no SDK: official @anthropic-ai/sdk pulls node-only deps + 100KB+ runtime.
 * Direct REST is straightforward + Workers-safe.
 *
 * Auth: `x-api-key: $ANTHROPIC_API_KEY` (not bearer).
 * Endpoint: POST https://api.anthropic.com/v1/messages
 *
 * Models (as of 2026-05):
 *   - claude-opus-4-7         — najlepszy do długich tekstów / złożonych zadań
 *   - claude-sonnet-4-6       — domyślny dla blog drafts (balans cost/jakość)
 *   - claude-haiku-4-5-20251001 — tani, do prostych zadań (topic suggestions, lead scoring)
 *
 * Cost tracking: every call logs to ai_calls (Track 7 ops cost dashboard).
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type AnthropicModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

export interface AnthropicClientConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicCallInput {
  model: AnthropicModel;
  /** System prompt (Anthropic prefers this as separate field, not in messages). */
  system?: string;
  messages: AnthropicMessage[];
  /** Max tokens to generate. Default 1024. */
  maxTokens?: number;
  /** Temperature 0..1. Default 0.7 for creative content, 0.2 for deterministic. */
  temperature?: number;
  /** Stop sequences (max 4). */
  stopSequences?: readonly string[];
}

export interface AnthropicResponse {
  id: string;
  model: string;
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface AnthropicRequestError extends Error {
  status: number;
  body: string;
  anthropicErrorType?: string;
}

function makeError(status: number, body: string): AnthropicRequestError {
  const err = new Error(`Anthropic ${status}: ${body.slice(0, 250)}`) as AnthropicRequestError;
  err.status = status;
  err.body = body;
  try {
    const parsed = JSON.parse(body) as { error?: { type?: string; message?: string } };
    if (parsed.error?.type) err.anthropicErrorType = parsed.error.type;
    if (parsed.error?.message) err.message = `Anthropic ${status} (${parsed.error.type ?? "unknown"}): ${parsed.error.message}`;
  } catch {
    /* not JSON */
  }
  return err;
}

/**
 * Call Claude messages API. Returns full response (caller extracts text from content[0]).
 * Throws AnthropicRequestError on non-2xx.
 */
export async function callAnthropic(
  cfg: AnthropicClientConfig,
  input: AnthropicCallInput,
): Promise<AnthropicResponse> {
  const fetchImpl = cfg.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.maxTokens ?? 1024,
    temperature: input.temperature ?? 0.7,
  };
  if (input.system) body["system"] = input.system;
  if (input.stopSequences && input.stopSequences.length > 0) {
    body["stop_sequences"] = input.stopSequences;
  }

  const res = await fetchImpl(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw makeError(res.status, text);
  return JSON.parse(text) as AnthropicResponse;
}

/** Convenience: returns just the first text block. */
export function extractText(res: AnthropicResponse): string {
  return res.content.find((c) => c.type === "text")?.text ?? "";
}

// ---------------------------------------------------------------------------
// Pricing (as of 2026-05). Used for cost tracking in ai_calls.
// Source: https://www.anthropic.com/pricing
// Returns cost in grosze (1/100 PLN) — converted from USD using rough 4 PLN/USD.
// ---------------------------------------------------------------------------

interface ModelPricing {
  /** USD per million input tokens. */
  inputPerMillion: number;
  /** USD per million output tokens. */
  outputPerMillion: number;
}

const PRICING: Record<AnthropicModel, ModelPricing> = {
  "claude-opus-4-7": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.8, outputPerMillion: 4 },
};

const USD_TO_PLN = 4.0;

export function computeCostGrosze(
  model: AnthropicModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  const usd = (inputTokens / 1_000_000) * p.inputPerMillion + (outputTokens / 1_000_000) * p.outputPerMillion;
  return Math.ceil(usd * USD_TO_PLN * 100);
}

/**
 * Record AI call to D1 ai_calls table for cost tracking + abuse detection.
 * Inserts a row with computed cost_grosze.
 */
export async function recordAiCall(
  db: D1Database,
  input: {
    client_id?: string | null;
    caller: string; // 'blog_draft' | 'lead_score' | 'meta_gen' | etc.
    model: AnthropicModel;
    response: AnthropicResponse;
    latency_ms?: number;
    request_id?: string;
    prompt_template?: string;
  },
): Promise<void> {
  const costGrosze = computeCostGrosze(
    input.model,
    input.response.usage.input_tokens,
    input.response.usage.output_tokens,
  );

  await db
    .prepare(
      `INSERT INTO ai_calls (
         client_id, caller, provider, model,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         cost_grosze, latency_ms, success, prompt_template, request_id
       ) VALUES (?, ?, 'anthropic', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      input.client_id ?? null,
      input.caller,
      input.model,
      input.response.usage.input_tokens,
      input.response.usage.output_tokens,
      input.response.usage.cache_read_input_tokens ?? null,
      input.response.usage.cache_creation_input_tokens ?? null,
      costGrosze,
      input.latency_ms ?? null,
      input.prompt_template ?? null,
      input.request_id ?? input.response.id,
    )
    .run();
}
