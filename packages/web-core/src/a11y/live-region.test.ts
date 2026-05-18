// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLiveRegion } from "./live-region.js";

describe("createLiveRegion", () => {
  let region: ReturnType<typeof createLiveRegion>;
  afterEach(() => {
    region?.destroy();
  });

  it("creates element with aria-live=polite by default", () => {
    region = createLiveRegion();
    expect(region.element.getAttribute("aria-live")).toBe("polite");
    expect(region.element.getAttribute("aria-atomic")).toBe("true");
    expect(region.element.classList.contains("sr-only")).toBe(true);
  });

  it("respects assertive politeness", () => {
    region = createLiveRegion({ politeness: "assertive" });
    expect(region.element.getAttribute("aria-live")).toBe("assertive");
  });

  it("custom id", () => {
    region = createLiveRegion({ id: "status" });
    expect(region.element.id).toBe("status");
  });

  it("hidden=false skips sr-only class", () => {
    region = createLiveRegion({ hidden: false });
    expect(region.element.classList.contains("sr-only")).toBe(false);
  });

  it("announce sets textContent", () => {
    region = createLiveRegion();
    region.announce("Wysłano!");
    expect(region.element.textContent).toBe("Wysłano!");
  });

  it("announce re-announces same string (textContent cleared first)", () => {
    region = createLiveRegion();
    region.announce("Save");
    region.announce("Save");
    expect(region.element.textContent).toBe("Save");
  });

  it("clear empties textContent", () => {
    region = createLiveRegion();
    region.announce("x");
    region.clear();
    expect(region.element.textContent).toBe("");
  });

  it("destroy removes from DOM", () => {
    region = createLiveRegion({ id: "test-destroy" });
    expect(document.getElementById("test-destroy")).toBeTruthy();
    region.destroy();
    expect(document.getElementById("test-destroy")).toBeNull();
  });

  it("custom parent", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    region = createLiveRegion({ parent });
    expect(region.element.parentElement).toBe(parent);
    parent.remove();
  });
});

describe("createLiveRegion SSR", () => {
  beforeEach(() => {
    // Simulate SSR — happy-dom has document, but our check is for `typeof document === "undefined"`
    // Can't actually unset document, but we test that runtime functions don't throw.
  });

  it("announce/clear/destroy are no-ops without throwing in normal env", () => {
    const r = createLiveRegion();
    expect(() => r.announce("x")).not.toThrow();
    expect(() => r.clear()).not.toThrow();
    expect(() => r.destroy()).not.toThrow();
  });
});
