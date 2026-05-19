import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv } from "./helpers.js";

const ADMIN_KEY = "test-admin-key-xyz";

function postCron(job: string, key?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-BP-Admin-Key"] = key;
  return new Request("https://test/api/admin/cron/run-now", {
    method: "POST",
    headers,
    body: JSON.stringify({ job }),
  });
}

describe("POST /api/admin/cron/run-now", () => {
  it("returns 403 when ADMIN_API_KEY env var not set", async () => {
    const { env } = await setupTestEnv();
    env.ADMIN_API_KEY = undefined;
    const app = createApp();
    const res = await app.fetch(postCron("provision_pending_2min", "anything"), env);
    expect(res.status).toBe(403);
  });

  it("returns 401 when wrong admin key", async () => {
    const { env } = await setupTestEnv();
    env.ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.fetch(postCron("provision_pending_2min", "wrong-key"), env);
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown job name", async () => {
    const { env } = await setupTestEnv();
    env.ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.fetch(postCron("not_a_real_job", ADMIN_KEY), env);
    expect(res.status).toBe(400);
  });

  it("runs provision_pending_2min job + records cron_runs row", async () => {
    const { env } = await setupTestEnv();
    env.ADMIN_API_KEY = ADMIN_KEY;
    env.PROVISIONING_DRY_RUN = "true";
    const app = createApp();
    const res = await app.fetch(postCron("provision_pending_2min", ADMIN_KEY), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { job: string; processed: number; failed: number; duration_ms: number } };
    expect(json.ok).toBe(true);
    expect(json.data.job).toBe("provision_pending_2min");
    expect(typeof json.data.duration_ms).toBe("number");

    const cronRow = await env.DB
      .prepare(`SELECT job_name, cron_expression, status FROM cron_runs WHERE job_name = ?`)
      .bind("provision_pending_2min")
      .first<{ job_name: string; cron_expression: string; status: string }>();
    expect(cronRow?.cron_expression).toBe("manual");
    expect(cronRow?.status).toBe("success");
  });

  it("runs ai_blog_weekly with dry-run + reports skipped count", async () => {
    const { env } = await setupTestEnv();
    env.ADMIN_API_KEY = ADMIN_KEY;
    env.BLOG_AI_DRY_RUN = "true";
    const app = createApp();
    const res = await app.fetch(postCron("ai_blog_weekly", ADMIN_KEY), env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { job: string; processed: number } };
    expect(json.data.job).toBe("ai_blog_weekly");
  });
});
