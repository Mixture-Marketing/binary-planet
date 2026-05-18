import { describe, expect, it, vi } from "vitest";

import { buildCapiLeadEvent, sendMetaCapiEvents } from "./meta-capi.js";

describe("buildCapiLeadEvent", () => {
  it("builds minimum Lead event", () => {
    const ev = buildCapiLeadEvent({
      leadId: "lead_abc",
      sourceUrl: "https://kowalski.pl/kontakt",
    });
    expect(ev.event_name).toBe("Lead");
    expect(ev.event_id).toBe("lead_abc");
    expect(ev.action_source).toBe("website");
    expect(ev.event_source_url).toBe("https://kowalski.pl/kontakt");
    expect(typeof ev.event_time).toBe("number");
  });

  it("includes hashed user data", () => {
    const ev = buildCapiLeadEvent({
      leadId: "lead_x",
      sourceUrl: "https://x/",
      emailHash: "deadbeef",
      phoneHash: "abc123",
      clientIp: "1.2.3.4",
      userAgent: "Mozilla/5.0",
      fbc: "fb.1.123.x",
      fbp: "fb.1.123.y",
    });
    expect(ev.user_data.em).toEqual(["deadbeef"]);
    expect(ev.user_data.ph).toEqual(["abc123"]);
    expect(ev.user_data.client_ip_address).toBe("1.2.3.4");
    expect(ev.user_data.fbc).toBe("fb.1.123.x");
  });

  it("includes value + currency in custom_data when value provided", () => {
    const ev = buildCapiLeadEvent({
      leadId: "lead_x",
      sourceUrl: "https://x/",
      value: 250,
    });
    expect(ev.custom_data?.["value"]).toBe(250);
    expect(ev.custom_data?.["currency"]).toBe("PLN");
  });

  it("omits custom_data when no value", () => {
    const ev = buildCapiLeadEvent({ leadId: "x", sourceUrl: "https://x/" });
    expect(ev.custom_data).toBeUndefined();
  });

  it("event_time matches occurredAt when provided", () => {
    const date = new Date("2026-05-19T12:00:00Z");
    const ev = buildCapiLeadEvent({
      leadId: "x",
      sourceUrl: "https://x/",
      occurredAt: date,
    });
    expect(ev.event_time).toBe(Math.floor(date.getTime() / 1000));
  });
});

describe("sendMetaCapiEvents", () => {
  it("returns ok=true with eventsReceived on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace_x" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const r = await sendMetaCapiEvents(
      { pixelId: "1234567890", accessToken: "EAAxxx", fetchImpl },
      [
        buildCapiLeadEvent({ leadId: "x", sourceUrl: "https://x/" }),
      ],
    );
    expect(r.ok).toBe(true);
    expect(r.eventsReceived).toBe(1);
    expect(r.fbtraceId).toBe("trace_x");
  });

  it("returns ok=false with error on 400", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid pixel" } }), { status: 400 }),
    ) as unknown as typeof fetch;

    const r = await sendMetaCapiEvents(
      { pixelId: "x", accessToken: "y", fetchImpl },
      [buildCapiLeadEvent({ leadId: "x", sourceUrl: "https://x/" })],
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Invalid pixel");
  });

  it("no-op (ok=true, 0 events) on empty batch", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await sendMetaCapiEvents(
      { pixelId: "x", accessToken: "y", fetchImpl },
      [],
    );
    expect(r.ok).toBe(true);
    expect(r.eventsReceived).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("test_event_code passed through", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await sendMetaCapiEvents(
      { pixelId: "x", accessToken: "y", testEventCode: "TEST12345", fetchImpl },
      [buildCapiLeadEvent({ leadId: "x", sourceUrl: "https://x/" })],
    );
    const body = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body["test_event_code"]).toBe("TEST12345");
  });

  it("network error returns ok=false", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("DNS fail")) as unknown as typeof fetch;
    const r = await sendMetaCapiEvents(
      { pixelId: "x", accessToken: "y", fetchImpl },
      [buildCapiLeadEvent({ leadId: "x", sourceUrl: "https://x/" })],
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("DNS fail");
  });
});
