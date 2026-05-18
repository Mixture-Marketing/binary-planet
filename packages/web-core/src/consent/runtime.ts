/**
 * Browser-side runtime: wire up banner + modal + persist consent decisions.
 *
 * Called once on every page load. Reads saved cookie:
 *   - If valid (matches version) → apply consent state to gtag, banner stays hidden
 *   - If missing/mismatched → show banner
 *
 * Event flow:
 *   1. User clicks button on banner OR modal → handleAction()
 *   2. handleAction builds ConsentRecord
 *   3. Writes cookie + dispatches gtag('consent', 'update', ...)
 *   4. POSTs audit log to /api/events/consent (fire-and-forget)
 *   5. Hides banner + modal
 *   6. Calls onConsentChange callback (optional — for klient-specific UI updates)
 */

import { applyConsentUpdate } from "./default-state.js";
import { readConsentFromDocument, writeConsentCookie } from "./storage.js";
import {
  CATEGORY_TO_SIGNALS,
  DEFAULT_DENIED_STATE,
  FULLY_GRANTED_STATE,
  type ConsentCategory,
  type ConsentRecord,
  type ConsentState,
} from "./types.js";

export interface ConsentRuntimeOptions {
  /** Consent version — must match cookie version + banner data-version attr. */
  version: string;
  /** Endpoint to POST audit log to. Default "/api/events/consent". Set to null to disable. */
  auditEndpoint?: string | null;
  /** Called after consent changes (cookie written + gtag updated). */
  onChange?: (state: ConsentState) => void;
  /** Cookie options override. */
  cookieOptions?: import("./types.js").ConsentCookieOptions;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Initialize consent runtime on page load.
 * Call once near top of <script> tag at end of <body>.
 */
export function initConsentRuntime(options: ConsentRuntimeOptions): void {
  if (typeof document === "undefined") return;

  const banner = document.getElementById("mm-consent-banner");
  const modal = document.getElementById("mm-consent-modal");

  const existing = readConsentFromDocument(options.version);
  if (existing) {
    // Apply saved state — but don't show banner
    applyConsentUpdate(existing.state);
    return;
  }

  // No valid consent → show banner
  if (banner) banner.removeAttribute("hidden");

  const handleAction = (action: string): void => {
    let state: ConsentState | null = null;
    let explicit = true;

    if (action === "accept") {
      state = FULLY_GRANTED_STATE;
    } else if (action === "reject") {
      state = DEFAULT_DENIED_STATE;
    } else if (action === "customize") {
      // Open preferences modal
      if (modal) modal.removeAttribute("hidden");
      return;
    } else if (action === "close-modal") {
      if (modal) modal.setAttribute("hidden", "");
      return;
    } else if (action === "save-preferences") {
      state = readPreferencesFromModal();
    } else {
      return;
    }

    if (!state) return;

    persistAndNotify(state, options, explicit);
    if (banner) banner.setAttribute("hidden", "");
    if (modal) modal.setAttribute("hidden", "");
  };

  // Wire all data-mm-consent-action buttons
  document.querySelectorAll<HTMLElement>("[data-mm-consent-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-mm-consent-action");
      if (action) handleAction(action);
    });
  });

  // Esc on banner → treat as reject
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal && !modal.hasAttribute("hidden")) {
      // Close modal first
      modal.setAttribute("hidden", "");
      return;
    }
    if (banner && !banner.hasAttribute("hidden")) {
      handleAction("reject");
    }
  });
}

function readPreferencesFromModal(): ConsentState {
  const state: ConsentState = { ...DEFAULT_DENIED_STATE };
  document.querySelectorAll<HTMLInputElement>("[data-mm-consent-category]").forEach((input) => {
    const cat = input.getAttribute("data-mm-consent-category") as ConsentCategory | null;
    if (!cat) return;
    const signals = CATEGORY_TO_SIGNALS[cat];
    if (!signals) return;
    const value = input.checked ? "granted" : "denied";
    for (const sig of signals) {
      state[sig] = sig === "functionality_storage" || sig === "security_storage" ? "granted" : value;
    }
  });
  return state;
}

function persistAndNotify(state: ConsentState, options: ConsentRuntimeOptions, explicit: boolean): void {
  const record: ConsentRecord = {
    version: options.version,
    timestamp: new Date().toISOString(),
    state,
    explicit,
  };

  // 1. Write cookie
  writeConsentCookie(record, options.cookieOptions ?? {});

  // 2. Update Google Consent Mode
  applyConsentUpdate(state);

  // 3. Audit log (fire-and-forget)
  if (options.auditEndpoint !== null) {
    const endpoint = options.auditEndpoint ?? "/api/events/consent";
    const fetchImpl = options.fetchImpl ?? fetch;
    fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "consent.changed",
        data: { state, version: options.version, explicit, timestamp: record.timestamp },
      }),
      keepalive: true,
    }).catch(() => {
      /* swallow — audit failures don't block UX */
    });
  }

  // 4. Klient callback
  options.onChange?.(state);
}
