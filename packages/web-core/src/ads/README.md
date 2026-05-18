# @mixturemarketing/web-core/ads

Conversion event helpers + GCLID handling + server-side Conversions API integration.

**Status:** Track Ads done. 6 source + 4 test files, **42 testów**.

## Two-side architecture

### Client-side (mm-starter)

Browser fires conversion → Zaraz dispatches do wszystkich skonfigurowanych platform.

```ts
import { fireLeadConversion, captureGclid } from "@mixturemarketing/web-core/ads";

// On page load: capture GCLID from URL
captureGclid();

// On form submit:
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const eventId = fireLeadConversion({
    form_id: "contact",
    service_interest: "otwieranie-zamkow",
    value: 250,
  });

  // Send eventId with form data → server matches client event for Meta CAPI dedup
  await fetch("/api/contact", {
    method: "POST",
    body: JSON.stringify({ ...data, meta_event_id: eventId }),
  });
});
```

### Server-side (mm-control-plane)

Po przyjęciu lead, hub wysyła **Meta Conversions API** event z tym samym `event_id` → Meta dedupuje (lepsze ROAS measurement, immune to iOS ATT + adblockers).

```ts
import { sendMetaCapiEvents, buildCapiLeadEvent } from "@mixturemarketing/web-core/ads";

const event = buildCapiLeadEvent({
  emailHash: lead.email_hash,    // already sha256 from forms PII pipeline
  phoneHash: lead.phone_hash,
  leadId: lead.client_event_id,  // matches client event_id
  sourceUrl: lead.source_page,
  clientIp: request.headers.get("CF-Connecting-IP") ?? undefined,
  userAgent: request.headers.get("User-Agent") ?? undefined,
  value: 250,
});

const result = await sendMetaCapiEvents(
  { pixelId: env.META_PIXEL_ID, accessToken: env.META_CAPI_TOKEN },
  [event],
);
```

## API surface

### Client-side helpers

| Function | Returns | Use |
|----------|---------|-----|
| `fireLeadConversion(params?)` | `eventId` | **PRIMARY** — form submit success |
| `firePhoneClick(params?)` | `eventId` | tel: link click |
| `fireContactClick("email"\|"sms"\|"whatsapp", params?)` | `eventId` | other contact channels |
| `fireQuoteStarted(params?)` | `eventId` | calculator opened |
| `fireQuoteCompleted({value, ...})` | `eventId` | calculator finished |
| `fireGbpDirectionClick(params?)` | `eventId` | "wskazówki" click |
| `fireGbpReviewClick(params?)` | `eventId` | "zostaw opinię" click |
| `fireVisitor(params?)` | `eventId` | page view (remarketing pool) |
| `fireFormViewer(formId, params?)` | `eventId` | form intersected viewport |
| `generateEventId(prefix)` | `string` | unique client+server correlator |

Każde fire'uje przez Zaraz (lub dataLayer fallback) + dołącza zapisane click IDs (GCLID/fbclid/etc.).

### GCLID / Click ID handling

| Function | Returns | Use |
|----------|---------|-----|
| `captureGclid(opts?)` | `string \| undefined` | Read GCLID z URL → cookie |
| `captureAllClickIds(opts?)` | `CapturedClickIds` | All known (Google/Meta/MS/TikTok/iOS gbraid/wbraid) |
| `readStoredGclid()` | `string \| undefined` | Read previously captured |
| `readAllStoredClickIds()` | `CapturedClickIds` | All for sending z conversion |
| `parseClickIds(searchParams)` | `CapturedClickIds` | SSR-safe URLSearchParams parser |

**Window odpowiada:** Google = 90 dni (default), Meta = ?, TikTok = 28 dni. Wszystkie cookies SameSite=Lax + Secure (HTTPS).

### Server-side helpers

| Function | Returns | Use |
|----------|---------|-----|
| `buildCapiLeadEvent(input)` | `MetaCapiEvent` | Build payload z hashed user data |
| `sendMetaCapiEvents(deps, events)` | `Promise<SendCapiResult>` | POST do Meta Graph API (batch up to 1000) |
| `buildOfflineConversionsCsv(rows)` | `string` (CSV) | Google Ads OCT manual upload format |

## Standard conversion events → platform mapping

| Our event | Meta Pixel | TikTok Pixel | Google Ads |
|-----------|------------|--------------|------------|
| `lead_form_submit` | `Lead` | `SubmitForm` | `conversion` |
| `phone_click` | `Contact` | `ClickButton` | (event) |
| `email_click` | `Contact` | — | — |
| `whatsapp_click` | `Contact` | — | — |
| `quote_started` | `InitiateCheckout` | — | — |
| `quote_completed` | `Lead` | `SubmitForm` | `conversion` |
| `page_view` | `PageView` | `Pageview` | (default) |

## Pairs with

- **`web-core/zaraz`** — niskopoziomowe `trackEvent()` + tool configs
- **`web-core/consent`** — gating consent dla marketing trackers
- **`web-core/forms`** — gdzie się odpalają lead conversions (po success POST)
- **`mm-control-plane`** — server-side CAPI dispatch po lead receipt

## Limity v0.0.1

- **Google Ads Enhanced Conversions** (klient-side hash) — w Zaraz tool config; nie ma dedykowanego helpera (Zaraz handles automatycznie)
- **Google Ads OCT real upload** — tylko CSV builder (manual upload do Ads UI); pełen Ads API integration to heavy OAuth flow — Faza 7
- **LinkedIn Conversion API** — nie zaimplementowane (rzadko relevantne dla local service biz)
- **TikTok Events API** — server-side; tylko Pixel klient-side w tej wersji

## Reference

- Plan: [I-analytics.md (I.3 Reklamy ready)](../../../../plan/I-analytics.md)
- Meta CAPI docs: https://developers.facebook.com/docs/marketing-api/conversions-api
- Google Ads OCT: https://support.google.com/google-ads/answer/2998031
