/**
 * Consistent :focus-visible styles.
 *
 * Modern :focus-visible only shows outline on keyboard navigation
 * (Tab key, screen reader), not on mouse click. Better UX without sacrificing a11y.
 *
 * WCAG 2.4.7 Focus Visible — REQUIRED for AA compliance.
 */

export interface FocusVisibleOptions {
  /** Outline color. Default "currentColor". For theme: use CSS var "var(--color-brand)". */
  outlineColor?: string;
  /** Outline width. Default "3px". */
  outlineWidth?: string;
  /** Outline offset. Default "2px". */
  outlineOffset?: string;
  /** Border radius to match. Default "4px". */
  borderRadius?: string;
}

/**
 * Inject consistent :focus-visible styles globally.
 *
 * Use in app's root layout:
 *   <style>{focusVisibleStyles()}</style>
 *
 * Or with theme color:
 *   <style>{focusVisibleStyles({ outlineColor: "var(--color-brand)" })}</style>
 */
export function focusVisibleStyles(options: FocusVisibleOptions = {}): string {
  const color = options.outlineColor ?? "currentColor";
  const width = options.outlineWidth ?? "3px";
  const offset = options.outlineOffset ?? "2px";
  const radius = options.borderRadius ?? "4px";

  return `
/* Suppress legacy :focus outline (only when :focus-visible supported) */
:focus:not(:focus-visible) {
  outline: none;
}

/* Show outline only for keyboard navigation */
:focus-visible {
  outline: ${width} solid ${color};
  outline-offset: ${offset};
  border-radius: ${radius};
}
`.trim();
}
