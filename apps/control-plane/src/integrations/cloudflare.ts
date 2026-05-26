/**
 * Cloudflare integration — deploy Worker + attach custom domain.
 *
 * Production options:
 *   A) GitHub Actions in klient repo → `wrangler deploy` (recommended, no API token in hub)
 *   B) CF API directly — POST /accounts/{id}/workers/scripts/{name}/content
 *      Requires bundling the Worker code in hub (complicated). NOT v0.1.
 *
 * For v0.1 we go with option A: hub creates GH repo + commits secrets/workflow,
 * GH Actions does the actual deploy. Hub just records "github actions triggered"
 * and waits for webhook callback (or polls).
 *
 * Dry-run: stub.
 */

import type { Env } from "../env.js";

export interface CfResult {
  ok: boolean;
  message: string;
  /** Worker name when deployed. */
  worker_name?: string;
  /** Workers.dev preview URL. */
  preview_url?: string;
}

function dryRun(env: Env): boolean {
  return (env.PROVISIONING_DRY_RUN ?? "true").toLowerCase() === "true";
}

function testMode(env: Env): boolean {
  return !dryRun(env) && (env.PROVISIONING_TEST_MODE ?? "").toLowerCase() === "true";
}

/**
 * Worker name — MUST match klient-deploy.yml derivation:
 *   REPO_NAME="{client_id}-site"
 *   SUFFIX="${REPO_NAME%-site}"  →  full client_id
 *   name="mm-starter-${SUFFIX}"  →  mm-starter-{client_id}
 *
 * Both push-triggered and workflow_dispatch (input not passed) end up at this
 * name, so hub's `cf_worker_name` matches whatever GH Actions actually deploys.
 * testMode no longer changes the name (was a stale convention pre-2026-05-26).
 */
export function workerNameFor(_env: Env, clientId: string): string {
  return `mm-starter-${clientId}`;
}

/**
 * Trigger Worker deploy.
 * v0.1 dry-run: stubs success.
 * Production: triggers `workflow_dispatch` on klient repo (which runs wrangler deploy).
 */
export async function cfDeployWorker(
  env: Env,
  params: {
    client_id: string;
    repo_owner: string;
    repo_name: string;
  },
): Promise<CfResult> {
  const workerName = workerNameFor(env, params.client_id);
  // workers.dev subdomain is your account's free subdomain, not the account ID.
  // Set CF_WORKERS_DEV_SUBDOMAIN env (e.g. "dark-limit-982e") for accurate URLs.
  const subdomain = env.CF_WORKERS_DEV_SUBDOMAIN ?? env.CF_ACCOUNT_ID ?? "ACCOUNT";
  const previewUrl = `https://${workerName}.${subdomain}.workers.dev`;

  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would trigger deploy workflow in ${params.repo_owner}/${params.repo_name} → ${workerName}`,
      worker_name: workerName,
      preview_url: previewUrl,
    };
  }
  if (!env.GITHUB_PAT) return { ok: false, message: "GITHUB_PAT missing (needed to trigger workflow_dispatch)" };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}/actions/workflows/klient-deploy.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_PAT}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "mm-control-plane",
        },
        body: JSON.stringify({ ref: "main", inputs: { worker_name: workerName } }),
      },
    );
    if (!res.ok) {
      return { ok: false, message: `GH workflow_dispatch ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true, message: "Deploy workflow triggered", worker_name: workerName, preview_url: previewUrl };
  } catch (e) {
    return { ok: false, message: `Workflow trigger failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/**
 * Track 19a — Create a KV namespace via CF API.
 * Returns the namespace ID which we then inject into klient's wrangler.toml.
 */
export async function cfCreateKvNamespace(
  env: Env,
  params: { title: string },
): Promise<{ ok: boolean; namespace_id?: string; message: string }> {
  if (dryRun(env)) {
    return { ok: true, namespace_id: `dryrun-kv-${Date.now()}`, message: `[DRY-RUN] Would create KV ${params.title}` };
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { ok: false, message: "CF_API_TOKEN / CF_ACCOUNT_ID missing" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: params.title }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      // 400 with "already exists" is OK — fetch existing ID
      if (body.includes("already exists") || body.includes("10014")) {
        const existing = await cfFindKvNamespace(env, params.title);
        if (existing) return { ok: true, namespace_id: existing, message: `Reused existing KV: ${existing}` };
      }
      return { ok: false, message: `CF KV create ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { result?: { id?: string }; success?: boolean };
    const id = json.result?.id;
    if (!id) return { ok: false, message: "CF KV create: no id in response" };
    return { ok: true, namespace_id: id, message: `KV ${params.title} created (${id})` };
  } catch (e) {
    return { ok: false, message: `CF KV create failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

async function cfFindKvNamespace(env: Env, title: string): Promise<string | null> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`,
      { headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: Array<{ id: string; title: string }> };
    const found = (json.result ?? []).find((n) => n.title === title);
    return found?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Set a Worker secret via Cloudflare API.
 * Used by Track 24h addon sync (CHATBOT_ENABLED, LEADPOP_ENABLED, etc.)
 */
export async function cfSetWorkerSecret(
  env: Env,
  params: { worker_name: string; secret_name: string; secret_value: string },
): Promise<{ ok: boolean; message: string }> {
  if (dryRun(env)) {
    return { ok: true, message: `[DRY-RUN] Would set ${params.secret_name} on ${params.worker_name}` };
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { ok: false, message: "CF_API_TOKEN / CF_ACCOUNT_ID missing" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${params.worker_name}/secrets`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.secret_name,
          text: params.secret_value,
          type: "secret_text",
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, message: `CF secret PUT ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true, message: `${params.secret_name} set` };
  } catch (e) {
    return { ok: false, message: `CF secret PUT failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/** Attach custom domain to deployed Worker. */
export async function cfAttachCustomDomain(
  env: Env,
  params: { worker_name: string; domain: string },
): Promise<CfResult> {
  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would attach ${params.domain} to ${params.worker_name}`,
    };
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return { ok: false, message: "CF_API_TOKEN / CF_ACCOUNT_ID missing" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          environment: "production",
          hostname: params.domain,
          service: params.worker_name,
          zone_id: env.CF_ZONE_ID,
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, message: `CF domains ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true, message: "Custom domain attached" };
  } catch (e) {
    return { ok: false, message: `CF attach domain failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
