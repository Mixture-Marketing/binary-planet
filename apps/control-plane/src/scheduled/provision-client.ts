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
  cfCreateKvNamespace,
  cfDeployWorker,
} from "../integrations/cloudflare.js";
import {
  githubCommitFile,
  githubCreateClientRepo,
  githubForceWorkflowIndex,
} from "../integrations/github.js";
import { ovhCheckDomainAvailability, ovhConfigureDns, ovhGetOrder, ovhRegisterDomain } from "../integrations/ovh.js";

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

function isTestMode(env: Env): boolean {
  return !isDryRun(env) && (env.PROVISIONING_TEST_MODE ?? "").toLowerCase() === "true";
}

/** Cron entry: pick up to N pending rows and walk each. */
export async function provisionPending(env: Env, log: Logger): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  // Phase 1 — handle waiting_domain rows (Track 19b multi-tick OVH order polling)
  const waiting = await env.DB
    .prepare(
      `SELECT p.client_id, p.pending_order_id, p.pending_order_first_seen_at, p.steps_json,
              c.primary_domain
         FROM client_provisioning_configs p
         JOIN clients c ON c.id = p.client_id
        WHERE p.provisioning_status = 'waiting_domain'
          AND p.pending_order_id IS NOT NULL
        ORDER BY p.pending_order_first_seen_at ASC
        LIMIT ?`,
    )
    .bind(MAX_QUEUE_PER_RUN)
    .all<{
      client_id: string;
      pending_order_id: string;
      pending_order_first_seen_at: string | null;
      steps_json: string;
      primary_domain: string | null;
    }>();

  for (const wRow of waiting.results ?? []) {
    processed++;
    const result = await pollWaitingOrder(env, log, wRow);
    if (!result.ok) failed++;
  }

  // Phase 2 — fresh pending rows
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

  for (const row of rows.results ?? []) {
    const result = await provisionOne(env, log, row);
    processed++;
    if (!result.ok) failed++;
  }

  return { processed, failed };
}

/**
 * Track 19b — poll OVH order status. Called from cron when client is in 'waiting_domain' state.
 *
 * Outcomes:
 *   - order delivered → flip status='pending' so next tick resumes provisioning from step 2 (DNS)
 *   - cancelled / notPaid → status='failed' + audit alert
 *   - timeout (>48h) → status='failed' + alert
 *   - still in-flight → leave row as-is, log info
 */
async function pollWaitingOrder(
  env: Env,
  log: Logger,
  row: { client_id: string; pending_order_id: string; pending_order_first_seen_at: string | null; steps_json: string; primary_domain: string | null },
): Promise<{ ok: boolean }> {
  const order = await ovhGetOrder(env, row.pending_order_id);
  log.info("provision.poll_order", { client_id: row.client_id, order_id: row.pending_order_id, status: order.status });

  // Append a step entry
  const steps: ProvisioningStep[] = parseSteps(row.steps_json);
  steps.push({
    step: "ovh_order_poll",
    ok: !["cancelled", "notPaid"].includes(order.status),
    ts: new Date().toISOString(),
    message: `Order ${row.pending_order_id}: ${order.status} — ${order.message}`,
  });

  if (order.status === "delivered") {
    // Order delivered — resume provisioning from step 2 next tick
    await env.DB
      .prepare(
        `UPDATE client_provisioning_configs
            SET provisioning_status = 'pending',
                pending_order_id = NULL,
                pending_order_first_seen_at = NULL,
                steps_json = ?
          WHERE client_id = ?`,
      )
      .bind(JSON.stringify(steps), row.client_id)
      .run();
    return { ok: true };
  }

  if (order.status === "cancelled" || order.status === "notPaid") {
    await env.DB
      .prepare(
        `UPDATE client_provisioning_configs
            SET provisioning_status = 'failed',
                provisioning_finished_at = datetime('now'),
                provisioning_error = ?,
                steps_json = ?
          WHERE client_id = ?`,
      )
      .bind(`OVH order ${row.pending_order_id} ${order.status}: ${order.message}`, JSON.stringify(steps), row.client_id)
      .run();
    return { ok: false };
  }

  // Timeout check (48h)
  const firstSeen = row.pending_order_first_seen_at ? new Date(row.pending_order_first_seen_at).getTime() : Date.now();
  if (Date.now() - firstSeen > 48 * 3600 * 1000) {
    await env.DB
      .prepare(
        `UPDATE client_provisioning_configs
            SET provisioning_status = 'failed',
                provisioning_finished_at = datetime('now'),
                provisioning_error = 'OVH order timeout (>48h waiting for delivery)',
                steps_json = ?
          WHERE client_id = ?`,
      )
      .bind(JSON.stringify(steps), row.client_id)
      .run();
    log.error("provision.order_timeout", new Error("OVH order timeout"), { client_id: row.client_id, order_id: row.pending_order_id });
    return { ok: false };
  }

  // Still in-flight — just update steps
  await env.DB
    .prepare(`UPDATE client_provisioning_configs SET steps_json = ? WHERE client_id = ?`)
    .bind(JSON.stringify(steps), row.client_id)
    .run();
  return { ok: true };
}

