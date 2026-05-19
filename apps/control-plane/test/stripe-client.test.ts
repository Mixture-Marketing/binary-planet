import { describe, expect, it, vi } from "vitest";

import {
  createCheckoutSession,
  encodeStripeForm,
  stripeRequest,
} from "../src/integrations/stripe.js";

describe("encodeStripeForm", () => {
  it("encodes flat object", () => {
    expect(encodeStripeForm({ mode: "subscription", quantity: 1 })).toBe("mode=subscription&quantity=1");
  });

  it("encodes nested object with bracket syntax", () => {
    expect(encodeStripeForm({ metadata: { client_id: "clk_x" } })).toBe("metadata%5Bclient_id%5D=clk_x");
  });

  it("encodes array of objects with index", () => {
    const out = encodeStripeForm({ line_items: [{ price: "price_a", quantity: 1 }] });
    expect(out).toContain("line_items%5B0%5D%5Bprice%5D=price_a");
    expect(out).toContain("line_items%5B0%5D%5Bquantity%5D=1");
  });

  it("skips undefined and null", () => {
    expect(encodeStripeForm({ a: 1, b: undefined, c: null, d: 2 })).toBe("a=1&d=2");
  });

  it("url-encodes special chars in values", () => {
    expect(encodeStripeForm({ url: "https://x.com/?a=b&c=d" })).toContain("https%3A%2F%2Fx.com");
  });
});

describe("stripeRequest", () => {
  it("sends Bearer auth + Stripe-Version + JSON body parsing", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const h = new Headers(init?.headers);
      expect(h.get("Authorization")).toBe("Bearer sk_test_x");
      expect(h.get("Stripe-Version")).toBe("2024-12-18.acacia");
      return new Response(JSON.stringify({ id: "acct_x", country: "PL" }), { status: 200 });
    });
    const out = await stripeRequest<{ id: string; country: string }>(
      { secretKey: "sk_test_x", fetchImpl: fetchSpy as unknown as typeof fetch },
      "/account",
    );
    expect(out.id).toBe("acct_x");
  });

  it("encodes POST body as form + adds idempotency-key header", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const h = new Headers(init?.headers);
      expect(h.get("Idempotency-Key")).toBe("idem-123");
      expect(h.get("Content-Type")).toBe("application/x-www-form-urlencoded");
      expect(String(init?.body)).toContain("mode=subscription");
      return new Response(JSON.stringify({ id: "cs_x", url: "https://checkout.stripe.com/x" }), { status: 200 });
    });
    const r = await stripeRequest<{ id: string; url: string }>(
      { secretKey: "sk_test_x", fetchImpl: fetchSpy as unknown as typeof fetch },
      "/checkout/sessions",
      { method: "POST", body: { mode: "subscription" }, idempotencyKey: "idem-123" },
    );
    expect(r.id).toBe("cs_x");
  });

  it("throws StripeRequestError with parsed error code on 4xx", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "resource_missing", type: "invalid_request_error", message: "No such price" } }), { status: 404 }),
    );
    await expect(
      stripeRequest({ secretKey: "sk_test_x", fetchImpl: fetchSpy as unknown as typeof fetch }, "/prices/price_missing"),
    ).rejects.toMatchObject({ status: 404, stripeErrorCode: "resource_missing", stripeErrorType: "invalid_request_error" });
  });
});

describe("createCheckoutSession", () => {
  it("builds subscription mode session with metadata + locale=pl", async () => {
    let capturedBody = "";
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/cs_test" }), { status: 200 });
    });
    const out = await createCheckoutSession(
      { secretKey: "sk_test_x", fetchImpl: fetchSpy as unknown as typeof fetch },
      {
        priceId: "price_abc",
        successUrl: "https://app.mm.pl/success",
        cancelUrl: "https://app.mm.pl/cancel",
        clientId: "clk_kowalski",
        customerEmail: "k@example.com",
        idempotencyKey: "test-1",
      },
    );
    expect(out.url).toContain("checkout.stripe.com");
    expect(capturedBody).toContain("mode=subscription");
    expect(capturedBody).toContain("line_items%5B0%5D%5Bprice%5D=price_abc");
    expect(capturedBody).toContain("metadata%5Bclient_id%5D=clk_kowalski");
    expect(capturedBody).toContain("subscription_data%5Bmetadata%5D%5Bclient_id%5D=clk_kowalski");
    expect(capturedBody).toContain("customer_email=k%40example.com");
    expect(capturedBody).toContain("locale=pl");
    expect(capturedBody).toContain("billing_address_collection=required");
  });

  it("prefers existingCustomerId over customer_email", async () => {
    let capturedBody = "";
    const fetchSpy = vi.fn(async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: "cs_x", url: "https://x" }), { status: 200 });
    });
    await createCheckoutSession(
      { secretKey: "sk_test_x", fetchImpl: fetchSpy as unknown as typeof fetch },
      {
        priceId: "price_abc",
        successUrl: "https://app.mm.pl/success",
        cancelUrl: "https://app.mm.pl/cancel",
        clientId: "clk_x",
        customerEmail: "ignored@example.com",
        existingCustomerId: "cus_existing",
      },
    );
    expect(capturedBody).toContain("customer=cus_existing");
    expect(capturedBody).not.toContain("customer_email=");
  });
});
