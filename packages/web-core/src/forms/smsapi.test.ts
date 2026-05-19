import { describe, expect, it, vi } from "vitest";

import { renderSmsBody, sendLeadSmsToKlient } from "./smsapi.js";
import type { ValidatedLead } from "./types.js";

function makeLead(overrides: Partial<ValidatedLead> = {}): ValidatedLead {
  return {
    name: "Anna",
    email: "anna@example.com",
    phone: "+48600111222",
    consent_processing: true,
    consent_marketing: false,
    consent_text_version: "v1.0",
    consent_text_hash: "abc",
    ...overrides,
  };
}

describe("renderSmsBody", () => {
  it("includes service, city, phone, ref", () => {
    const out = renderSmsBody({
      toPhone: "+48171234567",
      businessName: "Ślusarz Kowalski",
      lead: makeLead({ service_interest: "awaryjne-otwieranie-zamkow", phone: "+48600111222" }),
      clientLeadId: "lead_abc12345xyz",
      city: "Rzeszów",
    });
    expect(out).toContain("awaryjne-otwieranie-zamkow");
    expect(out).toContain("Rzeszów");
    expect(out).toContain("+48600111222");
    expect(out).toContain("abc12345"); // ref (truncated lead id)
  });

  it("falls back when no service / no phone / no city", () => {
    const out = renderSmsBody({
      toPhone: "+48171234567",
      businessName: "X",
      lead: makeLead({ phone: undefined }),
      clientLeadId: "lead_z",
    });
    expect(out).toContain("kontakt");
    expect(out).toContain("brak tel");
    expect(out).not.toContain("(");
  });

  it("includes value when estimated_value_pln set", () => {
    const out = renderSmsBody({
      toPhone: "+48171234567",
      businessName: "X",
      lead: makeLead({ estimated_value_pln: 250 }),
      clientLeadId: "lead_q",
    });
    expect(out).toContain("250zl");
  });

  it("caps body to ~2 SMS (320 chars)", () => {
    const out = renderSmsBody({
      toPhone: "+48171234567",
      businessName: "X",
      lead: makeLead({ service_interest: "x".repeat(500) }),
      clientLeadId: "lead_q",
    });
    expect(out.length).toBeLessThanOrEqual(320);
  });
});

describe("sendLeadSmsToKlient", () => {
  it("returns ok with messageId on successful POST", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ count: 1, list: [{ id: "msg_123", points: 1, status: "QUEUE", price: 0.07 }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    const r = await sendLeadSmsToKlient(
      { token: "fake-token", fetchImpl: fetchSpy as unknown as typeof fetch },
      {
        toPhone: "+48171234567",
        businessName: "X",
        lead: makeLead(),
        clientLeadId: "lead_x",
        city: "Rzeszów",
      },
    );
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe("msg_123");
    expect(r.pricePln).toBe(0.07);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.smsapi.pl/sms.do");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as { body: URLSearchParams }).body;
    expect(body.get("to")).toBe("48171234567"); // + stripped
    expect(body.get("from")).toBe("INFO");
    expect(body.get("message")).toContain("oddzwon");
  });

  it("honors custom from sender (truncated to 11 chars)", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ count: 1, list: [{ id: "m", points: 1, status: "QUEUE" }] }), { status: 200 }),
    );
    await sendLeadSmsToKlient(
      { token: "t", from: "MixtureMarketing-XYZ", fetchImpl: fetchSpy as unknown as typeof fetch },
      { toPhone: "+48171234567", businessName: "X", lead: makeLead(), clientLeadId: "lead_x" },
    );
    const init = fetchSpy.mock.calls[0]![1] as { body: URLSearchParams };
    expect(init.body.get("from")).toBe("MixtureMark");
    expect(init.body.get("from")!.length).toBeLessThanOrEqual(11);
  });

  it("returns ok=false on HTTP error", async () => {
    const fetchSpy = vi.fn(async () => new Response("auth failure", { status: 401 }));
    const r = await sendLeadSmsToKlient(
      { token: "bad", fetchImpl: fetchSpy as unknown as typeof fetch },
      { toPhone: "+48171234567", businessName: "X", lead: makeLead(), clientLeadId: "lead_x" },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("401");
  });

  it("returns ok=false on SMSAPI error envelope", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: 13, message: "Wrong number" }), { status: 200 }),
    );
    const r = await sendLeadSmsToKlient(
      { token: "t", fetchImpl: fetchSpy as unknown as typeof fetch },
      { toPhone: "+48000", businessName: "X", lead: makeLead(), clientLeadId: "lead_x" },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("13");
    expect(r.error).toContain("Wrong number");
  });

  it("returns ok=false on fetch throw", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("network down");
    });
    const r = await sendLeadSmsToKlient(
      { token: "t", fetchImpl: fetchSpy as unknown as typeof fetch },
      { toPhone: "+48171234567", businessName: "X", lead: makeLead(), clientLeadId: "lead_x" },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toBe("network down");
  });

  it("returns ok=false when status is something other than QUEUE/SENT", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ count: 1, list: [{ id: "m", points: 1, status: "FAILED" }] }), { status: 200 }),
    );
    const r = await sendLeadSmsToKlient(
      { token: "t", fetchImpl: fetchSpy as unknown as typeof fetch },
      { toPhone: "+48171234567", businessName: "X", lead: makeLead(), clientLeadId: "lead_x" },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("FAILED");
  });
});
