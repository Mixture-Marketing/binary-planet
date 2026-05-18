/**
 * @mixturemarketing/web-core/a11y
 *
 * Scope: 8 reusable a11y-correct components (Astro + framework-agnostic primitives):
 *  - SkipLink
 *  - VisuallyHidden
 *  - FocusTrap (modal, drawer)
 *  - AccessibleIcon (icon + sr-only label pattern)
 *  - LiveRegion (aria-live announcements)
 *  - DisclosureButton (aria-expanded)
 *  - Breadcrumb (aria-label, structured)
 *  - LandmarkLayout (main, nav, aside, footer with proper roles)
 *
 * Plus utilities:
 *  - prefersReducedMotion() helper
 *  - contrastRatio(fg, bg) ≥4.5:1 check
 *  - focusVisibleStyles() injectable CSS
 *
 * Target: axe-core 0 violations, manual NVDA pass, kontrast 4.5:1+.
 */

export const MODULE_NAME = "a11y" as const;
