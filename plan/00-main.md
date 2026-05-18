# Plan: starter "binary-planet" — hurtowa produkcja stron dla małych lokalnych firm

## Context

Jakub uruchamia hurtową produkcję stron internetowych dla **małych lokalnych firm usługowych** (ślusarz Rzeszów, mechanik Rzeszów, księgowy, notariusz, architekt itp.). Architektura: w pełni Cloudflare (Workers, KV, D1, R2, Turnstile, CF for SaaS). Cel: doskonałe SEO (głównie **local SEO + GEO**), maksymalna wydajność, dostępność.

**Kluczowe ograniczenia biznesowe:**
- **Najniższy możliwy próg wejścia dla klienta**: setup 0–799 zł (lub free z 12 mc lock-in) + subskrypcja od 99 zł/mc, cap ~1500 zł/mc
- **Cel: małe lokalne firmy** w PL (mikro-firmy, jednoosobowe działalności, max. ~10 pracowników)
- **Local SEO = priorytet #1**, blog/GEO = drugorzędny ale obecny
- **Setup per klient = max 15 min mojej pracy** (review jakości po auto-deployu, batchowo). Klient sam przechodzi wizard, AI generuje treść, theme preset zamiast custom designu.
- **Obsługa per klient = max 1h/mc**. Solo operator musi obsłużyć 100–200 klientów.
- **Customizacja per klient = theme preset + brand tokens (kolory, logo, font)**, NIE custom code. 6 branżowych presetów pokrywa target rynek.
- **Hosting**: wszyscy klienci na koncie CF Jakuba (Cloudflare for SaaS + Custom Hostnames)

**Ustalone wcześniej:**
- Frontend: **Astro 5** (zero JS default, najlepsze SEO/LLM, content collections)
- Multi-tenant: **1 repo per klient** (template-based, fork startera)
- CMS: **Sveltia** (git-based, free) — głównie cennik + drobne edycje, klient nie pisze treści sam
- Blog AI: **półautomat z review** (AI brief+draft → ty/klient akceptuje → publikacja)
- Pełen autopilot bloga odrzucony (ryzyko HCU Google)

## Architektura — cztery poziomy

### 1. `@binary-planet/web-core` (paczka npm prywatna)

Cross-cutting biblioteka — common dla każdej strony klienta.

**Moduły:**
- `core/seo` — generator JSON-LD (LocalBusiness + 15 subtypów, Service, FAQPage, BreadcrumbList, Organization, Article z `author`), builder sitemap, robots, llms.txt (baseline, nie premium), OG image generator
- `core/local` — fundament: NAP block component, opening hours z timezone, service area (GeoCircle), lokalna nawigacja, distance calculator
- `core/forms` — Turnstile + honeypot + rate limit (KV) + Resend adapter + opcjonalnie D1 leady
- `core/a11y` — komponenty Astro WAI-ARIA compliant (Button, Nav, Modal, FormField, SkipLink, Accordion), focus management
- `core/analytics` — **default Plausible self-hosted** (RODO compliant bez consent) + opcjonalnie CF Web Analytics + Microsoft Clarity (oba wymagają consent banner)
- `core/consent` — **nowy moduł kluczowy**: cookie consent banner (RODO compliant), category-based opt-in (necessary / analytics / marketing), persistence w localStorage + IP-hash, integracja z Plausible/Clarity loaders
- `core/eeat` — **nowy**: AuthorBox component, author bio pages auto-gen z `client.config.ts`, schema `Person` + `author` w Article, certyfikaty/credentials renderer
- `core/i18n` — wrapper na Astro i18n + hreflang helper (PL-only na start, gotowe pod EN)
- `core/cms` — konfiguracja Sveltia (admin/config.yml builder z client.config.ts), OAuth proxy Worker dla GitHub auth
- `core/security` — CSP builder, security headers (A+ na securityheaders.com), rate limit middleware
- `core/programmatic` — engine do lokalnych podstron z guard rails: max 40 stron per klient, min 500 słów unique, similarity check w CI (<70%), wymóg 3+ local testimonials per strona
- `core/feature-flags` — runtime feature gating
- `core/regon` — wrapper na REGON/GUS BIR1 API (autofetch firm z NIP) — wymaga zatwierdzenia GUS (request mailowy w fazie 0)
- `core/citation` — half-auto submission engine dla polskich katalogów (lista 10 priorytetowych, nie 30 — research obalił mit ~30 aktywnych)

