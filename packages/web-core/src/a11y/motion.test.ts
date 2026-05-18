// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { conditionalAnimationCss, onReducedMotionChange, prefersReducedMotion } from "./motion.js";

describe("prefersReducedMotion", () => {
  it("returns false when matchMedia not available", () => {
    const original = window.matchMedia;
    // @ts-expect-error — intentional override for test
    delete window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
    window.matchMedia = original;
  });

  it("respects matchMedia result", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    });
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = original;
  });
});

describe("onReducedMotionChange", () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("registers change listener + returns cleanup", () => {
    const added = vi.fn();
    const removed = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: added,
      removeEventListener: removed,
    });
    const cleanup = onReducedMotionChange(() => {});
    expect(added).toHaveBeenCalledWith("change", expect.any(Function));
    cleanup();
    expect(removed).toHaveBeenCalled();
  });

  it("returns no-op cleanup when matchMedia missing", () => {
    // @ts-expect-error — intentional
    delete window.matchMedia;
    const cleanup = onReducedMotionChange(() => {});
    expect(cleanup).toBeInstanceOf(Function);
    cleanup(); // shouldn't throw
  });
});

describe("conditionalAnimationCss", () => {
  it("emits both prefers branches", () => {
    const css = conditionalAnimationCss({
      full: ".x { animation: a 300ms; }",
      reduced: ".x { animation: none; }",
    });
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: a 300ms");
    expect(css).toContain("animation: none");
  });
});
