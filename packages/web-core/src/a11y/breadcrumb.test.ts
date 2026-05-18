import { describe, expect, it } from "vitest";

import { buildBreadcrumbHtml } from "./breadcrumb.js";

describe("buildBreadcrumbHtml", () => {
  it("renders nav with aria-label", () => {
    const html = buildBreadcrumbHtml([
      { name: "Home", url: "/" },
      { name: "Oferta" },
    ]);
    expect(html).toContain('<nav aria-label="breadcrumb"');
    expect(html).toContain("<ol");
  });

  it("last item has aria-current=page and no link", () => {
    const html = buildBreadcrumbHtml([
      { name: "A", url: "/a" },
      { name: "B" },
    ]);
    expect(html).toContain('aria-current="page"');
    // Last item should not have <a>
    const lastLi = html.match(/<li[^>]*>([^]*?)<\/li>/g)?.pop();
    expect(lastLi).toBeDefined();
    expect(lastLi).not.toContain("<a");
  });

  it("non-last items have links", () => {
    const html = buildBreadcrumbHtml([
      { name: "Home", url: "/" },
      { name: "Oferta", url: "/oferta" },
      { name: "Bieżąca" },
    ]);
    expect(html).toContain('<a href="/"');
    expect(html).toContain('<a href="/oferta"');
  });

  it("separator hidden from screen readers", () => {
    const html = buildBreadcrumbHtml([
      { name: "A", url: "/a" },
      { name: "B" },
    ]);
    expect(html).toContain('aria-hidden="true" class="breadcrumb-sep"');
  });

  it("custom separator", () => {
    const html = buildBreadcrumbHtml([{ name: "A", url: "/" }, { name: "B" }], {
      separator: ">",
    });
    expect(html).toContain(">");
  });

  it("custom aria-label", () => {
    const html = buildBreadcrumbHtml([{ name: "A", url: "/" }, { name: "B" }], {
      ariaLabel: "Okruszki",
    });
    expect(html).toContain('aria-label="Okruszki"');
  });

  it("throws on single item", () => {
    expect(() => buildBreadcrumbHtml([{ name: "Home" }])).toThrow(/at least 2/);
  });

  it("throws on empty", () => {
    expect(() => buildBreadcrumbHtml([])).toThrow();
  });

  it("escapes name and url", () => {
    const html = buildBreadcrumbHtml([
      { name: '<script>"', url: '/x"<' },
      { name: "OK" },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