ESM-only, tree-shakable, semver, publikowane do GitHub Packages.

### 2. `binary-planet-starter` (template repo)

Pojedynczy projekt klienta. Skeleton:

```
client-XYZ/
├── astro.config.ts          (CF Workers adapter, integrations)
├── wrangler.toml            (Worker config, bindings)
├── client.config.ts         (config klienta — single source of truth)
├── content/
│   ├── pages/               (markdown podstron — Sveltia edytuje)
│   ├── services/            (per usługa: opis, cennik, FAQ)
│   ├── locations/           (per dzielnica/miasto: opis lokalny, landmarks)
│   ├── blog/                (jeśli moduł 'blog' włączony)
│   ├── pricing.yaml         (klient edytuje przez Sveltia)
│   ├── testimonials.yaml    (opinie wybranych klientów)
│   └── faq.yaml             (per usługa pytania)
├── public/
│   ├── admin/               (Sveltia CMS static)
│   ├── robots.txt           (auto-generated)
│   └── llms.txt             (auto-generated)
├── src/
│   ├── layouts/
│   ├── components/          (per klient design)
│   ├── pages/
│   │   ├── index.astro
│   │   ├── kontakt.astro
│   │   ├── opinie.astro
│   │   ├── uslugi/[service].astro              (z content/services)
│   │   ├── lokalizacja/[location].astro        (z content/locations)
│   │   ├── uslugi/[service]/[location].astro   (programmatic kombinacje)
│   │   ├── blog/[slug].astro
│   │   └── api/
│   │       ├── contact.ts
│   │       ├── review-request.ts
│   │       └── og/[...slug].ts
│   ├── styles/tokens.css    (brand tokens per klient)
│   └── env.d.ts
├── .github/workflows/
│   ├── deploy.yml
│   ├── lighthouse-ci.yml
│   ├── axe-a11y.yml
│   └── content-quality.yml  (sprawdza min word count na programmatic pages)
└── package.json
```

**`client.config.ts` — heart of every client project:**

```ts
export const client = {
  id: 'slusarz-kowalski-rzeszow',
  brand: {
    name: 'Ślusarstwo Kowalski',
    legalName: 'Jan Kowalski Ślusarstwo',
    nip: '1234567890',
    regon: '...',
    krs: null,
    domains: ['slusarz-kowalski.pl'],
    primaryLocale: 'pl-PL',
    locales: ['pl'],
    industry: 'locksmith',
  },
  local: {
    address: { street: 'Krakowska 12', city: 'Rzeszów', postalCode: '35-001', country: 'PL' },
    geo: { lat: 50.0413, lng: 21.9990 },
    serviceArea: {
      type: 'GeoCircle',
      centerLat: 50.0413, centerLng: 21.9990,
      radiusKm: 30,
      cities: ['Rzeszów', 'Tyczyn', 'Boguchwała', 'Głogów Małopolski'],
      neighborhoods: ['Śródmieście', 'Pobitno', 'Krasne', 'Słocina', 'Staromieście'],
    },
    openingHours: [
      { day: 'Mon-Fri', open: '08:00', close: '17:00' },
      { day: 'Sat', open: '09:00', close: '13:00' },
    ],
    phone: '+48...', emergencyPhone: '+48...',
    googleBusinessProfileId: '...',
    googlePlaceId: '...',
  },
  services: ['otwieranie-zamkow', 'awaryjne-otwarcie', 'wymiana-zamka', 'klucze-na-zamowienie'],
  modules: {
    contactForm: { enabled: true, recipient: '...', storeInD1: true },
    blog: { enabled: false },                    // mała firma — często niepotrzebne na start
    cms: { enabled: true, editableCollections: ['pricing', 'testimonials', 'faq'] },
    analytics: { provider: 'cf-web-analytics', clarityEnabled: true },
    localSeo: { tier: 'basic' },                 // basic | pro | premium
    geo: { enabled: false },
    programmatic: { enabled: true, mode: 'service-x-location' },
    reputation: { enabled: true, autoRequestAfter: 'contact-form' },
    backup: { enabled: true, scheduleCron: '0 3 * * *' },
    i18n: { enabled: false },
  },
  integrations: {
    resend: { fromEmail: 'noreply@slusarz-kowalski.pl' },
    turnstile: { siteKey: '...' },
    gbp: { accountId: '...' },
  },
} as const;
```

