/**
 * GET /opinia — NFC stojak redirect target.
 *
 * NFC sticker URL = https://klient-domena.pl/opinia
 * Klient zbliża telefon → otwiera tę stronę → 302 redirect do Google Reviews write form
 * dla klient's Place ID.
 *
 * Activated by addon `nfc_stand` (99 zł 1×) — physical sticker shipped separately,
 * but the URL works once GOOGLE_PLACE_ID env var is set.
 *
 * Fallback: jeśli brak Place ID, redirect na `/kontakt` aby klient mógł zostawić feedback.
 */

import type { APIRoute } from "astro";

import clientConfig from "../client.config.ts";

export const prerender = false;

interface RuntimeEnv {
  GOOGLE_PLACE_ID?: string;
}

export const GET: APIRoute = async ({ locals, request }) => {
  const env = (locals as { runtime?: { env?: RuntimeEnv } })?.runtime?.env;
  const placeId = env?.GOOGLE_PLACE_ID?.trim();

  // Audit hit (best-effort — no-op if we can't log)
  // eslint-disable-next-line no-console
  console.log("nfc.opinia.hit", { placeId: placeId ? "set" : "missing", ua: request.headers.get("user-agent")?.slice(0, 80) });

  if (placeId) {
    return Response.redirect(`https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`, 302);
  }
  // Fallback — redirect to contact page with anchor "reviews"
  const fallback = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}/kontakt#opinie`;
  return Response.redirect(fallback, 302);
};
