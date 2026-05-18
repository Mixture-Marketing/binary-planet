/**
 * @mixturemarketing/web-core/consent
 *
 * Scope: cookie banner + Google Consent Mode v2 (obowiązkowe od 03/2024 dla GA4/Ads w EU).
 *
 *  - 4 consent signals zarządzane: ad_storage, analytics_storage, ad_user_data, ad_personalization
 *  - 2 always-granted: functionality_storage, security_storage
 *  - Default consent state injected PRZED Zaraz load (<script> w <head>)
 *  - Update propagation: consent('update', {...}) → Zaraz auto-propagates do GA4/Ads
 *  - Audit log każdej zmiany consent → POST /api/events/consent (D1 audit_log)
 *
 *  - Banner UI components (Astro + framework-agnostic):
 *      - Initial banner (3 buttons: accept all / reject all / customize)
 *      - Preferences modal (per-category toggles + descriptions)
 *      - Footer link "Ustawienia plików cookie" (re-open banner)
 *
 *  - i18n: PL primary, EN optional
 *  - Persistence: cookie `mm_consent_v1` (granted/denied per category + timestamp + version)
 *  - Re-prompt on version bump (np. nowy sub-procesor → wymagana ponowna zgoda)
 *
 * Reference: plan/I-analytics.md (I.2 Consent Mode v2), plan/A-rodo.md (A.2).
 */

export const MODULE_NAME = "consent" as const;