### 3. `binary-planet-control-plane` (Worker + Astro dashboard, twoje konto)

Centralna warstwa zarządzająca **wszystkimi klientami**. NIE deployowana per klient.

**Funkcje:**

**Onboarding & provisioning:**
- Publiczny landing → wizard (publiczna stronka www.binary-planet.pl/start)
- Klient: NIP → REGON API autofetch → city → service area → uploady (logo, zdjęcia, dokumenty) → płatność (Stripe/Przelewy24)
- Auto-provision pipeline (Cloudflare Workflows):
  1. Utwórz repo z template (GitHub API)
  2. Wygeneruj `client.config.ts` z odpowiedzi wizard
  3. Wygeneruj wstępną treść (AI: home hero, about, FAQ na podstawie branży) → commit
  4. Utwórz Worker, bindings, Custom Hostname (CF API)
  5. Setup DNS instructions email do klienta
  6. Powiadom Jakuba o nowym kliencie (slack/email)
- Klient w ciągu **2h od płatności** ma działającą stronę (jeszcze surową, przed twoim review)

**GBP / Local SEO:**
- Integracja Google Business Profile API per klient
- Auto-posting na GBP (4 posty/mc) z AI-generated treścią (zatwierdzane przez ciebie batchowo)
- Insights pull (views, calls, direction requests) → dashboard + miesięczny raport
- Review monitoring + alerty na ≤4 gwiazdki + AI-suggested response do akceptacji

**Citation builder:**
- Baza ~30 polskich katalogów z formą NAP submission
- Per klient: queue submission tasks → niektóre automatyczne (mają public API: Bing Places, Apple Business Connect), reszta to template + manual w wymiarze 5-10 min per klient
- Tracking statusu: submitted / verified / live

**Reputation manager:**
- Po wysłaniu form contact → cron za 7 dni → wysłanie review request (SMS via SMSAPI lub email)
- AI-draft response na każdą nową opinię GBP → notyfikacja do akceptacji w panelu
- Negative review alert (>1 gwiazdka różnica od średniej) → SMS do klienta

**Reporting:**
- Cron miesięczny (1. każdego mc) → generuje PDF report per klient:
  - GBP insights (views, calls, direction requests, photo views)
  - GSC: top queries, top pages, CTR, position, impressions
  - GA4: sessions, users, conversions
  - Lighthouse latest, uptime %
  - Top local rank tracking (DataForSEO snapshot dla głównych keywords)
  - Recommendations (auto-generated z trend analysis)
- Wysyłka PDF + link do klienta z białoetykietowym brandingiem twoim

**Operations:**
- Daily backup (R2) wszystkich repo klientów + content
- Health monitor (5 min cron) — uptime, SSL, CWV (CrUX), AI Overviews presence
- Feature flag overrides per klient (płaci za moduł → włączasz w KV)
- Billing tracker (Stripe subscriptions sync → KV per klient)

**Storage:**
- D1 `bp_clients` (klienci, plan, moduły, billing status)
- D1 `bp_leads` (leady z formularzy wszystkich klientów, per-tenant namespace)
- D1 `bp_seo_metrics` (snapshoty GSC/GA4/GBP per klient)
- D1 `bp_citations` (status NAP submissions)
- D1 `bp_reviews` (wszystkie opinie GBP, sentiment, response status)
- D1 `bp_content_drafts` (drafty bloga AI, status review)
- KV `bp_feature_flags`
- KV `bp_rate_limit`
- R2 `bp-backups` (daily snapshots)
- R2 `bp-reports` (wygenerowane PDF reports)

