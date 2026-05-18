/**
 * Browser-side event tracking helper.
 *
 * Strategy: try window.zaraz.track() (preferred — server-side dispatch via CF Zaraz).
 * Fallback: push to window.dataLayer (compatible with GTM if klient prefers it later).
 * SSR: no-op (typeof window === "undefined").
 */

import type { EventParameters, StandardEvent } from "./types.js";

interface ZarazGlobal {
  track(eventName: string, params?: Record<string, unknown>): void;
  set?(key: string, value: unknown): void;
  ecommerce?(eventName: string, data?: Record<string, unknown>): void;
}

interface WindowWithZaraz {
  zaraz?: ZarazGlobal;
  dataLayer?: unknown[];
}

/**
 * Track an event. Returns true if successfully dispatched, false if no destination.
 *
 * @example
 *   trackEvent("lead_form_submit", { form_id: "contact", service_interest: "otwieranie" });
 */
export function trackEvent(
  eventName: StandardEvent | string,
  params: EventParameters = {},
): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithZaraz;

  // Filter undefined params (Zaraz dislikes null/undefined values in some integrations)
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) cleaned[k] = v;
  }

  // Prefer Zaraz
  if (win.zaraz && typeof win.zaraz.track === "function") {
    try {
      win.zaraz.track(eventName, cleaned);
      return true;
    } catch {
      // fall through to dataLayer
    }
  }

  // Fallback: dataLayer (GTM-compatible — also works with our defaultConsentScript gtag setup)
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push({ event: eventName, ...cleaned });
    return true;
  }

  return false;
}

/**
 * Identify visitor — calls window.zaraz.set() if available.
 * Use for hashed user identifiers, NOT plain PII.
 */
export function identifyVisitor(properties: Record<string, string>): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithZaraz;
  if (win.zaraz && typeof win.zaraz.set === "function") {
    try {
      for (const [k, v] of Object.entries(properties)) {
        win.zaraz.set(k, v);
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Auto-track click handler. Wires data-track-event attribute to fire events.
 *
 * @example HTML:
 *   <a href="tel:+48171234567" data-track-event="phone_click" data-track-position="hero">
 *
 * Then call: autoTrackClicks() once on page load.
 */
export function autoTrackClicks(root: Document | HTMLElement = document): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const trackable = target.closest<HTMLElement>("[data-track-event]");
    if (!trackable) return;
    const eventName = trackable.getAttribute("data-track-event");
    if (!eventName) return;

    const params: Record<string, string> = {};
    for (const attr of Array.from(trackable.attributes)) {
      if (attr.name.startsWith("data-track-") && attr.name !== "data-track-event") {
        const key = attr.name.replace("data-track-", "");
        params[key] = attr.value;
      }
    }
    trackEvent(eventName, params);
  };

  root.addEventListener("click", handler as EventListener, { capture: true });
  return () => {
    root.removeEventListener("click", handler as EventListener, { capture: true });
  };
}

/**
 * Browser-side: read all currently-active integrations from window.zaraz.
 * Used by consent module bridge to know what to gate.
 */
export function isZarazLoaded(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithZaraz;
  return Boolean(win.zaraz?.track);
}
