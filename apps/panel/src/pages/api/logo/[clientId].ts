/**
 * GET /api/logo/{client_id} — publiczny serving logo z R2.
 *
 * Klient site (mm-starter) używa tego URL w <img src> żeby wyświetlić logo.
 * Cache 1h via Cache-Control. Próbuje 4 rozszerzenia (svg/png/jpg/webp).
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const EXTS = ["svg", "png", "jpg", "webp"] as const;
const MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export const GET: APIRoute = async ({ params, locals }) => {
  if (!env?.UPLOADS) return new Response("Runtime not ready", { status: 500 });
  const clientId = params.clientId;
  if (!clientId || !/^clk_[a-z0-9_-]+$/.test(clientId)) {
    return new Response("Invalid client_id", { status: 400 });
  }

  for (const ext of EXTS) {
    const obj = await env.UPLOADS.get(`logos/${clientId}.${ext}`);
    if (obj) {
      return new Response(obj.body, {
        status: 200,
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "Access-Control-Allow-Origin": "*",
          "ETag": obj.httpEtag,
        },
      });
    }
  }
  return new Response("Logo not found", { status: 404 });
};