### 4. `binary-planet-marketing` (osobne repo, publiczne)

Twoja własna strona — landing, cennik, demo, wizard onboardingu. To **first dogfooding** stack: jeśli twoja strona nie ma świetnego local SEO, nie sprzedasz lokalnym firmom.

## Pakiety usług — low-entry, automatyzacja-first

**Model gotowych tierów** (klient wybiera w wizardzie, nie buduje à la carte):

| Tier | Setup | Subskrypcja | Co zawiera | Mój czas setup | Mój czas/mc |
|---|---|---|---|---|---|
| **Starter** | **0 zł** (12 mc lock-in) lub 299 zł bez lock-in | **149 zł/mc** | Strona z theme preset, AI-generowana treść, **GBP setup + 4 GBP posty AI/mc**, **submisja NAP do 5 katalogów**, formularz, schema, sitemap, hosting, SSL, backup, drobne edycje (do 15 min/mc), miesięczny mini-raport email | 15 min review | 20 min |
| **Standard** | **0 zł** (12 mc lock-in) lub 499 zł bez lock-in | **299 zł/mc** | Starter + Local SEO Pro (citation building 30 katalogów, 4 GBP posty/mc, tracking 30 keywords, 2 nowe lokalne podstrony/mc) + Reputation Manager (auto review requests SMS, AI response suggester) + miesięczny raport PDF | 30 min review + GBP setup | 30 min |
| **Premium** | **799 zł** one-time (30 min konsultacja, theme tweaks, premium content briefing) | **599 zł/mc** | Standard + Conversion Booster (A/B testy, Clarity, kwartalna CRO review) + Blog AI (4 artykuły/mc półautomat) | 1h konsultacja + 30 min review | 45 min |

**Dodatki à la carte** (bez przebudowy tieru):
- **Multi-location**: +79 zł/mc per dodatkowa lokalizacja
- **GEO / AI Search optimization**: +149 zł/mc (LLM mention tracking, passage optimization)
- **Dodatkowe artykuły bloga**: +49 zł za artykuł (poza limitem tieru)
- **Premium theme switch w trakcie**: 199 zł one-time

**Cap praktyczny** = ~1500 zł/mc (Premium + multi-location 3 oddziały + GEO + extra contents).

### Sanity check ekonomiki

Przy 100 klientach (60 Starter / 30 Standard / 10 Premium):
- MRR: 60×149 + 30×299 + 10×599 = **23 870 zł/mc**
- Koszty operacyjne (CF, API, SMSAPI, Anthropic, DataForSEO Basic): ~3 500 zł
- **NET MRR: ~20 370 zł/mc**
- Twój czas: ~60h/mc (60×20min + 30×30min + 10×45min)

Przy 250 klientach (150/75/25):
- MRR: 150×149 + 75×299 + 25×599 = **59 750 zł/mc**
- Koszty: ~9 000 zł
- **NET: ~50 750 zł/mc**
- Twój czas: ~140h/mc → granica solo, warto outsource'ować GBP posts review

**Setup z lock-in jest kluczowy.** Klient płaci 99–599 zł/mc × 12 mc = LTV minimum 1188–7188 zł. Pokrywa twój czas setupu (auto) + 1–2 godziny review w roku.

## Local SEO — strategia szczegółowa

To rdzeń wartości dla klientów. Konkretnie:

### Co MUSI być na każdej stronie klienta (auto z `client.config.ts`)
- **LocalBusiness schema** (lub konkretny subtype: `Locksmith`, `AutoRepair`, `Notary`, `AccountingService`, `Architect`) z `geo`, `areaServed`, `openingHoursSpecification`, `aggregateRating` (jeśli są opinie)
- **NAP** w stopce, header, kontakt — IDENTYCZNY z GBP (case-sensitive)
- **OpeningHours** widget używający `core/local`
- **Service Area** (mapa lub lista dzielnic) — używa GeoCircle z config
- **Google Map** osadzona (lazy load — nie ładuj IFrame przed scroll, żeby nie psuć CWV)
- **Lokalne testimonials** z miastem ("Anna K. z Pobitnej")
- **FAQ schema** z lokalnymi pytaniami ("Czy obsługujecie Pobitną?", "Ile czasu zajmuje dojazd do Krasnego?")

