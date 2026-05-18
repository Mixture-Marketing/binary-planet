import { describe, expect, it } from "vitest";

import { sendLeadToHub } from "./hub-sync.js";
import type { TransportLead } from "./types.js";

const sampleLead: TransportLead = {
  client_id: "clk_a",
  client_lead_id: "lead_abc",
  spoke_received_at: "2026-05-18T12:00:00Z",
  source: "contact_form",
  email_hash: "deadbeef",
  consent_processing: 1,
  consent_marketing: 0,
  consent_text_version: "v1.0",
  consent_text_hash: "abc",
  consent_at: "2026-05-18T12:00:00Z",
};

function mockFetch(handler: (req: Request) => Promise<Response> | Response): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init);
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

describe("sendLeadToHub", () => {
  it("sends with X-BP-Client-Key + X-Lead-Id headers", async () => {
    let received: Request | undefined;
    const fetchImpl = mockFetch((req) => {
      received = req;
      return new Response(JSON.stringify({ id: "hub_lead_1" }), { status: 200 });
    });

    const r = await sendLeadToHub(
      { hubBaseUrl: "https://api.example.pl", apiKey: "ck_test", fetchImpl },
      sampleLead,
    );
    expect(r.ok).toBe(true);
    expect(r.hubLeadId).toBe("hub_lead_1");
    expect(received?.headers.get("X-BP-Client-Key")).toBe("ck_test");
    expect(received?.headers.get("X-Lead-Id")).toBe("lead_abc");
  });

  it("strips trailing slash from hubBaseUrl", async () => {
    let url = "";
    const fetchImpl = mockFetch((req) => {
      url = req.url;
      return new Response("{}", { status: 200 });
    });
    await sendLeadToHub(
      { hubBaseUrl: "https://api.example.pl/", apiKey: "k", fetchImpl },
      sampleLead,
    );
    expect(url).toBe("https://api.example.pl/api/leads");
  });

  it("returns ok=false retriable for 5xx", async () => {
    const fetchImpl = mockFetch(() => new Response("server err", { status: 503 }));
    const r = await sendLeadToHub(
      { hubBaseUrl: "https://x", apiKey: "k", fetchImpl },
      sampleLead,
      { maxRetries: 0 },
    );
    expect(r.ok).toBe(false);
    expect(r.isRetriable).toBe(true);
    expect(r.status).toBe(503);
  });

  it("returns ok=false NON-retriable for 4xx", async () => {
    const fetchImpl = mockFetch(() => new Response("bad", { status: 400 }));
    const r = await sendLeadToHub(
      { hubBaseUrl: "https://x", apiKey: "k", fetchImpl },
      sampleLead,
    );
    expect(r.ok).toBe(false);
    expect(r.isRetriable).toBe(false);
    expect(r.status).toBe(400);
  });

  it("retries once on 5xx then succeeds", async () => {
    let calls = 0;
    const fetchImpl = mockFetch(() => {
      calls++;
      if (calls === 1) return new Response("err", { status: 503 });
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    });
    const r = await sendLeadToHub(
      { hubBaseUrl: "https://x", apiKey: "k", fetchImpl },
      sampleLead,
      { maxRetries: 1, backoffBaseMs: 1 },
    );
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("timeout produces retriable error", async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof fetch;

    const r = await sendLeadToHub(
      { hubBaseUrl: "https://x", apiKey: "k", fetchImpl },
      sampleLead,
      { timeoutMs: 50, maxRetries: 0 },
    );
    expect(r.ok).toBe(false);
    expect(r.isRetriable).toBe(true);
  });
});
