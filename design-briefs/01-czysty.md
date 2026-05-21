# Styl: Czysty (Minimalist)

> **Slug w kodzie:** `minimalist`
> **PL Label (UI klienta):** **Czysty**
> **Tagline klienta:** "Dla tych, którzy chcą wyglądać poważnie i profesjonalnie"
> **Master design system:** [00-master-design-system.md](00-master-design-system.md)

---

## Filozofia projektowa

**Każdy piksel zarabia.** Brak dekoracji która nie służy konwersji. Whitespace jako element (nie pustka). Typografia jako główny visual. Jeden akcent koloru. Stylistyka "Notion-meets-Linear" — czysta, ale ciepła (expressive minimalism 2026, nie sterylna z 2018).

**Co tu działa:** klient widzi że firma "wie co robi", że nie chowa nic za ozdobami, że dostaje konkretne info. Konwersja przez CLARITY, nie przez sprzedażową agresję.

**Co tu nie działa:** branże gdzie sprzedaje "atmosfera" (SPA, restauracja butikowa) lub gdzie urgency = kluczowe (ślusarz 24/7, awaryjne usługi).

---

## Dla kogo (naturalnie pasuje)

- Prawnik / adwokat / radca prawny / notariusz
- Lekarz / dentysta / fizjoterapeuta (pakiet Professional)
- Księgowy / doradca podatkowy
- Architekt / projektant wnętrz B2B
- Konsultant / coach biznesowy
- Agencja IT / software house mały
- Firma B2B SaaS / startup tech
- Tłumacz przysięgły
- Audytor / inspektor

Profesjonale gdzie cena usługi to 200-2000 zł/h. Klient szuka **kompetencji**, nie ozdób.

---

## Inspiracje (referencyjne strony)

Otwórz w przeglądarce, oceń układ + typografię + spacing + użycie koloru:

| Strona | URL | Co warto stamtąd wziąć |
|--------|-----|------------------------|
| Linear | https://linear.app | Hero z dużym sloganem, single accent gradient, struktura cards |
| Stripe | https://stripe.com | Whitespace, typografia jako hierarchia, ikony cienkie |
| Notion | https://notion.so | Ilustracje minimalist (czarno-białe + 1 kolor), CTA spokojne |
| Framer | https://framer.com | Bold typo na białym, hero animowany subtle |
| Vercel | https://vercel.com | Mono-style typografia, dark mode jako system |
| Mercury | https://mercury.com | Premium B2B feel, finansowy ale czytelny |
| Posthog | https://posthog.com | Casual minimalism, hand-drawn akcenty, ale czytelny |
| Geist (Vercel design system) | https://vercel.com/geist | Naszym domyślnym fontem ma być Geist Sans + Mono |

**Moodboard kierunek:** Linear meets Mercury meets Notion. Czysto, biało, jeden mocny accent, typografia robi robotę.

---

## Conversion workflow — jak prowadzi do CTA

**Klient prawnika trafia na stronę:**

```
[Ekran 1 — hero centered]
└── h1: "Mecenas Wiśniewski — Wrocław"  (text-5xl Geist Sans 600)
└── p:   "Prawo gospodarcze i cywilne. Reprezentacja przed sądami od 2012."
└── CTA: [Umów konsultację]  ← outline button, brand accent
└── ↘  poniżej, subtle:  "Pierwsza konsultacja bezpłatna · Odpowiedź w 24h"

[Ekran 2 — trust row, 3 columns, no decoration]
├── 600+ spraw rozwiązanych
├── 14 lat praktyki
└── Tajemnica zawodowa

[Ekran 3 — usługi (bento grid 2×2, equal size)]
├── Prawo gospodarcze   "Obsługa firm, kontrakty, spory B2B"   od 250 zł/h →
├── Prawo cywilne       "Odszkodowania, spadki, nieruchomości" od 200 zł/h →
├── Prawo pracy         "Wszystko po stronie pracownika i pracodawcy"   →
└── Prawo rodzinne      "Rozwody, alimenty, władza"                     →

[Ekran 4 — 1 opinia full-width pull quote]
"Adwokat Wiśniewski wygrał kluczowy spór z kontrahentem."
— Spółka X, 2026-04

[Ekran 5 — kontakt + lokalizacja, side-by-side]
├── form (3 pola: imię, email/telefon, krótka sprawa)
└── adres + telefon + godziny + mapa

[Footer — NIP/KRS/REGON, polityka, regulamin]
```

**6 etapów conversion workflow z master doc:**
1. POZNANIE — Hero w 1.5s LCP ✓
2. ZAUFANIE — trust row pod hero ✓ (lata, sukcesy, tajemnica)
3. PRZYDATNOŚĆ — bento grid usług z cenami ✓
4. DOWÓD — 1 mocny pull quote (jakość > ilość w Czystym) ✓
5. PRZESZKODY — godziny + telefon + odpowiedź w 24h info ✓
6. AKCJA — form na końcu + sticky CTA "Zadzwoń" mobile ✓

