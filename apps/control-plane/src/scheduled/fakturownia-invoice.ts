/**
 * Fakturownia invoice generation — Track 7.
 *
 * Triggered from Stripe webhook `invoice.paid` (handlers/stripe.ts).
 * Flow:
 *   1. Fetch client + contact (legal name, NIP, address)
 *   2. POST /invoices.json → Fakturownia generates invoice + assigns number
 *   3. GET /invoices/{id}.pdf → download PDF
 *   4. PUT to R2 (key: invoices/{client_id}/{invoice_number}.pdf)
 *   5. INSERT into invoices D1 table with fakturownia_id + pdf_r2_key
 *
 * Idempotent: if invoice for this Stripe payment already exists, skip.
 *
 * Dry-run mode (FAKTUROWNIA_DRY_RUN=true OR token missing): logs but skips API + R2.
 */

import type { Env } from "../env.js";
import {
  fakturowniaCreateInvoice,
  fakturowniaDownloadPdf,
  groszeToPlnString,
  type FakturowniaInvoice,
  type FakturowniaInvoiceInput,
} from "../integrations/fakturownia.js";

export interface GenerateInvoiceInput {
  client_id: string;
  payment_id: string;
  /** Amount paid (grosze). */
  amount_grosze: number;
  /** PLN | EUR | USD */
  currency: string;
  /** Stripe payment_intent ID / invoice ID for audit trail. */
  external_payment_ref: string;
}

export interface GenerateInvoiceResult {
  ok: boolean;
  /** Internal invoice id (D1). */
  invoice_id?: string;
  /** Fakturownia numeric id. */
  fakturownia_id?: number;
  /** Generated invoice number ("FV/2026/05/0001"). */
  invoice_number?: string;
  /** R2 object key for the stored PDF. */
  pdf_r2_key?: string;
  dry_run?: boolean;
  error?: string;
}

function dryRun(env: Env): boolean {
  return !env.FAKTUROWNIA_API_TOKEN || !env.FAKTUROWNIA_LOGIN ||
    (env.FAKTUROWNIA_DRY_RUN ?? "false").toLowerCase() === "true";
}

interface ClientRow {
  id: string;
  business_name: string;
  legal_name: string | null;
  nip: string | null;
  city: string;
  postal_code: string | null;
  voivodeship: string | null;
  tier: "starter" | "standard" | "premium";
}

interface ContactRow {
  contact_email_enc: string | null;
}

const TIER_DESCRIPTIONS: Record<string, string> = {
  starter: "Pakiet Starter — strona internetowa + GBP + local SEO (miesiąc)",
  standard: "Pakiet Standard — Starter + content + raporty (miesiąc)",
  premium: "Pakiet Premium — Standard + AI blog + multi-location (miesiąc)",
};

