import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  callAnthropic,
  computeCostGrosze,
  extractText,
  recordAiCall,
} from "../src/integrations/anthropic.js";
import { getIndustryConfig, buildTopicSystemPrompt, buildDraftSystemPrompt } from "../src/lib/blog/prompts.js";
import { generateSingleDraft, generateAiBlogDrafts, type AiBlogClient } from "../src/scheduled/ai-blog-draft.js";
import { setupTestEnv, type TestSetup } from "./helpers.js";

describe("computeCostGrosze", () => {
  it("Sonnet: 1M input + 1M output ≈ ((3+15)*4*100) grosze", () => {
    // 1M input × $3/M + 1M output × $15/M = $18 → 72 PLN → 7200 grosze
    expect(computeCostGrosze("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBe(7200);
  });

  it("Haiku much cheaper than Opus", () => {
    const haiku = computeCostGrosze("claude-haiku-4-5-20251001", 1000, 1000);
    const opus = computeCostGrosze("claude-opus-4-7", 1000, 1000);
    expect(haiku).toBeLessThan(opus);
  });

  it("zero usage = zero cost", () => {
    expect(computeCostGrosze("claude-sonnet-4-6", 0, 0)).toBe(0);
  });
});

describe("prompts library", () => {
  it("returns locksmith config for known industry", () => {
    const cfg = getIndustryConfig("locksmith");
    expect(cfg.persona).toContain("ślusarz");
    expect(cfg.topicSeeds.length).toBeGreaterThan(0);
  });

  it("falls back to 'other' for unknown industry", () => {
    const cfg = getIndustryConfig("nonexistent");
    expect(cfg.persona).toContain("właściciel");
    expect(cfg.topicSeeds.length).toBeGreaterThan(0);
  });

  it("buildTopicSystemPrompt includes business + industry + city", () => {
    const p = buildTopicSystemPrompt("locksmith", "Rzeszów", "Ślusarz Kowalski");
    expect(p).toContain("Ślusarz Kowalski");
    expect(p).toContain("Rzeszów");
    expect(p).toContain("locksmith");
    expect(p).toContain("3 propozycje");
  });

  it("buildDraftSystemPrompt includes phone CTA section", () => {
    const p = buildDraftSystemPrompt("locksmith", "Rzeszów", "Ślusarz X", "+48171234567");
    expect(p).toContain("+48171234567");
    expect(p).toContain("frontmatter");
    expect(p).toContain("published: false");
  });
});

describe("callAnthropic + extractText + recordAiCall", () => {
  it("callAnthropic sets x-api-key + anthropic-version headers", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const h = new Headers(init?.headers);
      expect(h.get("x-api-key")).toBe("sk-ant-test");
      expect(h.get("anthropic-version")).toBe("2023-06-01");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("claude-haiku-4-5-20251001");
      expect(body.max_tokens).toBe(100);
      return new Response(
        JSON.stringify({
          id: "msg_test",
          model: "claude-haiku-4-5-20251001",
          role: "assistant",
          content: [{ type: "text", text: "hi" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 2 },
        }),
        { status: 200 },
      );
    });
    const res = await callAnthropic(
      { apiKey: "sk-ant-test", fetchImpl: fetchSpy as unknown as typeof fetch },
      {
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
      },
    );
    expect(res.id).toBe("msg_test");
    expect(extractText(res)).toBe("hi");
  });

  it("recordAiCall inserts to ai_calls with computed cost", async () => {
    const setup = await setupTestEnv();
    await recordAiCall(setup.env.DB, {
      client_id: setup.clientId,
      caller: "ai_blog.topic",
      model: "claude-haiku-4-5-20251001",
      response: {
        id: "msg_x", model: "claude-haiku-4-5-20251001", role: "assistant",
        content: [{ type: "text", text: "" }], stop_reason: "end_turn",
        usage: { input_tokens: 1000, output_tokens: 500 },
      },
      latency_ms: 250,
      prompt_template: "blog_topic_v1",
    });
    const row = await setup.env.DB
      .prepare(`SELECT model, input_tokens, output_tokens, cost_grosze, caller, prompt_template FROM ai_calls WHERE client_id = ?`)
      .bind(setup.clientId).first<{ model: string; input_tokens: number; output_tokens: number; cost_grosze: number; caller: string; prompt_template: string }>();
    expect(row?.input_tokens).toBe(1000);
    expect(row?.output_tokens).toBe(500);
    expect(row?.caller).toBe("ai_blog.topic");
    expect(row?.prompt_template).toBe("blog_topic_v1");
    // Haiku: 1000×0.8 + 500×4 = 0.0008+0.002 = $0.0028 → 0.0112 PLN → 2 grosze (ceil)
    expect(row?.cost_grosze).toBeGreaterThan(0);
    expect(row?.cost_grosze).toBeLessThan(10);
  });

  it("propagates 4xx as AnthropicRequestError with type", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "bad key" } }), { status: 401 }),
    );
    await expect(
      callAnthropic({ apiKey: "x", fetchImpl: fetchSpy as unknown as typeof fetch }, {
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: "x" }],
      }),
    ).rejects.toMatchObject({ status: 401, anthropicErrorType: "invalid_request_error" });
  });
});

