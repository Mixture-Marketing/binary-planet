import { describe, expect, it } from "vitest";

import { buildPermissionsPolicy, DEFAULT_DENY_ALL } from "./permissions-policy.js";

describe("buildPermissionsPolicy", () => {
  it("uses DEFAULT_DENY_ALL when no input", () => {
    const out = buildPermissionsPolicy();
    expect(out).toContain("camera=()");
    expect(out).toContain("geolocation=()");
    expect(out).toContain("interest-cohort=()"); // FLoC opt-out
    expect(out).toContain("payment=()");
  });

  it("renders 'self' as (self)", () => {
    const out = buildPermissionsPolicy({ fullscreen: "self" });
    expect(out).toBe("fullscreen=(self)");
  });

  it("renders 'none' as ()", () => {
    const out = buildPermissionsPolicy({ camera: "none" });
    expect(out).toBe("camera=()");
  });

  it("renders '*' literal", () => {
    const out = buildPermissionsPolicy({ autoplay: "*" });
    expect(out).toBe("autoplay=*");
  });

  it("renders origin list with quoting", () => {
    const out = buildPermissionsPolicy({
      camera: ["self", "https://embed.example.pl"],
    });
    expect(out).toBe('camera=(self "https://embed.example.pl")');
  });

  it("joins multiple features with comma", () => {
    const out = buildPermissionsPolicy({
      camera: "none",
      geolocation: "none",
      fullscreen: "self",
    });
    const parts = out.split(", ");
    expect(parts).toContain("camera=()");
    expect(parts).toContain("geolocation=()");
    expect(parts).toContain("fullscreen=(self)");
  });

  it("DEFAULT_DENY_ALL covers >25 features", () => {
    expect(Object.keys(DEFAULT_DENY_ALL).length).toBeGreaterThan(25);
  });
});
