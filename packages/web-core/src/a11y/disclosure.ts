/**
 * Disclosure pattern — collapsible content controlled by a button.
 *
 * Use cases: FAQ accordions, "Show more", mobile menu toggle.
 * Pattern: button with aria-expanded="true|false" + aria-controls referencing target.
 *
 * WAI-ARIA Authoring Practices — Disclosure pattern.
 *
 * Implementation: Vanilla JS, framework-agnostic. SSR-safe HTML can be generated separately.
 */

import type { CleanupFn } from "./types.js";

export interface DisclosureOptions {
  /** Whether the content starts open. Default false (closed). */
  initiallyOpen?: boolean;
  /**
   * Custom open/close behavior — toggle CSS class instead of hidden attr.
   * Useful when animating with CSS transitions.
   */
  onToggle?: (isOpen: boolean) => void;
}

export interface DisclosureController {
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  /** Remove event listeners + restore initial state. */
  destroy: CleanupFn;
}

/**
 * Wire up a disclosure pair: button toggles visibility of content.
 *
 * Requires HTML already set up:
 *   <button aria-controls="my-content" aria-expanded="false">Toggle</button>
 *   <div id="my-content" hidden>...</div>
 *
 * @example
 *   const btn = document.querySelector('[data-disclosure-trigger]');
 *   const content = document.querySelector('[data-disclosure-content]');
 *   const dc = createDisclosure(btn, content);
 *   // dc.toggle(), dc.isOpen()
 */
export function createDisclosure(
  trigger: HTMLElement,
  content: HTMLElement,
  options: DisclosureOptions = {},
): DisclosureController {
  let isOpen = options.initiallyOpen ?? false;

  const apply = (): void => {
    trigger.setAttribute("aria-expanded", String(isOpen));
    if (options.onToggle) {
      options.onToggle(isOpen);
    } else {
      if (isOpen) content.removeAttribute("hidden");
      else content.setAttribute("hidden", "");
    }
  };

  // Ensure trigger has aria-controls if not already set
  if (!trigger.hasAttribute("aria-controls") && content.id) {
    trigger.setAttribute("aria-controls", content.id);
  }

  apply();

  const handleClick = (e: Event): void => {
    e.preventDefault();
    isOpen = !isOpen;
    apply();
  };

  trigger.addEventListener("click", handleClick);

  return {
    isOpen: () => isOpen,
    open: () => {
      isOpen = true;
      apply();
    },
    close: () => {
      isOpen = false;
      apply();
    },
    toggle: () => {
      isOpen = !isOpen;
      apply();
    },
    destroy: () => {
      trigger.removeEventListener("click", handleClick);
    },
  };
}

/**
 * Auto-wire all disclosure pairs marked with data attributes.
 * Convention:
 *   <button data-disclosure-trigger="my-content">Toggle</button>
 *   <div id="my-content" data-disclosure-content hidden>...</div>
 */
export function autoWireDisclosures(root: HTMLElement | Document = document): CleanupFn {
  const triggers = root.querySelectorAll<HTMLElement>("[data-disclosure-trigger]");
  const cleanups: CleanupFn[] = [];
  for (const trigger of Array.from(triggers)) {
    const targetId = trigger.getAttribute("data-disclosure-trigger");
    if (!targetId) continue;
    const doc = trigger.ownerDocument;
    const content = doc.getElementById(targetId);
    if (!content) continue;
    cleanups.push(createDisclosure(trigger, content).destroy);
  }
  return (): void => {
    for (const c of cleanups) c();
  };
}
