// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { autoWireDisclosures, createDisclosure } from "./disclosure.js";

describe("createDisclosure", () => {
  let trigger: HTMLButtonElement;
  let content: HTMLDivElement;

  beforeEach(() => {
    trigger = document.createElement("button");
    content = document.createElement("div");
    content.id = "content";
    document.body.append(trigger, content);
  });

  afterEach(() => {
    trigger.remove();
    content.remove();
  });

  it("starts closed by default + sets aria-expanded=false + hidden", () => {
    const dc = createDisclosure(trigger, content);
    expect(dc.isOpen()).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(content.hasAttribute("hidden")).toBe(true);
    dc.destroy();
  });

  it("initiallyOpen=true opens immediately", () => {
    const dc = createDisclosure(trigger, content, { initiallyOpen: true });
    expect(dc.isOpen()).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(content.hasAttribute("hidden")).toBe(false);
    dc.destroy();
  });

  it("click toggles", () => {
    const dc = createDisclosure(trigger, content);
    trigger.click();
    expect(dc.isOpen()).toBe(true);
    expect(content.hasAttribute("hidden")).toBe(false);
    trigger.click();
    expect(dc.isOpen()).toBe(false);
    expect(content.hasAttribute("hidden")).toBe(true);
    dc.destroy();
  });

  it("auto-sets aria-controls from content id", () => {
    createDisclosure(trigger, content);
    expect(trigger.getAttribute("aria-controls")).toBe("content");
  });

  it("respects pre-existing aria-controls", () => {
    trigger.setAttribute("aria-controls", "custom-id");
    createDisclosure(trigger, content);
    expect(trigger.getAttribute("aria-controls")).toBe("custom-id");
  });

  it("destroy removes click listener", () => {
    const dc = createDisclosure(trigger, content);
    dc.destroy();
    trigger.click();
    // Should NOT have toggled because listener removed (but state stays as before destroy)
    expect(content.hasAttribute("hidden")).toBe(true);
  });

  it("open() / close() / toggle() programmatic", () => {
    const dc = createDisclosure(trigger, content);
    dc.open();
    expect(dc.isOpen()).toBe(true);
    dc.close();
    expect(dc.isOpen()).toBe(false);
    dc.toggle();
    expect(dc.isOpen()).toBe(true);
    dc.destroy();
  });

  it("onToggle callback overrides default hidden attr behavior", () => {
    const toggles: boolean[] = [];
    const dc = createDisclosure(trigger, content, {
      onToggle: (open) => {
        toggles.push(open);
      },
    });
    trigger.click();
    trigger.click();
    expect(toggles).toEqual([false, true, false]); // initial false + 2 clicks
    // Default hidden behavior should be skipped
    dc.destroy();
  });
});

describe("autoWireDisclosures", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-disclosure-trigger="content-a">A</button>
      <div id="content-a" data-disclosure-content hidden>A content</div>
      <button data-disclosure-trigger="content-b">B</button>
      <div id="content-b" data-disclosure-content hidden>B content</div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("wires all marked pairs", () => {
    const cleanup = autoWireDisclosures();
    const btnA = document.querySelector<HTMLButtonElement>('[data-disclosure-trigger="content-a"]')!;
    const contentA = document.getElementById("content-a")!;
    btnA.click();
    expect(contentA.hasAttribute("hidden")).toBe(false);
    cleanup();
  });

  it("cleanup unwires all", () => {
    const cleanup = autoWireDisclosures();
    cleanup();
    const btnA = document.querySelector<HTMLButtonElement>('[data-disclosure-trigger="content-a"]')!;
    const contentA = document.getElementById("content-a")!;
    btnA.click();
    // hidden was set during apply at activation, click does nothing now
    expect(contentA.hasAttribute("hidden")).toBe(true);
  });
});
