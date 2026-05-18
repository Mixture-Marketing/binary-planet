import { describe, expect, it } from "vitest";

import { accessibleIcon, decorativeIcon } from "./accessible-icon.js";

describe("accessibleIcon", () => {
  it("wraps icon + sr-only label", () => {
    const out = accessibleIcon({ icon: "<svg></svg>", label: "Otwórz menu" });
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("<svg></svg>");
    expect(out).toContain('class="sr-only"');
    expect(out).toContain("Otwórz menu");
  });

  it("escapes label", () => {
    const out = accessibleIcon({ icon: "i", label: '<bad>"' });
    expect(out).not.toContain("<bad>");
    expect(out).toContain("&lt;bad&gt;");
    expect(out).toContain("&quot;");
  });
});

describe("decorativeIcon", () => {
  it("wraps icon in aria-hidden span", () => {
    const out = decorativeIcon("📞");
    expect(out).toBe('<span aria-hidden="true">📞</span>');
  });
});
