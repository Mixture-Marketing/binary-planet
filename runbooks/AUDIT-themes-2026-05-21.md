# 4-Theme Audit Report — 2026-05-21

5 subagent audits przeprowadzonych na 4 motywach po pełnym redesign z mockupów. Wyniki posortowane wg priorytetu.

**Live:**
- https://demo-minimalist.mixturemarketing.pl/ (Kancelaria Wiśniewski Wrocław)
- https://demo-editorial.mixturemarketing.pl/ (Trattoria Bocca Kraków)
- https://demo-elegant.mixturemarketing.pl/ (Salon Lila Warszawa)
- https://demo-dynamic.mixturemarketing.pl/ (Ślusarz Kowalski Rzeszów)

---

## Scoring overview

| Motyw | UX critique /10 | SXO persona /100 | A11y crits | Schema crits | Perf risk |
|---|---|---|---|---|---|
| **Dynamic** | 7 | **90** (best persona fit) | 1 (gradient contrast) | 3 (image[], priceRange, 24/7 mismatch) | Low (box-shadow paint) |
| **Editorial** | **7.5** (best UX) | 68 (worst — page type mismatch) | 1 (amber contrast FAIL) | 2 (hasMenu rename, encoding) | Medium (Unsplash no preconnect) |
| **Minimalist** | 6.5 | 82 | 0 (passes contrast) | 3 (founder, hasOfferCatalog, priceRange) | Low (font swap) |
| **Elegant** | 6 (most generic) | 78 | 2 (hero text scrim, CTA border) | 3 (wrong restaurant images, priceRange) | **High** (CSS bg-image 600KB) |

---

## P0 — KRYTYCZNE (Ship-blockers)

### A. Elegant — full-bleed hero perf (LCP risk)
- **Problem:** `.e-hero__img` używa CSS `background-image: url(...1800q85)` zamiast `<img fetchpriority="high">`. Background images nie są discoverable przez preload-scanner — dodaje ~400-600ms LCP delay. Plus brak preconnect do images.unsplash.com.
- **Impact:** LCP może slip do "needs improvement" na mobile 4G.
- **Fix:** zamień div na `<img loading="eager" fetchpriority="high" decoding="async">` z `object-fit:cover`. Plus `<link rel="preconnect" href="https://images.unsplash.com" crossorigin>` w BaseLayout.

### B. Elegant — hero label contrast FAIL
- **Problem:** `.e-hero__label` ma `color:#fff` na zdjęciu BEZ scrim/text-shadow. Na jasnych fragmentach photo (jasne włosy, refleksy) — kontrast spadnie poniżej 4.5:1.
- **Fix:** dodaj `linear-gradient(transparent 0%, rgba(0,0,0,0.55) 100%)` jako `.e-hero::after` overlay na bottom 40%, ALBO `text-shadow: 0 2px 8px rgba(0,0,0,0.6)` na label tekstach.
- **Plus:** CTA border `rgba(255,255,255,0.5)` = 1.9:1 (FAIL 1.4.11) — zmień na `rgba(255,255,255,0.85)` lub solid `#fff`.

### C. Editorial — amber contrast FAIL na cream
- **Problem:** `#e89556` (light amber) na `#fef8f0` (cream) = **2.6:1** (FAIL 1.4.3 dla text). Używane jako:
  - `.ed-hero__byline` text
  - `.ed-hero__caption em` text
  - Eyebrow w karta/articles/reviews
- **Fix:** zamień gdzie używane jako TEXT na ciemniejszy amber `#8a4f1e` (już zadeklarowany jako `--accent` w innym variancie — ~7.5:1 ✓). Lub użyj amber TYLKO dla underline/border/icon, nie text.

### D. Dynamic — gradient text headline FAIL
- **Problem:** `.d-tile__map-title` lub gradient text uses `background: linear-gradient(135deg, var(--color-brand), var(--color-accent))` + `background-clip:text;color:transparent`. Amber stop `#fbbf24` = 1.65:1 na białym (FAIL 1.4.3).
- **Plus:** `forced-color-adjust:none` ZNIKA w Windows High Contrast bez fallback.
- **Fix:** dodaj `@media (forced-colors: active) { color: CanvasText; -webkit-text-fill-color: CanvasText; }` — solid fallback. Plus rozważ darkening amber stop do `#d97706`.

