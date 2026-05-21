/**
 * POST /api/auth/send-link
 * Body: form-urlencoded { email, next }
 * Response: 302 redirect to /login?sent=1 OR /login?error=<code>
 */

import type { APIRoute } from "astro";

import { createMagicLink, findAdminByEmail, sendMagicLinkEmail } from "../../../lib/auth.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!env?.DB) {
    return new Response("Runtime not available", { status: 500 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const next = String(form.get("next") ?? "/");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return redirect("/login?error=invalid_email");
  }

  const user = await findAdminByEmail(env.DB, email);
  if (!user) {
    // Don't reveal which emails exist — but for v0.1 (admin tool, limited surface) we do.
    // Faza 5+: always redirect with sent=1 to prevent enumeration.
    return redirect("/login?error=not_found");
  }

  const fullToken = await createMagicLink(env.DB, user.id, user.email);
  const verifyUrl = new URL(`/login/verify?token=${fullToken}&next=${encodeURIComponent(next)}`, request.url);

  const result = await sendMagicLinkEmail(
    {
      ...(env.RESEND_API_KEY && { RESEND_API_KEY: env.RESEND_API_KEY }),
      ...(env.RESEND_FROM && { RESEND_FROM: env.RESEND_FROM }),
    },
    {
      to: user.email,
      link: verifyUrl.toString(),
      displayName: user.display_name,
    },
  );

  if (!result.ok) {
    return redirect("/login?error=send_failed");
  }

  return redirect("/login?sent=1");
};