### Programmatic local pages — engine z guard rails

Generujemy `/uslugi/[service]/[location]/` dla każdej (service × location) kombinacji.

**Guard rails (przeciw doorway pages):**
1. Min. 400 słów **unikalnej** treści per strona (lint w CI)
2. Per location obowiązkowe: lokalne landmarks (z OpenStreetMap Overpass), lokalne kody pocztowe, lokalne case study (1 testimonial przypisany do tej lokalizacji)
3. Per service per location: specyficzne lokalne FAQ (AI gen z prompt o lokalnych potrzebach)
4. Generowanie OFFLINE w build time (Astro content collections), nie w runtime — żeby były indeksowalne i statyczne
5. Hard cap: max 50 programmatic pages per klient (jakość > ilość)
6. Audit script przed deployem: jeśli > 20% stron ma >80% similarity (z innymi stronami), build fail

### Citation building — lista katalogów PL (priorytet)

Tier 1 (każdy klient): Google Business Profile, Bing Places, Apple Business Connect, Panorama Firm, pkt.pl, Aleo, Bizser, Yelp PL, Foursquare, Yellow Pages PL
Tier 2 (Local SEO Pro): Allegro Lokalnie, GoldenLine, Branżowo, gowork.pl, Olx Praca (jeśli zatrudniają), Zumi (mapy), TripAdvisor (jeśli dotyczy), Houzz (architekci), ZnanyLekarz (zdrowie), Booksy (uroda/zdrowie)
Tier 3 (manual review): branżowe katalogi (np. ślusarze: dedykowane portale ślusarskie, izby rzemieślnicze)

Tooling: half automated submitter w control plane. Część (Bing, Apple) ma API. Reszta — wizard z prefilled fields + screenshot weryfikacji submisji do D1.

### Review acquisition

Po każdej formie kontaktowej (która prowadzi do realnej transakcji) → cron za 7 dni:
- SMS via SMSAPI: "Cześć [imię], dziękujemy za skorzystanie z [firma]. Jeśli zadowolony, wystaw nam opinię: [short.link/abc]"
- short.link wskazuje na Google Review Link klienta (z GBP)
- Tracking konwersji w D1 (ile wysłanych, ile opinii nowych w tym oknie)

## Stack technologiczny (potwierdzony)

| Warstwa | Wybór |
|---|---|
| Framework | **Astro 5** (CF Workers adapter) |
| CSS | **Tailwind v4** + CSS custom properties dla brand tokens |
| Komponenty | własne a11y-first + selektywnie shadcn/ui patterns |
| Hosting | **Cloudflare Workers** + Static Assets |
| DB | **D1** (per klient gdzie potrzeba, central w control plane) |
| KV | **CF KV** (rate limit, feature flags) |
| Storage | **R2** + **CF Images** (warianty + WebP/AVIF) |
| Forms | **Turnstile** + **Resend** |
| SMS | **SMSAPI.pl** (PL native, dobre stawki) |
| CMS | **Sveltia CMS** (git-based) |
| Analytics | **CF Web Analytics** + **Microsoft Clarity** (free) |
| LLM | **Anthropic** (Claude Sonnet 4.6 / Opus 4.7) |
| SEO data | **DataForSEO** (Basic plan: Google SERP + Local) |
| GBP | **Google Business Profile API** |
| REGON | **REGON API GUS** (free, dane firm z NIP) |
| Domeny | **Cloudflare for SaaS** + Custom Hostnames |
| Płatności | **Stripe** (subscription) + **Przelewy24** (one-time setup, BLIK) |
| CI/CD | **GitHub Actions** + Wrangler |
| Monitoring | **Better Stack** free tier |
| A11y CI | **axe-core** + **pa11y-ci** |
| Performance CI | **Lighthouse CI** (budget enforcement) |
| Workflows | **Cloudflare Workflows** (onboarding pipeline) |

