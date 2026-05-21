/**
 * AI blog draft generation — Track 8.
 *
 * Cron: 0 8 * * 1 (każdy poniedziałek 8:00 — bi-weekly per klient via lastRunAt check).
 *
 * Per klient with `modules_json` containing "blog_ai":
 *   1. Check lastRunAt > 14 days ago (or never)
 *   2. Claude Haiku → generate 3 topic candidates (cheap call)
 *   3. Pick best topic (highest "value score" — simple heuristic)
 *   4. Claude Sonnet → generate full markdown draft (frontmatter + body)
 *   5. GitHub: branch ai-blog/<slug>-<timestamp> → commit content/posts/<slug>.md → open PR
 *   6. Log everything to ai_calls + audit_log
 *
 * Klient widzi PR w panelu klienta (/blog/propozycje — TBD v0.2). Może też dostać email
 * z linkiem do PR. v0.1: PR jest open, klient ręcznie review + merge w GH UI.
 *
 * Dry-run: ANTHROPIC_API_KEY missing OR BLOG_AI_DRY_RUN=true → skips API calls,
 * inserts placeholder ai_calls + audit_log entry.
 */

import type { Env } from "../env.js";
import {
  callAnthropic,
  computeCostGrosze,
  extractText,
  recordAiCall,
  type AnthropicModel,
  type AnthropicResponse,
} from "../integrations/anthropic.js";
import { githubOpenPullRequest } from "../integrations/github.js";
import {
  buildDraftSystemPrompt,
  buildTopicSystemPrompt,
} from "../lib/blog/prompts.js";

const BIWEEKLY_DAYS = 14;
const POST_BASE_PATH = "apps/starter/content/posts";

export interface AiBlogClient {
  id: string;
  business_name: string;
  industry: string;
  city: string;
  primary_phone: string;
  github_repo_url: string | null;
  modules_json: string;
  last_blog_at: string | null; // ISO from clients table (we add a virtual via JOIN with audit_log)
}

export interface DraftResult {
  client_id: string;
  ok: boolean;
  topic_title?: string;
  pr_url?: string;
  error?: string;
  skipped_reason?: string;
}

export interface OrchestratorResult {
  processed: number;
  successful: number;
  skipped: number;
  failed: number;
  details: DraftResult[];
}

function dryRun(env: Env): boolean {
  return !env.ANTHROPIC_API_KEY || (env.BLOG_AI_DRY_RUN ?? "false").toLowerCase() === "true";
}

/** Cron entry: scan clients with blog_ai module, run drafts for eligible ones. */
export async function generateAiBlogDrafts(env: Env): Promise<OrchestratorResult> {
  const candidates = await env.DB
    .prepare(
      `SELECT c.id, c.business_name, c.industry, c.city, c.modules_json, c.github_repo_url,
              (SELECT cc.contact_phone_enc FROM client_contacts cc WHERE cc.client_id = c.id LIMIT 1) AS primary_phone,
              (SELECT MAX(occurred_at) FROM audit_log
                WHERE client_id = c.id AND action = 'ai_blog.draft_opened') AS last_blog_at
         FROM clients c
        WHERE c.status = 'active'
          AND c.github_repo_url IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM client_addons ca
             WHERE ca.client_id = c.id
               AND ca.addon_slug = 'blog_ai'
               AND ca.status IN ('trial', 'active')
          )`,
    )
    .all<AiBlogClient & { primary_phone: string | null }>();

  const list = candidates.results ?? [];
  const result: OrchestratorResult = { processed: 0, successful: 0, skipped: 0, failed: 0, details: [] };

  for (const client of list) {
    result.processed++;
    // Bi-weekly check
    if (client.last_blog_at) {
      const lastDate = new Date(client.last_blog_at);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < BIWEEKLY_DAYS) {
        result.skipped++;
        result.details.push({
          client_id: client.id,
          ok: true,
          skipped_reason: `last draft ${Math.floor(daysSince)}d ago — wait ${BIWEEKLY_DAYS - Math.floor(daysSince)}d more`,
        });
        continue;
      }
    }

    const draftResult = await generateSingleDraft(env, client);
    result.details.push(draftResult);
    if (draftResult.ok && !draftResult.skipped_reason) result.successful++;
    else if (!draftResult.ok) result.failed++;
  }

  return result;
}

