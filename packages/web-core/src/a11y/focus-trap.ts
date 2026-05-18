/**
 * Focus trap for modal-like UI (drawers, dialogs, lightboxes).
 *
 * Behavior:
 *   - Tab cycles through focusable elements inside the trap container
 *   - Shift+Tab goes backwards
 *   - Escape key calls onEscape callback (caller closes modal)
 *   - Initial focus goes to first focusable OR explicit `initialFocus` element
 *   - Returns cleanup function that restores previous focus
 *
 * WAI-ARIA Authoring Practices — Dialog (Modal) pattern.
 */

import type { CleanupFn } from "./types.js";

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'details > summary:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(", ");

export interface FocusTrapOptions {
  /** Element to focus when trap activates. Default: first focusable in container. */
  initialFocus?: HTMLElement | null;
  /** Called when Escape pressed. Caller should close the modal. */
  onEscape?: () => void;
  /**
   * Element to restore focus to on cleanup. Default: document.activeElement at activation.
   */
  restoreFocus?: HTMLElement | null;
}

/**
 * Activate focus trap inside `container`. Returns cleanup function.
 *
 * @example
 *   const cleanup = focusTrap(modalEl, { onEscape: () => closeModal() });
 *   // When closing modal:
 *   cleanup();
 */
export function focusTrap(container: HTMLElement, options: FocusTrapOptions = {}): CleanupFn {
  const doc = container.ownerDocument;
  const previouslyFocused = options.restoreFocus ?? (doc.activeElement as HTMLElement | null);

  const getFocusable = (): HTMLElement[] => {
    // Note: we don't filter by offsetWidth/Height — display:none elements aren't
    // matched by FOCUSABLE_SELECTOR anyway (selector excludes `[disabled]` and
    // `[tabindex="-1"]`), and offsetWidth doesn't work without layout (happy-dom).
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  };

  // Initial focus
  const initial = options.initialFocus ?? getFocusable()[0] ?? container;
  initial.focus();

  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      options.onEscape?.();
      return;
    }
    if (e.key !== "Tab") return;

    const focusable = getFocusable();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = doc.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      // Shift+Tab — backwards
      if (active === first || !active || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab — forwards
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Click outside trap → refocus container (prevents focus escape via click)
  const handleFocusIn = (e: FocusEvent): void => {
    const target = e.target as Node | null;
    if (target && !container.contains(target)) {
      const focusable = getFocusable();
      (focusable[0] ?? container).focus();
    }
  };

  doc.addEventListener("keydown", handleKeydown);
  doc.addEventListener("focusin", handleFocusIn);

  return function cleanup(): void {
    doc.removeEventListener("keydown", handleKeydown);
    doc.removeEventListener("focusin", handleFocusIn);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  };
}

/**
 * List focusable descendants of an element (utility — exported for tests + advanced use).
 */
export function findFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}
