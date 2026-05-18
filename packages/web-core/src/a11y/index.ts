/**
 * @mixturemarketing/web-core/a11y
 *
 * Accessibility primitives: WCAG 2.1 AA compliance helpers.
 *
 * Reference: plan/00-main.md (Faza 1), W3C WAI-ARIA Authoring Practices.
 *
 * Targets:
 *   - axe-core 0 violations on generated HTML
 *   - WCAG 2.1 AA (4.5:1 contrast, keyboard nav, landmark structure)
 *   - Manual NVDA / VoiceOver verification
 *
 * Design philosophy: pure TS, framework-agnostic. HTML helpers return strings or
 * structured snippets; runtime helpers operate on existing DOM. Astro/React/etc.
 * wrap as needed in their own components.
 */

export const MODULE_NAME = "a11y" as const;

// Skip link
export { skipLink } from "./skip-link.js";
export type { SkipLinkOptions } from "./skip-link.js";

// Visually hidden ("sr-only")
export { SR_ONLY_CLASS, VISUALLY_HIDDEN_CSS, visuallyHidden } from "./visually-hidden.js";

// Focus visible styles
export { focusVisibleStyles } from "./focus-visible.js";
export type { FocusVisibleOptions } from "./focus-visible.js";

// Accessible icon pattern
export { accessibleIcon, decorativeIcon } from "./accessible-icon.js";
export type { AccessibleIconOptions } from "./accessible-icon.js";

// Breadcrumb (HTML — pairs with /seo.breadcrumbSchema for JSON-LD)
export { BREADCRUMB_CSS, buildBreadcrumbHtml } from "./breadcrumb.js";
export type { BreadcrumbItem, BuildBreadcrumbOptions } from "./breadcrumb.js";

// Landmarks
export { LANDMARK_ROLES, landmarkAttrs, renderAttrs } from "./landmarks.js";
export type { LandmarkRole } from "./landmarks.js";

// Contrast / WCAG
export {
  checkContrast,
  contrastRatio,
  meetsAA,
  meetsAALarge,
  meetsAAA,
  meetsAAALarge,
  parseColor,
  parseHex,
  relativeLuminance,
} from "./contrast.js";
export type { ContrastReport, RGB } from "./contrast.js";

// Reduced motion
export { conditionalAnimationCss, onReducedMotionChange, prefersReducedMotion } from "./motion.js";

// Runtime helpers (require DOM)
export { findFocusable, focusTrap } from "./focus-trap.js";
export type { FocusTrapOptions } from "./focus-trap.js";

export { createLiveRegion } from "./live-region.js";
export type { LiveRegion, LiveRegionOptions } from "./live-region.js";

export { autoWireDisclosures, createDisclosure } from "./disclosure.js";
export type { DisclosureController, DisclosureOptions } from "./disclosure.js";

// Shared types
export type { CleanupFn, HtmlSnippet, LivePoliteness } from "./types.js";
