/**
 * Track 24f-8 — Extra subpage addon (150 zł 1×).
 *
 * Klient zamawia dodatkową niszową podstronę (np. "Awaryjne otwieranie sejfów Warszawa Mokotów").
 * Operator (lub klient sam jeśli flow autonomous) podaje tytuł + briefing.
 * Hub generuje markdown via Claude → commit do klient repo → workflow rebuild → strona live.
 *
 * POST /api/admin/extra-subpage/generate
 *   Body: { client_id, title, description, target_keyword, location?, ... }
 *   Auth: X-BP-Admin-Key.
 *
 * Effect:
 *   1. Claude generates SEO-optimized markdown content (1500-2500 words)
 *   2. Commits to apps/starter/content/posts/<slug>.md (lub /uslugi/ etc.) in klient repo
 *   3. workflow_dispatch → rebuild → page live in ~3 min
 *   4. Audit + idempotency (one extra_subpage = one charge)
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { callAnthropic, computeCostGrosze, extractText, recordAiCall } from "../../../integrations/anthropic.js";
import { cfDeployWorker } from "../../../integrations/cloudflare.js";
import { githubCommitFile } from "../../../integrations/github.js";
import { err, ok } from "../../lib/responses.js";

export const adminExtraSubpageRouter = new Hono<HonoEnv>();

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

adminExtraSubpageRouter.post("/generate", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  let body: { client_id?: string; title?: string; target_keyword?: string; description?: string; location?: string };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id || !body.title || !body.target_keyword) {
    return c.json(err("VALIDATION_ERROR", "client_id, title, target_keyword required"), 400);
  }
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(err("INTERNAL_ERROR", "ANTHROPIC_API_KEY missing"), 500);
  }
  if (!c.env.GITHUB_PAT) {
    return c.json(err("INTERNAL_ERROR", "GITHUB_PAT missing"), 500);
  }

  // Verify klient has active extra_subpage addon
  const addon = await c.env.DB
    .prepare(
      `SELECT id FROM client_addons WHERE client_id = ? AND addon_slug = 'extra_subpage' AND status IN ('trial','active') ORDER BY id DESC LIMIT 1`,
    )
    .bind(body.client_id)
    .first<{ id: number }>();
  if (!addon) {
    return c.json(err("VALIDATION_ERROR", "Klient nie ma aktywnego dodatku extra_subpage"), 422);
  }

  const klient = await c.env.DB
    .prepare(`SELECT id, business_name, industry, city, github_repo_url FROM clients WHERE id = ? LIMIT 1`)
    .bind(body.client_id)
    .first<{ id: string; business_name: string; industry: string; city: string; github_repo_url: string | null }>();
  if (!klient?.github_repo_url) {
    return c.json(err("NOT_FOUND", "Klient nie ma github_repo_url"), 404);
  }

  // Generate content via Claude Sonnet
  const systemPrompt = `Jesteś copywriterem SEO. Tworzysz dla firmy "${klient.business_name}" (branża: ${klient.industry}, miasto: ${klient.city}) niszową podstronę optimised pod target keyword.

ZASADY:
- 1500-2000 słów, czysto po polsku
- Markdown z H2/H3, paragrafy max 3 zdania, bullet lists
- Frontmatter: title, description (160 znaków), date (dzisiejsza), tags
- Hook w pierwszym akapicie + clear CTA na końcu
- Lokalne sygnały: nazwij miasto + dzielnice, NAP, godziny
- Zero zmyślania — używaj tylko informacji które masz w briefingu
- Nie używaj słów "Po pierwsze", "Po drugie" — naturalny język`;

  const userPrompt = `Tytuł podstrony: ${body.title}
Target keyword: ${body.target_keyword}
${body.location ? `Lokalizacja: ${body.location}` : ""}
${body.description ? `Briefing klienta: ${body.description}` : ""}

Wygeneruj pełną podstronę w markdown z frontmatter. Output TYLKO markdown, bez "Oto twoja podstrona:" preambuły.`;

  let claudeResponse;
  const startMs = Date.now();
  try {
    claudeResponse = await callAnthropic(
      { apiKey: c.env.ANTHROPIC_API_KEY },
      {
        model: "claude-sonnet-4-6",
        maxTokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
    );
  } catch (e) {
    return c.json(err("INTERNAL_ERROR", `Anthropic call failed: ${e instanceof Error ? e.message : "unknown"}`), 502);
  }

  const markdown = extractText(claudeResponse);
  if (!markdown || markdown.length < 500) {
    return c.json(err("INTERNAL_ERROR", "Generated content too short"), 502);
  }

  // Record AI cost
  const cost = computeCostGrosze(
    "claude-sonnet-4-6",
    claudeResponse.usage?.input_tokens ?? 0,
    claudeResponse.usage?.output_tokens ?? 0,
  );
  await recordAiCall(c.env.DB, {
    client_id: body.client_id,
    caller: "extra_subpage",
    model: "claude-sonnet-4-6",
    response: claudeResponse,
    latency_ms: Date.now() - startMs,
  });

  // Commit to klient repo
  const slug = slugify(body.title);
  const filePath = `apps/starter/content/posts/${new Date().toISOString().slice(0, 10)}-${slug}.md`;
  const match = klient.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return c.json(err("VALIDATION_ERROR", "Invalid github_repo_url"), 422);

  const commitResult = await githubCommitFile(c.env, {
    repo_owner: match[1]!,
    repo_name: match[2]!,
    path: filePath,
    content: markdown,
    message: `feat: extra subpage — ${body.title}`,
  });
  if (!commitResult.ok) {
    return c.json(err("INTERNAL_ERROR", `GH commit failed: ${commitResult.message}`), 502);
  }

  // Trigger rebuild
  await cfDeployWorker(c.env, {
    client_id: body.client_id,
    repo_owner: match[1]!,
    repo_name: match[2]!,
  });

  // Audit
  await c.env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('admin', 'extra_subpage.generated', 'content', ?, ?, 'info', ?)`,
    )
    .bind(filePath, body.client_id, JSON.stringify({ title: body.title, target_keyword: body.target_keyword, cost_grosze: cost, words: markdown.split(/\s+/).length }))
    .run();

  return c.json(
    ok({
      file_path: filePath,
      slug,
      cost_grosze: cost,
      words: markdown.split(/\s+/).length,
      commit_sha: commitResult.commit_sha,
      rebuild_triggered: true,
    }),
    200,
  );
});
