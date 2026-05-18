# @mixturemarketing/web-core/consent

RODO/GDPR cookie consent banner + Google Consent Mode v2 integration.

**Status:** Track Consent done. 8 source + 5 test files, 49 testów.

⚠️ **PRZED PROD:** wymaga review przez prawnika RODO/IT (konsultacja w [legal-questions.md](../../../../legal-questions.md)). Default text + design baseline gotowe, ale legal weryfikacja **gating dla pierwszego klienta**.

## Strategia (z planu I.2)

- **Default analytics:** Plausible (cookieless, no consent needed — ZAWSZE loaduje się)
- **Trackery gated na consent:** GA4, Google Ads, Meta Pixel, TikTok, MS Clarity, Zaraz
- **4 granular signals** + 2 baseline (always-granted essential)
- **First visit:** ALL denied (RODO opt-in requirement)
- **Versioned consent text** — re-prompt na bump (dodanie nowego sub-procesora etc.)
- **Audit log** każdej zmiany → `consent_log` D1 table (Art. 7 RODO compliance)

## Quick start (Astro)

W `<head>` (PRZED Zaraz / GA scripts):

```astro
---
import { defaultConsentScriptTag } from "@mixturemarketing/web-core/consent";
---
<Fragment set:html={defaultConsentScriptTag({ nonce: Astro.locals.nonce })} />
```

W `<body>` (na końcu, po `<main>`):

```astro
---
import {
  consentBannerHtml,
  consentBannerCss,
  preferencesModalHtml,
  preferencesModalCss,
} from "@mixturemarketing/web-core/consent";
import clientConfig from "../client.config.ts";
---
<style is:global>
  {consentBannerCss()}
  {preferencesModalCss()}
</style>

<Fragment set:html={consentBannerHtml({
  businessName: clientConfig.business.name,
  privacyUrl: "/polityka-prywatnosci",
  termsUrl: "/regulamin",
  version: clientConfig.rodo.consentVersion,
})} />
<Fragment set:html={preferencesModalHtml()} />

<script>
  import { initConsentRuntime } from "@mixturemarketing/web-core/consent";
  initConsentRuntime({
    version: "v1.0",
    auditEndpoint: "/api/events/consent",
    onChange: (state) => {
      // Optional: re-init klient-specific trackers if consent changed
      if (state.analytics_storage === "granted") {
        // load Clarity etc.
      }
    },
  });
</script>
```

## Flow

```
First visit:
  SSR: head has defaultConsentScript → gtag('consent', 'default', ALL_DENIED)
  SSR: head loads Plausible (cookieless — always)
  SSR: trackers (GA4 etc.) load BUT respect denied state (Consent Mode v2)
  Body: banner shown (no cookie yet)
  ↓
User clicks "Akceptuj wszystkie":
  - Cookie `mm_consent_v1` written z FULLY_GRANTED_STATE
  - gtag('consent', 'update', GRANTED) → GA4/Ads start tracking
  - POST /api/events/consent (audit log → D1 consent_log)
  - Banner hidden
  ↓
Subsequent visit:
  SSR: head reads cookie (lub klient JS na load)
  - cookie valid version → applyConsentUpdate(saved state)
  - banner stays hidden
```

## Consent Mode v2 signals

| Signal | Category | Default | Notes |
|--------|----------|---------|-------|
| `ad_storage` | marketing | denied | GAds cookies + remarketing |
| `analytics_storage` | analytics | denied | GA4 cookies |
| `ad_user_data` | marketing | denied | User data sent to GAds |
| `ad_personalization` | personalization | denied | Personalized ads |
| `functionality_storage` | necessary | **granted** | Essential (session, preferences) |
| `security_storage` | necessary | **granted** | Anti-fraud, security |

## UI components

### Banner (always on first visit)
- 3 primary buttons: Akceptuj wszystkie / Tylko niezbędne / Dostosuj
- Privacy policy + Terms links
- ARIA dialog role, focus management
- Esc key → "Tylko niezbędne"
- Responsive (mobile stacks buttons)

### Preferences modal (opened by "Dostosuj")
- 4 toggle categories: necessary (disabled), analytics, marketing, personalization
- Visible signal codes (`analytics_storage`, `ad_storage`...)
- Save selection + Accept all buttons
- Backdrop click → close

## Files

```
src/consent/
├── types.ts           — types + DEFAULT_DENIED_STATE + FULLY_GRANTED_STATE + categories
├── storage.ts         — cookie read/write + versioned migration
├── default-state.ts   — defaultConsentScript() + applyConsentUpdate()
├── banner.ts          — consentBannerHtml + consentBannerCss
├── preferences.ts     — preferencesModalHtml + preferencesModalCss
├── runtime.ts         — initConsentRuntime() — browser-side wire-up
└── index.ts
```

## i18n

PL (default) + EN. Override copy per-banner:

```ts
consentBannerHtml({
  businessName: "Test",
  privacyUrl: "/privacy",
  version: "v1.0",
  lang: "en",  // → English copy
});
```

Or full custom override via `heading` + `description` props.

## Audit log integration

Runtime POSTs `{event_type: "consent.changed", data: {state, version, explicit, timestamp}}` do `/api/events/consent` (lub custom endpoint). mm-control-plane już ma `/api/events` route który dispatch'uje to do D1 `consent_log` (Track J).

Disable z `auditEndpoint: null`.

## Pre-deployment checklist

- [ ] Prawnik review treści banner/modal (PL + EN)
- [ ] Privacy policy URL + Terms URL działają
- [ ] consent_text_version w `client.config.ts` synced z banner data-version
- [ ] DPA template (legal) zawiera listę sub-procesorów które są blocked by default
- [ ] D1 `consent_log` table seeded + cron daily cleanup (24mc retention)

## Reference

- Plan: [I-analytics.md I.2 Consent Mode v2](../../../../plan/I-analytics.md)
- Plan: [A-rodo.md A.2 Cookie consent](../../../../plan/A-rodo.md)
- Plan: [legal-questions.md C2 Cookie banner copy template](../../../../legal-questions.md)
- D1: [0006_compliance.sql consent_log](../../../../apps/control-plane/migrations/0006_compliance.sql)
- Google Consent Mode v2: https://developers.google.com/tag-platform/security/concepts/consent
- IAB EU TCF v2: https://iabeurope.eu/tcf-2-0/ (not implemented — different vendor model)
