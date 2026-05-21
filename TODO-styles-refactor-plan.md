# Refactor stylów + system sekcji — plan kontynuacji

> **Status:** plan na 2026-05-21+. Decyzje podjęte 2026-05-20.
> **Cel:** klient wybiera STYL (nie branżę), zmienia kolory/logo, włącza/wyłącza sekcje zależnie od oferty firmy.
>
> **Design briefs (dokończone 2026-05-20):**
> - [design-briefs/00-master-design-system.md](design-briefs/00-master-design-system.md) — wspólne fundamenty (icons, spacing, motion, a11y, trendy 2026, typography defaults, dark mode, CMS schema)
> - [design-briefs/01-czysty.md](design-briefs/01-czysty.md) — **Czysty** (Minimalist)
> - [design-briefs/02-elegancki.md](design-briefs/02-elegancki.md) — **Elegancki** (Elegant)
> - [design-briefs/03-dynamiczny.md](design-briefs/03-dynamiczny.md) — **Dynamiczny** (Dynamic)
> - [design-briefs/04-magazynowy.md](design-briefs/04-magazynowy.md) — **Magazynowy** (Editorial)
> - [design-briefs/05-color-system.md](design-briefs/05-color-system.md) — **System kolorów** (predefined + auto-generation z 1-2 brand colors via Material Color Utilities)
>
> **Decyzje 2026-05-20 (round 2):**
> 1. Default fonty per styl + opcja zmiany w `/ustawienia → Wygląd → Typografia` — zob. [00-master-design-system.md#typography](design-briefs/00-master-design-system.md#typography-per-styl--defaulty--opcje-decyzja-2026-05-20)
> 2. Dark mode w v1 — TAK, każdy styl ma palety dark + tryb Auto/Tylko jasny/Tylko ciemny w panelu
> 3. Ornamenty Magazynowego: mix SVG Repo (CC0) + custom 3-5 wzorów moich
> 4. CMS schema dla "Historia": dedicated frontmatter fields (drop cap, pull quote, ornament jako toggle/select w Sveltia, NIE shortcodes ani MDX)
> 5. **System kolorów (nowy):** klient widzi 3 predefined palety per styl (kolorowe kółka + preview) ALBO podaje 1-2 brand colors → Material Color Utilities auto-generuje resztę → WCAG kontrast pilnowany przez system

---

## TL;DR — co zmienia się względem obecnego stanu

❌ **Źle (teraz):** themes nazwane branżowo — `craftsman` / `beauty` / `food` / `professional`. 4 demo workery zdeployowane, ale każdy ma ten sam zestaw komponentów (tylko Hero + kolory + fonty się różnią — strony wyglądają w 75% podobnie).

✅ **Dobrze (cel):** themes nazwane stylowo — `minimalist` / `elegant` / `dynamic` / `editorial`. Każdy styl = realnie inny **set komponentów** (Header / ServicesList / ReviewsSection / Footer + Hero — wszystkie per-style). Klient sam podpina branżę przez treści + sekcje opcjonalne.

---

## Decyzje podjęte (do zapisania w pamięć)

| # | Pytanie | Decyzja Jakuba |
|---|---------|----------------|
| 1 | Ile stylów na starcie? | **4 stylowe (nie branżowe).** Polskie nazwy w UI klienta: **Czysty / Elegancki / Dynamiczny / Magazynowy**. Slug w kodzie: minimalist/elegant/dynamic/editorial. |
| 2 | Czy demo workery przemianować? | **TAK** — `demo-craftsman → demo-dynamiczny`, `demo-beauty → demo-elegancki`, `demo-food → demo-magazynowy`, `demo-professional → demo-czysty`. URL-e zostają na `mixturemarketing.pl`. |
| 3 | Czy klient wybiera styl w wizardzie czy w /ustawienia? | **AUTOMATYZACJA POTWIERDZONA.** Zmiana stylu w `/ustawienia → Wygląd strony` → API save → hub commit do GH repo klienta → workflow_dispatch → rebuild ~2 min. Wszystko już działa (zob. obecny `/api/admin/addons/deploy-trigger`). Klient ma "domyślny styl" w wizardzie (Czysty), może zmienić w każdej chwili. |
| 4 | Czy sekcje opcjonalne są bezpłatne czy płatne? | **Pełna mapa core/tier/addon** poniżej. Sekcje per-styl pre-checkbox w briefach. |
| 5 | Czy używać emoji w UI? | **NIE — nigdy.** Wszystkie ikony z profesjonalnych bibliotek SVG (Lucide/Phosphor/Material). [Master design system](design-briefs/00-master-design-system.md#zasada-nr-1-bez-emoji-w-kodzie-i-ui). |
| 6 | Trendy 2026 do adoptowania? | **Cherry-pick:** bento grids (Czysty+Magazynowy), bold typo (Dynamiczny+Magazynowy), dark mode opt-in, micro-interactions purposeful, mobile thumb-zone CTA, trust-based design, clarity > decoration, performance LCP <2s. **Odrzucone:** brutalism, glassmorphism, 3D/WebGL w v1, AI personalization w v1. |

---

## Mapa 4 stylów (dopracowane — pełne briefs w `design-briefs/`)

**Każdy styl ma osobny brief z:** filozofia / inspiracje (10+ ref sites) / conversion workflow / palety kolorów (3 warianty z HEX) / typografia (3 pary fontów) / system ikon / komponenty per-styl / sekcje opcjonalne pre-checkbox / demo klient sugestia. Otwarte pytania na końcu każdego briefu.

### 1. Czysty (Minimalist) → [01-czysty.md](design-briefs/01-czysty.md)
*Notion meets Linear. Bento grids. Single accent. Whitespace 40-60%.*

### 2. Elegancki (Elegant) → [02-elegancki.md](design-briefs/02-elegancki.md)
*Aesop meets Glossier. Image-bg hero. Serif. Pull quote reviews. Ornament dividers.*

### 3. Dynamiczny (Dynamic) → [03-dynamiczny.md](design-briefs/03-dynamiczny.md)
*Liquid Death meets Notion. Sticky CTA top+bottom. Multi-CTA hero. 4 trust badges row. Optional dark default.*

### 4. Magazynowy (Editorial) → [04-magazynowy.md](design-briefs/04-magazynowy.md)
*Eater meets Apple Today. Asymetryczny hero. Drop caps. "W prasie" zamiast Google stars. Long-form text.*

---

## Mapa 4 stylów (oryginalna robocza — superseded przez briefy powyżej)

### 1. Minimalist
- **Charakter:** dużo whitespace, sans-serif, jeden akcent koloru, brak ornamentów, ostre cienie, fokus na typografii i hierarchii informacji
- **Hero:** centered, krótki nagłówek, jeden CTA, podtitle
- **Fonty (default):** Inter (display + body) lub Geist / Manrope (do wyboru)
- **Palety wariantów:** `mono-black` / `mono-blue` / `mono-emerald`
- **Naturalnie dla:** prawnik, lekarz, doradca, architekt, B2B usługi, IT, księgowy — branże gdzie powaga = sprzedaż
- **Differentiator vs konkurencja:** Wix daje zaśmiecone templates, my dajemy "Notion-vibe" prostotę za 179-249 zł

### 2. Elegant
- **Charakter:** serif (Playfair / Cormorant Garamond / Lora) w nagłówkach, ciepłe pastele, miękkie cienie, image-bg z overlay, dużo zdjęć
- **Hero:** image-bg z dużą fotografią produktu/wnętrza + serif headline + subtle CTA pill
- **Fonty (default):** Playfair Display + Lora, alternatywa: Cormorant + Source Sans
- **Palety wariantów:** `rose-cream` / `sage-ivory` / `lavender-gold`
- **Naturalnie dla:** salon kosmetyczny, SPA, fryzjer, fine dining, butik, fotograf, planner ślubny
- **Differentiator:** Squarespace vibe za 1/3 ceny

### 3. Dynamic
- **Charakter:** mocne kolory, gradienty, duże litery bold sans, mocne CTA, animacje on-scroll, wykrzykniki w copy, sticky CTA "Zadzwoń"
- **Hero:** split (text + image) lub bold gradient bg + duże litery, multi-CTA (call + booking)
- **Fonty (default):** Barlow Condensed + Inter, alternatywa: Archivo Black + Inter
- **Palety wariantów:** `red-yellow` / `electric-blue` / `magenta-lime`
- **Naturalnie dla:** ślusarz 24/7, mechanik, hydraulik, restauracja fast-food, siłownia, kurier, e-commerce
- **Differentiator:** typowa polska usługowa strona robiona "po taniości" — my dajemy z polorem

### 4. Editorial
- **Charakter:** narracja, duże nagłówki na blokach kolorów, mieszane układy (asymetria), mocne typo, zdjęcia full-bleed, akcent ramek/cudzysłowów
- **Hero:** mieszany — duże fullbleed image + nagłówek na blokach kolorów + krótki essay-style intro
- **Fonty (default):** Fraunces + IBM Plex Sans, alternatywa: GT Sectra + Inter
- **Palety wariantów:** `forest-amber` / `slate-rose` / `cream-cobalt`
- **Naturalnie dla:** restauracja z historią, hotel butikowy, winiarnia, ekologiczna firma, rzemiosło premium, marka osobista, kreatywni
- **Differentiator:** **niemal nikt w PL nie robi w tym stylu** — okazja na różnicowanie wśród "tych co chcą wyglądać jak NYT albo Apaiser"

---

## Mapa sekcji — co jest core / tier / addon

### Core (zawsze obecne, niezależnie od stylu i pakietu)

| Sekcja | Komponent | Dostępność |
|--------|-----------|------------|
| Hero | per-style (mamy 4) | wszyscy |
| Usługi / Oferta | per-style (do zrobienia 4) | wszyscy — max 5 usług na Starter, 12 Standard, unlimited Premium+ |
| Reviews | per-style (do zrobienia 4) | wszyscy — manual seed + GBP sync Premium+ |
| Hours | per-style (do zrobienia 4) | wszyscy |
| Contact / kontakt form | per-style (do zrobienia 4) | wszyscy |
| Footer + NAP + RODO | per-style (do zrobienia 4) | wszyscy |
| Mapa Google embed (LocalBusiness) | shared | wszyscy z fizycznym adresem |

### Tier-included (free w określonych pakietach)

| Sekcja | Pakiet | Notatki |
|--------|--------|---------|
| Live widget opinii Google | Starter+ | już w bazie cenowej Track 25 |
| Click-to-call sticky mobile | Starter+ | already implemented |
| Sveltia CMS panel `/admin/` | Starter+ | already implemented |
| Booksy / Calendly embed | Starter+ | already implemented as widget |
| Galeria zdjęć z filtrami (przed-po / kategorie) | Standard+ | nowa sekcja do zaprojektowania |
| Lokalne SEO dzielnicowe (programmatic) | Standard+ | already implemented |
| SMS reminder przed wizytą | Standard+ | already implemented |
| Blog AI (2 posty/mc) | Premium | already implemented |
| AI Reviews PRO (auto-draft odpowiedzi) | Premium | already implemented |
| Wizytówka Google posting (3/mc) | Premium | already implemented |
| Call tracking | Premium | already implemented |
| Sekcja "Publikacje + case studies" | Professional only | nowa sekcja |
| Bezpieczny upload dokumentów | Professional only | nowa sekcja |
| Cal.com + płatna konsultacja | Professional only | nowa integracja |
| Wersja językowa EN/UA | Professional only | already implemented as addon, dla Pro w cenie |

### Płatne dodatki (Stripe sub items, klient kupuje per /addons)

| Slug | Sekcja na stronie | Cena/mc |
|------|-------------------|---------|
| `chatbot_basic` | Chatbot AI Basic | TBD (Workers AI) |
| `chatbot_pro` | Chatbot AI PRO | TBD (Anthropic Haiku) |
| `chatbot_premium` | Chatbot AI Premium | TBD (Anthropic Sonnet) |
| `leadpop_discount` | Leadpop modal exit-intent | +30 zł |
| `fomo_counter` | FOMO licznik | +20 zł |
| `newsletter_sms` | Newsletter zapisu (SMS/email) | +30 zł |
| `instagram_sync` | Instagram feed embed | +15 zł |
| `wolt_glovo` | Delivery widget | +25 zł |
| `nfc_stand` | NFC stojak "Zbliż i oceń" | TBD |
| `extra_subpage` | Dodatkowa podstrona Premium | +40 zł |
| `site_migration` | Migracja istniejącej strony | one-time |
| `language_addon` | Dodatkowa wersja językowa (poza Pro tier) | TBD |
| `booking_integration` | Integracja własnego systemu rezerwacji | TBD |
| `geo_llm_pro` | GEO/LLM PRO (AI search optimization) | TBD |
| `competitor_monitoring` | Monitoring konkurencji (DataForSEO) | TBD |
| `backup_pro` | Backup PRO (więcej retention) | TBD |
| `analytics_pro` | Analityka PRO (GA4 + dashboards) | TBD |
| `reviews_pro` | Zarządzanie opiniami PRO (już w Premium tier, ale jako addon dla Standard) | TBD |
| `call_tracking` | Call tracking (już w Premium tier, ale jako addon dla Standard) | TBD |
| `seasonal_photo` | Sesja foto sezonowa (one-time service) | TBD |

### Nowe sekcje strony do zaprojektowania (nie ma jeszcze komponentów)

Każdy z tych musi mieć: per-style komponent + edytor w panelu klienta + render w starter:

| Sekcja | Dla kogo | Pakiet / dodatek |
|--------|----------|-------------------|
| **Galeria zdjęć** (grid z filtrami przed-po lub kategorie) | beauty / fotograf / rzemiosło / wnętrza / restauracja | Standard+ (CMS Sveltia upload do R2 już jest) |
| **Menu / Karta dań ze zdjęciami** | restauracja / kawiarnia / catering / piekarnia | Standard+ (CMS schema do zaprojektowania) |
| **Cennik tabelaryczny** | większość usług | wszystkie (jeden component, content via CMS) |
| **Sekcja "Zespół"** | większe firmy 5+ osób | wszystkie (CMS schema osób z fotografiami) |
| **Sekcja "Historia firmy"** | restauracja / rzemiosło / marka z tradycją | wszystkie (rich content via CMS) |
| **Wideo embed (YouTube/Vimeo)** | wszystkie | wszystkie (single field URL) |
| **FAQ rozszerzona** | prawnik / księgowy / lekarz / kursy | wszystkie (już mamy basic FAQ — rozszerzyć grupowanie) |
| **Publikacje + case studies** | prawnik / lekarz / konsultant | Professional only (CMS collection + render) |
| **Bezpieczny upload dokumentów** | prawnik / księgowy | Professional only (R2 + retention + AES-GCM per-doc) |

---

## Co już zrobione (do zachowania w refactorze)

| Co | Plik / Worker | Status |
|----|---------------|--------|
| Theme registry z tokensCss + fontsCss + custom HEX overrides | [apps/starter/src/themes/registry.ts](apps/starter/src/themes/registry.ts) | ✅ — tylko przemianować presety |
| Schema z `brandColor` / `accentColor` / `heroVariant` / `accent` / `logoUrl` | [apps/starter/src/client.config.schema.ts](apps/starter/src/client.config.schema.ts) | ✅ — bez zmian |
| BaseLayout z Google Fonts preconnect + tokens overrides | [apps/starter/src/layouts/BaseLayout.astro](apps/starter/src/layouts/BaseLayout.astro) | ✅ — bez zmian |
| Hero dispatcher | [apps/starter/src/themes/Hero.astro](apps/starter/src/themes/Hero.astro) | ✅ — tylko przemianować imports |
| Panel `/ustawienia` z theme picker + color picker + logo upload | [apps/panel/src/pages/ustawienia.astro](apps/panel/src/pages/ustawienia.astro) | ✅ — tylko przemianować labels |
| `/api/settings/save kind="theme"` z walidacją HEX | [apps/panel/src/pages/api/settings/save.ts](apps/panel/src/pages/api/settings/save.ts) | ✅ — przemianować wartości VARIANTS |
| Logo upload do R2 + serve endpoint | [apps/panel/src/pages/api/settings/logo-upload.ts](apps/panel/src/pages/api/settings/logo-upload.ts), [apps/panel/src/pages/api/logo/[clientId].ts](apps/panel/src/pages/api/logo/[clientId].ts) | ✅ — bez zmian |
| Hub deploy-trigger syncuje `client.config.ts` do GH repo | [apps/control-plane/src/api/routes/admin/addons.ts](apps/control-plane/src/api/routes/admin/addons.ts) | ✅ — bez zmian |
| 4 demo workery na CF + custom domains | `demo-{craftsman,beauty,food,professional}.mixturemarketing.pl` | ✅ działają, do przemianowania |
| Panel onboarding picker (4 themes synced variants) | [apps/panel/src/pages/onboarding.astro](apps/panel/src/pages/onboarding.astro) | ✅ — przemianować |
| Admin onboarding picker | [apps/admin/src/pages/onboarding/new.astro](apps/admin/src/pages/onboarding/new.astro) | ✅ — przemianować |

---

## Konkretna kolejność prac (Faza X)

### Faza X.1 — Refactor 4 stylów (3-4 dni) ⭐ ZACZYNAMY TU
1. `themes/registry.ts` — przemianować presety (4 nowe + nowe warianty kolorystyczne + nowe pary fontów per styl)
2. Każdy styl dostaje **5 nowych komponentów** (folder `themes/{style}/components/`):
   - Hero (mamy 4 — przerobić under nowe nazwy)
   - Header
   - ServicesList
   - ReviewsSection
   - Footer
   (Hours / ContactForm / OpeningHours na razie shared — refactor w X.3)
3. Globalne page templates (`pages/index.astro`, `oferta.astro`, `o-firmie.astro`, `kontakt.astro`, `faq.astro`, `aktualnosci/...`) renderują per-style komponenty przez dispatchery
4. Schema → przemianowanie presetów + walidacja HEX zostaje
5. Update panel + admin onboarding selecty (5 dropdowny: styl, wariant, layout hero, akcent, brand color)
6. Update API `/api/settings/save kind="theme"` VARIANTS map
7. **Rebuild 4 demo workerów** z nowymi configami:
   - `demo-minimalist.mixturemarketing.pl` (np. kancelaria adwokacka — Minimalist mono-blue)
   - `demo-elegant.mixturemarketing.pl` (salon SPA — Elegant rose-cream)
   - `demo-dynamic.mixturemarketing.pl` (ślusarz 24/7 — Dynamic red-yellow)
   - `demo-editorial.mixturemarketing.pl` (restauracja butikowa — Editorial forest-amber)
8. Usunięcie starych demo workerów + DNS routes (`demo-craftsman/beauty/food/professional`)

### Faza X.2 — Edycja oferty/usług w panelu (1 dzień)
1. `/ustawienia → Usługi` — repeater (dodaj/edytuj/usuń/zmień kolejność) max 8 usług
2. `POST /api/settings/save kind="services"` z walidacją Zod (slug regex, max length, priceFrom format)
3. Sync do GH repo klienta przez deploy-trigger
4. Service items same UI logic co w panel/onboarding wizard — można wyciągnąć do shared component

### Faza X.3 — System sekcji opcjonalnych (2-3 dni)
1. **Schema:** rozszerzyć theme z `sections: Array<{ kind: string, enabled: boolean, position: number, config?: object }>`
2. **Defaults per styl:** każdy styl ma listę "naturalnych dla niego" sekcji (Editorial → Historia, Dynamic → FOMO, Elegant → Galeria) — pre-checkboxed
3. **UI:** `/ustawienia → Sekcje strony` — lista wszystkich dostępnych sekcji (filtrowana przez pakiet klienta + jego addony), checkbox + drag-handle do kolejności
4. **Render w starter:** `pages/index.astro` zamiast hardcode sekcji robi pętlę po `clientConfig.theme.sections` i dispatcher per `kind`
5. **5 nowych sekcji modułowych do dorobienia:**
   - Galeria (per-style, R2 grid filter)
   - Menu / Karta dań (per-style, CMS schema)
   - Cennik tabelaryczny (shared, CMS schema)
   - Zespół (CMS schema z osobami)
   - Historia firmy (rich content via CMS)
   - Wideo embed (jeden field URL)
   (FAQ rozszerzona / Publikacje + Case studies → Faza X.5 dla Professional tier)
6. **Sync sections do `client.config.ts`** + dispatcher

### Faza X.4 — Wizard onboardingu z wyborem stylu (0.5 dnia)
1. `/onboarding` pierwszy krok (po nazwie firmy) → karty 4 stylów z preview thumbnails (zrzuty z demo workerów)
2. Wybór stylu pre-filluje default wariant + akcent + hero variant
3. Cały wizard się dostosowuje (np. Editorial domyślnie ma "Historia firmy" włączoną, Minimalist nie)

### Faza X.5 — Sekcje Professional tier (1-2 dni)
1. Publikacje + Case studies (CMS collection z anonimizacją)
2. Bezpieczny upload dokumentów (R2 + AES-GCM + 30-day retention + Cal.com link na potwierdzenie)
3. Trust badges (numer wpisu na listę adwokacką, polisa OC, izba)

### Faza X.6 — UX wyboru fontu z 2-3 par per styl (0.5 dnia)
1. Każdy styl ma 2-3 pary fontów w registry (już zaprojektowane wyżej)
2. UI: `/ustawienia → Wygląd strony` dropdown "Para fontów"
3. Walidacja w API + sync do config

---

## Otwarte pytania na jutro

### A. Nazwy stylów
"Minimalist / Elegant / Dynamic / Editorial" to robocze nazwy. Może lepsze są bardziej "polskie" lub bardziej **opisowe** dla klienta:
- Minimalist → "Czysty / Klasyczny / Profesjonalny"
- Elegant → "Elegancki / Premium / Butikowy"
- Dynamic → "Dynamiczny / Mocny / Sprzedażowy"
- Editorial → "Magazynowy / Narracyjny / Storytellingowy"

**Decyzja:** zostawiamy angielskie slugi w kodzie, ale **labels w UI klienta** używają polskich opisowych nazw. Lista do dopracowania jutro.

### B. Migracja istniejących klientów testowych
Po refactor naming `craftsman→minimalist` itp.:
- DB CHECK constraint w `clients.theme_preset` ma stare wartości — czy puścić migrację która aktualizuje istniejące rekordy?
- Czy mapować 1:1 (craftsman→minimalist) czy zostawić klienta przypisanego do starej wartości jako "legacy"?

**Propozycja:** migracja 0020_theme_styles.sql która:
1. Loosens CHECK do nowych 4 wartości + zostawia stare jako legacy
2. UPDATE clients SET theme_preset = ... gdzie stara nazwa
3. Re-sync config.ts do repos klientów

### C. Auto-rebuild przy zmianie stylu (pytanie #3 z analizy)
Klient zmienia styl w `/ustawienia` → save → hub commituje `client.config.ts` → workflow_dispatch → ~2 min rebuild.

**Zautomatyzowane?** TAK, wszystko już mamy:
- `POST /api/settings/save kind="theme"` zapisuje do D1 ✓
- Woła `POST /api/admin/addons/deploy-trigger` ✓
- Hub czyta D1 → wraps as TS → commits do GH ✓
- GH Actions workflow_dispatch ✓
- `wrangler deploy` w workflow ✓

**Jedyne ryzyko:** klient klika 10× pod rząd → 10 commitów → 10 rebuildów. **Mitigation:** debounce w `/api/settings/save` (np. ostatnia zmiana w ciągu 30s nie triggeruje rebuild — sumowanie zmian).

### D. Per-styl sample data fixtures
Po refactor potrzebne nowe 4 demo fixtures z odpowiednią "branżą" demo-klienta dla każdego stylu. Sugestia:
- Minimalist → Kancelaria adwokacka (B2B usługi)
- Elegant → Salon SPA / butik fryzjerski
- Dynamic → Ślusarz 24/7 / mechanik
- Editorial → Restauracja z historią / hotel butikowy

Można zrecyklingować obecne demo-fixtures, tylko przemianować `theme.preset`.

---

## Co możemy zrobić **bez kodu** zanim wrócimy do tematu

1. **Wybrać polskie nazwy** stylów dla UI klienta (B z otwartych pytań)
2. **Zrobić moodboard** dla każdego z 4 stylów — 3-4 referencyjne strony WWW jako wzorce wizualne (Linear / Stripe / Apple dla Minimalist; Aesop / Apaiser dla Elegant; Liquid Death / Notion landing dla Dynamic; NYT / Eater dla Editorial)
3. **Decyzja o palecie kolorów** per styl — 3 default variants per styl, kolory pasujące do charakteru (np. Minimalist=neutralne, Elegant=pastele, Dynamic=mocne, Editorial=ziemiste)
4. **Decyzja o parach fontów** per styl — 2-3 opcje per styl z Google Fonts

---

## Pliki / linki referencyjne (do otwarcia jutro)

- [TODO-landing-trust-signals.md](TODO-landing-trust-signals.md) — companion dla agenta od landinga
- [TODO-landing-pricing-update-track25.md](TODO-landing-pricing-update-track25.md) — cennik landing
- [apps/starter/demo-fixtures/README.md](apps/starter/demo-fixtures/README.md) — jak deployować demo workery
- [RUNBOOK-tracks-status.md](RUNBOOK-tracks-status.md) — całościowy status projektu
- [apps/starter/src/themes/registry.ts](apps/starter/src/themes/registry.ts) — current registry do refactor
- [apps/control-plane/migrations/0011_addons.sql](apps/control-plane/migrations/0011_addons.sql) — pełna lista 21 addon-modules

---

## Ostatnie demo workery (zachować do reference podczas refactor)

| URL | Theme (obecny, do przemianowania) | Klient (fikcyjny) |
|-----|-----------------------------------|--------------------|
| https://demo-craftsman.mixturemarketing.pl | craftsman / red-bold | Ślusarz Kowalski Rzeszów |
| https://demo-beauty.mixturemarketing.pl | beauty / rose-soft | Salon Lila Warszawa |
| https://demo-food.mixturemarketing.pl | food / terracotta-warm | Trattoria Bocca Kraków |
| https://demo-professional.mixturemarketing.pl | professional / navy-gold | Kancelaria Wiśniewski Wrocław |

Po refactor: tych 4 workerów do **usunięcia** + zastąpienia 4 nowymi (`demo-minimalist/elegant/dynamic/editorial.mixturemarketing.pl`).

---

**Wersja:** v1.0 — 2026-05-20
**Następny krok:** otwórz ten plik jutro i zacznij od Fazy X.1 (refactor stylów) — przed kodem przemyśl polskie nazwy stylów (otwarte pytanie A).
