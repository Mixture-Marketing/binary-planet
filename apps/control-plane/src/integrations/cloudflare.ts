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
  const workerName = `mm-starter-${params.client_id.replace(/^clk_/, "")}`;
  const previewUrl = `https://${workerName}.${env.CF_ACCOUNT_ID ?? "ACCOUNT_ID"}.workers.dev`;

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
      `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}/actions/workflows/deploy.yml/dispatches`,
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