/**
 * Generate one draft for one klient. Exported for admin "Run now" + tests.
 */
export async function generateSingleDraft(env: Env, client: AiBlogClient & { primary_phone: string | null }): Promise<DraftResult> {
  const phoneRaw = client.primary_phone?.startsWith("dev:") ? client.primary_phone.slice(4) : client.primary_phone ?? "";

  // Existing post slugs to avoid duplication
  const existing = await env.DB
    .prepare(
      `SELECT metadata_json FROM audit_log
        WHERE client_id = ? AND action = 'ai_blog.draft_opened'
        ORDER BY occurred_at DESC LIMIT 20`,
    )
    .bind(client.id)
    .all<{ metadata_json: string }>();
  const existingTitles: string[] = [];
  for (const row of existing.results ?? []) {
    try {
      const meta = JSON.parse(row.metadata_json) as { topic_title?: string };
      if (meta.topic_title) existingTitles.push(meta.topic_title);
    } catch { /* ignore */ }
  }

  // ---------- Dry-run ----------
  if (dryRun(env)) {
    const fakeTitle = `[DRY] Demo topic dla ${client.industry} ${new Date().toISOString().slice(0, 10)}`;
    const fakeSlug = slugify(fakeTitle);
    await logAuditEvent(env, client.id, "ai_blog.draft_opened", {
      topic_title: fakeTitle,
      slug: fakeSlug,
      pr_url: "[DRY-RUN]",
      dry_run: true,
    });
    return { client_id: client.id, ok: true, topic_title: fakeTitle, pr_url: "[DRY-RUN]" };
  }

  // ---------- Step 1: topic generation (Haiku — cheap) ----------
  let topicTitle: string;
  try {
    topicTitle = await generateTopic(env, client, existingTitles);
  } catch (e) {
    return { client_id: client.id, ok: false, error: `topic gen failed: ${e instanceof Error ? e.message : "unknown"}` };
  }

  // ---------- Step 2: full draft (Sonnet) ----------
  let markdown: string;
  try {
    markdown = await generateDraft(env, client, phoneRaw, topicTitle);
  } catch (e) {
    return { client_id: client.id, ok: false, topic_title: topicTitle, error: `draft gen failed: ${e instanceof Error ? e.message : "unknown"}` };
  }

  // ---------- Step 3: GitHub PR ----------
  const repoMatch = client.github_repo_url?.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!repoMatch) {
    return { client_id: client.id, ok: false, topic_title: topicTitle, error: "invalid github_repo_url" };
  }
  const repoOwner = repoMatch[1]!;
  const repoName = repoMatch[2]!;
  const slug = slugify(topicTitle);
  const today = new Date().toISOString().slice(0, 10);
  const branchName = `ai-blog/${today}-${slug.slice(0, 30)}`;
  const filePath = `${POST_BASE_PATH}/${today}-${slug}.md`;

  const prResult = await githubOpenPullRequest(env, {
    repo_owner: repoOwner,
    repo_name: repoName,
    base_branch: "main",
    new_branch: branchName,
    file_path: filePath,
    file_content: markdown,
    commit_message: `chore: AI blog draft — ${topicTitle}`,
    pr_title: `AI blog draft: ${topicTitle}`,
    pr_body: [
      "## Wygenerowany draft blogowy",
      "",
      `**Temat:** ${topicTitle}`,
      `**Branża:** ${client.industry}`,
      `**Miasto:** ${client.city}`,
      "",
      "## Co dalej",
      "",
      "1. Przeczytaj draft + edytuj jeśli coś wymaga korekty (factual claims, ton)",
      "2. Zmień `published: false` → `published: true` w frontmatter",
      "3. Merge PR — Cloudflare Pages zdeploy stronę automatycznie",
      "",
      `_Wygenerowane przez MixtureMarketing AI Blog (Claude Sonnet 4.6)._`,
    ].join("\n"),
  });

  if (!prResult.ok) {
    return { client_id: client.id, ok: false, topic_title: topicTitle, error: `PR failed: ${prResult.message}` };
  }

  await logAuditEvent(env, client.id, "ai_blog.draft_opened", {
    topic_title: topicTitle,
    slug,
    pr_number: prResult.pr_number,
    pr_url: prResult.pr_url,
    file_path: filePath,
  });

  return { client_id: client.id, ok: true, topic_title: topicTitle, ...(prResult.pr_url && { pr_url: prResult.pr_url }) };
}

