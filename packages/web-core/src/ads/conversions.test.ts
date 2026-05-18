// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fireContactClick,
  fireGbpDirectionClick,
  fireLeadConversion,
  firePhoneClick,
  fireQuoteCompleted,
  fireQuoteStarted,
  fireVisitor,
  generateEventId,
} from "./conversions.js";

declare global {
  // eslint-disable-next-line no-var
  var zaraz: { track: (n: string, p?: unknown) => void } | undefined;
}

describe("generateEventId", () => {
  it("returns prefix + timestamp + random", () => {
    const id = generateEventId("test");
    expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
  });

  it("unique across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId("x")));
    expect(ids.size).toBe(100);
  });
});

describe("conversion helpers", () => {
  let trackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackSpy = vi.fn();
    globalThis.zaraz = { track: trackSpy };
    // Clear cookies to avoid GCLID interference
    for (const name of ["_gcl_aw", "_gcl_gb", "_fbc", "_msclkid", "_ttp"]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  });

  afterEach(() => {
    globalThis.zaraz = undefined;
  });

  it("fireLeadConversion fires lead_form_submit + returns event_id", () => {
    const eventId = fireLeadConversion({ form_id: "contact", value: 250 });
    expect(eventId).toMatch(/^lead_/);
    expect(trackSpy).toHaveBeenCalledWith(
      "lead_form_submit",
      expect.objectContaining({
        event_id: eventId,
        form_id: "contact",
        value: 250,
        currency: "PLN",
      }),
    );
  });

  it("firePhoneClick → phone_click event", () => {
    const eventId = firePhoneClick({ position: "hero" });
    expect(eventId).toMatch(/^phone_/);
    expect(trackSpy).toHaveBeenCalledWith(
      "phone_click",
      expect.objectContaining({ event_id: eventId, position: "hero" }),
    );
  });

  it("fireContactClick handles each channel", () => {
    fireContactClick("email", { position: "footer" });
    expect(trackSpy).toHaveBeenLastCalledWith(
      "email_click",
      expect.objectContaining({ position: "footer" }),
    );
    fireContactClick("whatsapp");
    expect(trackSpy).toHaveBeenLastCalledWith("whatsapp_click", expect.anything());
  });

  it("fireQuoteCompleted includes currency + value", () => {
    fireQuoteCompleted({ value: 500, service_interest: "wymiana-zamkow" });
    expect(trackSpy).toHaveBeenCalledWith(
      "quote_completed",
      expect.objectContaining({ value: 500, currency: "PLN", service_interest: "wymiana-zamkow" }),
    );
  });

  it("fireQuoteStarted no value required", () => {
    fireQuoteStarted();
    expect(trackSpy).toHaveBeenCalledWith("quote_started", expect.objectContaining({}));
  });

  it("fireGbpDirectionClick", () => {
    fireGbpDirectionClick({ position: "header" });
    expect(trackSpy).toHaveBeenCalledWith(
      "gbp_direction_click",
      expect.objectContaining({ position: "header" }),
    );
  });

  it("fireVisitor → page_view", () => {
    fireVisitor({ page_path: "/oferta" });
    expect(trackSpy).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({ page_path: "/oferta" }),
    );
  });

  it("includes stored click IDs when present", () => {
    document.cookie = "_gcl_aw=savedgclid; Path=/";
    fireLeadConversion();
    const call = trackSpy.mock.calls[0]!;
    expect(call[1]).toMatchObject({ gclid: "savedgclid" });
  });
});
