/**
 * POST /api/addons/:slug/deactivate — klient anuluje dodatek.
 *
 * 1. Read stripe_subscription_item_id BEFORE D1 update (so we know what to cancel)
 * 2. Call hub /api/admin/addons/cancel to remove Stripe subscription item
 * 3. Update D1 row to canceled
 */

import type { APIRoute } from "astro";

import { deactivateAddon } from "../../../../lib/addons.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, request }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  const slug = params.slug;
  if (!slug) return json({ ok: false, error: "Missing addon slug" }, 400);

  let reason: string | undefined;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body.reason;
  } catch { /* empty */ }

  // 1. Best-effort Stripe cancel (BEFORE D1 update so we can find sub_item_id)
  let stripe: { ok: boolean; deleted?: string; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/addons/cancel`, {
        method: "POST",
        headers: {
          "X-BP-Admin-Key": env.ADMIN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: locals.client.id, addon_slug: slug }),
      });
      const j = (await res.json()) as { ok?: boolean; data?: { deleted?: string }; error?: { message?: string } };
      stripe = j.ok
        ? { ok: true, deleted: j.data?.deleted }
        : { ok: false, error: j.error?.message ?? "stripe cancel failed" };
    } catch (e) {
      stripe = { ok: false, error: e instanceof Error ? e.message : "hub unreachable" };
    }
  }

  // 2. Update D1 (always, even if Stripe failed — manual reconcile)
  const result = await deactivateAddon(env.DB, locals.client.id, slug, reason);
  if (!result.ok) return json({ ok: false, error: "No active subscription to cancel", stripe }, 422);

  // 3. Trigger klient site rebuild — flips the feature flag to false (Track 24h)
  let deploy: { ok: boolean; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/addons/deploy-trigger`, {
        method: "POST",
        headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: locals.client.id }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      deploy = j.ok ? { ok: true } : { ok: false, error: j.error?.message ?? "deploy trigger failed" };
    } catch (e) {
      deploy = { ok: false, error: e instanceof Error ? e.message : "hub unreachable" };
    }
  }

  return json({ ok: true, canceled: result.canceled, stripe, deploy }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
