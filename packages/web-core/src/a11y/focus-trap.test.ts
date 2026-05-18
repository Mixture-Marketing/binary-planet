// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findFocusable, focusTrap } from "./focus-trap.js";

describe("findFocusable", () => {
  it("finds buttons, links, inputs, selects, textareas", () => {
    const div = document.createElement("div");
    div.innerHTML = `
      <button id="b1">B1</button>
      <a id="l1" href="/x">L1</a>
      <input id="i1" type="text" />
      <select id="s1"><option>x</option></select>
      <textarea id="t1"></textarea>
      <span>not focusable</span>
    `;
    document.body.appendChild(div);
    const focusable = findFocusable(div);
    const ids = focusable.map((el) => el.id);
    expect(ids).toEqual(["b1", "l1", "i1", "s1", "t1"]);
    div.remove();
  });

  it("excludes disabled + tabindex=-1", () => {
    const div = document.createElement("div");
    div.innerHTML = `
      <button id="ok">ok</button>
      <button id="dis" disabled>dis</button>
      <button id="tabneg" tabindex="-1">tabneg</button>
      <button id="tabzero" tabindex="0">tabzero</button>
    `;
    document.body.appendChild(div);
    const ids = findFocusable(div).map((el) => el.id);
    expect(ids).toContain("ok");
    expect(ids).not.toContain("dis");
    expect(ids).not.toContain("tabneg");
    expect(ids).toContain("tabzero");
    div.remove();
  });

  it("excludes type=hidden inputs", () => {
    const div = document.createElement("div");
    div.innerHTML = `<input id="hidden" type="hidden" /><input id="text" type="text" />`;
    document.body.appendChild(div);
    const ids = findFocusable(div).map((el) => el.id);
    expect(ids).not.toContain("hidden");
    expect(ids).toContain("text");
    div.remove();
  });
});

describe("focusTrap", () => {
  let container: HTMLDivElement;
  let externalBtn: HTMLButtonElement;

  beforeEach(() => {
    externalBtn = document.createElement("button");
    externalBtn.id = "external";
    document.body.appendChild(externalBtn);
    externalBtn.focus();

    container = document.createElement("div");
    container.innerHTML = `
      <button id="first">First</button>
      <button id="mid">Mid</button>
      <button id="last">Last</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    externalBtn.remove();
  });

  it("focuses first focusable on activate", () => {
    const cleanup = focusTrap(container);
    expect(document.activeElement?.id).toBe("first");
    cleanup();
  });

  it("uses initialFocus override", () => {
    const mid = container.querySelector<HTMLButtonElement>("#mid")!;
    const cleanup = focusTrap(container, { initialFocus: mid });
    expect(document.activeElement?.id).toBe("mid");
    cleanup();
  });

  it("Escape calls onEscape", () => {
    const onEscape = vi.fn();
    const cleanup = focusTrap(container, { onEscape });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onEscape).toHaveBeenCalledOnce();
    cleanup();
  });

  it("cleanup restores previous focus", () => {
    const cleanup = focusTrap(container);
    expect(document.activeElement?.id).toBe("first");
    cleanup();
    expect(document.activeElement?.id).toBe("external");
  });

  it("restoreFocus override is honored", () => {
    const target = document.createElement("button");
    target.id = "restore-target";
    document.body.appendChild(target);
    const cleanup = focusTrap(container, { restoreFocus: target });
    cleanup();
    expect(document.activeElement?.id).toBe("restore-target");
    target.remove();
  });
});
