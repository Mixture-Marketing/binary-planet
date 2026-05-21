# Styl: Elegancki (Elegant)

> **Slug w kodzie:** `elegant`
> **PL Label (UI klienta):** **Elegancki**
> **Tagline klienta:** "Dla tych, którzy sprzedają atmosferę i premium feel"
> **Master design system:** [00-master-design-system.md](00-master-design-system.md)

---

## Filozofia projektowa

**Premium przez powściągliwość.** Serif typografia w nagłówkach, ciepłe pastele, miękkie cienie, dużo dużych zdjęć produktu/wnętrza, mało tekstu na ekran. Dziedzic Squarespace i Aesop — strony które same w sobie pachną drogą perfumą.

**Co tu działa:** klient czuje że firma "myśli o detalach". Premium feel rozbraja obawę o cenę — jeśli strona wygląda jak Aesop, klient przyjmuje że "to nie tanie chińskie". Konwersja przez ESTETYKĘ + emotion.

**Co tu nie działa:** branże gdzie kluczowy jest czas reakcji (ślusarz 24/7) lub gdzie produkt = sucha specyfikacja (księgowy, IT).

---

## Dla kogo (naturalnie pasuje)

- Salon kosmetyczny / SPA / wellness
- Fryzjer / barber butikowy
- Studio paznokci premium
- Kosmetolog / dermatolog estetyczny
- Fotograf ślubny / portretowy
- Planner ślubny / event manager
- Butik (odzież, biżuteria)
- Florysta artystyczny
- Restauracja fine dining
- Hotel butikowy / villa
- Marka osobista (lifestyle blogger, ekspert)
- Architekt wnętrz B2C
- Cukiernia rzemieślnicza

Klient gdzie produkt = doświadczenie. Cena zwykle 100-500 zł za pojedynczą usługę.

---

## Inspiracje (referencyjne strony)

| Strona | URL | Co warto stamtąd wziąć |
|--------|-----|------------------------|
| Aesop | https://aesop.com | Mistrz Elegant. Serif Garamond, ciepłe pastele, dużo whitespace, zdjęcia w stylu still-life |
| Apaiser (Australian bath) | https://apaiser.com | Hero z dużym zdjęciem produktu, serif headline na overlay |
| Glossier | https://glossier.com | Friendly elegant — pastel pink + serif + person-focused photos |
| Goop | https://goop.com | Editorial spike w eleganckim |
| Le Labo | https://lelabofragrances.com | Apothecary feel — czarne na białym + serif + mono numerals |
| Loro Piana | https://loropiana.com | Lux serif + slow scroll + minimalna nawigacja |
| Ouai Haircare | https://theouai.com | Modern Elegant z młodszą energią |
| Maison Margiela | https://maisonmargiela.com | Bardziej awangardowo — minimum typografii, full image-bg |
| Suite Caroline | https://suitecaroline.com | Mała marka salonowa z blush + elegant script |

**Moodboard kierunek:** Aesop meets Glossier meets Loro Piana. Powściągliwe, drogie, ciepłe, ale nie sztywne. **Photo-driven** > typo-driven.

---

## Conversion workflow — jak prowadzi do CTA

**Klientka trafia na stronę Salon Lila (fryzjer):**

```
[Ekran 1 — hero full-bleed image with overlay text]
└── Image: salon interior soft golden hour
└── Overlay top-left: small badge "Warszawa Mokotów · Premium service"
└── Overlay center: "Salon Lila" (h1 Playfair 64px white, serif)
└── Overlay sub: "Twoje miejsce na chwilę dla siebie"
└── [Pill CTA bottom: "Umów wizytę → Booksy"]
        + small "lub +48 22 123 45 67"

[Ekran 2 — short essay-style intro, max-width 60ch, centered]
"Salon Lila to butikowy gabinet na Mokotowie..." (3 zdania)
[Decoration: 60px vertical brand line above text]

[Ekran 3 — gallery 3×2 grid, full-bleed images, soft hover scale]
└── 6 fotografii: przed-po koloryzacji / interier / produkty
└── No labels, no buttons — image talks

[Ekran 4 — usługi list (NOT grid, narrow column 2 rows visible)]
└── Lista 5 usług, każda: nazwa serif + cena + krótki opis
└── Hover: subtle underline animation
└── Decoration: ornament divider między usługami (custom SVG)

[Ekran 5 — opinie carousel (3 cytaty, auto-scroll slow)]
└── Pull quote + autor + małe gwiazdki

[Ekran 6 — godziny + adres + mapa, side-by-side, soft]
└── Godziny w serif + mapa w sepia overlay

[Ekran 7 — Instagram embed (jeśli włączone) lub Newsletter zapis]
└── Subtle, footer-adjacent

[Footer — NIP / KRS / regulamin, ale w subtle small serif]
```

