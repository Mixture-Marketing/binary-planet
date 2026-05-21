/**
 * GET /api/raporty/download?month=YYYY-MM
 *
 * Streams (or signed-URL redirects to) the monthly PDF report from R2.
 * Auth: client_session cookie required (middleware blocks unauth).
 * Returns: 200 PDF stream OR 302 to R2 signed URL OR 404 if missing.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const client = locals.client;
  if (!client) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) {
    return new Response("Database not configured", { status: 500 });
  }
  // INVOICES bucket is shared across panel docs (invoices + monthly reports);
  // could be split later (REPORTS binding) but for now use INVOICES.
  const bucket = (env as unknown as { INVOICES?: R2Bucket }).INVOICES;
  if (!bucket) {
    return new Response("R2 storage not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response("Invalid month parameter (expected YYYY-MM)", { status: 400 });
  }

  // Look up the report — verify client_id ownership
  const row = await env.DB
    .prepare(
      `SELECT pdf_r2_key, month_id FROM monthly_reports
         WHERE client_id = ? AND month_id = ?
         LIMIT 1`,
    )
    .bind(client.id, month)
    .first<{ pdf_r2_key: string | null; month_id: string }>();

  if (!row) {
    return new Response("Raport nie znaleziony", { status: 404 });
  }
  if (!row.pdf_r2_key) {
    return new Response("PDF jeszcze nie wygenerowany — sprawdź za kilka godzin", { status: 425 }); // 425 Too Early
  }

  // Fetch from R2 + stream back
  const obj = await bucket.get(row.pdf_r2_key);
  if (!obj) {
    return new Response("PDF został usunięty z R2 — skontaktuj się z agencją", { status: 410 });
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="raport-${month}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
};
