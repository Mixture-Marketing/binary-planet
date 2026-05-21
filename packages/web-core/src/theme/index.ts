/**
 * @mixturemarketing/web-core/theme
 * Color palette generator + WCAG contrast helpers.
 *
 * Used by:
 *   - apps/starter/src/themes/registry.ts (per-styl tokens generation)
 *   - apps/panel/src/pages/ustawienia.astro (live custom HEX preview)
 *   - apps/control-plane/src/scheduled/provision-client.ts (auto-palette in config)
 */

export * from "./color-generator.js";
export * from "./preview-svg.js";
