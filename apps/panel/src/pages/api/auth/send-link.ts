import type { APIRoute } from "astro";

import {
  createMagicLink,
  findClientByEmail,
  sendMagicLinkEmail,
} from "../../../lib/auth.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!env?.DB) {
    return new Response("Runtime not ready", { status: 500 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "/");

  if (!email || !EMAIL_RE.test(email)) {
    return Astro_redirect("/login?error=invalid_email");
  }

  const client = await findClientByEmail(env.DB, email);
  if (!client) {
    // Privacy-preserving: respond same as success even when no match, but log so
    // staff can detect repeated mismatch attempts. v0.1 returns explicit error so klient
    // knows they're using the wrong email (better UX during pilot).
    return Astro_redirect("/login?error=not_found");
  }

  const fullToken = await createMagicLink(env.DB, client.id, email);
  const link = `${url.origin}/login/verify?token=${encodeURIComponent(fullToken)}&next=${encodeURIComponent(next)}`;

  const sendResult = await sendMagicLinkEmail(
    { RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM: env.RESEND_FROM },
    { to: email, link, businessName: client.business_name },
  );

  if (!sendResult.ok) {
    return Astro_redirect("/login?error=send_failed");
  }

  return Astro_redirect("/login?sent=1");
};

function Astro_redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}