export async function generateMonthlyInvoice(
  env: Env,
  input: GenerateInvoiceInput,
): Promise<GenerateInvoiceResult> {
  // Idempotency check — if invoice with this payment_id already exists, skip.
  const existing = await env.DB
    .prepare(`SELECT id, invoice_number, pdf_r2_key, fakturownia_id FROM invoices WHERE payment_id = ? LIMIT 1`)
    .bind(input.payment_id)
    .first<{ id: string; invoice_number: string; pdf_r2_key: string | null; fakturownia_id: number | null }>();
  if (existing) {
    return {
      ok: true,
      invoice_id: existing.id,
      invoice_number: existing.invoice_number,
      ...(existing.pdf_r2_key && { pdf_r2_key: existing.pdf_r2_key }),
      ...(existing.fakturownia_id !== null && { fakturownia_id: existing.fakturownia_id }),
    };
  }

  const client = await env.DB
    .prepare(
      `SELECT id, business_name, legal_name, nip, city, postal_code, voivodeship, tier
         FROM clients WHERE id = ? LIMIT 1`,
    )
    .bind(input.client_id)
    .first<ClientRow>();
  if (!client) return { ok: false, error: "client not found" };

  const contact = await env.DB
    .prepare(`SELECT contact_email_enc FROM client_contacts WHERE client_id = ? LIMIT 1`)
    .bind(input.client_id)
    .first<ContactRow>();

  // v0.1 stores email as "dev:<plaintext>" — strip prefix for production-shape.
  const buyerEmail = contact?.contact_email_enc?.startsWith("dev:")
    ? contact.contact_email_enc.slice(4)
    : contact?.contact_email_enc ?? undefined;

  // ---------- Dry-run path ----------
  if (dryRun(env)) {
    const fakeNumber = `DRYRUN/${new Date().toISOString().slice(0, 7).replace("-", "/")}/${input.payment_id.slice(-6)}`;
    const fakeId = `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await insertInvoiceRow(env, {
      id: fakeId,
      client_id: input.client_id,
      payment_id: input.payment_id,
      fakturownia_id: null,
      invoice_number: fakeNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      net_grosze: Math.floor(input.amount_grosze / 1.23),
      vat_rate: 0.23,
      vat_grosze: input.amount_grosze - Math.floor(input.amount_grosze / 1.23),
      gross_grosze: input.amount_grosze,
      pdf_r2_key: null,
      status: "draft",
    });
    return { ok: true, dry_run: true, invoice_id: fakeId, invoice_number: fakeNumber };
  }

  // ---------- Production path ----------
  const grossPln = groszeToPlnString(input.amount_grosze);
  const buyerName = client.legal_name ?? client.business_name;
  const buyerTaxNo = client.nip ?? undefined;
  const issueDate = new Date().toISOString().slice(0, 10);

  const invoiceInput: FakturowniaInvoiceInput = {
    kind: "vat",
    issue_date: issueDate,
    payment_to: issueDate, // Zapłacono w dniu wystawienia (Stripe pobrał)
    buyer_name: buyerName,
    buyer_city: client.city,
    currency: (input.currency as "PLN" | "EUR" | "USD") ?? "PLN",
    positions: [
      {
        name: TIER_DESCRIPTIONS[client.tier] ?? `Subskrypcja ${client.tier}`,
        quantity: 1,
        unit: "miesiąc",
        tax: 23,
        total_price_gross: grossPln,
      },
    ],
    paid: input.amount_grosze, // mark as fully paid
    payment_type: "card",
    description: `Stripe payment ref: ${input.external_payment_ref}`,
    send_to_email: !!buyerEmail,
  };
  if (buyerTaxNo) invoiceInput.buyer_tax_no = buyerTaxNo;
  if (buyerEmail) invoiceInput.buyer_email = buyerEmail;
  if (client.postal_code) invoiceInput.buyer_post_code = client.postal_code;

  let fakturowniaInv: FakturowniaInvoice;
  try {
    fakturowniaInv = await fakturowniaCreateInvoice(
      { login: env.FAKTUROWNIA_LOGIN!, apiToken: env.FAKTUROWNIA_API_TOKEN! },
      invoiceInput,
    );
  } catch (e) {
    return { ok: false, error: `Fakturownia create failed: ${e instanceof Error ? e.message : "unknown"}` };
  }

  // Download PDF + store in R2
  let pdfR2Key: string | null = null;
  try {
    const pdfBytes = await fakturowniaDownloadPdf(
      { login: env.FAKTUROWNIA_LOGIN!, apiToken: env.FAKTUROWNIA_API_TOKEN! },
      fakturowniaInv.id,
    );
    pdfR2Key = `invoices/${input.client_id}/${fakturowniaInv.number.replace(/[\/]/g, "-")}.pdf`;
    await env.UPLOADS.put(pdfR2Key, pdfBytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { client_id: input.client_id, fakturownia_id: String(fakturowniaInv.id) },
    });
  } catch (e) {
    // PDF download/storage failed — invoice still exists in Fakturownia, will retry via cron.
    pdfR2Key = null;
    // eslint-disable-next-line no-console
    console.warn(`Fakturownia PDF/R2 failed for inv ${fakturowniaInv.id}:`, e instanceof Error ? e.message : e);
  }

  const internalId = `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const netGrosze = Math.floor(input.amount_grosze / 1.23);
  await insertInvoiceRow(env, {
    id: internalId,
    client_id: input.client_id,
    payment_id: input.payment_id,
    fakturownia_id: fakturowniaInv.id,
    invoice_number: fakturowniaInv.number,
    invoice_date: fakturowniaInv.issue_date,
    net_grosze: netGrosze,
    vat_rate: 0.23,
    vat_grosze: input.amount_grosze - netGrosze,
    gross_grosze: input.amount_grosze,
    pdf_r2_key: pdfR2Key,
    status: "issued",
  });

  return {
    ok: true,
    invoice_id: internalId,
    fakturownia_id: fakturowniaInv.id,
    invoice_number: fakturowniaInv.number,
    ...(pdfR2Key && { pdf_r2_key: pdfR2Key }),
  };
}

interface InsertInvoiceInput {
  id: string;
  client_id: string;
  payment_id: string;
  fakturownia_id: number | null;
  invoice_number: string;
  invoice_date: string;
  net_grosze: number;
  vat_rate: number;
  vat_grosze: number;
  gross_grosze: number;
  pdf_r2_key: string | null;
  status: string;
}

async function insertInvoiceRow(env: Env, row: InsertInvoiceInput): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO invoices (
         id, client_id, payment_id, fakturownia_id, invoice_number, invoice_date,
         net_grosze, vat_rate, vat_grosze, gross_grosze, pdf_r2_key, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (invoice_number) DO NOTHING`,
    )
    .bind(
      row.id,
      row.client_id,
      row.payment_id,
      row.fakturownia_id,
      row.invoice_number,
      row.invoice_date,
      row.net_grosze,
      row.vat_rate,
      row.vat_grosze,
      row.gross_grosze,
      row.pdf_r2_key,
      row.status,
    )
    .run();
}
