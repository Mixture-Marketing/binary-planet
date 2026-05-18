import { describe, expect, it } from "vitest";

import { skipLink } from "./skip-link.js";

describe("skipLink", () => {
  it("default — Polish label + #main target", () => {
    const { html, css } = skipLink();
    expect(html).toContain('href="#main"');
    expect(html).toContain("Przejdź do treści głównej");
    expect(html).toContain('class="skip-link"');
    expect(css).toContain(".skip-link");
    expect(css).toContain("left: -9999px");
  });

  it("custom targetId + label", () => {
    const { html } = skipLink({ targetId: "content", label: "Skip to main" });
    expect(html).toContain('href="#content"');
    expect(html).toContain("Skip to main");
  });

  it("escapes HTML in label", () => {
    const { html } = skipLink({ label: '<script>alert("xss")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses custom colors", () => {
    const { css } = skipLink({ bg: "#000000", fg: "#ffffff" });
    expect(css).toContain("background: #000000");
    expect(css).toContain("color: #ffffff");
  });
});
