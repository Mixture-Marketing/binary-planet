# APPENDIX I — Analytics & Tracking Stack (kompletny)

## I.1 Cloudflare Zaraz — server-side tag management

Zaraz to natywne CF rozwiązanie dla server-side trackingu. Wszystkie tagi (GA4, Meta Pixel, Google Ads, Clarity) ładowane na edge, nie w przeglądarce.

**Korzyści dla naszego stacku:**
- **CWV boost**: drop LCP o 200–400ms vs client-side GTM. Krytyczne dla local SEO (Google liczy CWV w ranking)
- **Recovery 30–40% traffic**: omija adblockery przez first-party origin (subdomain klienta serwuje endpointy)
- **Native Consent Mode v2** support — wymagany od marca 2024 dla GA4/Ads w EU
- **Free tier**: 1M events/mc per Worker — wystarcza dla każdego naszego klienta
- **Privacy by default**: cookieless modes, IP anonymization, no third-party fingerprinting

**Konfiguracja per klient (`core/zaraz`):**
- Generator `wrangler.toml` z Zaraz config z `client.config.ts.integrations.zaraz`
- Lista tagów per moduł:
  - Zawsze: Plausible (cookieless, no consent needed)
  - Jeśli `integrations.ga4`: GA4 server-side (events)
  - Jeśli `integrations.googleAds`: Google Ads conversion + remarketing
  - Jeśli `integrations.metaPixel`: Meta Pixel server-side (z Conversions API)
  - Jeśli `integrations.clarity`: Microsoft Clarity (wymaga consent)
  - Jeśli `integrations.tiktokPixel`: TikTok Pixel server-side

## I.2 Consent Mode v2 (obowiązkowe od 03/2024)

Bez Consent Mode v2 GA4 i Google Ads w EU tracą 60–80% danych. Z CMv2 dostają "modeled data" (behavioral modeling) — legalne i przybliżenie statystyczne.

**4 consent signals zarządzane przez `core/consent`:**

| Signal | Mapowanie na nasz banner | Default |
|---|---|---|
| `ad_storage` | Marketingowe | denied |
| `analytics_storage` | Analityczne | denied |
| `ad_user_data` | Marketingowe | denied |
| `ad_personalization` | Marketingowe | denied |
| `functionality_storage` | Niezbędne | granted |
| `security_storage` | Niezbędne | granted |

**Implementacja:**
1. Default consent state ustawiony PRZED Zaraz load (`<script>` blok w `<head>`)
2. Po wyborze klienta w banner: `consent('update', {...})` propaguje do Zaraz
3. Zaraz przekazuje signals do GA4 + Google Ads automatycznie
4. Audit log każdej zmiany consent w D1 `audit_log` (RODO compliance)

## I.3 Reklamy ready — `core/ads`

Każda strona klienta przygotowana do natychmiastowego włączenia reklam (Premium tier lub add-on):

**Google Ads:**
- Conversion tracking events: `lead_form_submit` (główna konwersja), `phone_click` (micro-conversion), `quote_request`
- Remarketing audiences: visitors, form-viewers, lead-converters (exclude)
- Dynamic remarketing dla branż z produktami (e.g. salon urody z usługami)
- Auto-tagging GCLID dla cross-domain conversion attribution

**Meta Pixel (Facebook/Instagram):**
- Server-side via Conversions API (omija iOS 14.5+ blockades)
- Standard events: PageView, Lead, Contact, ViewContent
- Custom audiences: same jak Google Ads
- KRYTYCZNE dla mikrofirm w PL — Facebook to dominujący kanał reklamowy dla local

**TikTok Pixel:**
- Server-side via Events API
- Opcjonalne, włączane per klient (rzadko dla naszego targetu, ale daje opcję)

**Implementacja:** klient w Sveltia CMS dodaje swoje ID konwersji (`google_ads_id`, `meta_pixel_id`, `tiktok_pixel_id`) → Zaraz config rebuild → reklamy działają.

## I.4 Search Console + GA4 Service Account onboarding

**Problem:** klient musi dać nam dostęp do swojej GSC property i GA4 property. Trzy ścieżki:

**Ścieżka A — Service Account (rekomendacja, scalable):**
1. Mamy 1 Google Cloud project `binary-planet` z Service Account `bp-clients@binary-planet.iam.gserviceaccount.com`
2. Klient w wizardzie krok 12: dostaje instrukcję "Idź do search.google.com/search-console → Settings → Users → Add user → wklej `bp-clients@binary-planet.iam.gserviceaccount.com` → Role: Full"
3. To samo dla analytics.google.com → Admin → Property Access → Add user → wklej ten sam email
4. Klient klika "Sprawdź dostęp" w naszym dashboard → control plane testuje API call → jeśli OK, persist w `client.integrations.gsc_property_url` + `ga4_property_id`
5. Cron daily/weekly pulluje przez Service Account credentials (jeden key w wrangler secret) dla wszystkich klientów

**Ścieżka B — OAuth consent flow (jeśli A nie działa):**
- Klient klika "Zaloguj się przez Google" → OAuth scopes: `webmasters.readonly`, `analytics.readonly`
- Refresh token zapisany szyfrowany w D1
- Re-auth co 6 mc (Google policy)

**Ścieżka C — manual upload (fallback):**
- Klient eksportuje CSV z GSC/GA4 raz w miesiącu, upload do dashboard
- Tylko jeśli A i B niemożliwe

Default flow: A → B → C w tej kolejności w wizardzie.

## I.5 Wszystkie eventy do GA4 (przez Zaraz)

Standardowe eventy fired z `@binary-planet/web-core/analytics`:

| Event | Trigger | Parametry |
|---|---|---|
| `page_view` | każda strona | page_path, page_title, page_referrer |
| `lead_form_view` | viewport intersect form | form_id, form_position |
| `lead_form_submit` | successful POST | form_id, service_interest, lead_id (hashed) |
| `phone_click` | click tel: link | phone_number_hash, position |
| `sms_click` | click sms: link | phone_number_hash |
| `email_click` | click mailto: link | email_hash |
| `whatsapp_click` | click wa.me link | position |
| `gbp_direction_click` | click "wskazówki" | position |
| `gbp_review_click` | click "zostaw opinię" | source |
| `quote_started` | otwarcie kalkulatora wstępnej wyceny | service_type |
| `quote_completed` | zakończenie kalkulatora | service_type, estimated_value |
| `scroll_depth_75` | scroll 75% strony | page_path |
| `engagement_time_30s` | 30s active engagement | page_path |
| `cookie_consent_change` | zmiana w banner | new_state (granular per category) |

Konwersje (Google Ads + GA4): `lead_form_submit` (primary), `phone_click` (micro), `quote_completed` (micro).

---