---

## Palety kolorów (3 warianty)

Wszystkie warianty: **białe tło + niemal-czarny tekst + jeden brand accent**. Dark mode dodatkowo dostępny.

### Wariant 1: `mono-blue` (default) — Biel + Granat
```
brand:        #0a4cff       ← electric royal blue
brandFg:      #ffffff
accent:       #ff5c1f       ← orange call-out (rzadko używany)
surface:      #ffffff
surfaceMuted: #f7f8fa       ← faintest cool grey
text:         #0a0a0a       ← near black, lepszy kontrast niż czarny
textMuted:    #4a4a4a
border:       #e6e8ec
```
Best for: prawnik, IT, doradca finansowy

### Wariant 2: `mono-black` — Czysta czerń
```
brand:        #0a0a0a       ← czysta jako accent na białym
brandFg:      #ffffff
accent:       #fbbf24       ← solar yellow rzadko (np. promo badge)
surface:      #ffffff
surfaceMuted: #fafafa
text:         #0a0a0a
textMuted:    #525252
border:       #e5e5e5
```
Best for: architekt, designer, fotograf, marka osobista

### Wariant 3: `mono-emerald` — Biel + Zieleń mech
```
brand:        #0d5d3b       ← deep emerald
brandFg:      #ffffff
accent:       #b8945f       ← stonowane złoto
surface:      #ffffff
surfaceMuted: #f4f7f5
text:         #0d1b15
textMuted:    #475e52
border:       #dde6e0
```
Best for: doradca podatkowy, księgowy, konsultant ekologiczny

### Dark mode (opcja, włączana per-klient)
Inwersja: tło `#0a0a0a`, tekst `#fafafa`, brand jaśniejszy o 15%, surface-muted `#171717`, border `#262626`.

---

## Typografia (2 pary fontów do wyboru klienta)

