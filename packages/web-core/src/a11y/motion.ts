/**
 * Reduced motion preference detection.
 *
 * Critical for vestibular disorders + general accessibility.
 * Astro pages should respect this for any animation > 200ms.
 */

/**
 * Check if user has requested reduced motion.
 * SSR-safe: returns false when window is undefined.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Subscribe to reduced-motion preference changes (user toggles OS setting mid-session).
 * Returns cleanup function.
 *
 * @example
 *   const cleanup = onReducedMotionChange((reduced) => {
 *     if (reduced) pauseAnimations();
 *     else resumeAnimations();
 *   });
 *   // later: cleanup();
 */
export function onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (e: MediaQueryListEvent): void => callback(e.matches);
  // Modern API (Safari 14+, Chrome 14+)
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }
  // Legacy fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mq as any).addListener?.(handler);
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mq as any).removeListener?.(handler);
  };
}

/**
 * Conditional CSS — emits two blocks: full + reduced.
 *
 * Pattern:
 *   <style>{conditionalAnimationCss({
 *     full: ".fade-in { animation: fadeIn 300ms; }",
 *     reduced: ".fade-in { animation: none; }",
 *   })}</style>
 */
export function conditionalAnimationCss(opts: { full: string; reduced: string }): string {
  return `@media (prefers-reduced-motion: no-preference) { ${opts.full} }
@media (prefers-reduced-motion: reduce) { ${opts.reduced} }`;
}
