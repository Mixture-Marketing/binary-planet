/**
 * Track 24 — Stripe billing for addons.
 *
 * Endpoints (auth: X-BP-Admin-Key):
 *   POST /api/admin/addons/seed-stripe         — create Product+Price for each addon (idempotent)
 *   POST /api/admin/addons/sync                — sync one client_addons row to Stripe (create sub item OR invoice item)
 *   POST /api/admin/addons/cancel              — remove sub item from Stripe (recurring only)
 *
 * Why centralized in hub: STRIPE_SECRET_KEY lives only in hub. Panel calls these
 * endpoints after writing D1 row, hub does the Stripe side.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { computeWorkerEnvFromAddons } from "../../../integrations/addon-env-map.js";
import { cfDeployWorker, cfSetWorkerSecret } from "../../../integrations/cloudflare.js";
import { githubCommitFile } from "../../../integrations/github.js";
import { wrapConfigAsTs } from "../../../scheduled/provision-client.js";
import {
  createInvoiceItem,
  createStripePrice,
  createStripeProduct,
  createSubscriptionItem,
  deleteSubscriptionItem,
} from "../../../integrations/stripe.js";
import { err, ok } from "../../lib/responses.js";

export const adminAddonsRouter = new Hono<HonoEnv>();

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

interface AddonRow {
  slug: string;
  name: string;
  short_description: string;
  price_grosze: number;
  currency: string;
  billing_period: "monthly" | "one_time";
  stripe_price_id: string | null;
}

// ---------------------------------------------------------------------------
// 1. POST /api/admin/addons/seed-stripe
// ---------------------------------------------------------------------------
adminAddonsRouter.post("/seed-stripe", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);
  if (!c.env.STRIPE_SECRET_KEY) return c.json(err("INTERNAL_ERROR", "STRIPE_SECRET_KEY missing"), 500);

  const rows = await c.env.DB
    .prepare(
      `SELECT slug, name, short_description, price_grosze, currency, billing_period, stripe_price_id
         FROM addon_modules
        WHERE is_active = 1`,
    )
    .all<AddonRow>();

  const cfg = { secretKey: c.env.STRIPE_SECRET_KEY };
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ slug: string; error: string }> = [];

  for (const a of rows.results ?? []) {
    if (a.stripe_price_id) {
      skipped.push(a.slug);
      continue;
    }
    try {
      const product = await createStripeProduct(cfg, {
        name: `MixtureMarketing — ${a.name}`,
        description: a.short_description,
        metadata: { addon_slug: a.slug, source: "binary_planet" },
        idempotencyKey: `addon_product_${a.slug}`,
      });
      const price = await createStripePrice(cfg, {
        productId: product.id,
        unitAmountGrosze: a.price_grosze,
        currency: a.currency,
        ...(a.billing_period === "monthly" && { recurring: { interval: "month" as const } }),
        metadata: { addon_slug: a.slug, billing_period: a.billing_period },
        idempotencyKey: `addon_price_${a.slug}`,
      });
      await c.env.DB
        .prepare(`UPDATE addon_modules SET stripe_price_id = ? WHERE slug = ?`)
        .bind(price.id, a.slug)
        .run();
      created.push(`${a.slug} → ${price.id}`);
    } catch (e) {
      failed.push({ slug: a.slug, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return c.json(ok({ created, skipped, failed, total: rows.results?.length ?? 0 }), 200);
});

// ---------------------------------------------------------------------------
// 2. POST /api/admin/addons/sync — sync client_addons row to Stripe
//    Body: { client_id, addon_slug }
// ---------------------------------------------------------------------------
adminAddonsRouter.post("/sync", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);
  if (!c.env.STRIPE_SECRET_KEY) return c.json(err("INTERNAL_ERROR", "STRIPE_SECRET_KEY missing"), 500);

  let body: { client_id?: string; addon_slug?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id || !body.addon_slug) {
    return c.json(err("VALIDATION_ERROR", "client_id + addon_slug required"), 400);
  }

  // Look up the client_addons row
  const addonRow = await c.env.DB
    .prepare(
      `SELECT ca.id, ca.status, ca.stripe_subscription_item_id, ca.price_grosze_at_activation,
              am.slug, am.name, am.currency, am.billing_period, am.stripe_price_id
         FROM client_addons ca
         JOIN addon_modules am ON am.slug = ca.addon_slug
        WHERE ca.client_id = ? AND ca.addon_slug = ?
          AND ca.status IN ('trial', 'active')
        ORDER BY ca.id DESC LIMIT 1`,
    )
    .bind(body.client_id, body.addon_slug)
    .first<{
      id: number;
      status: string;
      stripe_subscription_item_id: string | null;
      price_grosze_at_activation: number;
      slug: string;
      name: string;
      currency: string;
      billing_period: "monthly" | "one_time";
      stripe_price_id: string | null;
    }>();
  if (!addonRow) return c.json(err("NOT_FOUND", "No active client_addons row"), 404);
  if (addonRow.stripe_subscription_item_id) {
    return c.json(ok({ skipped: true, reason: "already_synced", item_id: addonRow.stripe_subscription_item_id }), 200);
  }
  if (!addonRow.stripe_price_id) {
    return c.json(err("VALIDATION_ERROR", `Addon ${body.addon_slug} has no stripe_price_id (run seed-stripe first)`), 422);
  }

  // Find client's active subscription
  const sub = await c.env.DB
    .prepare(
      `SELECT external_id, external_customer_id FROM subscriptions
        WHERE client_id = ? AND provider = 'stripe' AND status IN ('active', 'trialing', 'past_due')
        ORDER BY current_period_end DESC LIMIT 1`,
    )
    .bind(body.client_id)
    .first<{ external_id: string; external_customer_id: string | null }>();

  const cfg = { secretKey: c.env.STRIPE_SECRET_KEY };

  try {
    if (addonRow.billing_period === "monthly") {
      if (!sub) return c.json(err("VALIDATION_ERROR", "Client has no active Stripe subscription"), 422);
      const item = await createSubscriptionItem(cfg, {
        subscriptionId: sub.external_id,
        priceId: addonRow.stripe_price_id,
        proration_behavior: "none",
        metadata: { addon_slug: addonRow.slug, client_id: body.client_id },
        idempotencyKey: `sub_item_${body.client_id}_${addonRow.slug}_${addonRow.id}`,
      });
      await c.env.DB
        .prepare(`UPDATE client_addons SET stripe_subscription_item_id = ? WHERE id = ?`)
        .bind(item.id, addonRow.id)
        .run();
      return c.json(ok({ kind: "subscription_item", item_id: item.id }), 200);
    } else {
      // one_time → invoiceitem attached to next subscription invoice OR customer's next invoice
      if (!sub?.external_customer_id) {
        return c.json(err("VALIDATION_ERROR", "Client has no Stripe customer to bill one-time charge to"), 422);
      }
      const invItem = await createInvoiceItem(cfg, {
        customerId: sub.external_customer_id,
        unitAmountGrosze: addonRow.price_grosze_at_activation,
        currency: addonRow.currency,
        description: addonRow.name,
        metadata: { addon_slug: addonRow.slug, client_id: body.client_id },
        idempotencyKey: `inv_item_${body.client_id}_${addonRow.slug}_${addonRow.id}`,
      });
      await c.env.DB
        .prepare(`UPDATE client_addons SET stripe_invoice_id = ? WHERE id = ?`)
        .bind(invItem.id, addonRow.id)
        .run();
      return c.json(ok({ kind: "invoice_item", invoice_item_id: invItem.id }), 200);
    }
  } catch (e) {
    return c.json(err("INTERNAL_ERROR", e instanceof Error ? e.message : "stripe sync failed"), 502);
  }
});

// ---------------------------------------------------------------------------
// 3. POST /api/admin/addons/cancel — remove Stripe subscription item
//    Body: { client_id, addon_slug }
// ---------------------------------------------------------------------------
adminAddonsRouter.post("/cancel", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);
  if (!c.env.STRIPE_SECRET_KEY) return c.json(err("INTERNAL_ERROR", "STRIPE_SECRET_KEY missing"), 500);

  let body: { client_id?: string; addon_slug?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id || !body.addon_slug) {
    return c.json(err("VALIDATION_ERROR", "client_id + addon_slug required"), 400);
  }

  // Find canceled client_addons row with stripe_subscription_item_id
  const addonRow = await c.env.DB
    .prepare(
      `SELECT ca.id, ca.stripe_subscription_item_id
         FROM client_addons ca
        WHERE ca.client_id = ? AND ca.addon_slug = ?
          AND ca.stripe_subscription_item_id IS NOT NULL
        ORDER BY ca.id DESC LIMIT 1`,
    )
    .bind(body.client_id, body.addon_slug)
    .first<{ id: number; stripe_subscription_item_id: string }>();
  if (!addonRow) return c.json(err("NOT_FOUND", "No synced client_addons row"), 404);

  try {
    await deleteSubscriptionItem({ secretKey: c.env.STRIPE_SECRET_KEY }, addonRow.stripe_subscription_item_id, "none");
    return c.json(ok({ deleted: addonRow.stripe_subscription_item_id }), 200);
  } catch (e) {
    return c.json(err("INTERNAL_ERROR", e instanceof Error ? e.message : "stripe cancel failed"), 502);
  }
});

// ---------------------------------------------------------------------------
// 4. POST /api/admin/addons/deploy-trigger — sync klient Worker secrets + rebuild
//    Body: { client_id }
//    Effect:
//      1. Read all active client_addons for klient
//      2. Compute env vars (CHATBOT_ENABLED, LEADPOP_ENABLED, etc.)
//      3. PUT each secret via CF API
//      4. Trigger GH Actions workflow_dispatch → klient site rebuilds with new flags
//    Returns: { secrets_set: [...], deploy_triggered: bool }
// ---------------------------------------------------------------------------
adminAddonsRouter.post("/deploy-trigger", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  let body: { client_id?: string };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id) return c.json(err("VALIDATION_ERROR", "client_id required"), 400);

  // 1. Fetch klient's worker info
  const klient = await c.env.DB
    .prepare(`SELECT cf_worker_name, github_repo_url FROM clients WHERE id = ? LIMIT 1`)
    .bind(body.client_id)
    .first<{ cf_worker_name: string | null; github_repo_url: string | null }>();
  if (!klient?.cf_worker_name) {
    return c.json(err("NOT_FOUND", `Klient ${body.client_id} has no cf_worker_name`), 404);
  }

  // 2. Fetch active addon slugs
  const addons = await c.env.DB
    .prepare(`SELECT addon_slug FROM client_addons WHERE client_id = ? AND status IN ('trial','active')`)
    .bind(body.client_id)
    .all<{ addon_slug: string }>();
  const activeSlugs = (addons.results ?? []).map((r) => r.addon_slug);

  // 3. Compute env vars
  const envVars = computeWorkerEnvFromAddons(activeSlugs);

  // 3b. Per-addon DB-driven extras (Instagram, Wolt/Glovo, NFC, Booksy, etc.)
  if (activeSlugs.includes("instagram_sync")) {
    const ig = await c.env.DB
      .prepare(`SELECT embed_url, display_count, section_title FROM instagram_embed_config WHERE client_id = ? LIMIT 1`)
      .bind(body.client_id)
      .first<{ embed_url: string | null; display_count: number; section_title: string }>();
    if (ig?.embed_url) {
      envVars.INSTAGRAM_EMBED_URL = ig.embed_url;
      envVars.INSTAGRAM_DISPLAY_COUNT = String(ig.display_count);
      envVars.INSTAGRAM_SECTION_TITLE = ig.section_title;
    }
  }
  if (activeSlugs.includes("wolt_glovo")) {
    const d = await c.env.DB
      .prepare(`SELECT delivery_url, provider FROM delivery_config WHERE client_id = ? LIMIT 1`)
      .bind(body.client_id)
      .first<{ delivery_url: string; provider: string }>();
    if (d?.delivery_url) {
      envVars.DELIVERY_URL = d.delivery_url;
      envVars.DELIVERY_PROVIDER = d.provider;
    }
  }
  if (activeSlugs.includes("nfc_stand")) {
    const n = await c.env.DB
      .prepare(`SELECT google_place_id FROM nfc_config WHERE client_id = ? LIMIT 1`)
      .bind(body.client_id)
      .first<{ google_place_id: string }>();
    if (n?.google_place_id) {
      envVars.GOOGLE_PLACE_ID = n.google_place_id;
    }
  }

  // 4. PUT each secret via CF API
  const secrets_set: string[] = [];
  const secrets_failed: Array<{ name: string; error: string }> = [];
  for (const [name, value] of Object.entries(envVars)) {
    const r = await cfSetWorkerSecret(c.env, {
      worker_name: klient.cf_worker_name,
      secret_name: name,
      secret_value: value,
    });
    if (r.ok) secrets_set.push(`${name}=${value}`);
    else secrets_failed.push({ name, error: r.message });
  }

  // 5a. Sync client.config.ts to klient repo if config_json changed (theme, hero, hours, etc.)
  let config_sync: { ok: boolean; message: string; commit_sha?: string } = { ok: false, message: "not attempted" };
  if (klient.github_repo_url) {
    const cfgRow = await c.env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(body.client_id)
      .first<{ config_json: string }>();
    if (cfgRow?.config_json) {
      const match = klient.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const [, owner, name] = match;
        const tsContent = wrapConfigAsTs(cfgRow.config_json);
        const r = await githubCommitFile(c.env, {
          repo_owner: owner!,
          repo_name: name!,
          path: "apps/starter/src/client.config.ts",
          content: tsContent,
          message: `chore: sync client.config.ts (theme/settings update) for ${body.client_id}`,
        });
        config_sync = { ok: r.ok, message: r.message, ...(r.commit_sha && { commit_sha: r.commit_sha }) };
      }
    }
  }

  // 5b. Trigger workflow_dispatch to rebuild klient site with new env + config
  let deploy: { ok: boolean; message: string; preview_url?: string } = { ok: false, message: "not attempted" };
  if (klient.github_repo_url) {
    const match = klient.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, name] = match;
      const r = await cfDeployWorker(c.env, {
        client_id: body.client_id,
        repo_owner: owner!,
        repo_name: name!,
      });
      deploy = { ok: r.ok, message: r.message, ...(r.preview_url && { preview_url: r.preview_url }) };
    }
  }

  await c.env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system', 'addon.deploy_triggered', 'client', ?, ?, 'info', ?)`,
    )
    .bind(
      body.client_id,
      body.client_id,
      JSON.stringify({
        active_addons: activeSlugs,
        secrets_set_count: secrets_set.length,
        secrets_failed_count: secrets_failed.length,
        deploy_ok: deploy.ok,
      }),
    )
    .run();

  return c.json(
    ok({
      client_id: body.client_id,
      worker_name: klient.cf_worker_name,
      active_addons: activeSlugs,
      secrets_set,
      ...(secrets_failed.length > 0 && { secrets_failed }),
      config_sync,
      deploy,
    }),
    200,
  );
});
