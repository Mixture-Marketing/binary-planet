/**
 * @mixturemarketing/web-core/ornaments
 * SVG ornaments / dingbats for Magazynowy + Elegancki styles.
 */

import { ORNAMENT_PATHS, type OrnamentName } from "./paths.js";

export * from "./paths.js";

/**
 * Builds a complete SVG <svg> tag for given ornament + size.
 *
 * @example
 *   <Fragment set:html={buildOrnamentSvg("divider-fleuron", { width: 200, label: "section divider" })} />
 */
export function buildOrnamentSvg(
  name: OrnamentName,
  opts: { width?: number; height?: number; label?: string; className?: string } = {},
): string {
  const path = ORNAMENT_PATHS[name];
  const w = opts.width ?? 100;
  const h = opts.height ?? 24;
  const cls = opts.className ? ` class="${opts.className}"` : "";
  const role = opts.label ? ` role="img" aria-label="${opts.label}"` : ` aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 24" width="${w}" height="${h}"${cls}${role} style="display:block;color:inherit;">${path}</svg>`;
}
