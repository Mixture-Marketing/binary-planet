# @mixturemarketing/web-core/zaraz

Cloudflare Zaraz server-side tag manager — config generators + runtime event tracking.

**Status:** Track Zaraz done. 6 source + 3 test files, **27 testów**.

## Dlaczego Zaraz

Server-side tag manager od CF:
- **CWV boost:** -200–400ms LCP vs client-side GTM
- **30–40% traffic recovery** vs adblockers (first-party origin endpoints)
- **Native Consent Mode v2** support
- **Free tier:** 1M events/mc per Worker → wystarcza dla naszego scale
- **Privacy-first:** cookieless modes, IP anonymization

## Quick start

### Provisioning (mm-control-plane onboarding workflow)

```ts
import { buildZarazTools } from "@mixturemarketing/web-core/zaraz";

const { tools, warnings } = buildZarazTools({
  plausible: true,                          // cookieless, always on
  ga4: "G-XXXXXXX",
  googleAds: { conversionId: "AW-1234567890", conversionLabel: "abc/xyz" },
  metaPixel: "1234567890",
  tiktokPixel: "C123",
  clarity: "abcd1234",
});

// `tools` is ZarazToolConfig[] — send to CF Zaraz API per klient zone
// Each tool has built-in: consent.required + consent.purposes mapping
```

### Runtime (klient site `<script>`)

```ts
import { trackEvent, autoTrackClicks } from "@mixturemarketing/web-core/zaraz";

// Auto-wire HTML data attributes:
autoTrackClicks();

// Manual fire:
trackEvent("lead_form_submit", {
  form_id: "contact",
  service_interest: "otwieranie-zamkow",
  estimated_value: 250,
});
```

HTML pattern (used by Hero, Header):
```html
<a href="tel:+48171234567" data-track-event="phone_click" data-track-position="hero">
  Zadzwoń
</a>
```

## Standard events

| Event | Trigger | Conversion? |
|-------|---------|-------------|
| `page_view` | each page | — |
| `lead_form_view` | form intersects viewport | audience |
| `lead_form_submit` | successful POST | **PRIMARY** |
| `phone_click` | tel: link clicked | micro |
| `sms_click` / `email_click` / `whatsapp_click` | respective click | micro |
| `quote_started` / `quote_completed` | calculator flow | funnel |
| `gbp_direction_click` / `gbp_review_click` | GBP integration | micro |
| `scroll_depth_75` | 75% scroll | engagement |
| `engagement_time_30s` | 30s on page | engagement |
| `cookie_consent_change` | banner action | audit |

Każdy event mapowany per-platform w `tool-configs.ts` (np. Meta: `lead_form_submit` → `Lead`, GAds → `conversion`).

## Tool builders

| Function | Type | Default purposes |
|----------|------|------------------|
| `plausibleTool` | plausible | `necessary` (cookieless, no consent needed) |
| `ga4Tool({measurementId})` | googleanalytics | `analytics` |
| `googleAdsTool({conversionId, ...})` | googleads | `marketing` |
| `metaPixelTool({pixelId})` | facebookpixel | `marketing` |
| `tiktokPixelTool({pixelId})` | tiktokpixel | `marketing` |
| `clarityTool({projectId})` | microsoftclarity | `analytics` (PII heatmaps) |
| `linkedinInsightTool({partnerId})` | linkedininsight | `marketing` |
| `customHtmlTool({name, html, purposes?})` | customhtml | configurable |

Validation: GA4 wymaga `G-` prefix, GAds `AW-`, Meta pixelId numeric. Invalid throws.

## Integracja z consent module

`tool-config.consent.purposes` map'uje na nasze 4 user-facing categories (`@mixturemarketing/web-core/consent`):

- `necessary` → wyłączenie wymaga maintenance-level decyzji
- `analytics` → checkbox "Analityczne"
- `marketing` → checkbox "Marketingowe"
- `personalization` → checkbox "Personalizacja"

Zaraz auto-respektuje user consent state z `gtag('consent', 'default'|'update', ...)` (z naszego `web-core/consent/default-state.ts`).

## Runtime fallback chain

```
trackEvent("lead_form_submit", {...})
  ↓ try window.zaraz.track() — preferred, server-side dispatch
  ↓ fallback to window.dataLayer.push() — GTM/gtag compatible
  ↓ fallback no-op (SSR or no tag manager)
```

To pozwala stronie działać nawet **bez** Zaraz (np. lokalny dev mm-starter — Zaraz nie aktywny do Faza 5+ deployu).

## Reference

- Plan: [I-analytics.md (I.1 Zaraz)](../../../../plan/I-analytics.md)
- CF Zaraz docs: https://developers.cloudflare.com/zaraz/
- Pairs with [`/consent`](../consent/) (gates) + [`/ads`](../ads/) (high-level conversion helpers)
