/**
 * Default-state script generator.
 *
 * Goes in <head> BEFORE any Zaraz / GA / Meta Pixel scripts. Sets Google Consent Mode v2
 * default to "all denied" (or saved state if cookie present), so trackers behave correctly
 * when they load.
 *
 * Pattern:
 *   1. <script> tag near top of <head>
 *   2. Defines dataLayer + gtag() globals
 *   3. Calls gtag('consent', 'default', {...})
 *   4. Trackers loaded AFTER read this state on initialization
 *
 * After user clicks banner: gtag('consent', 'update', {...}) propagates new state.
 */

import { DEFAULT_DENIED_STATE, type ConsentState } from "./types.js";

export interface DefaultStateOptions {
  /** Initial state to set. Default DEFAULT_DENIED_STATE. */
  state?: ConsentState;
  /**
   * If true, also call gtag('set', 'ads_data_redaction', true) for EU users.
   * Default true — RODO compliance.
   */
  adsDataRedaction?: boolean;
  /**
   * If true, set url_passthrough to true (preserve URL params for redirects even with denied).
   * Default true.
   */
  urlPassthrough?: boolean;
  /** Optional nonce — required if strict CSP. */
  nonce?: string;
}

/**
 * Generate the <script> tag content (without <script> wrapper).
 * Caller wraps with their nonce + position in head.
 */
export function defaultConsentScript(options: DefaultStateOptions = {}): string {
  const state = options.state ?? DEFAULT_DENIED_STATE;
  const adsRedaction = options.adsDataRedaction ?? true;
  const urlPassthrough = options.urlPassthrough ?? true;

  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',${JSON.stringify(state)});
${adsRedaction ? "gtag('set','ads_data_redaction',true);" : ""}
${urlPassthrough ? "gtag('set','url_passthrough',true);" : ""}`.trim();
}

/**
 * Build full <script> tag with optional nonce + position helper text.
 */
export function defaultConsentScriptTag(options: DefaultStateOptions = {}): string {
  const nonceAttr = options.nonce ? ` nonce="${escapeAttr(options.nonce)}"` : "";
  return `<script${nonceAttr}>${defaultConsentScript(options)}</script>`;
}

/**
 * Browser-side: update consent state. Use after user clicks banner.
 * Must be called from a script that has access to window.gtag (defined by defaultConsentScript).
 */
export function applyConsentUpdate(state: Partial<ConsentState>): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (typeof win.gtag !== "function") {
    // Initialize if not yet
    win.dataLayer = win.dataLayer || [];
    win.gtag = function (...args: unknown[]): void {
      win.dataLayer.push(args);
    };
  }
  win.gtag("consent", "update", state);
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