### E. Schema image[] template bug — Elegant + Dynamic
- **Problem:** JSON-LD `image` array w obu motywach pokazuje 3 zdjęcia carbonara/restauracja zamiast hair salon / locksmith. To kopia bug ze schema/index.ts gdzie hardcoded Unsplash URLs są zawsze restaurant images.
- **Fix:** w `apps/starter/src/lib/schema.ts` — image[] musi być industry-aware lub pobierane z fixture (np. `clientConfig.business.heroImageUrl`).

### F. llms.txt 500 error na 4 demos
- **Problem:** route `/llms.txt` zwraca 500 na wszystkich 4 demos.
- **Fix:** sprawdź `apps/starter/src/pages/llms.txt.ts` — prawdopodobnie missing import lub błąd w runtime workerd. Może 1970-Date gotcha.

---

## P1 — WYSOKIE (priority week)

### G. UX critique — Elegant most generic (6/10)
- **Problem:** Elegant promised Aman/Aesop ale render to "Aesop sitemap z rose-gold paint". Subagent UX: "right brand vocabulary, wrong restraint level. Aman whole point is what you remove — this theme removed nothing."
- **Specific:** services grid po hero to "Bootstrap card grid w rose-gold makeup". Aman/Aesop nigdy nie listują usług jako cards — robią to jako editorial prose.
- **Fix path:** hero 100vh single sentence (commit harder do restraint). Services jako long-scrolling column z service names w Cormorant italic 32px + 14px sans description + small caps price right-aligned. Brak kart, brak ikon.

### H. UX critique — Minimalist "stats block lazy" + Inter font flat
- **Problem:** "3 reviews" jako hero stats metric = template tell. Inter "nie jest typografical choice w 2026, to brak wyboru" wg subagent.
- **Fix:** kill stats section gdzie review count <10. Zamień Inter Tight na "Söhne / Switzer / General Sans" (paid commercial OR free alternative — np. Switzer ma open license).
- **Plus:** cobalt accent powinien być EXACTLY raz above-the-fold (na primary CTA), nigdzie indziej.

### I. UX critique — Editorial hero "carbonara photo lazy"
- **Problem:** Wg subagent UX: hero z food photo to "TripAdvisor 2014, nie NYT". NYT mastheads put type-first, image second w 4-col lockup (nie stacked food shot).
- **Fix path:** restructure hero do NYT op-ed: 8-col Fraunces headline left, 4-col dek + small portrait chef right, byline metadata row. Drop cap na pierwszy paragraf menu, nie hero.

### J. Editorial → tourist persona mismatch (SXO 68/100)
- **Problem:** Editorial page magazine-style = odwrotność tego co potrzebuje turysta mobile w 2 min. SERP dla "włoska restauracja Kraków stare miasto" nagradza condensed local business pages (TripAdvisor, Google Maps cards) z menu above-fold.
- **Fix:** Mobile hero: numer telefonu + godziny otwarcia DZIŚ na pierwszym ekranie. H1 dosłownie matching query: "Włoska restauracja — Stare Miasto, Kraków".

### K. priceRange `"PLN"` bug — 3 motywy
- **Problem:** `priceRange: "PLN"` to currency code, nie price tier. Google's Local Business rich result wymaga human-readable.
- **Fix:** w `apps/starter/src/lib/schema.ts` — replace `"PLN"` z `"PLN 200–800"` dla service businesses (oblicz z `services[].priceFrom`) lub `"$$"` dla restaurants (już zrobione).

### L. Form errors `role="alert"` cross-theme
- **Problem:** A11y subagent: 0× `role="alert"` na error region. Submission errors silent dla screen readers.
- **Note:** zauważyłem że w `init.client.ts` mam handler który zmienia role na "alert" przy invalid event. **Weryfikacja konieczna** czy faktycznie się triggerze przy submit fail.
- **Fix path:** każdy ContactForm powinien mieć dedicated `<div role="alert" aria-live="assertive" id="contact-form__errors">` osobno od polite status. JS wpisuje text na pierwszy invalid.

---

## P2 — ŚREDNIE (polish iteration)

### M. BreadcrumbList missing na home + Org @id polish
- Schema audit: BreadcrumbList absent na wszystkich home pages. WebSite @id powinien używać `#website` fragment (jak Organization używa `#organization`).
- **Fix:** dodaj `BreadcrumbList` w `homeSeo()` (single item: home). WebSite @id → bare URL + `#website`.

