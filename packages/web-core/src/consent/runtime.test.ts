// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consentBannerHtml } from "./banner.js";
import { preferencesModalHtml } from "./preferences.js";
import { initConsentRuntime } from "./runtime.js";

function mountUi(): void {
  document.body.innerHTML = `
    ${consentBannerHtml({ businessName: "Test", privacyUrl: "/privacy", version: "v1.0" })}
    ${preferencesModalHtml()}
  `;
}

describe("initConsentRuntime", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    document.cookie = "mm_consent_v1=; Path=/; Max-Age=0";
    fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.cookie = "mm_consent_v1=; Path=/; Max-Age=0";
  });

  it("shows banner when no consent cookie", () => {
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    const banner = document.getElementById("mm-consent-banner")!;
    expect(banner.hasAttribute("hidden")).toBe(false);
  });

  it("hides banner when valid consent already saved", () => {
    // Pre-write cookie
    const record = {
      version: "v1.0",
      timestamp: "2026-05-19T00:00:00Z",
      state: {
        ad_storage: "denied" as const,
        analytics_storage: "denied" as const,
        ad_user_data: "denied" as const,
        ad_personalization: "denied" as const,
        functionality_storage: "granted" as const,
        security_storage: "granted" as const,
      },
      explicit: true,
    };
    document.cookie = `mm_consent_v1=${encodeURIComponent(JSON.stringify(record))}; Path=/`;
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    const banner = document.getElementById("mm-consent-banner")!;
    expect(banner.hasAttribute("hidden")).toBe(true);
  });

  it("shows banner when version mismatched", () => {
    document.cookie = `mm_consent_v1=${encodeURIComponent(
      JSON.stringify({
        version: "v0.9",
        timestamp: "2026-01-01T00:00:00Z",
        explicit: true,
        state: {
          ad_storage: "granted",
          analytics_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
          functionality_storage: "granted",
          security_storage: "granted",
        },
      }),
    )}; Path=/`;
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    const banner = document.getElementById("mm-consent-banner")!;
    expect(banner.hasAttribute("hidden")).toBe(false);
  });

  it("Accept all → writes cookie + hides banner + posts audit", async () => {
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-mm-consent-action="accept"]',
    )!;
    acceptBtn.click();
    // Banner hidden
    const banner = document.getElementById("mm-consent-banner")!;
    expect(banner.hasAttribute("hidden")).toBe(true);
    // Cookie set
    expect(document.cookie).toContain("mm_consent_v1=");
    // Audit posted
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/consent",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("Reject → cookie set with denied state", () => {
    mountUi();
    const onChange = vi.fn();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      onChange,
    });
    const rejectBtn = document.querySelector<HTMLButtonElement>(
      '[data-mm-consent-action="reject"]',
    )!;
    rejectBtn.click();
    expect(onChange).toHaveBeenCalledOnce();
    const state = onChange.mock.calls[0]![0] as Record<string, string>;
    expect(state.ad_storage).toBe("denied");
    expect(state.analytics_storage).toBe("denied");
    expect(state.functionality_storage).toBe("granted");
  });

  it("Customize → shows modal", () => {
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    const customizeBtn = document.querySelector<HTMLButtonElement>(
      '[data-mm-consent-action="customize"]',
    )!;
    customizeBtn.click();
    const modal = document.getElementById("mm-consent-modal")!;
    expect(modal.hasAttribute("hidden")).toBe(false);
  });

  it("close-modal hides modal but keeps banner up", () => {
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cookieOptions: { secure: false },
    });
    // Open modal
    document.querySelector<HTMLButtonElement>('[data-mm-consent-action="customize"]')!.click();
    // Close
    document.querySelector<HTMLButtonElement>('[data-mm-consent-action="close-modal"]')!.click();
    const modal = document.getElementById("mm-consent-modal")!;
    const banner = document.getElementById("mm-consent-banner")!;
    expect(modal.hasAttribute("hidden")).toBe(true);
    expect(banner.hasAttribute("hidden")).toBe(false);
  });

  it("save-preferences reads checkbox state", () => {
    mountUi();
    const onChange = vi.fn();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      onChange,
    });

    // Open modal
    document.querySelector<HTMLButtonElement>('[data-mm-consent-action="customize"]')!.click();

    // Toggle analytics on
    const analytics = document.querySelector<HTMLInputElement>(
      '[data-mm-consent-category="analytics"]',
    )!;
    analytics.checked = true;

    // Save
    document.querySelector<HTMLButtonElement>('[data-mm-consent-action="save-preferences"]')!.click();

    expect(onChange).toHaveBeenCalledOnce();
    const state = onChange.mock.calls[0]![0] as Record<string, string>;
    expect(state.analytics_storage).toBe("granted");
    expect(state.ad_storage).toBe("denied"); // marketing not toggled
  });

  it("Escape on banner triggers reject", () => {
    mountUi();
    const onChange = vi.fn();
    initConsentRuntime({
      version: "v1.0",
      fetchImpl: fetchMock as unknown as typeof fetch,
      onChange,
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onChange).toHaveBeenCalledOnce();
    const state = onChange.mock.calls[0]![0] as Record<string, string>;
    expect(state.ad_storage).toBe("denied");
  });

  it("auditEndpoint=null disables audit POST", async () => {
    mountUi();
    initConsentRuntime({
      version: "v1.0",
      auditEndpoint: null,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    document.querySelector<HTMLButtonElement>('[data-mm-consent-action="reject"]')!.click();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
