import { describe, expect, it, vi } from "vitest";

import {
  fakturowniaCreateInvoice,
  fakturowniaDownloadPdf,
  getFakturowniaAccount,
  groszeToPlnString,
} from "../src/integrations/fakturownia.js";
import { generateMonthlyInvoice } from "../src/scheduled/fakturownia-invoice.js";
import { setupTestEnv, type TestSetup } from "./helpers.js";

describe("groszeToPlnString", () => {
  it("formats integer grosze with 2 decimal places", () => {
    expect(groszeToPlnString(14900)).toBe("149.00");
    expect(groszeToPlnString(19900)).toBe("199.00");
    expect(groszeToPlnString(123)).toBe("1.23");
    expect(groszeToPlnString(7)).toBe("0.07");
    expect(groszeToPlnString(0)).toBe("0.00");
  });
});

describe("fakturownia client", () => {
  it("getFakturowniaAccount sends token + parses JSON", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toBe("https://mixturemarketing.fakturownia.pl/account.json?api_token=tok123");
      return new Response(JSON.stringify({ id: 42, login: "mm", name: "MixtureMarketing" }), { status: 200 });
    });
    const out = await getFakturowniaAccount({
      login: "mixturemarketing",
      apiToken: "tok123",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(out.id).toBe(42);
    expect(out.name).toBe("MixtureMarketing");
  });

  it("fakturowniaCreateInvoice POSTs to /invoices.json with wrapped body", async () => {
    let bodyJson = "";
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toBe("https://x.fakturownia.pl/invoices.json");
      expect(init?.method).toBe("POST");
      bodyJson = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          id: 999,
          number: "FV/2026/05/0001",
          kind: "vat",
          issue_date: "2026-05-19",
          payment_to: "2026-05-19",
          paid_date: "2026-05-19",
          price_net: "149.00",
          price_tax: "34.27",
          price_gross: "183.27",
          currency: "PLN",
        }),
        { status: 200 },
      );
    });
    const inv = await fakturowniaCreateInvoice(
      { login: "x", apiToken: "tok", fetchImpl: fetchSpy as unknown as typeof fetch },
      {
        kind: "vat",
        buyer_name: "Test Sp. z o.o.",
        buyer_tax_no: "1234567890",
        positions: [{ name: "Subskrypcja", quantity: 1, tax: 23, total_price_gross: "199.00" }],
      },
    );
    expect(inv.id).toBe(999);
    expect(inv.number).toBe("FV/2026/05/0001");
    const parsed = JSON.parse(bodyJson) as { api_token: string; invoice: { buyer_name: string } };
    expect(parsed.api_token).toBe("tok");
    expect(parsed.invoice.buyer_name).toBe("Test Sp. z o.o.");
  });

  it("fakturowniaDownloadPdf returns ArrayBuffer", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // "%PDF-1.4"
    const fetchSpy = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toContain("/invoices/123.pdf");
      expect(url).toContain("api_token=tok");
      return new Response(pdfBytes, { status: 200, headers: { "Content-Type": "application/pdf" } });
    });
    const buf = await fakturowniaDownloadPdf({ login: "x", apiToken: "tok", fetchImpl: fetchSpy as unknown as typeof fetch }, 123);
    expect(new Uint8Array(buf).slice(0, 4)).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it("throws FakturowniaError on non-2xx", async () => {
    const fetchSpy = vi.fn(async () => new Response("Invalid token", { status: 401 }));
    await expect(
      getFakturowniaAccount({ login: "x", apiToken: "bad", fetchImpl: fetchSpy as unknown as typeof fetch }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("generateMonthlyInvoice (dry-run)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestEnv();
    setup.env.FAKTUROWNIA_DRY_RUN = "true";
    // Ensure client has NIP + postal_code + legal_name for the path to populate them.
    await setup.env.DB
      .prepare(`UPDATE clients SET legal_name = ?, nip = ?, postal_code = ? WHERE id = ?`)
      .bind("Ślusarz Kowalski Sp. z o.o.", "8121234567", "35-060", setup.clientId)
      .run();
    // Seed payment row first (invoice FK to payments)
    await setup.env.DB
      .prepare(
        `INSERT INTO payments (id, client_id, amount_grosze, currency, type, provider, external_id, status, paid_at)
         VALUES (?, ?, ?, 'PLN', 'monthly', 'stripe', ?, 'succeeded', datetime('now'))`,
      )
      .bind("pmt_test_001", setup.clientId, 19900, "in_test_001")
      .run();
  });

  it("dry-run mode: inserts invoice row with DRYRUN number + no fakturownia_id", async () => {
    const r = await generateMonthlyInvoice(setup.env, {
      client_id: setup.clientId,
      payment_id: "pmt_test_001",
      amount_grosze: 19900,
      currency: "PLN",
      external_payment_ref: "in_test_001",
    });
    expect(r.ok).toBe(true);
    expect(r.dry_run).toBe(true);
    expect(r.invoice_number).toContain("DRYRUN");
    expect(r.invoice_id).toMatch(/^inv_/);

    const row = await setup.env.DB
      .prepare(`SELECT fakturownia_id, gross_grosze, vat_rate, status FROM invoices WHERE id = ?`)
      .bind(r.invoice_id!)
      .first<{ fakturownia_id: number | null; gross_grosze: number; vat_rate: number; status: string }>();
    expect(row?.fakturownia_id).toBeNull();
    expect(row?.gross_grosze).toBe(19900);
    expect(row?.vat_rate).toBe(0.23);
    expect(row?.status).toBe("draft");
  });

  it("idempotent — calling twice with same payment_id returns existing invoice", async () => {
    const r1 = await generateMonthlyInvoice(setup.env, {
      client_id: setup.clientId,
      payment_id: "pmt_test_001",
      amount_grosze: 19900,
      currency: "PLN",
      external_payment_ref: "in_test_001",
    });
    const r2 = await generateMonthlyInvoice(setup.env, {
      client_id: setup.clientId,
      payment_id: "pmt_test_001",
      amount_grosze: 19900,
      currency: "PLN",
      external_payment_ref: "in_test_001",
    });
    expect(r2.ok).toBe(true);
    expect(r2.invoice_id).toBe(r1.invoice_id);
    expect(r2.invoice_number).toBe(r1.invoice_number);
  });

  it("returns error when client not found", async () => {
    const r = await generateMonthlyInvoice(setup.env, {
      client_id: "clk_does_not_exist",
      payment_id: "pmt_test_001",
      amount_grosze: 19900,
      currency: "PLN",
      external_payment_ref: "in_test_001",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("client not found");
  });

  it("computes net+vat from gross 19900 grosze with VAT 23%", async () => {
    const r = await generateMonthlyInvoice(setup.env, {
      client_id: setup.clientId,
      payment_id: "pmt_test_001",
      amount_grosze: 19900,
      currency: "PLN",
      external_payment_ref: "in_test_001",
    });
    const row = await setup.env.DB
      .prepare(`SELECT net_grosze, vat_grosze, gross_grosze FROM invoices WHERE id = ?`)
      .bind(r.invoice_id!)
      .first<{ net_grosze: number; vat_grosze: number; gross_grosze: number }>();
    expect(row?.gross_grosze).toBe(19900);
    expect(row?.net_grosze).toBe(Math.floor(19900 / 1.23)); // = 16178
    expect(row?.vat_grosze).toBe(19900 - Math.floor(19900 / 1.23)); // = 3722
  });
});

// Add beforeEach helper at module scope (vitest)
import { beforeEach } from "vitest";
