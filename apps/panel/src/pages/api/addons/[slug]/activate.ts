/**
 * POST /api/addons/:slug/activate — klient self-service addon activation.
 *
 * 1. Write D1 client_addons row (immediate, panel-local)
 * 2. Best-effort call hub /api/admin/addons/sync to create Stripe subscription item
 *    (or invoice item for one-time). If hub call fails, row stays pending —
 *    reconciler can pick it up later.
 *
 * Returns Stripe sync result so UI can show "Naliczone na następnej fakturze"
 * or warning if Stripe sync deferred.
 */

import type { APIRoute } from "astro";

import { activateAddon } from "../../../../lib/addons.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  const slug = params.slug;
  if (!slug) return json({ ok: false, error: "Missing addon slug" }, 400);

  // 1. Write D1
  const result = await activateAddon(env.DB, locals.client.id, slug);
  if (!result.ok) return json({ ok: false, error: result.error }, 422);

  // 2. Best-effort Stripe sync
  let stripe: { ok: boolean; kind?: string; item_id?: string; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/addons/sync`, {
        method: "POST",
        headers: {
          "X-BP-Admin-Key": env.ADMIN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: locals.client.id, addon_slug: slug }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { kind?: string; item_id?: string; invoice_item_id?: string }; error?: { message?: string } };
      if (json.ok) {
        stripe = { ok: true, kind: json.data?.kind, item_id: json.data?.item_id ?? json.data?.invoice_item_id };
      } else {
        stripe = { ok: false, error: json.error?.message ?? "stripe sync failed" };
      }
    } catch (e) {
      stripe = { ok: false, error: e instanceof Error ? e.message : "hub unreachable" };
    }
  } else {
    stripe = { ok: false, error: "Stripe sync not configured (HUB_BASE_URL/ADMIN_API_KEY missing)" };
  }

  // 3. Best-effort: trigger klient site rebuild with new env vars (Track 24h)
  let deploy: { ok: boolean; deploy_ok?: boolean; secrets_set_count?: number; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/addons/deploy-trigger`, {
        method: "POST",
        headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: locals.client.id }),
      });
      const j = (await res.json()) as { ok?: boolean; data?: { secrets_set?: string[]; deploy?: { ok?: boolean } }; error?: { message?: string } };
      if (j.ok) {
        deploy = {
          ok: true,
          deploy_ok: j.data?.deploy?.ok,
          secrets_set_count: j.data?.secrets_set?.length ?? 0,
        };
      } else {
        deploy = { ok: false, error: j.error?.message ?? "deploy trigger failed" };
      }
    } catch (e) {
      deploy = { ok: false, error: e instanceof Error ? e.message : "hub unreachable" };
    }
  }

  return json(
    { ok: true, id: result.id, trial_until: result.trial_until, stripe, deploy },
    200,
  );
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