### N. Dynamic 24/7 vs OpeningHours mismatch
- **Problem:** title + hero claim "24/7 awaryjne", schema `openingHoursSpecification` pokazuje Mon-Sat ograniczone. Google flagged.
- **Fix:** dodaj `specialOpeningHoursSpecification` z 24/7 dla emergency note ALBO drugi Offer node z `availabilityStarts/Ends`.

### O. aggregateRating 5.0 quality filter
- **Problem:** ratingValue 5.0 z 3 reviews = Google quality filter (zbyt perfekcyjny). Real-world demo credibility minus.
- **Fix:** w fixtures zmień jeden review na 4-star, albo zaakceptuj 4.7-4.9 range dla aggregate (np. zmień ratingValue calculation żeby cap'ować na 4.9).

### P. Editorial Unsplash perf
- **Problem:** brak `<link rel="preconnect" href="https://images.unsplash.com" crossorigin>`. Brak `&fm=webp` w URL hero img.
- **Fix:** dodaj preconnect w BaseLayout + append `&fm=webp` lub `&fm=avif` do wszystkich Unsplash URLs.

### Q. Dynamic font weight 900 → 800 (already done) + box-shadow animation paint
- **Problem:** `.d-tile__status-dot` używa `box-shadow` w keyframe animation — triggers paint na każdą klatkę. Composited animations powinny używać `transform/opacity/filter`.
- **Fix:** zamień `box-shadow` na `filter: drop-shadow()` w `d-pulse-soft` keyframes.

### R. Generic "testimonials + hours + contact form" footer trio  ✅ ORDER-DIFFERENTIATED 2026-05-21
- **Problem (UX subagent):** wszystkie 4 motywy hit ten sam "AI-in-5-min seam" — testimonials → hours → contact w identical order/structure.
- **Fix executed (Phase 1 — narrative order):** per-theme `homeSectionOrder` w [registry.ts](../apps/starter/src/themes/registry.ts) i [pages/index.astro](../apps/starter/src/pages/index.astro):
  - Minimalist (trust): hero → services → sections → reviews → hours → contact
  - Elegant (atmosphere): hero → services → reviews → sections → hours → contact
  - Dynamic (urgency): hero → **hours** → services → reviews → sections → contact
  - Editorial (narrative): hero → **sections** → services → reviews → hours → contact
- **Phase 2 (defer Faza 2 — structural language per section):** każdy motyw potrzebuje obsługi tych sekcji "w własnym structural language":
  - Minimalist: inline citation footnotes
  - Editorial: letters-to-editor column
  - Elegant: "Visit" jako full-bleed image card
  - Dynamic: bento tile per review

---

## P3 — POLISH (nice-to-have)

### S. Cobalt accent overuse w Minimalist
- Pojawia się więcej niż raz above-the-fold. Linear/Vercel używają jednego dominant accent strategicznie.

### T. Elegant CTA arrow target size
- Verify `→` glyph nie ma separate `<span>` co break 24×24 target.

### U. Skill-derived: `prefers-reduced-transparency` dla glass/blur
- Liquid Glass skill: `backdrop-filter: blur()` powinien być conditional na `@media (prefers-reduced-transparency: no-preference)`. Sprawdzić mobile-cta-bar i elegant phone button.

### V. Switzer/General Sans typography commitment
- Inter to commodity. Zainwestuj w jedną signature typeface per motyw która nie jest na każdej stronie SaaS.

---

## Cross-cutting recommendations

Subagent UX zwrócił uwagę:
> "Wszystkie 4 motywy hit ten sam generic seam: testimonials + hours + contact form footer trio. Każdy theme powinien obsłużyć te sekcje w **swoim structural language**, nie identically."

Subagent SXO podsumował:
> "Closest to world-class: Editorial 7.5/10. Needs most work: Elegant 6/10. Editorial needs hero restructure, Elegant needs structural cowardice removal."

Subagent A11y:
> "Universal weakness: 0× role=alert na error regions. Universal strength: honeypot impl textbook (position:absolute -9999px + aria-hidden), focus-visible 2-3px brand outlines."

Subagent Schema:
> "Cross-cutting: priceRange 'PLN' (currency code) bug w 3 motywach, image[] restaurant-template-leak w Elegant + Dynamic, BreadcrumbList absent na home pages."

Subagent Perf:
> "Elegant największe ryzyko LCP (CSS bg-image 600KB), Editorial wymaga Unsplash preconnect + fm=webp, Dynamic + Minimalist niskie ryzyko."