function parseSteps(json: string): ProvisioningStep[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as ProvisioningStep[];
  } catch { /* empty */ }
  return [];
}

/** Walk a single config through all steps. Persists steps_json + final status. */
export async function provisionOne(
  env: Env,
  log: Logger,
  row: ProvisioningRow,
): Promise<ProvisioningResult> {
  const steps: ProvisioningStep[] = [];
  const dryRun = isDryRun(env);
  const testMode = isTestMode(env);
  log.info("provision.start", { client_id: row.client_id, dry_run: dryRun, test_mode: testMode });

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
    const domainCfg = (config["domain"] as { primary?: string; source?: string } | undefined);
    const domainSource = domainCfg?.source ?? "register";
    const isPreviewMode = domainSource === "preview";
    const domain = domainCfg?.primary ?? row.primary_domain ?? "";
    // Preview mode bypasses OVH entirely — klient gets workers.dev URL only.
    if (!isPreviewMode && !domain) throw new Error("missing primary_domain in config (and not preview mode)");

    // ---- Step 1: OVH register domain (or availability probe in TEST_MODE) ----
    if (isPreviewMode) {
      steps.push(stepResult("ovh_register_domain", true, "[PREVIEW] Klient chose workers.dev preview — skipping OVH", false, { skipped: true, mode: "preview" }));
    } else if (testMode) {
      const r = await ovhCheckDomainAvailability(env, { domain });
      steps.push(stepResult("ovh_check_availability", r.ok, r.message, false, {
        orderable: r.orderable,
        ...(r.price_first_year && { price_first_year: r.price_first_year }),
        ...(r.price_renew && { price_renew: r.price_renew }),
        ...(r.phase && { phase: r.phase }),
        test_mode: true,
      }));
      if (!r.ok) throw new Error(`ovh_check_availability: ${r.message}`);
    } else {
      // Skip if config_json says client already owns the domain (domain_source: "owned").
      if (domainSource === "owned") {
        steps.push(stepResult("ovh_register_domain", true, "[SKIPPED] Klient owns the domain — DNS will be configured manually", false, { skipped: true }));
      } else {
        const r = await ovhRegisterDomain(env, { domain, client_id: row.client_id });
        steps.push(stepResult("ovh_register_domain", r.ok, r.message, dryRun, { order_id: r.order_id }));
        if (!r.ok) throw new Error(`ovh_register_domain: ${r.message}`);

        // PROD MODE: parking until OVH delivers the order (5-60 min, sometimes 24h)
        if (r.order_id && !r.order_id.startsWith("dryrun")) {
          await env.DB
            .prepare(
              `UPDATE client_provisioning_configs
                  SET provisioning_status = 'waiting_domain',
                      pending_order_id = ?,
                      pending_order_first_seen_at = datetime('now'),
                      steps_json = ?
                WHERE client_id = ?`,
            )
            .bind(r.order_id, JSON.stringify(steps), row.client_id)
            .run();
          log.info("provision.parked_for_domain", { client_id: row.client_id, order_id: r.order_id });
          return { client_id: row.client_id, ok: true, steps };
        }
      }
    }

    // ---- Step 2: OVH configure DNS (skipped in TEST_MODE, preview, or owned) ----
    const cnameTarget = `mm-starter-${row.client_id.replace(/^clk_/, "")}.workers.dev`;
    if (isPreviewMode) {
      steps.push(stepResult("ovh_configure_dns", true, "[PREVIEW] No custom domain — DNS not needed", false, { skipped: true, mode: "preview" }));
    } else if (testMode) {
      steps.push(stepResult("ovh_configure_dns", true, "[TEST_MODE] Skipped DNS — domain not purchased", false, { skipped: true }));
    } else if (domainSource === "owned") {
      steps.push(stepResult("ovh_configure_dns", true, "[SKIPPED] Klient owns domain — must configure DNS manually", false, { skipped: true, cname_target: cnameTarget }));
    } else {
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

    // ---- Step 4a: patch Sveltia config.yml with per-klient repo + URL ----
    {
      // Resolve site URL: custom domain in prod, workers.dev preview in test mode
      const workerSlug = row.client_id.replace(/^clk_/, "").replace(/_/g, "-").slice(0, 40);
      const subdomain = env.CF_WORKERS_DEV_SUBDOMAIN ?? "ACCOUNT";
      const siteUrl = testMode
        ? `https://mm-test-${workerSlug}.${subdomain}.workers.dev`
        : `https://${domain}`;

      const sveltiaConfig = await fetchAndPatchSveltiaConfig(env, {
        repo_owner: orgRepo.owner,
        repo_name: orgRepo.name,
        site_url: siteUrl,
      });
      if (sveltiaConfig) {
        const r = await githubCommitFile(env, {
          repo_owner: orgRepo.owner,
          repo_name: orgRepo.name,
          path: "apps/starter/public/admin/config.yml",
          content: sveltiaConfig,
          message: `chore: configure Sveltia for ${row.client_id}`,
        });
        steps.push(stepResult("github_commit_sveltia_config", r.ok, r.message, dryRun, { commit_sha: r.commit_sha }));
      } else {
        steps.push(stepResult("github_commit_sveltia_config", false, "Failed to fetch/patch admin/config.yml", dryRun));
      }
    }

    // ---- Step 4c: Track 19a — provision KV namespaces (forms rate limit + fallback queue) ----
    const workerSlugLocal = row.client_id.replace(/^clk_/, "").replace(/_/g, "-").slice(0, 40);
    const kvPrefix = testMode ? `mm-test-${workerSlugLocal}` : `mm-${workerSlugLocal}`;
    {
      const rateRes = await cfCreateKvNamespace(env, { title: `${kvPrefix}-rate-limit` });
      steps.push(stepResult("cf_kv_rate_limit", rateRes.ok, rateRes.message, dryRun, { namespace_id: rateRes.namespace_id }));

      const fbqRes = await cfCreateKvNamespace(env, { title: `${kvPrefix}-fallback-queue` });
      steps.push(stepResult("cf_kv_fallback_queue", fbqRes.ok, fbqRes.message, dryRun, { namespace_id: fbqRes.namespace_id }));

      // Patch klient repo's wrangler.toml with KV IDs
      if (rateRes.ok && fbqRes.ok && rateRes.namespace_id && fbqRes.namespace_id) {
        const wranglerToml = await fetchWranglerToml(env, orgRepo.owner, orgRepo.name);
        if (wranglerToml) {
          const patched = patchWranglerKv(wranglerToml, {
            rate_limit_id: rateRes.namespace_id,
            fallback_queue_id: fbqRes.namespace_id,
          });
          const r = await githubCommitFile(env, {
            repo_owner: orgRepo.owner,
            repo_name: orgRepo.name,
            path: "apps/starter/wrangler.toml",
            content: patched,
            message: `chore: provision KV namespaces for ${row.client_id}`,
          });
          steps.push(stepResult("github_commit_wrangler_kv", r.ok, r.message, dryRun, { commit_sha: r.commit_sha }));
        }
      }
    }

    // ---- Step 4b: force workflow indexing (GH /generate doesn't auto-register workflows) ----
    {
      const r = await githubForceWorkflowIndex(env, {
        repo_owner: orgRepo.owner,
        repo_name: orgRepo.name,
        workflow_filename: "klient-deploy.yml",
      });
      steps.push(stepResult("github_force_workflow_index", r.ok, r.message, dryRun));
      // Non-fatal — if touch fails, dispatch may still work on a second cron pass.
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

    // ---- Step 6 (combined): attach custom domain (skipped in TEST_MODE / preview / owned) ----
    if (workerName && isPreviewMode) {
      steps.push(stepResult("cf_attach_domain", true, "[PREVIEW] Klient using workers.dev — no custom domain to attach", false, { skipped: true, mode: "preview" }));
    } else if (workerName && !testMode && domainSource === "register") {
      const r = await cfAttachCustomDomain(env, { worker_name: workerName, domain });
      steps.push(stepResult("cf_attach_domain", r.ok, r.message, dryRun));
      if (!r.ok && !dryRun) log.warn("provision.attach_domain_failed", { client_id: row.client_id, message: r.message });
    } else if (workerName && domainSource === "owned") {
      steps.push(stepResult("cf_attach_domain", true, "[OWNED] Klient must point DNS manually — domain attach skipped", false, { skipped: true }));
    } else if (workerName && testMode) {
      steps.push(stepResult("cf_attach_domain", true, "[TEST_MODE] Skipped custom domain attach — using workers.dev preview", false, { skipped: true }));
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

/**
 * Track 19a — fetch + patch klient's apps/starter/wrangler.toml with KV namespace IDs.
 */
async function fetchWranglerToml(
  env: Env,
  owner: string,
  name: string,
): Promise<string | null> {
  if (!env.GITHUB_PAT) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/apps/starter/wrangler.toml?ref=main`,
      {
        headers: {
          "Authorization": `Bearer ${env.GITHUB_PAT}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "mm-control-plane",
        },
      },
    );
    if (!res.ok) return null;
    const file = (await res.json()) as { content?: string };
    if (!file.content) return null;
    return atob(file.content.replace(/\s+/g, ""));
  } catch {
    return null;
  }
}

