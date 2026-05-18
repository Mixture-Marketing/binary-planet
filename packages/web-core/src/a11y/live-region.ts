/**
 * ARIA live region helper.
 *
 * Use case: dynamic content changes that screen readers should announce
 * (form submission status, async load completion, validation errors).
 *
 * Two politeness levels:
 *   - "polite" — announce when SR idle (most cases)
 *   - "assertive" — announce immediately, interrupting current (only critical errors)
 *
 * Pattern: hidden region in DOM, mutate textContent, SR announces change.
 */

import type { CleanupFn, LivePoliteness } from "./types.js";
import { SR_ONLY_CLASS } from "./visually-hidden.js";

export interface LiveRegionOptions {
  /** ARIA politeness level. Default "polite". */
  politeness?: LivePoliteness;
  /** Optional id for the region element. Default auto-generated. */
  id?: string;
  /** Parent element to append region to. Default document.body. */
  parent?: HTMLElement;
  /**
   * Whether to visually hide the region (sr-only). Default true.
   * Set false for status messages also useful visually.
   */
  hidden?: boolean;
  /** atomic — read whole region on change vs only added text. Default true. */
  atomic?: boolean;
}

export interface LiveRegion {
  /** Announce a message. Updates region textContent → SR reads it. */
  announce(message: string): void;
  /** Clear current message. */
  clear(): void;
  /** Element reference (rarely needed). */
  element: HTMLElement;
  /** Remove from DOM + cleanup. */
  destroy: CleanupFn;
}

/**
 * Create a live region. SSR-safe: returns no-op if document undefined.
 *
 * @example
 *   const status = createLiveRegion({ politeness: "polite" });
 *   formEl.addEventListener("submit", async () => {
 *     status.announce("Wysyłam...");
 *     await submit();
 *     status.announce("Wysłano! Odpowiadamy w 1h.");
 *   });
 *   // Cleanup on unmount: status.destroy();
 */
export function createLiveRegion(options: LiveRegionOptions = {}): LiveRegion {
  if (typeof document === "undefined") {
    return noOpRegion();
  }

  const politeness = options.politeness ?? "polite";
  const hidden = options.hidden ?? true;
  const atomic = options.atomic ?? true;
  const id = options.id ?? `live-region-${Math.random().toString(36).slice(2, 10)}`;

  const parent = options.parent ?? document.body;
  const element = document.createElement("div");
  element.setAttribute("id", id);
  element.setAttribute("aria-live", politeness);
  element.setAttribute("aria-atomic", String(atomic));
  if (hidden) {
    element.className = SR_ONLY_CLASS;
  }
  parent.appendChild(element);

  return {
    announce(message: string): void {
      // Clear first → set → ensures SR re-announces even if same string
      element.textContent = "";
      // Forced reflow trick — some SR ignore "same text" updates
      void element.offsetWidth;
      element.textContent = message;
    },
    clear(): void {
      element.textContent = "";
    },
    element,
    destroy(): void {
      element.remove();
    },
  };
}

function noOpRegion(): LiveRegion {
  // SSR fallback — runtime no-op
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = {
    announce: () => {},
    clear: () => {},
    element: {},
    destroy: () => {},
  };
  return stub as LiveRegion;
}
