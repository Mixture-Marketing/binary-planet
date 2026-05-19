/**
 * Provisioning trigger from admin UI.
 *
 * The real orchestrator lives in apps/control-plane/src/scheduled/provision-client.ts
 * (runs on a 2-minute cron). This admin module duplicates a "dry-run only" version
 * so the user can preview the lifecycle without waiting for cron OR running hub locally.
 *
 * In dry-run we do NOT call any external API — just produce deterministic step results
 * and update the DB rows the same way the real cron would.
 *
 * Production: admin should call hub's POST /api/admin/provision/{id} which triggers
 * the real orchestrator. That endpoint is Track 4-prod (TBD).
 */

export interface AdminProvisioningStep {
  step: string;
  ok: boolean;
  ts: string;
  message: string;
  dry_run: true;
  extra?: Record<string, unknown>;
}

interface Row {
  client_id: string;
  business_name: string;
  primary_domain: string | null;
  config_json: string;
}

export async function triggerDryRunProvisioning(
  db: D1Database,
  clientId: string,
): Promise<{ ok: boolean; steps: AdminProvisioningStep[]; error?: string }> {
  const row = await db
    .prepare(
      `SELECT p.client_id, c.business_name, c.primary_domain, p.config_json
         FROM client_provisioning_configs p
         JOIN clients c ON c.id = p.client_id
        WHERE p.client_id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<Row>();

  if (!row) return { ok: false, steps: [], error: "client not found" };

  await db
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = 'running',
              provisioning_started_at = datetime('now')
        WHERE client_id = ?`,
    )
    .bind(clientId)
    .run();

  const slug = clientId.replace(/^clk_/, "");
  const orgRepo = `MixtureMarketing/${clientId}-site`;
  const workerName = `mm-starter-${slug}`;
  const domain = row.primary_domain ?? "(missing)";
  const now = (): string => new Date().toISOString();

  const steps: AdminProvisioningStep[] = [
    {
      step: "ovh_register_domain",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would register ${domain} via OVH API`,
      dry_run: true,
      extra: { order_id: `dryrun-order-${Date.now()}` },
    },
    {
      step: "ovh_configure_dns",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would set ${domain} CNAME -> ${workerName}.workers.dev`,
      dry_run: true,
      extra: { cname_target: `${workerName}.workers.dev` },
    },
    {
      step: "github_create_repo",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would create repo https://github.com/${orgRepo}`,
      dry_run: true,
      extra: { repo_url: `https://github.com/${orgRepo}` },
    },
    {
      step: "github_commit_config",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would commit apps/starter/src/client.config.ts (${row.config_json.length} bytes)`,
      dry_run: true,
      extra: { commit_sha: `dryrun-${Date.now().toString(16)}` },
    },
    {
      step: "cf_deploy_worker",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would trigger GH Actions deploy -> Worker ${workerName}`,
      dry_run: true,
      extra: { worker_name: workerName, preview_url: `https://${workerName}.workers.dev` },
    },
    {
      step: "cf_attach_domain",
      ok: true,
      ts: now(),
      message: `[DRY-RUN] Would attach ${domain} to ${workerName}`,
      dry_run: true,
    },
  ];

  await db
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = 'done',
              provisioning_finished_at = datetime('now'),
              provisioning_error = NULL,
              steps_json = ?
        WHERE client_id = ?`,
    )
    .bind(JSON.stringify(steps), clientId)
    .run();

  // Flip clients.status from 'pending' to 'active' in dry-run too — makes admin UI useful.
  await db
    .prepare(
      `UPDATE clients
          SET status = 'active',
              activated_at = COALESCE(activated_at, datetime('now')),
              github_repo_url = ?,
              cf_worker_name = ?
        WHERE id = ?`,
    )
    .bind(`https://github.com/${orgRepo}`, workerName, clientId)
    .run();

  return { ok: true, steps };
}