**6 etapów conversion z master doc:**
1. POZNANIE — hero image-bg natychmiast ✓
2. ZAUFANIE — premium feel through visual quality (nie badges) + opinie ✓
3. PRZYDATNOŚĆ — usługi z cenami w eleganckim list view ✓
4. DOWÓD — galeria przed-po + opinie carousel ✓
5. PRZESZKODY — godziny + adres + Booksy w 1 click ✓
6. AKCJA — Booksy embed lub sticky bottom "Umów wizytę" mobile ✓

**Specyfika Elegant:** etap 3 (PRZYDATNOŚĆ) jest delikatny — nie agresywne "Wybierz pakiet", a "Te usługi oferujemy". Konwersja przez **want**, nie need.

---

## Palety kolorów (3 warianty)

Każda paleta: **kremowe białe + pastele ciepłe + brand kolor stonowany + akcent gold/copper**.

### Wariant 1: `rose-cream` (default) — Pudrowy róż + krem
```
brand:        #c4546d       ← dusty rose, nie agresywny
brandFg:      #ffffff
accent:       #b08d57       ← antique gold
surface:      #fdfaf6       ← warm cream (nie biały!)
surfaceMuted: #f5ebe4       ← peach pastel
text:         #2a1d1f       ← deep wine-brown
textMuted:    #6b525a
border:       #e8d8d4
```
Best for: SPA, beauty, ślub, florysta

### Wariant 2: `sage-ivory` — Szałwia + kość słoniowa
```
brand:        #5d7560       ← dusty sage green
brandFg:      #ffffff
accent:       #c9a96e       ← honey gold
surface:      #fbf9f4       ← ivory
surfaceMuted: #efeae0       ← warm beige
text:         #1f2820
textMuted:    #5a6358
border:       #ddd5c4
```
Best for: wellness, eko, masaż, herbaciarnia, restauracja organic

### Wariant 3: `mocha-blush` — Mocha + blush + bronze
```
brand:        #6b4423       ← warm mocha
brandFg:      #fdf6ee
accent:       #d4a574       ← bronze
surface:      #fcf6ef       ← very pale cream
surfaceMuted: #e8d9c8       ← latte
text:         #2a1810
textMuted:    #6e4d35
border:       #d9c5b0
```
Best for: kawiarnia premium, cukiernia, fotograf, marka osobista, butik

### Dark mode (opcja, klient włącza)
**Tutaj dark mode wymaga uważnej palety** — ciemny Elegant musi pozostać "premium dark", nie tech-dark.
Tło `#1a1410` (dark brown), tekst `#f5ebe4`, brand jaśniejszy, accent gold pop.

---

## Typografia (3 pary fontów do wyboru)

