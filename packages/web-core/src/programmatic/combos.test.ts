import { describe, expect, it } from "vitest";

import { buildCombos, buildSlug, findDuplicateSlugs, slugifyPolish } from "./combos.js";

describe("slugifyPolish", () => {
  it("removes diacritics", () => {
    expect(slugifyPolish("Rzeszów")).toBe("rzeszow");
    expect(slugifyPolish("Świętokrzyskie")).toBe("swietokrzyskie");
    expect(slugifyPolish("Łańcut")).toBe("lancut");
  });

  it("handles compound names", () => {
    expect(slugifyPolish("Bielsko-Biała")).toBe("bielsko-biala");
    expect(slugifyPolish("Gorzów Wielkopolski")).toBe("gorzow-wielkopolski");
  });

  it("collapses multiple separators", () => {
    expect(slugifyPolish("a  b")).toBe("a-b");
    expect(slugifyPolish("a---b")).toBe("a-b");
  });

  it("trims edge separators", () => {
    expect(slugifyPolish("-rzeszow-")).toBe("rzeszow");
    expect(slugifyPolish("  Rzeszów  ")).toBe("rzeszow");
  });
});

describe("buildSlug", () => {
  it("composes basePath + service + location slugs", () => {
    expect(
      buildSlug("/uslugi", { slug: "otwieranie-zamkow", name: "X" }, { name: "Rzeszów" }),
    ).toBe("/uslugi/otwieranie-zamkow/rzeszow");
  });

  it("honors explicit location slug", () => {
    expect(
      buildSlug("/x", { slug: "y", name: "Y" }, { name: "Bielsko-Biała", slug: "bb" }),
    ).toBe("/x/y/bb");
  });
});

describe("buildCombos", () => {
  const services = [
    { slug: "a", name: "A", priority: 8 },
    { slug: "b", name: "B", priority: 5 },
  ];
  const locations = ["Rzeszów", "Łańcut", "Tyczyn"];

  it("cartesian product", () => {
    const { selected } = buildCombos({ services, locations, maxPages: 100 });
    expect(selected).toHaveLength(6);
  });

  it("caps to maxPages", () => {
    const { selected, cappedOut } = buildCombos({ services, locations, maxPages: 3 });
    expect(selected).toHaveLength(3);
    expect(cappedOut).toHaveLength(3);
  });

  it("sorts by priority DESC then slug", () => {
    const { selected } = buildCombos({ services, locations, maxPages: 100 });
    // First three should all be service A (priority 8 + 5 = 13)
    expect(selected.slice(0, 3).every((c) => c.service.slug === "a")).toBe(true);
    expect(selected.slice(3).every((c) => c.service.slug === "b")).toBe(true);
  });

  it("normalizes string locations", () => {
    const { selected } = buildCombos({
      services: [{ slug: "x", name: "X" }],
      locations: ["Rzeszów"],
      maxPages: 10,
    });
    expect(selected[0]?.location.name).toBe("Rzeszów");
    expect(selected[0]?.slug).toBe("/uslugi/x/rzeszow");
  });

  it("honors basePath override", () => {
    const { selected } = buildCombos({
      services: [{ slug: "x", name: "X" }],
      locations: ["Y"],
      maxPages: 1,
      basePath: "/services",
    });
    expect(selected[0]?.slug).toBe("/services/x/y");
  });
});

describe("findDuplicateSlugs", () => {
  it("returns empty for unique slugs", () => {
    expect(
      findDuplicateSlugs([
        { service: { slug: "a", name: "A" }, location: { name: "X" }, slug: "/x", priority: 1 },
        { service: { slug: "b", name: "B" }, location: { name: "Y" }, slug: "/y", priority: 1 },
      ]),
    ).toEqual([]);
  });

  it("detects collisions", () => {
    const dups = findDuplicateSlugs([
      { service: { slug: "a", name: "A" }, location: { name: "X" }, slug: "/x", priority: 1 },
      { service: { slug: "b", name: "B" }, location: { name: "Y" }, slug: "/x", priority: 1 },
    ]);
    expect(dups).toEqual(["/x"]);
  });
});
