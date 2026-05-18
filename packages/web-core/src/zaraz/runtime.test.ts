// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { autoTrackClicks, identifyVisitor, isZarazLoaded, trackEvent } from "./runtime.js";

declare global {
  // eslint-disable-next-line no-var
  var zaraz: { track: (name: string, params?: unknown) => void; set?: (k: string, v: unknown) => void } | undefined;
  // eslint-disable-next-line no-var
  var dataLayer: unknown[] | undefined;
}

describe("trackEvent", () => {
  let zarazSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    zarazSpy = vi.fn();
    globalThis.zaraz = { track: zarazSpy };
    globalThis.dataLayer = undefined;
  });

  afterEach(() => {
    globalThis.zaraz = undefined;
    globalThis.dataLayer = undefined;
  });

  it("dispatches via zaraz.track when available", () => {
    const ok = trackEvent("lead_form_submit", { form_id: "contact" });
    expect(ok).toBe(true);
    expect(zarazSpy).toHaveBeenCalledWith("lead_form_submit", { form_id: "contact" });
  });

  it("strips undefined params", () => {
    trackEvent("phone_click", { position: "hero", missing: undefined });
    expect(zarazSpy).toHaveBeenCalledWith("phone_click", { position: "hero" });
  });

  it("falls back to dataLayer when zaraz absent", () => {
    globalThis.zaraz = undefined;
    globalThis.dataLayer = [];
    const ok = trackEvent("page_view", { page_path: "/" });
    expect(ok).toBe(true);
    expect(globalThis.dataLayer).toHaveLength(1);
    expect((globalThis.dataLayer![0] as Record<string, unknown>)["event"]).toBe("page_view");
  });

  it("returns false when no destination", () => {
    globalThis.zaraz = undefined;
    globalThis.dataLayer = undefined;
    expect(trackEvent("page_view")).toBe(false);
  });

  it("zaraz throw → falls back to dataLayer", () => {
    globalThis.zaraz = {
      track: () => {
        throw new Error("zaraz boom");
      },
    };
    globalThis.dataLayer = [];
    const ok = trackEvent("lead_form_submit");
    expect(ok).toBe(true);
    expect(globalThis.dataLayer).toHaveLength(1);
  });
});

describe("identifyVisitor", () => {
  it("calls zaraz.set per property", () => {
    const setSpy = vi.fn();
    globalThis.zaraz = { track: vi.fn(), set: setSpy };
    const ok = identifyVisitor({ visitor_id_hash: "abc", segment: "premium" });
    expect(ok).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(2);
    globalThis.zaraz = undefined;
  });

  it("returns false when zaraz.set unavailable", () => {
    globalThis.zaraz = { track: vi.fn() };
    expect(identifyVisitor({ x: "y" })).toBe(false);
    globalThis.zaraz = undefined;
  });
});

describe("autoTrackClicks", () => {
  let zarazSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    zarazSpy = vi.fn();
    globalThis.zaraz = { track: zarazSpy };
    document.body.innerHTML = "";
  });

  afterEach(() => {
    globalThis.zaraz = undefined;
    document.body.innerHTML = "";
  });

  it("fires event on click of element with data-track-event", () => {
    document.body.innerHTML = `<a href="tel:..." data-track-event="phone_click" data-track-position="hero">Call</a>`;
    const cleanup = autoTrackClicks();
    document.querySelector("a")!.click();
    expect(zarazSpy).toHaveBeenCalledWith("phone_click", { position: "hero" });
    cleanup();
  });

  it("walks up to nearest data-track-event ancestor", () => {
    document.body.innerHTML = `
      <button data-track-event="phone_click" data-track-position="header">
        <span><svg></svg></span>
      </button>`;
    const cleanup = autoTrackClicks();
    document.querySelector("span")!.click();
    expect(zarazSpy).toHaveBeenCalledWith("phone_click", { position: "header" });
    cleanup();
  });

  it("no-op if no data-track-event ancestor", () => {
    document.body.innerHTML = `<a href="/">Home</a>`;
    const cleanup = autoTrackClicks();
    document.querySelector("a")!.click();
    expect(zarazSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it("cleanup detaches handler", () => {
    document.body.innerHTML = `<a data-track-event="x">a</a>`;
    const cleanup = autoTrackClicks();
    cleanup();
    document.querySelector("a")!.click();
    expect(zarazSpy).not.toHaveBeenCalled();
  });
});

describe("isZarazLoaded", () => {
  it("true when window.zaraz.track exists", () => {
    globalThis.zaraz = { track: vi.fn() };
    expect(isZarazLoaded()).toBe(true);
    globalThis.zaraz = undefined;
  });

  it("false when missing", () => {
    globalThis.zaraz = undefined;
    expect(isZarazLoaded()).toBe(false);
  });
});
