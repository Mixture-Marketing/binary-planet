/**
 * Shared a11y types.
 *
 * Design philosophy: web-core/a11y ships PURE TS helpers — no framework binding.
 * Returns HTML strings (for SSR / Astro `set:html`) OR runtime init functions
 * (for browser-side JS that operates on existing DOM).
 *
 * Targets:
 *   - axe-core 0 violations on generated HTML
 *   - WCAG 2.1 AA (4.5:1 contrast, keyboard nav, landmarks)
 *   - Manual NVDA / VoiceOver pass
 */

/** Common HTML-output shape — HTML string + optional CSS to inject in <style>. */
export interface HtmlSnippet {
  /** Sanitized HTML — safe to `set:html` / `dangerouslySetInnerHTML`. */
  html: string;
  /** Optional CSS to include in `<style>` block (component-scoped). */
  css?: string;
}

/** Cleanup function returned by runtime helpers (focus trap, live region, disclosure). */
export type CleanupFn = () => void;

/** Standard ARIA "live" politeness levels. */
export type LivePoliteness = "polite" | "assertive" | "off";
