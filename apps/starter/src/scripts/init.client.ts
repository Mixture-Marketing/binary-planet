/**
 * Client-side init — runs in browser on every page.
 *
 * Wires up:
 *   - Consent runtime (banner + modal + cookie + gtag dispatch)
 *   - GCLID + click ID capture from URL → cookies
 *   - Auto-track data-track-event attributes
 *   - Page view event
 */

import { captureAllClickIds } from "@mixturemarketing/web-core/ads";
import { initConsentRuntime } from "@mixturemarketing/web-core/consent";
import { autoTrackClicks, trackEvent } from "@mixturemarketing/web-core/zaraz";

import clientConfig from "../client.config.ts";

export function initStarter(): void {
  if (typeof window === "undefined") return;

  // 1. Capture click IDs from landing URL (Google Ads / Meta / TikTok / MS / iOS)
  try {
    captureAllClickIds();
  } catch {
    /* swallow — non-critical */
  }

  // 2. Consent runtime (banner + modal). Reads saved cookie, applies state to gtag,
  //    OR shows banner if no consent yet / version mismatched.
  try {
    initConsentRuntime({
      version: clientConfig.rodo.consentVersion,
      auditEndpoint: "/api/events/consent",
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error("[consent] init failed", err);
  }

  // 3. Auto-wire data-track-event clicks (phone, email, GBP, hero CTA, etc.)
  try {
    autoTrackClicks();
  } catch {
    /* swallow */
  }

  // 4. Page view event (Plausible auto-tracks but Zaraz needs explicit)
  try {
    trackEvent("page_view", {
      page_path: window.location.pathname,
      page_title: document.title,
      page_referrer: document.referrer,
    });
  } catch {
    /* swallow */
  }
}
