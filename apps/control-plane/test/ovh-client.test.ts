import { describe, expect, it, vi } from "vitest";

import { buildOvhSignature, ovhRequest, OVH_ENDPOINTS } from "../src/integrations/ovh-client.js";

describe("buildOvhSignature", () => {
  it("returns $1$ + 40-char sha1 hex", async () => {
    const sig = await buildOvhSignature({
      appSecret: "s",
      consumerKey: "ck",
      method: "GET",
      url: "https://eu.api.ovh.com/1.0/me",
      body: "",
      timestamp: 1700000000,
    });
    expect(sig).toMatch(/^\$1\$[0-9a-f]{40}$/);
  });

  it("is deterministic for same inputs", async () => {
    const args = {
      appSecret: "secret",
      consumerKey: "consumer",
      method: "POST",
      url: "https://eu.api.ovh.com/1.0/order/cart",
      body: JSON.stringify({ x: 1 }),
      timestamp: 42,
    };
    const a = await buildOvhSignature(args);
    const b = await buildOvhSignature(args);
    expect(a).toBe(b);
  });

  it("differs when any input changes", async () => {
    const base = {
      appSecret: "s",
      consumerKey: "ck",
      method: "GET",
      url: "https://eu.api.ovh.com/1.0/me",
      body: "",
      timestamp: 100,
    };
    const a = await buildOvhSignature(base);
    const b = await buildOvhSignature({ ...base, timestamp: 101 });
    expect(a).not.toBe(b);
  });
});

describe("OVH_ENDPOINTS", () => {
  it("has eu/us/ca configured", () => {
    expect(OVH_ENDPOINTS["ovh-eu"]).toContain("eu.api.ovh.com");
    expect(OVH_ENDPOINTS["ovh-us"]).toContain("us.ovhcloud.com");
    expect(OVH_ENDPOINTS["ovh-ca"]).toContain("ca.api.ovh.com");
  });
});

describe("ovhRequest", () => {
  function mockFetch(handler: (req: { url: string; method: string; headers: Headers; body: string | null }) => Response) {
    return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      const body = init?.body ? String(init.body) : null;
      return handler({ url, method, headers, body });
    }) as unknown as typeof fetch;
  }

  it("first call fetches server time, signs subsequent requests", async () => {
    let timeCalls = 0;
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/auth/time")) {
        timeCalls++;
        return new Response("1700000000", { status: 200 });
      }
      // verify signed headers present
      const h = new Headers(init?.headers);
      expect(h.get("X-Ovh-Application")).toBe("ak");
      expect(h.get("X-Ovh-Consumer")).toBe("ck");
      expect(h.get("X-Ovh-Signature")).toMatch(/^\$1\$[0-9a-f]{40}$/);
      expect(h.get("X-Ovh-Timestamp")).toBeTruthy();
      return new Response(JSON.stringify({ nichandle: "test-handle" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const out = await ovhRequest<{ nichandle: string }>(
      {
        appKey: "ak",
        appSecret: "as",
        consumerKey: "ck",
        fetchImpl: fetchSpy as unknown as typeof fetch,
        endpoint: "ovh-eu-test-" + Math.random(), // unique to bypass module-level cache
      },
      "/me",
    );
    expect(out.nichandle).toBe("test-handle");
    expect(timeCalls).toBe(1);
  });

  it("throws OvhRequestError on non-2xx with parsed errorCode", async () => {
    const fetchSpy = mockFetch(({ url }) => {
      if (url.endsWith("/auth/time")) return new Response("1700000000", { status: 200 });
      return new Response(JSON.stringify({ errorCode: "INVALID_CREDENTIAL", message: "bad" }), { status: 403 });
    });
    await expect(
      ovhRequest(
        { appKey: "ak", appSecret: "as", consumerKey: "ck", fetchImpl: fetchSpy, endpoint: "ovh-eu-err-" + Math.random() },
        "/me",
      ),
    ).rejects.toMatchObject({ status: 403, ovhErrorCode: "INVALID_CREDENTIAL" });
  });

  it("serializes body as JSON and signs with body content", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/auth/time")) return new Response("1700000000", { status: 200 });
      const body = String(init?.body ?? "");
      expect(body).toBe(JSON.stringify({ ovhSubsidiary: "PL" }));
      const h = new Headers(init?.headers);
      expect(h.get("Content-Type")).toBe("application/json");
      return new Response(JSON.stringify({ cartId: "cart_x" }), { status: 200 });
    });
    const out = await ovhRequest<{ cartId: string }>(
      { appKey: "ak", appSecret: "as", consumerKey: "ck", fetchImpl: fetchSpy as unknown as typeof fetch, endpoint: "ovh-eu-cart-" + Math.random() },
      "/order/cart",
      { method: "POST", body: { ovhSubsidiary: "PL" } },
    );
    expect(out.cartId).toBe("cart_x");
  });
});
