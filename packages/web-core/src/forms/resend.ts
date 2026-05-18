/**
 * Resend integration — forward lead email to klient.
 *
 * This is the BACKUP channel: even when hub sync succeeds, we still send email to klient,
 * because that's the user's primary expectation ("I'll get email when someone fills the form").
 *
 * Per RODO: klient is controller of THIS data (their leads). MM is processor.
 * Email content includes PII — klient receives it directly, no MM persistence beyond audit log.
 */

import type { ValidatedLead } from "./types.js";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface ResendDeps {
  apiKey: string;
  from: string; // 'leads@mixturemarketing.pl' or per-klient 'leads@klient-domain.pl'
  fetchImpl?: typeof fetch;
}

export interface ForwardLeadInput {
  /** klient's notification address. */
  toEmail: string;
  /** klient's business name (used in subject). */
  businessName: string;
  /** Lead data (PLAINTEXT — not encrypted, since this is the delivery payload). */
  lead: ValidatedLead;
  /** Source page URL (optional). */
  sourcePage?: string;
  /** Spoke-side client_lead_id — included so klient can correlate with dashboard. */
  clientLeadId: string;
  /** ISO timestamp of submission. */
  submittedAt: string;
}

export interface ResendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a "you have a new lead" email to klient.
 * Returns ok=false on failure; caller decides escalation (P1 if persistent).
 */
export async function forwardLeadToKlient(
  deps: ResendDeps,
  input: ForwardLeadInput,
): Promise<ResendResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const subject = `[Nowy lead] ${input.businessName} — ${input.lead.name}`;
  const html = renderLeadEmailHtml(input);
  const text = renderLeadEmailText(input);

  try {
    const res = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: deps.from,
        to: input.toEmail,
        reply_to: input.lead.email, // klient may reply directly to lead's email
        subject,
        html,
        text,
        tags: [
          { name: "type", value: "lead_forward" },
          { name: "client_lead_id", value: input.clientLeadId },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }

    const body = (await res.json()) as { id?: string };
    const result: ResendResult = { ok: true };
    if (body.id !== undefined) result.messageId = body.id;
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Resend network error" };
  }
}

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLeadEmailText(input: ForwardLeadInput): string {
  const { lead } = input;
  const lines: string[] = [
    `Otrzymałeś nowy lead — ${input.businessName}`,
    `Zgłoszenie: ${input.clientLeadId}`,
    `Czas: ${input.submittedAt}`,
    ``,
    `Imię:    ${lead.name}`,
    `E-mail:  ${lead.email}`,
  ];
  if (lead.phone) lines.push(`Telefon: ${lead.phone}`);
  if (lead.service_interest) lines.push(`Usługa:  ${lead.service_interest}`);
  if (lead.estimated_value_pln !== undefined) {
    lines.push(`Wycena:  ${lead.estimated_value_pln} zł (szac.)`);
  }
  if (input.sourcePage) lines.push(`Strona:  ${input.sourcePage}`);
  if (lead.message) {
    lines.push(``, `Wiadomość:`, lead.message);
  }
  lines.push(``, `---`, `Wiadomość dostarczona przez MixtureMarketing.`);
  return lines.join("\n");
}

function renderLeadEmailHtml(input: ForwardLeadInput): string {
  const { lead } = input;
  const rows: string[] = [
    row("Imię", escapeHtml(lead.name)),
    row("E-mail", `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>`),
  ];
  if (lead.phone) {
    rows.push(row("Telefon", `<a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a>`));
  }
  if (lead.service_interest) rows.push(row("Usługa", escapeHtml(lead.service_interest)));
  if (lead.estimated_value_pln !== undefined) {
    rows.push(row("Wycena szac.", `${lead.estimated_value_pln} zł`));
  }
  if (input.sourcePage) rows.push(row("Strona", escapeHtml(input.sourcePage)));

  const message = lead.message
    ? `<tr><td colspan="2" style="padding:16px 0 0 0;"><strong>Wiadomość:</strong><div style="white-space:pre-wrap;margin-top:8px;padding:12px;background:#f5f5f5;border-radius:6px;">${escapeHtml(lead.message)}</div></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:20px;margin:0 0 8px 0;">Nowy lead — ${escapeHtml(input.businessName)}</h1>
  <p style="color:#666;margin:0 0 24px 0;">Zgłoszenie ${escapeHtml(input.clientLeadId)} · ${escapeHtml(input.submittedAt)}</p>
  <table style="width:100%;border-collapse:collapse;">
    ${rows.join("\n    ")}
    ${message}
  </table>
  <hr style="margin:32px 0;border:none;border-top:1px solid #eee;" />
  <p style="font-size:12px;color:#999;">Wiadomość dostarczona przez MixtureMarketing.</p>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:8px 16px 8px 0;color:#666;width:100px;">${escapeHtml(label)}:</td><td style="padding:8px 0;">${value}</td></tr>`;
}
