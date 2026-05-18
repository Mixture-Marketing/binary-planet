# mm-starter

Astro 5 + CF Workers + Tailwind v4 template dla stron klientów MixtureMarketing.

**Status:** Track I done — build green, jeden preset (`craftsman`) funkcjonalny end-to-end.

Demo client: **"Ślusarz Kowalski Rzeszów"** (`src/client.config.ts`).

## Co działa (v0.0.1)

### Strony

| Path | Route | Status |
|------|-------|--------|
| `/` | `pages/index.astro` | ✅ Hero + Services + Reviews + OpeningHours + ContactForm |
| `/oferta` | `pages/oferta.astro` | ✅ ServicesList + ContactForm |
| `/o-firmie` | `pages/o-firmie.astro` | ✅ longDescription + stats + Reviews + ContactForm |
| `/kontakt` | `pages/kontakt.astro` | ✅ OpeningHours (z adresem) + ContactForm |
| `/404` | `pages/404.astro` | ✅ przyjazna strona błędu |
| `/api/contact` | `pages/api/contact.ts` | ✅ form handler (web-core/forms) |
| `/sitemap.xml` | `pages/sitemap.xml.ts` | ✅ web-core/local builder |
| `/robots.txt` | `pages/robots.txt.ts` | ✅ + NOISY_SEO_BOTS deny |
| `/llms.txt` | `pages/llms.txt.ts` | ✅ AI crawler hints |

### Components (`themes/craftsman/components/`)

- `Header.astro` — sticky nav + telefon CTA mobile
- `Hero.astro` — urgency CTA + phone-first design (call/email tracking events)
- `ServicesList.astro` — grid usług z ikonkami i cenami od
- `OpeningHours.astro` — tabela godzin + adres + telefon/email (today highlighted)
- `ReviewsSection.astro` — opinie GBP-style (gwiazdki + autor + data)
- `ContactForm.astro` — pełen RODO form (honeypot, consent, Turnstile-ready, JS submit)
- `Footer.astro` — kontakt, mapa stron, service area

### Schema + SEO

- **LocalBusiness JSON-LD** w head każdej strony (`src/lib/schema.ts`)
- 16 subtypów schema.org dostępnych przez `client.config.business.schemaType`
- `sitemap.xml` zwraca aktualne URL z `lastmod` (today)
- `robots.txt` z `Sitemap:` directive + blokada AhrefsBot/MJ12bot etc.
- `llms.txt` per llmstxt.org spec (Strony główne + Dodatkowe sections)

### Security

- Per-request CSP nonce (Astro middleware → `Astro.locals.nonce`)
- Inline scripts mają `nonce={...}` (np. form handler JS)
- Pełen set security headers (HSTS preload, Permissions-Policy deny-all, COOP, frame-ancestors none)
- Integration extensions włączane warunkowo z `client.config.integrations` (Plausible/GA4/Turnstile/Zaraz/...)

### Theme system

- `themes/craftsman/tokens.ts` — 3 warianty kolorystyczne (red-bold, blue-trust, green-ground)
- Tokens injected w `<style>` w head (no FOUC, no extra CSS file)
- Wybór via `client.config.theme.{preset, variant}`

## Demo client

`src/client.config.ts` zawiera kompletną konfigurację demo dla "Ślusarz Kowalski Rzeszów":
- Branża: `locksmith` (schema.org `Locksmith`)
- 5 usług (otwieranie zamków, dorabianie kluczy, wymiana, naprawa, systemy zabezpieczeń)
- Godziny otwarcia (Pon-Pt 8-18, Sob 9-14, Nd zamknięte)
- 3 opinie seed
- Service area: Rzeszów + 5 pobliskich
- Variant: `red-bold`

W produkcji ten plik generuje provisioning workflow z onboarding wizardu (Faza 3).

## Validation

`src/client.config.schema.ts` — Zod schema. Astro build fails jeśli config niepoprawny.
Walidowane: NIP (10 cyfr), REGON, postal code (NN-NNN), voivodeship (16 enum), phone (E.164), email, PKD, czasy (HH:MM), all required fields.

## Dev workflow

```bash
# Lokalny dev (Vite HMR, ale BEZ Worker bindings — KV/Turnstile/Resend wszystkie no-op)
pnpm --filter @mixturemarketing/mm-starter dev

# Build (produkuje dist/_worker.js dla CF deploy)
pnpm --filter @mixturemarketing/mm-starter build

# Preview z miniflare (włącza KV/etc lokalnie)
pnpm --filter @mixturemarketing/mm-starter preview

# Deploy
wrangler deploy
```

**Wymagane secrets** (`wrangler secret put`):
- `BP_CLIENT_API_KEY` — spoke → hub auth
- `RESEND_API_KEY` + `RESEND_FROM` — email forwarding leadów
- `TURNSTILE_SECRET` — anty-bot (opcjonalnie)
- `PII_ENCRYPTION_KEY_B64` — per-tenant PII encryption (opcjonalnie)

## End-to-end flow (gdy hub + spoke deployed)

```
Visitor → kowalski-slusarz.pl → submit form
   ↓
Astro middleware: nonce + security headers
   ↓
POST /api/contact (Astro API route)
   ↓
createFormHandler from web-core/forms:
   - validate (zod + RODO consent)
   - honeypot check
   - rate limit (KV: per IP + email_hash)
   - Turnstile verify (jeśli secret)
   - build TransportLead (hash PII, AES-GCM encrypt jeśli klucz)
   - parallel: POST hub /api/leads + Resend email do klienta
   - jeśli hub fail → enqueue do FALLBACK_QUEUE KV
   ↓
Klient dostaje email (zawsze, zero data loss)
Hub D1 ma lead (lub fallback queue → drain cron retries)
```

## Co świadomie NIE jest w v0.1

- **Pozostałe 5 theme presets** (professional, medical, beauty, local-services, food) — w Track I2, każdy ~1 dzień pracy
- **service × location pages** (programmatic) — Track E (`web-core/programmatic`)
- **Review request flow** (SMS po form → opinia GBP) — Faza 5
- **Blog (AI workflow)** — Faza 7
- **Sveltia CMS integration** — config builder, oddzielny Track
- **OG image generator** (satori) — fallback dla teraz, własny moduł `web-core/seo/og`
- **GitHub Actions** (deploy + Lighthouse CI + axe) — Faza 5
- **Multi-language (hreflang)** — odłożone
- **Vitest unit tests** — integration testing przez build smoke wystarcza w v0.1

## Reference

- Plan: [00-main.md "Faza 2"](../../plan/00-main.md)
- Plan: [B-themes.md](../../plan/B-themes.md) (6 theme presets spec)
- Plan: [C-onboarding-wizard.md](../../plan/C-onboarding-wizard.md) (jak ten config jest wypełniany)
- web-core: [local](../../packages/web-core/src/local/), [forms](../../packages/web-core/src/forms/), [security](../../packages/web-core/src/security/)
- Hub: [mm-control-plane](../control-plane/) (gdzie leady idą)
