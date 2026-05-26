/**
 * POST /api/admin/clients/:clientId/upgrade-domain
 *
 * Triggered by panel klient via `/api/settings/upgrade-domain`. Klient is in
 * preview mode (preview_domain set, primary_domain NULL) and wants to upgrade
 * to a custom domain.
 *
 * Body: { domain: string, source: "register" | "owned" }
 *
 * For 'register': OVH availability check → OVH register → DNS configure → CF attach
 * For 'owned': skip OVH register (klient has it), give DNS instructions, CF attach
 *
 * Auth: X-BP-Admin-Key.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import {
  ovhCheckDomainAvailability,
  ovhRegisterDomain,
  ovhConfigureDns,
} from "../../../integrations/ovh.js";
import { cfAttachCustomDomain, workerNameFor } from "../../../integrations/cloudflare.js";
import { err, ok } from "../../lib/responses.js";

export const adminUpgradeDomainRouter = new Hono<HonoEnv>();

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i;

function checkAuth(c: { req: { header(name: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "Admin endpoint disabled — set ADMIN_API_KEY";
  const got = c.req.header("X-BP-Admin-Key");
  if (got !== expected) return "Invalid or missing X-BP-Admin-Key";
  return null;
}

adminUpgradeDomainRouter.post("/:clientId/upgrade-domain", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const clientId = c.req.param("clientId");
  if (!clientId) return c.json(err("VALIDATION_ERROR", "clientId required"), 400);

  let body: { domain?: string; source?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  const domain = (body.domain ?? "").trim().toLowerCase();
  const source = body.source;
  if (!DOMAIN_RE.test(domain)) {
    return c.json(err("VALIDATION_ERROR", "Invalid domain format"), 422);
  }
  if (source !== "register" && source !== "owned") {
    return c.json(err("VALIDATION_ERROR", "source must be 'register' or 'owned'"), 422);
  }

  // Verify klient exists + is preview-only (no primary_domain yet)
  const klient = await c.env.DB
    .prepare(`SELECT id, primary_domain, preview_domain, status FROM clients WHERE id = ? LIMIT 1`)
    .bind(clientId)
    .first<{ id: string; primary_domain: string | null; preview_domain: string | null; status: string }>();
  if (!klient) return c.json(err("NOT_FOUND", "Klient not found"), 404);
  if (klient.primary_domain) {
    return c.json(err("CONFLICT", "Klient already has custom domain. Email info@mixturemarketing.pl to change it."), 409);
  }

  const workerName = workerNameFor(c.env, clientId);
  const steps: Array<{ step: string; ok: boolean; message: string }> = [];

  try {
    // STEP 1: OVH register or availability check
    if (source === "register") {
      const r = await ovhRegisterDomain(c.env, { domain, client_id: clientId });
      steps.push({ step: "ovh_register_domain", ok: r.ok, message: r.message });
      if (!r.ok) throw new Error(`OVH register failed: ${r.message}`);
      // PROD MODE: real OVH order — domain delivery 5-60 min. Klient sees status pending.
      // For simplicity, we return early here and let cron continue when delivered.
      if (r.order_id && !r.order_id.startsWith("dryrun")) {
        await c.env.DB
          .prepare(
            `UPDATE clients SET primary_domain = ? WHERE id = ?`,
          )
          .bind(domain, clientId)
          .run();
        return c.json(
          ok({ steps, status: "waiting_domain", message: "Domena zamówiona w OVH. Dostawa: 5-60 min. Otrzymasz email gdy strona będzie pod nową domeną." }),
          200,
        );
      }
    } else {
      // owned — just record the domain, klient will configure DNS via instructions
      steps.push({ step: "ovh_register_domain", ok: true, message: "[OWNED] Klient has domain, skipping registration" });
    }

    // STEP 2: OVH DNS (only for register mode — owned klient configures manually)
    if (source === "register") {
      const cnameTarget = `${workerName}.workers.dev`;
      const r = await ovhConfigureDns(c.env, { domain, cname_target: cnameTarget });
      steps.push({ step: "ovh_configure_dns", ok: r.ok, message: r.message });
      if (!r.ok) throw new Error(`OVH DNS failed: ${r.message}`);
    } else {
      const subdomain = c.env.CF_WORKERS_DEV_SUBDOMAIN ?? "ACCOUNT";
      const cnameTarget = `${workerName}.${subdomain}.workers.dev`;
      steps.push({
        step: "ovh_configure_dns",
        ok: true,
        message: `[OWNED] Skonfiguruj w panelu rejestratora: CNAME ${domain} → ${cnameTarget}`,
      });
    }

    // STEP 3: CF attach custom domain
    const attachRes = await cfAttachCustomDomain(c.env, { worker_name: workerName, domain });
    steps.push({ step: "cf_attach_domain", ok: attachRes.ok, message: attachRes.message });
    if (!attachRes.ok && source === "register") {
      // For register: hard fail (OVH should have provisioned domain so attach must work)
      throw new Error(`CF attach failed: ${attachRes.message}`);
    }
    // For owned: soft fail OK (klient may need to point DNS first)

    // STEP 4: Update clients table
    await c.env.DB
      .prepare(`UPDATE clients SET primary_domain = ? WHERE id = ?`)
      .bind(domain, clientId)
      .run();

    // STEP 5: Audit log
    await c.env.DB
      .prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
         VALUES ('klient', 'domain.upgraded', 'client', ?, ?, 'info', ?)`,
      )
      .bind(clientId, clientId, JSON.stringify({ domain, source, steps }))
      .run();

    return c.json(
      ok({
        steps,
        status: "done",
        primary_domain: domain,
        message:
          source === "register"
            ? "Domena dodana. Strona będzie dostępna pod nowym adresem w ~5-30 min (DNS propagation)."
            : "Domena zapisana. Aby strona działała, ustaw DNS u rejestratora wg instrukcji.",
      }),
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return c.json(err("INTERNAL_ERROR", message, { steps }), 502);
  }
});
