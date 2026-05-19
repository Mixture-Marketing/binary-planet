/**
 * Fakturownia.pl API client — Polish VAT invoice generation.
 *
 * Auth: per-account API token, sent as ?api_token=... OR Authorization: token xxx header.
 * Each account lives at https://{login}.fakturownia.pl (login = subdomena podana przy rejestracji).
 *
 * Endpoints used:
 *   POST /invoices.json           — create invoice
 *   GET  /invoices/{id}.json      — read invoice
 *   GET  /invoices/{id}.pdf       — download PDF (returns binary)
 *   POST /clients.json            — create buyer (klient = "client" in Fakturownia terminology — confusingly!)
 *   GET  /clients.json?nip=...    — find buyer by NIP
 *
 * Polish VAT context:
 *   - Most usługi B2B → VAT 23% (default)
 *   - Faktura na NIP buyera → klient może odliczyć VAT
 *   - kind: 'vat' → standard FV VAT; 'invoice' = paragon
 *   - payment_to → ISO date deadline (default = invoice_date for "zapłacono")
 *
 * Reference: https://app.fakturownia.pl/api
 */

export interface FakturowniaClientConfig {
  /** Account login (subdomain). e.g. "mixturemarketing" → https://mixturemarketing.fakturownia.pl */
  login: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}

export interface FakturowniaError extends Error {
  status: number;
  body: string;
}

function baseUrl(cfg: FakturowniaClientConfig): string {
  return `https://${cfg.login}.fakturownia.pl`;
}

function makeError(status: number, body: string): FakturowniaError {
  const err = new Error(`Fakturownia ${status}: ${body.slice(0, 250)}`) as FakturowniaError;
  err.status = status;
  err.body = body;
  return err;
}

async function fakturowniaRequest<T = unknown>(
  cfg: FakturowniaClientConfig,
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: Record<string, unknown> } = {},
): Promise<T> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const url = `${baseUrl(cfg)}${path}`;
  const method = init.method ?? "GET";

  const payload = init.body !== undefined ? { api_token: cfg.apiToken, ...init.body } : undefined;
  // GET requests pass token as query param; POST/PUT include in body.
  const finalUrl = method === "GET" ? `${url}${url.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(cfg.apiToken)}` : url;

  const res = await fetchImpl(finalUrl, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    ...(payload && { body: JSON.stringify(payload) }),
  });
  const text = await res.text();
  if (!res.ok) throw makeError(res.status, text);
  if (!text) return null as unknown as T;
  return JSON.parse(text) as T;
}

/** Download PDF (binary). Returns ArrayBuffer. */
export async function fakturowniaDownloadPdf(
  cfg: FakturowniaClientConfig,
  invoiceId: number,
): Promise<ArrayBuffer> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const url = `${baseUrl(cfg)}/invoices/${invoiceId}.pdf?api_token=${encodeURIComponent(cfg.apiToken)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw makeError(res.status, (await res.text()).slice(0, 200));
  return await res.arrayBuffer();
}

// ---------------------------------------------------------------------------
// High-level operations
// ---------------------------------------------------------------------------

export interface FakturowniaAccount {
  id?: number;
  /** Account login slug (subdomain). */
  login?: string;
  /** Company name on issued invoices. */
  name?: string;
}

/** Verify token by fetching account. GET /account.json returns 200 + account info. */
export async function getFakturowniaAccount(cfg: FakturowniaClientConfig): Promise<FakturowniaAccount> {
  return await fakturowniaRequest<FakturowniaAccount>(cfg, "/account.json");
}

export interface FakturowniaInvoiceInput {
  /** "vat" = faktura VAT (default), "proforma" = pro-forma, "invoice" = paragon. */
  kind?: "vat" | "proforma" | "invoice" | "receipt";
  /** Numbering scheme — leave undefined to use account default. */
  number?: string | null;
  /** Issue date YYYY-MM-DD. Default today. */
  issue_date?: string;
  /** Payment deadline YYYY-MM-DD. */
  payment_to?: string;
  /** "Sprzedawca" — your firm. Usually pre-filled in account settings; override with seller_name + seller_nip if needed. */
  seller_name?: string;
  seller_tax_no?: string;
  /** "Nabywca". */
  buyer_name: string;
  buyer_tax_no?: string;
  buyer_email?: string;
  buyer_street?: string;
  buyer_post_code?: string;
  buyer_city?: string;
  buyer_country?: string; // "PL"
  /** Line items. */
  positions: Array<{
    name: string;
    quantity?: number;
    unit?: string; // "szt." | "miesiąc" | "godz."
    tax: number | string; // 23 | "23%" | "zw" (VAT)
    /** Price PER UNIT, NET (without VAT). PLN with comma OR plain number; Fakturownia accepts both. */
    total_price_gross?: string | number;
    price_net?: string | number;
  }>;
  /** Currency, default PLN. */
  currency?: "PLN" | "EUR" | "USD";
  /** "Pieczęć i podpis" — info text. */
  description?: string;
  /** Already paid? */
  paid?: number; // grosze actually paid (we set = total to mark "Zapłacono")
  /** Free-text bottom of invoice. */
  comments?: string;
  /** "Sposób zapłaty". */
  payment_type?: "transfer" | "card" | "cash" | "online";
  /** Auto-send by email on create. */
  send_to_email?: boolean;
}

export interface FakturowniaInvoice {
  id: number;
  number: string;
  kind: string;
  /** ISO yyyy-mm-dd */
  issue_date: string;
  payment_to: string | null;
  paid_date: string | null;
  price_net: string;     // "149.00" — Fakturownia returns strings
  price_tax: string;     // "34.27"
  price_gross: string;   // "183.27"
  tax_value?: string;
  currency: string;
  view_url?: string;
}

export async function fakturowniaCreateInvoice(
  cfg: FakturowniaClientConfig,
  input: FakturowniaInvoiceInput,
): Promise<FakturowniaInvoice> {
  return await fakturowniaRequest<FakturowniaInvoice>(cfg, "/invoices.json", {
    method: "POST",
    body: { invoice: input },
  });
}

export async function fakturowniaGetInvoice(
  cfg: FakturowniaClientConfig,
  invoiceId: number,
): Promise<FakturowniaInvoice> {
  return await fakturowniaRequest<FakturowniaInvoice>(cfg, `/invoices/${invoiceId}.json`);
}

/**
 * Convert grosze (Stripe convention) to "PLN string with dot" (Fakturownia convention).
 * 14900 → "149.00"
 */
export function groszeToPlnString(grosze: number): string {
  const zl = Math.floor(grosze / 100);
  const gr = grosze % 100;
  return `${zl}.${gr.toString().padStart(2, "0")}`;
}