### Para A: Geist (default)
- **Display + body:** [Geist Sans](https://fonts.google.com/specimen/Geist) (weights 400, 500, 600, 700)
- **Mono accent:** Geist Mono dla numerów telefonów / NIP / kodu
- Loader: 2 weights initial (500 + 600), reszta lazy

### Para B: Inter + Cormorant Garamond
- **Display:** [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) 500-600 weights — daje lekki "klasyczny B2B" feel
- **Body:** [Inter](https://fonts.google.com/specimen/Inter) 400-500
- Best for: kancelaria, notariusz, traditional B2B

### Para C: Manrope + JetBrains Mono
- **Display + body:** [Manrope](https://fonts.google.com/specimen/Manrope) 500-700
- **Mono:** [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- Best for: IT, software house, dev tools

---

## Ikony — biblioteka i styl

**[Lucide](https://lucide.dev)** stroke-based ikon. Konfiguracja:
- Stroke-width: **1.5px** (cienkie, eleganckie, nie krzykliwe)
- Size default: **20px** (inline z tekstem), **24px** (standalone)
- Color: zawsze `currentColor` (dziedziczy z tekstu)
- Outline only, no fill (jednolity styl)

Konkretne ikony dla tego stylu:
- Hero CTA: `arrow-right` (nie phone — Czysty nie krzyczy)
- Trust badges: `shield-check`, `clock`, `briefcase`
- Services list: `arrow-up-right` jako "więcej info" link
- Footer: `mail`, `phone`, `map-pin`, `external-link`
- Form: `check-circle-2` after submit
- **Bez emoji w kodzie.** Każda decoracja = lucide SVG.

---

## Komponenty per-style (do zaprojektowania)

Każdy komponent ma własną strukturę dla Czystego — nie tylko inne kolory.

### 1. Hero (centered variant default)
```
+----------------------------------------+
|                                        |
|         h1 50-72px Geist 600           |  ← duże, centered, max 20ch szerokości
|                                        |
|       p 18-20px text-muted             |  ← max 60ch, lead paragraph
|                                        |
|          [Outline CTA primary]         |  ← single CTA, brand color outline
|     small "lub zadzwoń: +48 ..."       |  ← text-sm, no button
|                                        |
+----------------------------------------+
```

Dlaczego centered? Bo Czysty = jasna hierarchia. Brak split = brak konkurencji o uwagę.

### 2. Header
- Sticky, biały, border-bottom 1px subtle
- Logo lewa (max 32px h), nav prawa (max 5 linków + 1 CTA outline button)
- Mobile: hamburger → drawer right-side
- Brak animacji scroll-shrink (clarity > effect)

### 3. ServicesList (bento grid 2×2 lub 2×3)
- 4-6 usług w grid `grid-cols-2 gap-6` mobile, `lg:grid-cols-3` desktop
- Karta = nazwa (h3 text-xl 600) + opis (text-base muted) + cena (text-sm mono) + arrow link
- Hover: subtle border accent + 2px translate-y
- Background: surfaceMuted (faintest tint, nie biały — depth)

### 4. ReviewsSection (1-2 pull quotes, NOT grid)
- Czysty NIE ma grid 3×3 testimoniali. Jeden mocny cytat = większy impact.
- Pull quote w cudzysłowach (italic, text-3xl Display font), pod podpis (text-sm 500), data (text-xs muted)
- Max 2 cytaty obok siebie na desktop, 1 na mobile
- Decoration: subtle vertical line lewa (brand 2px), nie cudzysłów emoji

### 5. OpeningHours
- Tabela 7 wierszy (Pon-Niedz) + 1 row "Note" jeśli jest
- Layout 2-column: dzień (left) | godziny (right, mono font)
- Bieżący dzień: pogrubiony + brand color
- Dziś "OTWARTE / ZAMKNIĘTE" badge subtle (live calc Astro server-side)

### 6. ContactForm
- 3 pola: imię, telefon LUB email, krótka sprawa (textarea max 3 wiersze)
- Labels visible (nie placeholder), required asterisk subtle
- Button outline brand, full-width mobile, auto width desktop
- Success state: full replace with check-circle-2 + thank you text (no modal)

### 7. Footer
- 3 kolumny desktop: Firma (NIP/KRS/REGON/adres) | Kontakt (tel/email/godziny) | Linki (polityka/regulamin/RODO)
- Mobile: stack vertical
- Tekst text-sm muted, granica góra 1px
- Brak social media ikon jeśli klient ich nie ma (puste sekcje = brzydkie)

---

## Sekcje opcjonalne (mapa do toggle w panelu)

Sekcje które klient może włączyć, naturalne dla Czystego (pre-checkbox enabled):
- Zespół (jeśli 3+ osoby — wizytówki minimalne)
- Cennik tabelaryczny (dla branż z transparent pricing)
- FAQ rozszerzona (zwłaszcza dla prawnik/lekarz/księgowy)
- Mapa Google

Sekcje które klient może włączyć ale Czysty ich nie sugeruje (uncheckbox default):
- Galeria (Czysty rzadko ma sens dla zdjęć — usługa nie produkt)
- Menu (nie dla branż usługowych)
- Wideo embed (zwykle za "głośne" dla Czystego)
- Instagram feed (dla B2B usług = noise)
- FOMO counter / Leadpop modal — **świadomie nie sugeruje** (psucie wizerunku premium B2B)
- Newsletter — opcja, ale subtle (footer link, nie modal)
- Chatbot — opcja jeśli klient ma capacity odpowiadać

---

## Co odróżnia Czysty od pozostałych 3 stylów

| Atrybut | Czysty |
|---------|--------|
| Hero layout default | **centered** |
| Image w hero? | **Nie** (czysta typografia) |
| Liczba CTA w hero | **1** (outline) |
| Animacje | **micro tylko** (focus, hover-lift 2px) |
| Reviews | **1-2 pull quotes** (nie grid) |
| Trust signals | **subtle row** (nie badges duże) |
| Bento grid? | **TAK** dla services |
| Dark mode | **opcjonalny, doskonale wykonany** |
| Kolory | **biel + 1 brand + 1 rzadki accent** |
| Whitespace | **40-60% strony** |
| Sticky CTA mobile | **wycieniowany subtelnie** (nie shouting) |
| Emoji w UI | **nigdy** |

---

## Demo klient (fixture do deploy `demo-minimalist.mixturemarketing.pl`)

Sugestia: **Kancelaria Adwokacka Wiśniewski & Partnerzy — Wrocław**
- Variant: `mono-blue`
- Para fontów: A (Geist Sans + Geist Mono)
- Sekcje opcjonalne włączone: Zespół (3 prawników), FAQ (5 pytań), Cennik
- Logo: monogram "W&P" w kółku (custom SVG do wygenerowania)

Można skopiować z istniejącego `demo-fixtures/professional.config.ts`, zaktualizować preset + variant.

---

## Otwarte pytania do Ciebie (jutro)

1. **Polska nazwa "Czysty"** — pasuje? Alternatywy: "Klasyczny", "Profesjonalny", "Minimalistyczny", "Spokojny". Decyzja wpływa na label w panelu klienta.
2. **Default font** — Geist (nowoczesny tech vibe) vs Inter (uniwersalny) vs Cormorant+Inter (lekko classical) — który ma być default na początku?
3. **Dark mode w v1?** — Czy uruchamiamy dark mode od razu czy w Fazie 2? (Implementacja: dodatkowa para tokens w registry + toggle w `/ustawienia`).
4. **Sekcja "Zespół"** — robimy do tego CMS collection schema (jak blog) czy edytor w panelu klienta z fotografią upload?

---

**Następny brief:** [02-elegancki.md](02-elegancki.md)