// ---------------------------------------------------------------------------
// Sub-steps
// ---------------------------------------------------------------------------

async function generateTopic(env: Env, client: AiBlogClient, existingTitles: string[]): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  const system = buildTopicSystemPrompt(client.industry, client.city, client.business_name);
  const userMsg = existingTitles.length > 0
    ? `Już opublikowane tematy (nie powielaj):\n${existingTitles.map((t) => `- ${t}`).join("\n")}\n\nWygeneruj 3 propozycje.`
    : `Wygeneruj 3 propozycje. Klient nie ma jeszcze żadnych artykułów.`;

  const model: AnthropicModel = "claude-haiku-4-5-20251001";
  const t0 = Date.now();
  const res = await callAnthropic({ apiKey: env.ANTHROPIC_API_KEY }, {
    model,
    system,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 700,
    temperature: 0.8,
  });
  const latency = Date.now() - t0;

  await recordAiCall(env.DB, {
    client_id: client.id,
    caller: "ai_blog.topic",
    model,
    response: res,
    latency_ms: latency,
    prompt_template: "blog_topic_v1",
  });

  // Parse first topic from response. Format: "1. <Tytuł>\n   Angle: ...\n   Search intent: ..."
  const text = extractText(res);
  const match = text.match(/1\.\s*([^\n]+)/);
  if (!match || !match[1]) throw new Error("could not parse topic from response");
  return match[1].replace(/^[*"]+|[*"]+$/g, "").trim();
}

async function generateDraft(env: Env, client: AiBlogClient, phone: string, topicTitle: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  const system = buildDraftSystemPrompt(client.industry, client.city, client.business_name, phone);

  const model: AnthropicModel = "claude-sonnet-4-6";
  const t0 = Date.now();
  const res = await callAnthropic({ apiKey: env.ANTHROPIC_API_KEY }, {
    model,
    system,
    messages: [{ role: "user", content: `Tytuł: ${topicTitle}\n\nNapisz kompletny artykuł 500-800 słów w formacie markdown z frontmatter (jak w instrukcji).` }],
    maxTokens: 3000,
    temperature: 0.7,
  });
  const latency = Date.now() - t0;

  await recordAiCall(env.DB, {
    client_id: client.id,
    caller: "ai_blog.draft",
    model,
    response: res,
    latency_ms: latency,
    prompt_template: "blog_draft_v1",
  });

  const md = extractText(res).trim();
  // Strip code fence if Claude added one (mimo instrukcji)
  return md.replace(/^```(?:markdown|md)?\n?/, "").replace(/\n?```$/, "").trim();
}

async function logAuditEvent(env: Env, clientId: string, action: string, meta: Record<string, unknown>): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system', ?, 'client', ?, ?, 'info', ?)`,
    )
    .bind(action, clientId, clientId, JSON.stringify(meta))
    .run();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Helper for tests/dev — computes cost without making API call. */
export { computeCostGrosze };