## Plan implementacji — fazy (low-entry, automatyzacja-first)

### Faza 0: setup infra + decyzje brandowe (1–2 dni)
- Ustalenie nazwy produktu (binary-planet placeholder do uzgodnienia)
- GitHub org, prywatne npm registry (GitHub Packages)
- Cloudflare account + CF for SaaS activated
- API keys: Anthropic, DataForSEO, Resend, SMSAPI, Stripe, Przelewy24, REGON, Google Cloud (GBP API)
- Domain własny (np. binary-planet.pl)

### Faza 1: `@binary-planet/web-core` v0.1 (5–7 dni)
- Monorepo (pnpm + turbo)
- Pakiety v0.1: `seo`, `local`, `forms`, `a11y`, `security`, `feature-flags`, `regon`, `programmatic`
- Schema.org: 15 subtypów LocalBusiness (Locksmith, AutoRepair, Notary, Architect, AccountingService, MedicalBusiness, BeautySalon, Plumber, Electrician, RealEstateAgent, Restaurant, ...)
- Sitemap + robots + llms.txt builders
- OG image generator (satori w Worker)
- Form handler z Turnstile + rate limit + Resend + opcjonalnie D1
- 8 a11y components
- REGON API wrapper (autofetch firmy z NIP)
- Programmatic engine z guard rails (min word count, similarity check)
- Testy: vitest + Playwright a11y
- Publikacja v0.1 do GitHub Packages

### Faza 2: `binary-planet-starter` + 6 theme presets (10–14 dni)

**To jest największa pojedyncza inwestycja czasowa**, bo theme presets to praca designerska + komponenty + treść boilerplate per branża.

- Template repo (GitHub "use this template")
- Astro 5 + CF Workers + Tailwind v4
- `client.config.ts` + Zod schema validation z `themePreset` jako required field
- Architektura theme'ów: każdy preset = osobny folder `themes/[preset]/` z `layouts/`, `components/`, `tokens/`, `sections/`
- **6 theme presets**:
  1. `craftsman` (ślusarz, mechanik, hydraulik, elektryk, dekarz) — hero z "zadzwoń teraz" CTA, lista usług z cenami, mapa zasięgu, opinie, urgency CTA
  2. `professional` (księgowy, notariusz, architekt, prawnik) — autorytatywny, "umów konsultację", case studies, certyfikaty, sekcja "kim jesteśmy"
  3. `medical` (lekarz, dentysta, kosmetolog, fizjoterapeuta) — zaufanie, opinie, kwalifikacje, booking widget placeholder
  4. `beauty` (salon urody, fryzjer, paznokcie, masaż) — galeria realizacji, cennik, Booksy integration hook
  5. `local-services` (sprzątanie, opieka, transport) — jasne pakiety cenowe, zakres, mapa
  6. `food` → odroczone do fazy 8 (restauracja, kawiarnia, catering)
- Każdy preset: 3–5 wariantów kolorystycznych
- Strony szablonowe: home, o-firmie, oferta, usługi/[service], lokalizacja/[location], usługi/[service]/[location], opinie, kontakt, 404, blog (opcjonalne)
- API routes: contact, review-request, og generator
- Sveltia CMS config builder
- GitHub Actions: deploy, Lighthouse CI, axe a11y, content quality
- Smoke test: stworzenie 6 demo clients (po jednym per preset) i deploy

### Faza 3: onboarding wizard + auto-provisioning + control plane v0.1 (14–18 dni)

**BEZ TEGO BIZNES NIE DZIAŁA** — to fundament low-cost operations.

**Control plane:**
- Worker `binary-planet-control-plane` (Astro Server Islands + Hono API)
- D1 schemas: clients, leads, seo_metrics, billing
- Dashboard MVP: clients list, client detail, billing, deploy log
- Health monitor scheduled worker (uptime, CWV, SSL)
- Daily backup scheduled worker

