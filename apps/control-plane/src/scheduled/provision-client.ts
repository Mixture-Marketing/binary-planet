/**
 * Provisioning orchestrator — Track 4.
 *
 * Picks up rows from `client_provisioning_configs` where provisioning_status='pending'
 * (or 'failed' for retry) and walks them through 5 steps:
 *
 *   1. ovh_register_domain     — reserve klient domain (or skip if klient owns existing)
 *   2. ovh_configure_dns       — CNAME → CF Workers
 *   3. github_create_repo      — generate repo from binary-planet template
 *   4. github_commit_config    — push apps/starter/src/client.config.ts
 *   5. cf_deploy_worker        — trigger GH Actions workflow → wrangler deploy
 *      (custom domain attach is part of wrangler deploy or follow-up cron)
 *
 * Each step result is appended to steps_json. On any error, provisioning_status='failed'
 * with the error message. Cron picks up failed rows for retry (max 3 attempts before
 * giving up — surfaced as alert).
 *
 * Default: PROVISIONING_DRY_RUN=true → no real API calls, but full DB lifecycle.
 */

import { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";
import {
  cfAttachCustomDomain,
  cfDeployWorker,
} from "../integrations/cloudflare.js";
import {
  githubCommitFile,
  githubCreateClientRepo,
} from "../integrations/github.js";
import { ovhConfigureDns, ovhRegisterDomain } from "../integrations/ovh.js";

export interface ProvisioningStep {
  step: string;
  ok: boolean;
  ts: string;
  message: string;
  dry_run?: boolean;
  extra?: Record<string, unknown>;
}

export interface ProvisioningRow {
  client_id: string;
  business_name: string;
  primary_domain: string | null;
  config_json: string;
  provisioning_status: string;
  steps_json: string;
}

export interface ProvisioningResult {
  client_id: string;
  ok: boolean;
  steps: ProvisioningStep[];
  error?: string;
}

const MAX_QUEUE_PER_RUN = 5;

function isDryRun(env: Env): boolean {
  return (env.PROVISIONING_DRY_RUN ?? "true").toLowerCase() === "true";
}

/** Cron entry: pick up to N pending rows and walk each. */
export async function provisionPending(env: Env, log: Logger): Promise<{ processed: number; failed: number }> {
  const rows = await env.DB
    .prepare(
      `SELECT p.client_id, c.business_name, c.primary_domain, p.config_json,
              p.provisioning_status, p.steps_json
         FROM client_provisioning_configs p
         JOIN clients c ON c.id = p.client_id
        WHERE p.provisioning_status = 'pending'
        ORDER BY p.generated_at ASC
        LIMIT ?`,
    )
    .bind(MAX_QUEUE_PER_RUN)
    .all<ProvisioningRow>();

  const list = rows.results ?? [];
  let processed = 0;
  let failed = 0;

  for (const row of list) {
    const result = await provisionOne(env, log, row);
    processed++;
    if (!result.ok) failed++;
  }

  return { processed, failed };
}

/** Walk a single config through all steps. Persists steps_json + final status. */
export async function provisionOne(
  env: Env,
  log: Logger,
  row: ProvisioningRow,
): Promise<ProvisioningResult> {
  const steps: ProvisioningStep[] = [];
  const dryRun = isDryRun(env);
  log.info("provision.start", { client_id: row.client_id, dry_run: dryRun });

  // Mark running
  await env.DB
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = 'running',
              provisioning_started_at = datetime('now')
        WHERE client_id = ?`,
    )
    .bind(row.client_id)
    .run();

  let finalStatus: "done" | "failed" = "done";
  let errorMsg: string | undefined;

  try {
    const config = JSON.parse(row.config_json) as Record<string, unknown>;
    const business = (config["business"] as { name?: string } | undefined) ?? {};
    const domain = (config["domain"] as { primary?: string } | undefined)?.primary ?? row.primary_domain ?? "";
    if (!domain) throw new Error("missing primary_domain in config");

    // ---- Step 1: OVH register domain ----
    {
      const r = await ovhRegisterDomain(env, { domain, client_id: row.client_id });
      steps.push(stepResult("ovh_register_domain", r.ok, r.message, dryRun, { order_id: r.order_id }));
      if (!r.ok) throw new Error(`ovh_register_domain: ${r.message}`);
    }

    // ---- Step 2: OVH configure DNS ----
    const cnameTarget = `mm-starter-${row.client_id.replace(/^clk_/, "")}.workers.dev`;
    {
      const r = await ovhConfigureDns(env, { domain, cname_target: cnameTarget });
      steps.push(stepResult("ovh_configure_dns", r.ok, r.message, dryRun, { cname_target: cnameTarget }));
      if (!r.ok) throw new Error(`ovh_configure_dns: ${r.message}`);
    }

    // ---- Step 3: GitHub create repo ----
    const orgRepo = githubRepoFromEnv(env, row.client_id);
    {
      const r = await githubCreateClientRepo(env, {
        client_id: row.client_id,
        description: `MixtureMarketing site for ${business.name ?? row.business_name}`,
      });
      steps.push(stepResult("github_create_repo", r.ok, r.message, dryRun, { repo_url: r.repo_url }));
      if (!r.ok) throw new Error(`github_create_repo: ${r.message}`);
    }

    // ---- Step 4: GitHub commit client.config.ts ----
    const tsContent = wrapConfigAsTs(row.config_json);
    {
      const r = await githubCommitFile(env, {
        repo_owner: orgRepo.owner,
        repo_name: orgRepo.name,
        path: "apps/starter/src/client.config.ts",
        content: tsContent,
        message: `chore: initial client.config.ts for ${row.client_id}`,
      });
      steps.push(stepResult("github_commit_config", r.ok, r.message, dryRun, { commit_sha: r.commit_sha }));
      if (!r.ok) throw new Error(`github_commit_config: ${r.message}`);
    }

    // ---- Step 5: CF deploy worker ----
    let workerName: string | undefined;
    {
      const r = await cfDeployWorker(env, {
        client_id: row.client_id,
        repo_owner: orgRepo.owner,
        repo_name: orgRepo.name,
      });
      workerName = r.worker_name;
      steps.push(stepResult("cf_deploy_worker", r.ok, r.message, dryRun, {
        worker_name: r.worker_name,
        preview_url: r.preview_url,
      }));
      if (!r.ok) throw new Error(`cf_deploy_worker: ${r.message}`);
    }

    // ---- Step 6 (combined): attach custom domain ----
    if (workerName) {
      const r = await cfAttachCustomDomain(env, { worker_name: workerName, domain });
      steps.push(stepResult("cf_attach_domain", r.ok, r.message, dryRun));
      // Non-fatal if attach fails in dry-run/prod — strona działa na preview URL.
      if (!r.ok && !dryRun) log.warn("provision.attach_domain_failed", { client_id: row.client_id, message: r.message });
    }

    // ---- Update clients row → active ----
    await env.DB
      .prepare(
        `UPDATE clients
            SET status = 'active',
                activated_at = COALESCE(activated_at, datetime('now')),
                github_repo_url = ?,
                cf_worker_name = ?
          WHERE id = ?`,
      )
      .bind(`https://github.com/${orgRepo.owner}/${orgRepo.name}`, workerName ?? null, row.client_id)
      .run();
  } catch (e) {
    finalStatus = "failed";
    errorMsg = e instanceof Error ? e.message : "unknown";
    log.error("provision.failed", e instanceof Error ? e : new Error(String(e)), { client_id: row.client_id });
  }

  await env.DB
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = ?,
              provisioning_finished_at = datetime('now'),
              provisioning_error = ?,
              steps_json = ?
        WHERE client_id = ?`,
    )
    .bind(finalStatus, errorMsg ?? null, JSON.stringify(steps), row.client_id)
    .run();

  log.info("provision.end", { client_id: row.client_id, status: finalStatus, steps: steps.length });
  return { client_id: row.client_id, ok: finalStatus === "done", steps, ...(errorMsg && { error: errorMsg }) };
}

function stepResult(
  step: string,
  ok: boolean,
  message: string,
  dryRun: boolean,
  extra?: Record<string, unknown>,
): ProvisioningStep {
  const filtered = extra ? Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) : undefined;
  return {
    step,
    ok,
    ts: new Date().toISOString(),
    message,
    ...(dryRun && { dry_run: true }),
    ...(filtered && Object.keys(filtered).length > 0 && { extra: filtered }),
  };
}

function githubRepoFromEnv(env: Env, clientId: string): { owner: string; name: string } {
  return {
    owner: env.GITHUB_ORG ?? "MixtureMarketing",
    name: `${clientId}-site`,
  };
}

function wrapConfigAsTs(configJson: string): string {
  let pretty = configJson;
  try {
    pretty = JSON.stringify(JSON.parse(configJson), null, 2);
  } catch {
    // fall through with original
  }
  return `import { validateClientConfig, type ClientConfig } from "./client.config.schema.js";

const config: ClientConfig = ${pretty} as ClientConfig;

export default validateClientConfig(config);
`;
}
