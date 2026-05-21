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
import { autoInitMotion } from "@mixturemarketing/web-core/motion";
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

  // 5. Motion utilities — scroll reveal + count-up + kinetic typo + magnetic + reading progress.
  //    Auto re-init po Astro View Transitions swap. Respects prefers-reduced-motion.
  try {
    autoInitMotion();
  } catch {
    /* swallow — non-critical */
  }

  // 6. WCAG 4.1.3 — announce route changes on Astro View Transitions navigation
  //    and reset focus to <main> so keyboard/screen-reader users land in fresh content
  //    (not on the now-removed link from previous page).
  const announceAndFocus = (): void => {
    const announcer = document.getElementById("route-announcer");
    if (announcer) {
      // Slight delay lets browser update document.title from new page's <head>
      setTimeout(() => {
        announcer.textContent = `Wczytano: ${document.title}`;
      }, 50);
    }
    const main = document.getElementById("main");
    if (main) {
      try {
        main.focus({ preventScroll: true });
      } catch {
        /* older browsers don't accept opts */
        main.focus();
      }
    }
  };
  // Astro ClientRouter: astro:after-swap event (legacy, kept for back-compat)
  document.addEventListener("astro:after-swap", announceAndFocus);
  // Native cross-document View Transitions: pageswap (old DOM) + pagereveal (new DOM)
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/pagereveal_event
  window.addEventListener("pagereveal", announceAndFocus);

  // 7. Contact form a11y — wire role=alert escalation on validation errors.
  //    HTML5 validation is silent for SR users. On invalid submit, surface error into
  //    #contact-form__status with role=alert so it interrupts and gets announced.
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  const status = document.getElementById("contact-form__status");
  if (form && status) {
    form.addEventListener("invalid", (e) => {
      // Catch the first invalid field — switch status to assertive
      e.preventDefault();
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const label =
        form.querySelector(`label[for="${target.id}"]`)?.textContent?.trim() ??
        (target.closest("label")?.textContent?.split(/\s+/).slice(0, 2).join(" ") ?? "Pole");
      status.setAttribute("role", "alert");
      status.setAttribute("aria-live", "assertive");
      status.textContent = `Uzupełnij wymagane pole: ${label.replace(/\s*\*\s*$/, "")}.`;
      target.focus();
    }, true);
    form.addEventListener("submit", () => {
      // Reset to polite + clear on a clean submit attempt
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.textContent = "";
    });
  }
}