**Onboarding wizard (część `binary-planet-marketing` — twoja strona):**
- Publiczny landing z cennikiem 3 tierów
- Wizard step-by-step:
  1. Wybierz branżę → automatycznie sugeruje theme preset
  2. Wybierz wariant kolorystyczny (3–5 wariantów per preset, live preview)
  3. Wpisz NIP → REGON autofetch (firma, adres)
  4. Potwierdź/edytuj dane firmy + dodaj GBP Place ID
  5. Lista usług (z presetu, edytowalna, max 8)
  6. Service area (miasta, dzielnice — wyszukiwarka geo)
  7. Godziny otwarcia
  8. Upload: logo (lub AI generation), 5–10 zdjęć (lub stockowe z presetu)
  9. AI generuje treść (home hero, about, service descriptions, FAQ) → klient widzi, edytuje, akceptuje
  10. Wybór tieru (Starter/Standard/Premium) i modelu płatności (lock-in vs setup fee)
  11. Płatność: Stripe (karty, SEPA, PayPal) + Przelewy24 (BLIK, przelewy PL)
  12. Confirmation + DNS instructions

**Auto-provisioning workflow (Cloudflare Workflows):**
1. Webhook (Stripe/P24) → klient potwierdzony
2. GitHub API: utwórz repo z template, wypełnij client.config.ts
3. AI gen final content → commit do repo
4. CF API: utwórz Worker, bindings (KV, R2, opcjonalnie D1)
5. CF for SaaS: utwórz Custom Hostname dla domeny klienta
6. Wrangler deploy via GitHub Actions
7. Email do klienta: DNS instructions + dostęp do Sveltia
8. Slack/email do Jakuba: nowy klient, 15-min review w batchu wieczornym

**Target time-to-live**: od potwierdzenia płatności do działającej strony = **<30 min automatycznie + 15 min twojego review następnego dnia**.

### Faza 4: pierwsi 3–5 klientów pilotażowych, różne branże (3–4 tyg)
- Onboard realnych klientów z różnych presetów (najlepiej znajomi/własna sieć): ślusarz, księgowy, lekarz, salon urody, sprzątanie
- Każdy klient przechodzi wizard "jak normalny user" — bez twojej pomocy w trakcie
- Mierz: czas wizard, % drop-off, gdzie utykają, jakość AI content, ile minut review per klient
- Iteruj wizard + theme presets + AI prompts
- Cel: time-to-live (od kliknięcia "kupuję" do strony online) **≤30 min**, twój czas review **≤15 min/klient**

### Faza 5: citation builder + reputation manager + GBP integration (7–10 dni)
- Citation engine: 30 polskich katalogów (Panorama Firm, pkt.pl, Aleo, Bizser, Bing Places, Apple Business Connect, Yelp PL, Foursquare, GoldenLine, gowork.pl, Zumi, Branżowo, + branżowe top-10)
- Auto-submit do API-enabled (Bing, Apple)
- Manual wizard z prefilled fields dla reszty (~5–10 min batch per klient, jednorazowo)
- D1 tracking statusu submisji
- GBP API integration: auto-posting (4 posty/mc, AI gen + batch approval), insights pull, review monitoring
- Reputation: cron post-form → SMS via SMSAPI z linkiem do GBP review → tracking konwersji w D1
- Review response AI suggester w dashboard (batch approval per klient)

### Faza 6: monthly reports + dashboard polish (5–7 dni)
- Generator miesięcznych PDF reports per klient (GBP insights + GSC + GA4 + Lighthouse + local rank snapshot + recommendations)
- Białe etykietowanie (twój brand)
- Auto-wysyłka email 1. każdego mc
- Dashboard: dodaj widoki rankings, reports archive, billing health

### Faza 7: blog AI engine + GEO module (7–10 dni)
- Per klient z Premium (lub add-on) blog AI workflow:
  - Cron miesięczny: fetch GSC + GA4 + DataForSEO + CRM context
  - Topic cluster analysis (SERP overlap method)
  - Brief generation → draft generation (Claude Sonnet 4.6 / Opus 4.7)
  - PR open na repo klienta z draftem
  - Email/Slack notify do klienta + ciebie