describe("generateSingleDraft (dry-run)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestEnv();
    setup.env.BLOG_AI_DRY_RUN = "true";
    // Add modules + github_repo_url + blog_ai addon row so client is eligible.
    // (Eligibility query checks client_addons, not modules_json — Track 24 addon system.)
    await setup.env.DB
      .prepare(`UPDATE clients SET modules_json = ?, github_repo_url = ? WHERE id = ?`)
      .bind('["care","blog_ai"]', "https://github.com/MixtureMarketing/clk_test-site", setup.clientId)
      .run();
    await setup.env.DB
      .prepare(
        `INSERT INTO client_addons (client_id, addon_slug, status, price_grosze_at_activation)
         VALUES (?, 'blog_ai', 'active', 4000)`,
      )
      .bind(setup.clientId)
      .run();
  });

  it("dry-run: logs audit event + does NOT call Anthropic/GitHub", async () => {
    const client: AiBlogClient & { primary_phone: string | null } = {
      id: setup.clientId,
      business_name: "Test Co",
      industry: "locksmith",
      city: "Rzeszów",
      primary_phone: "+48171234567",
      github_repo_url: "https://github.com/MixtureMarketing/clk_test-site",
      modules_json: '["blog_ai"]',
      last_blog_at: null,
    };
    const r = await generateSingleDraft(setup.env, client);
    expect(r.ok).toBe(true);
    expect(r.topic_title).toContain("[DRY]");
    expect(r.pr_url).toBe("[DRY-RUN]");

    const audit = await setup.env.DB
      .prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE client_id = ? AND action = 'ai_blog.draft_opened'`)
      .bind(setup.clientId).first<{ c: number }>();
    expect(audit?.c).toBe(1);
  });

  it("generateAiBlogDrafts skips klient with last_blog_at < 14 days", async () => {
    // Insert audit_log row 5 days ago so bi-weekly gate triggers skip
    await setup.env.DB
      .prepare(
        `INSERT INTO audit_log (occurred_at, actor, action, resource_type, resource_id, client_id, metadata_json)
         VALUES (datetime('now','-5 days'), 'system', 'ai_blog.draft_opened', 'client', ?, ?, ?)`,
      )
      .bind(setup.clientId, setup.clientId, JSON.stringify({ topic_title: "old" }))
      .run();

    const result = await generateAiBlogDrafts(setup.env);
    const detail = result.details.find((d) => d.client_id === setup.clientId);
    expect(detail?.ok).toBe(true);
    expect(detail?.skipped_reason).toContain("5d ago");
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("generateAiBlogDrafts ignores clients without blog_ai addon", async () => {
    // Eligibility now checks client_addons (Track 24) — remove addon to mark ineligible
    await setup.env.DB.prepare(`DELETE FROM client_addons WHERE client_id = ? AND addon_slug = 'blog_ai'`).bind(setup.clientId).run();
    await setup.env.DB.prepare(`UPDATE clients SET modules_json = '["care"]' WHERE id = ?`).bind(setup.clientId).run();
    const result = await generateAiBlogDrafts(setup.env);
    // Our test klient no longer eligible → not in details
    const detail = result.details.find((d) => d.client_id === setup.clientId);
    expect(detail).toBeUndefined();
  });
});