function patchWranglerKv(toml: string, ids: { rate_limit_id: string; fallback_queue_id: string }): string {
  // Replace the commented block with uncommented version that has IDs.
  // The template starts with:
  //   # [[kv_namespaces]]
  //   # binding = "RATE_LIMIT"
  //   # id = "<KV_ID>"
  //   #
  //   # [[kv_namespaces]]
  //   # binding = "FALLBACK_QUEUE"
  //   # id = "<KV_ID>"
  //
  // We replace the entire commented block (between the dash-comment header and the empty line)
  // OR if already uncommented (idempotent), just update IDs.
  const replacement = `[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "${ids.rate_limit_id}"

[[kv_namespaces]]
binding = "FALLBACK_QUEUE"
id = "${ids.fallback_queue_id}"`;

  // Try commented version first
  const commentedRegex = /# \[\[kv_namespaces\]\]\s*\n# binding = "RATE_LIMIT"\s*\n# id = "[^"]*"\s*\n#?\s*\n# \[\[kv_namespaces\]\]\s*\n# binding = "FALLBACK_QUEUE"\s*\n# id = "[^"]*"/m;
  if (commentedRegex.test(toml)) {
    return toml.replace(commentedRegex, replacement);
  }

  // Try uncommented (already-provisioned, idempotent update)
  const uncommentedRegex = /\[\[kv_namespaces\]\]\s*\nbinding = "RATE_LIMIT"\s*\nid = "[^"]*"\s*\n\s*\n\[\[kv_namespaces\]\]\s*\nbinding = "FALLBACK_QUEUE"\s*\nid = "[^"]*"/m;
  if (uncommentedRegex.test(toml)) {
    return toml.replace(uncommentedRegex, replacement);
  }

  // No match — append to end (rare case if template diverged)
  return toml.trimEnd() + "\n\n" + replacement + "\n";
}