- GEO module: llms.txt curation (manual approve), passage-level linter, LLM mention tracker (manual queries do ChatGPT/Perplexity batch)

### Faza 8: skalowanie + dalsze theme presets + outsourcing (ongoing)
- Onboard 20+ klientów dla validacji unit economics
- Dodatkowe theme presets: `food`, branżowe niche
- Outsourcing GBP posts review (np. wirtualna asystentka 3h/tydz na batch approval)
- Marketing growth: SEO własnej strony, paid ads, lokalne partnerstwa

## Krytyczne pliki do zaprojektowania jako pierwsze

1. **`@binary-planet/web-core/src/local/schema.ts`** — fundament local SEO. Builder dla LocalBusiness + 15 subtypów (Locksmith, AutoRepair, Notary, Architect, AccountingService, RealEstateAgent, Plumber, Electrician, MedicalBusiness, Restaurant, ...).
2. **`@binary-planet/web-core/src/programmatic/engine.ts`** — generator service × location pages z guard rails.
3. **`@binary-planet/web-core/src/regon/client.ts`** — REGON API client (NIP → autofetch firmy).
4. **`binary-planet-starter/src/client.config.schema.ts`** — Zod schema, kontrakt z core.
5. **`binary-planet-control-plane/src/onboarding/workflow.ts`** — Workflow auto-provisioning (sekwencja CF API + GitHub API + Stripe webhook).
6. **`binary-planet-control-plane/src/d1/schema.sql`** — model danych operacji.

## Decyzje świadomie odroczone

- **Headless CMS hosted** — Sveltia git-based wystarczy. Migracja możliwa później.
- **E-commerce moduł** — odrzucony (target = usługi lokalne, nie produkty).
- **Multi-tenant single Worker** — odrzucony, 1 repo per klient daje lepszą izolację designu.
- **Pełen autopilot bloga** — odrzucony (HCU ryzyko).
- **Decap CMS** — odrzucony na rzecz Sveltia.
- **Next.js** — odrzucony na rzecz Astro.
- **Profound / Peec LLM tracking** — odroczone do fazy 7+, początkowo manualne queries.

## Weryfikacja end-to-end (po fazie 3)

1. **Performance:** Lighthouse CI ≥95 we wszystkich metrykach, CLS <0.05, LCP <1.5s, INP <100ms. Field data via CrUX po tygodniu.
2. **Local SEO base:** GBP zweryfikowany, kategoria poprawna, NAP zgodny z stroną, GBP categories optimized. LocalBusiness schema valid w Rich Results Test.
3. **Programmatic pages:** max 40 per klient, wszystkie ≥500 słów unique, <70% similarity (lint w CI), każda z 3+ local testimonials + landmarks + lokalne FAQ.
4. **GEO / AI Citation Building:** Manual test w ChatGPT search + Perplexity dla brand queries i top long-tail. Article schema + author + dates + fresh content. llms.txt jako baseline (zero koszt), NIE jako moduł premium.
5. **A11y:** axe 0 violations, manual screen reader (NVDA), keyboard nav, kontrast 4.5:1+.
6. **Forms:** E2E test — wysłanie → email dostarczony → rate limit po 5 próbach → Turnstile blokuje bot.
7. **Reputation flow:** test E2E — wysłanie formy → cron za 7 dni → SMS dostarczone → klient klika link → opinia w GBP → fetch przez API → wyświetlenie w dashboard.
8. **CMS:** klient testowy zmienia cennik w Sveltia → deploy <90s → zmiana widoczna.
9. **Backup:** scheduled worker dumpuje R2 → restore test po tygodniu.
10. **Security:** CSP, security headers (securityheaders.com A+), HSTS, brak leak env vars.
11. **Onboarding (po fazie 5):** klient testowy przechodzi wizard → płaci (Stripe test mode) → w 30 min ma działającą stronę na test domenie.

## Nazwa robocza

"binary-planet" jest placeholderem. Sugeruję krótką, łatwą do wymówienia nazwę PL/EN, dostępną na `.pl` i `.com`. Do uzgodnienia z Jakubem przed fazą 0.

---