### Para A: Playfair Display + Lora (default)
- **Display:** [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) 500-700 — klasyczne serif z wysokim contrast
- **Body:** [Lora](https://fonts.google.com/specimen/Lora) 400-500 — czytelne serif do paragrafów
- Best universal — pasuje 80% przypadków

### Para B: Cormorant Garamond + Source Sans
- **Display:** [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) 500-600 — eleganckie, cienkie, refined
- **Body:** [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3) 400 — sans-serif body dla mniej "wybranego" feel
- Best for: kosmetyczka, fotograf, hotel butikowy

### Para C: Fraunces + Inter
- **Display:** [Fraunces](https://fonts.google.com/specimen/Fraunces) 400-700 (variable) — modern serif z opt-size, retro vibe
- **Body:** [Inter](https://fonts.google.com/specimen/Inter) 400-500
- Best for: marka osobista, lifestyle, premium ale "młodsza"

---

## Ikony — biblioteka i styl

**[Phosphor Icons](https://phosphoricons.com)** weight "regular" (1.5px stroke) lub "light" (1px).
- Phosphor ma więcej weights niż Lucide — Elegant wymaga "regular" lub "light"
- Size default: 18px (rzadko widoczne — Elegant minimalizuje ikony, używa typografii)
- Color: zawsze `currentColor`, nigdy brand color (subtelność)

Konkretne ikony dla Elegant:
- Hero CTA: `calendar-blank` (regular) — wizyta
- Trust badges: brak prominentnych badges — Elegant ufa visual quality
- Services: `arrow-up-right` regular jako "więcej info"
- Footer: `envelope-simple`, `phone`, `map-pin`
- **Bez Phosphor "fill" w Elegant** — tylko outline weights
- **Ornament dividers** zamiast ikon (custom SVG: cienka linia + ornament rombowy w środku)

---

## Komponenty per-style

### 1. Hero (image-bg default)
```
+----------------------------------------+
| [Image full-bleed, ratio 16:9 desktop] |
| [Soft overlay 30-50% dark gradient]    |
|                                        |
|  small badge "Miasto · Tagline"        |  ← top-left, max 24ch
|                                        |
|       h1 Playfair 80px white           |  ← center, max 14ch (nazwa firmy)
|        p sub 22px italic white          |  ← center, max 30ch
|                                        |
|       [Pill CTA "Umów wizytę"]         |  ← brand bg, white text
|     small "lub +48 ..."                 |
+----------------------------------------+
```

Image: klient uploaduje przez panel (R2). Default placeholder: high-res Unsplash relevant do branży (auto-blur-up).

### 2. Header
- Transparent at top, blur+bg na scroll (Elegant lubi reveal)
- Logo lewa (max 40px h, large dla salonu — logo to identity)
- Nav prawa (max 4-5 linków, serif font, no buttons in nav — Elegant nie krzyczy)
- Mobile: hamburger → full-screen overlay drawer
- Smooth scroll-shrink (header 80px → 64px on scroll)

### 3. ServicesList (narrow list, NOT grid)
- Usługi as long list 1-column (nie grid kart)
- Każda: nazwa Playfair text-2xl + cena right-align (mono) + opis text-base muted w 2-column row
- Hover: subtle underline animation na nazwie + arrow appears right
- Ornament divider between (custom SVG hairline + diamond center)

### 4. ReviewsSection (carousel, auto-scroll)
- 3-5 opinii w carousel, auto-scroll co 6s
- Każda: cytat italic Playfair 2xl + autor (text-sm small caps tracking-wide) + 5 gwiazdek (filled SVG)
- Background: surfaceMuted (peach blush)
- Decoration: large quotation mark SVG (subtle, brand color, top-left)

### 5. Gallery (3×2 grid, full-bleed)
- 6 zdjęć grid `grid-cols-2 md:grid-cols-3 gap-1` (CIASNE gap dla mosaic feel)
- Aspect ratio 4:3 lub 1:1 (klient wybiera w panelu)
- Hover: scale 1.05 + slow 600ms ease
- Lightbox on click (modal full-screen)
- CMS: klient uploaduje przez Sveltia, max 12 images per gallery

### 6. OpeningHours
- Tabela 7 wierszy, każdy: dzień Playfair italic + godziny mono right
- Dzisiejszy dzień: bold + brand color
- Container: surfaceMuted bg, generous padding, rounded-2xl
- Hours note jako small caps italic na dole

### 7. ContactForm
- Sekcja split: 60% form + 40% adres/mapa
- Form fields: floating labels (animacja na focus — TYLKO tutaj animacja "expensive"), serif labels
- Button: pill, brand bg, white text, "Umów wizytę →" z arrow
- Success: full-form replace z thank you message + pretty icon (Phosphor `check-fat`)

### 8. Footer
- 4 kolumny: Firma | Kontakt | Godziny | Social (jeśli klient ma)
- Tekst serif italic small, text-muted
- Górna granica: ornament divider (jak w services list)
- Bottom row: copyright + NIP/KRS small

---

## Sekcje opcjonalne (mapa do toggle)

**Pre-checkbox ENABLED dla Elegant:**
- Galeria zdjęć (KLUCZOWA — Elegant żyje obrazem)
- Booksy embed lub Cal.com (booking critical)
- Instagram feed (visual branża = IG-driven)
- Sekcja "Historia / O nas" (storytelling buduje atmosferę)
- Sekcja "Zespół" (osoby budują trust w beauty/spa)

**Pre-checkbox DISABLED ale dostępne:**
- Menu / Karta usług (cennik tabelaryczny) — alternatywa dla narrow list
- FAQ (zwykle nie potrzebne, ale dla SPA z medycznymi zabiegami tak)
- Wideo embed (3D salon tour np.)
- Newsletter — TAK ale subtle (no FOMO modal)

**Anti-recommend (Elegant nie powinien):**
- FOMO counter ("3 osoby ogląda teraz!") — psuje atmosferę
- Leadpop exit-intent modal — agresja
- Chatbot bot AI — automatyzacja kontra premium feel; lepiej WhatsApp direct
- Delivery Wolt/Glovo — wykluczające się z butikowym charakterem (chyba że klient = cukiernia rzemieślnicza)

---

## Co odróżnia Elegancki od pozostałych 3

| Atrybut | Elegancki |
|---------|-----------|
| Hero layout default | **image-bg** (zdjęcie full-bleed) |
| Image w hero? | **TAK, ZAWSZE** |
| Liczba CTA w hero | **1** (pill, brand bg) |
| Animacje | **short + medium**, ease-in-out-quart, scale 1.02-1.05 |
| Reviews | **carousel auto-scroll** |
| Trust signals | **NIEoprymowane** — visual quality robi za trust |
| Bento grid? | **Nie** — narrow lists + galleries |
| Dark mode | **opcja, ale rzadko używana** (Elegant = light by default) |
| Kolory | **kremowe + pastele + gold accent** |
| Whitespace | **30-50%** (więcej content niż Czysty) |
| Sticky CTA mobile | **pill brand bg, prominent** |
| Emoji w UI | **NIGDY** — ornament SVG dividers zastępują |
| Photo-driven? | **TAK** — bez zdjęć Elegant się rozpada |

---

## Demo klient (fixture `demo-elegancki.mixturemarketing.pl`)

Sugestia: **Salon Lila — Warszawa Mokotów (fryzjer + paznokcie premium)**
- Variant: `rose-cream`
- Para fontów: A (Playfair + Lora)
- Sekcje opcjonalne: Galeria (6 zdjęć), Booksy embed, Instagram, Historia (2 paragrafy), Zespół (3 stylistki)
- Logo: cienki monogram "L" w okręgu w gold accent

Skopiować z istniejącego `demo-fixtures/beauty.config.ts`, zaktualizować preset + variant.

---

## Otwarte pytania do Ciebie (jutro)

1. **Polska nazwa "Elegancki"** — alternatywy: "Premium", "Butikowy", "Wyrafinowany", "Klasyczny". Decyzja wpływa na UI klienta.
2. **Default font** — Playfair (universal) vs Cormorant (refined) vs Fraunces (modern retro) — który ma być default?
3. **Photo dependency** — Elegant nie działa bez dobrych zdjęć. Czy w wizardzie wymagamy 3+ zdjęć minimum, czy dajemy stockowe placeholdery (Unsplash relevant do branży) z ostrzeżeniem?
4. **Booksy/Calendly** — TAK Elegant ma to jako "core" sekcję (nie opcjonalną) — klient bez systemu booking dostaje warning?
5. **Ornamenty SVG** — robimy custom set (5-10 wzorów dziedziczących z brand color) czy używamy gotowych z Phosphor "thin" iconów jako dividery?

---

**Następny brief:** [03-dynamiczny.md](03-dynamiczny.md)
