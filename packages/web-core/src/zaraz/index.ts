/**
 * @mixturemarketing/web-core/zaraz
 *
 * Cloudflare Zaraz server-side tag manager — config generators + runtime event tracking.
 *
 * Reference: plan/I-analytics.md (I.1 Zaraz strategy).
 *
 * Two roles:
 *
 *   1. **Build-time / provisioning** — `buildZarazTools(clientConfig.integrations)` returns
 *      tool configs ready to send to CF Zaraz API. Use when onboarding a klient
 *      (Faza 3 provisioning workflow).
 *
 *   2. **Runtime / spoke** — `trackEvent("lead_form_submit", {...})` dispatches events to
 *      window.zaraz (preferred) or window.dataLayer (fallback). Use in form handlers,
 *      click handlers, etc.
 *
 * Quick start (klient site):
 *
 *   <script>
 *     import { trackEvent, autoTrackClicks } from "@mixturemarketing/web-core/zaraz";
 *     autoTrackClicks();  // wires data-track-event attributes
 *
 *     form.addEventListener("submit", () => {
 *       trackEvent("lead_form_submit", { form_id: "contact" });
 *     });
 *   </script>
 *
 *   HTML:
 *   <a href="tel:..." data-track-event="phone_click" data-track-position="hero">
 */

export const MODULE_NAME = "zaraz" as const;

// Types
export { STANDARD_EVENTS } from "./types.js";
export type {
  BuildToolsOutput,
  EventParameters,
  IntegrationFlags,
  StandardEvent,
  ZarazPurpose,
  ZarazToolConfig,
  ZarazToolType,
} from "./types.js";

// Tool config builders
export {
  clarityTool,
  customHtmlTool,
  ga4Tool,
  googleAdsTool,
  linkedinInsightTool,
  metaPixelTool,
  plausibleTool,
  tiktokPixelTool,
} from "./tool-configs.js";

// Config builder (high-level)
export { buildZarazTools } from "./config-builder.js";

// Runtime
export { autoTrackClicks, identifyVisitor, isZarazLoaded, trackEvent } from "./runtime.js";