/**
 * Fetch admin/config.yml from the klient's newly-created repo (copy of template)
 * and patch backend.repo + site_url + display_url to match the klient.
 *
 * Returns the patched YAML text, or null if fetch failed.
 */
async function fetchAndPatchSveltiaConfig(
  env: Env,
  params: { repo_owner: string; repo_name: string; site_url: string },
): Promise<string | null> {
  if (!env.GITHUB_PAT) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}/contents/apps/starter/public/admin/config.yml?ref=main`,
      {
        headers: {
          "Authorization": `Bearer ${env.GITHUB_PAT}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "mm-control-plane",
        },
      },
    );
    if (!res.ok) return null;
    const file = (await res.json()) as { content?: string };
    if (!file.content) return null;
    const decoded = atob(file.content.replace(/\s+/g, ""));
    return patchSveltiaYaml(decoded, {
      repo: `${params.repo_owner}/${params.repo_name}`,
      site_url: params.site_url,
    });
  } catch {
    return null;
  }
}

function patchSveltiaYaml(yaml: string, patches: { repo: string; site_url: string }): string {
  // Line-by-line patch — Sveltia YAML is hand-written, predictable indentation.
  return yaml
    .replace(/(^\s*repo:\s+)[^\s#]+/m, `$1${patches.repo}`)
    .replace(/(^\s*site_url:\s+)[^\s#]+/m, `$1${patches.site_url}`)
    .replace(/(^\s*display_url:\s+)[^\s#]+/m, `$1${patches.site_url}`);
}

export function wrapConfigAsTs(configJson: string): string {
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
