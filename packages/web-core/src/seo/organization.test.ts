import { describe, expect, it } from "vitest";

import { organizationSchema } from "./organization.js";

describe("organizationSchema", () => {
  it("emits minimal Organization", () => {
    const out = organizationSchema({ url: "https://x.pl", name: "MM" });
    expect(out["@type"]).toBe("Organization");
    expect(out.name).toBe("MM");
    expect(out["@id"]).toBe("https://x.pl/#organization");
  });

  it("includes logo with dimensions", () => {
    const out = organizationSchema({
      url: "https://x.pl",
      name: "X",
      logo: { url: "https://x.pl/logo.png", width: 200, height: 200 },
    });
    expect(out.logo).toEqual({ "@type": "ImageObject", url: "https://x.pl/logo.png", width: 200, height: 200 });
  });

  it("includes contact points", () => {
    const out = organizationSchema({
      url: "https://x.pl",
      name: "X",
      contactPoints: [
        {
          contactType: "customer service",
          telephone: "+48171234567",
          availableLanguage: ["pl", "en"],
          areaServed: "PL",
        },
      ],
    });
    expect(out.contactPoint).toHaveLength(1);
    expect(out.contactPoint?.[0]).toEqual({
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: "+48171234567",
      availableLanguage: ["pl", "en"],
      areaServed: "PL",
    });
  });

  it("includes sameAs URLs", () => {
    const out = organizationSchema({
      url: "https://x.pl",
      name: "X",
      sameAs: ["https://facebook.com/x", "https://linkedin.com/x"],
    });
    expect(out.sameAs).toEqual(["https://facebook.com/x", "https://linkedin.com/x"]);
  });

  it("includes tax + VAT IDs", () => {
    const out = organizationSchema({
      url: "https://x.pl",
      name: "X",
      taxID: "8121234567",
      vatID: "PL8121234567",
    });
    expect(out.taxID).toBe("8121234567");
    expect(out.vatID).toBe("PL8121234567");
  });

  it("throws on missing name", () => {
    expect(() => organizationSchema({ url: "https://x.pl", name: "" })).toThrow(/name/);
  });
});
