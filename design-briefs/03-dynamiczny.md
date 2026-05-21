# Styl: Dynamiczny (Dynamic)

> **Slug w kodzie:** `dynamic`
> **PL Label (UI klienta):** **Dynamiczny**
> **Tagline klienta:** "Dla tych, którzy chcą żeby klient dzwonił TERAZ"
> **Master design system:** [00-master-design-system.md](00-master-design-system.md)

---

## Filozofia projektowa

**Konwersja jest królem.** Mocne kolory, kontrast, duże CTA, jasne wartości "co dostaję / w jakim czasie / za ile", urgency bez crapowania (klient z awarią ma 2 minuty, nie 2 godziny). Dziedzic Liquid Death i Notion landing — strony bardziej energetyczne niż "ładne".

**Co tu działa:** branże urgent (ślusarz, hydraulik, mechanik, kurier), e-commerce z high-volume produktami, fast-food, siłownia, kursy z deadline. Konwersja przez URGENCY + CLEAR VALUE.

**Co tu nie działa:** B2B premium (prawnik, lekarz), beauty/spa (atmosfera), restauracja fine dining.

---

## Dla kogo (naturalnie pasuje)

- Ślusarz / hydraulik / elektryk 24/7
- Mechanik / auto-serwis / pomoc drogowa
- Pogotowie komputerowe / IT na wezwanie
- Sprzątanie / pranie dywanów / mycie okien
- Kurier / przeprowadzki
- Fast-food / pizza dostawa / kebab
- Siłownia / fitness / personal trainer
- Szkoła jazdy / kurs prawo jazdy
- Kursy online / edukacja
- E-commerce mała (do 50 produktów)
- Tatuażysta / piercing (urgency = "umów dziś")
- Sklep z częściami samochodowymi
- Usługi gastronomiczne na imprezy
- Foto-budka / wynajem sprzętu

Klient gdzie KAŻDA sekunda zwłoki = utracona sprzedaż.

---

## Inspiracje (referencyjne strony)

| Strona | URL | Co warto stamtąd wziąć |
|--------|-----|------------------------|
| Liquid Death | https://liquiddeath.com | Bold typography, mocne kolory, irreverent copy, ale jasne CTA |
| Notion landing | https://notion.so | Mocny gradient hero + duże litery + multi-CTA + social proof |
| Cluely | https://cluely.com | Aggressive CTA layout, big bold sans, scroll-triggered animacje |
| Webflow landing | https://webflow.com | Mocny visual + clear value props w 3 słowach |
| MailerLite | https://mailerlite.com | Multi-CTA z hierarchią (primary + secondary call) |
| Carrd | https://carrd.co | Single-page landing wzorce, fast load, focus on action |
| Cluely | https://cluely.com | Bold typo + dark mode default + neon accents |
| Linear early landings | https://linear.app/init | Pre-launch energy, multi-CTA layered |
| Pizza Hut PL | https://pizzahut.pl | Polski przykład — agresywny CTA "Zamów", multiple call-outs |
| Bolt.eu | https://bolt.eu | Multi-product sticky CTA, mocne typo, foto-driven ale szybkie |

**Moodboard kierunek:** Liquid Death meets Notion landing meets Bolt. Bold ale nie chaos. **Hierarchia działania > hierarchia informacji** (najpierw CTA, potem info dlaczego).

---

## Conversion workflow — agresywny, ale uczciwy

**Klient z awarią ślusarską trafia o 23:30 w nocy:**

```
[Top sticky bar (zawsze widoczny, mobile + desktop)]
└── Background: brand high-contrast | Text: "Awaryjne 24/7 · +48 600 100 200 · Dojazd 30 minut"
└── Button right: [ZADZWOŃ TERAZ] (filled bold + phone icon)

[Ekran 1 — hero split (text left + image right)]
Left:
└── Badge: "AWARYJNE 24/7 · RZESZÓW" (filled brand bg, white text, uppercase)
└── h1: "Otworzymy każdy zamek w 30 minut" (Barlow Condensed Bold 60-72px)
└── p: "Bez uszkodzeń. Bez zaliczki. Płacisz dopiero po wykonaniu."
└── 2 CTA:
    [ZADZWOŃ +48 600 100 200] ← primary, filled, brand bg
    [Napisz na WhatsApp]       ← secondary, outline accent
└── ↘ small "Ostatnia interwencja: 4 min temu · Średni czas dojazdu: 23 min"

Right:
└── Image: ślusarz przy drzwiach (real, nie stock), action shot

[Ekran 2 — trust badges row (4 columns, prominent)]
├── ⊳ icon | "1200+ interwencji"
├── ⊳ icon | "Średni dojazd 23 min"
├── ⊳ icon | "Płatność po wykonaniu"
└── ⊳ icon | "Gwarancja bez uszkodzeń"
(ikony filled Lucide 2.5px stroke, brand color)

[Ekran 3 — usługi grid 2×2 z cenami widocznymi]
└── 4 karty: każda = nazwa Bold + cena duża + lista 3 bullet co dostajesz + CTA "Sprawdź"
└── Hover: lift +4px + brand border 3px

[Ekran 4 — FOMO subtle + 3 recent reviews]
└── Live counter (jeśli włączone): "12 osób zadzwoniło dziś"
└── 3 opinie krótkie (każda max 2 zdania) z imienem + miastem + dnia

[Ekran 5 — strefa dojazdu (mapa Polski / regionu z kropkami)]
└── "Działamy w: Rzeszów + 10 okolicznych miejscowości"
└── Multi-CTA: "Twoje miasto nie ma?" → form quick callback

[Ekran 6 — kontakt + godziny prominent]
└── Telefon DUŻY (text-4xl bold)
└── "Otwieramy zamki 24/7, 365 dni"
└── WhatsApp QR + email + Booksy embed

[Sticky bottom mobile CTA: "ZADZWOŃ" (zawsze widoczny)]

[Footer — NIP/KRS itd. ale stonowane, na ciemnym tle]
```

**6 etapów conversion z master doc:**
1. POZNANIE — hero w 1s, headline natychmiast wartość ✓
2. ZAUFANIE — trust row badges 4 column ✓ + live counter (jeśli włączony)
3. PRZYDATNOŚĆ — bento grid usług z **prominent cenami** ✓
4. DOWÓD — 3 krótkie opinie w siatce 3-column ✓
5. PRZESZKODY — mapa strefy + godziny 24/7 prominent ✓
6. AKCJA — sticky bottom + sticky top + multi-CTA wszędzie ✓

**Specyfika Dynamic:** każdy ekran ma CTA. Najlepsze branże dla Dynamic = "i can call NOW". Konwersja jest **natychmiastowa**, nie "umówię się na konsultację".

---

## Palety kolorów (3 warianty)

Każdy wariant: **mocne brand + ostry kontrast + jeden alarmowy accent**.

### Wariant 1: `red-action` (default) — Czerwień + żółty
```
brand:        #dc2626       ← czysta alarmowa czerwień
brandFg:      #ffffff
accent:       #fbbf24       ← solar yellow (call-out, "promocja", "nowość")
surface:      #ffffff
surfaceMuted: #fef2f2       ← bardzo pale red bg
text:         #0a0a0a       ← near black
textMuted:    #525252
border:       #fecaca       ← pink-red
```
Best for: ślusarz, hydraulik, awaria, pomoc drogowa

### Wariant 2: `electric-blue` — Electric blue + magenta
```
brand:        #1d4ed8       ← electric royal blue
brandFg:      #ffffff
accent:       #ec4899       ← magenta pop
surface:      #ffffff
surfaceMuted: #eff6ff       ← pale blue
text:         #0a0a0a
textMuted:    #475569
border:       #dbeafe
```
Best for: IT na wezwanie, pogotowie komputerowe, kurier, e-commerce tech

### Wariant 3: `neon-noir` — Czarne tło + cyan/limonka (dark mode default!)
```
brand:        #00ffd1       ← cyan/mint neon (kontrast z czarnym)
brandFg:      #0a0a0a
accent:       #ff9500       ← orange neon (CTA na pop)
surface:      #0a0a0a       ← deep black (NIE szary)
surfaceMuted: #171717
text:         #fafafa
textMuted:    #a3a3a3
border:       #262626
```
Best for: siłownia, gaming, ecommerce młodzieżowy, klub muzyczny, fast-food trendy, tatuażysta

### Light vs Dark
**Dynamic to jedyny styl gdzie dark mode jest często domyślny** — wariant 3 (`neon-noir`) jest dark by default. Klient w panelu może mu dać light invert ale rzadko ma sens.

---

## Typografia (3 pary fontów do wyboru)

### Para A: Barlow Condensed + Inter (default)
- **Display:** [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) 700-800 — condensed = oszczędne miejsce + agresywne
- **Body:** [Inter](https://fonts.google.com/specimen/Inter) 400-600
- Best for: usługi techniczne, awaryjne, B2C natychmiastowe

### Para B: Archivo Black + Archivo
- **Display:** [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) (jeden weight 900) — heaviest sans
- **Body:** [Archivo](https://fonts.google.com/specimen/Archivo) 400-500
- Best for: e-commerce, fast-food, fitness, brand-forward

### Para C: Anton + Manrope
- **Display:** [Anton](https://fonts.google.com/specimen/Anton) (jeden weight) — slim condensed, mocny impact
- **Body:** [Manrope](https://fonts.google.com/specimen/Manrope) 400-700
- Best for: siłownia, klub, młodzieżowe marki

---

## Ikony — biblioteka i styl

**[Lucide](https://lucide.dev)** stroke-width **2.5px** (BOLD) lub [Material Symbols](https://fonts.google.com/icons) variable "filled" weight 700.
- Lucide thick: 2.5px stroke, dobre dla utility ikon
- Material filled: dla CTA i status badges (full color shapes)
- Size: 20px-32px (większe niż Czysty/Elegant)
- Color: zawsze brand lub accent (nie subtelne!)

Konkretne ikony dla Dynamic:
- Hero CTA: `phone` (filled, 24px) ZAWSZE prominent
- Trust badges: `shield-check`, `zap`, `award`, `clock` (wszystkie filled)
- Services: `arrow-right` (bold) lub `chevron-right` w kółku brand
- Header: `menu` (mobile), `phone` zawsze widoczny
- Status: `circle-check` (filled green) dla "available now"

**Emoji NIE** — nawet w Dynamic. Zawsze SVG. Powód: na "Zadzwoń 🔥" zamiast wygląda byle jak.

---

## Komponenty per-style

### 1. Hero (split variant default)
```
+----------------------------------------+
| Badge "PILNE 24/7"  (uppercase, brand bg) |
|                                        |
| h1 BIG BOLD Headline                   |  ← 60-80px Barlow Condensed
| (max 16ch, max 3 wiersze)              |
|                                        |
| p subtitle (max 60ch)                  |
|                                        |
| [ZADZWOŃ] [Wyślij sms]                 |  ← multi-CTA, primary + secondary
|                                        |
| small live status:                     |
| "12 dzwoniło dzisiaj · 4min od interw" |  ← micro social proof
+----------------------------------------+
| [Image right column, action shot]      |
+----------------------------------------+
```

Sticky top bar **ZAWSZE** widoczny ze swoim własnym CTA i telefonem.

### 2. Header
- Sticky, brand color background (nie biały!), white text
- Logo lewa + nav prawa (max 4 linki) + telefon BOLD bigger + CTA "Zadzwoń" pill
- Mobile: logo lewa + nav hamburger right + telefon BOLD w środku (zawsze widoczny)
- NO scroll-shrink (zawsze duży = visibility)

### 3. ServicesList (bento grid 2×2 lub 2×3, prominent prices)
- 4-6 kart, każda: nazwa Bold 700 + cena DUŻA (text-3xl) + bullets co dostajesz + filled CTA "Sprawdź"
- Background: subtle pattern (np. cross-hatch, brand color 5% opacity)
- Hover: lift +6px + brand color border 3px + scale 1.02
- Card 1 może być "FEATURED" — 2x size, accent color background, "NAJCZĘŚCIEJ WYBIERANE" badge

### 4. ReviewsSection (3-column grid, krótkie)
- 3 cytaty obok siebie, każda max 2 zdania
- Format: cytat + nazwa + miasto + data
- Stars: 5 filled gwiazdek brand color (NIE szare)
- Background: surfaceMuted, każda karta na białym bg

### 5. Trust badges row (4 columns prominent)
- Po hero, full width, brand color background
- Każdy badge: filled icon 32px + liczba/tekst Bold + label muted
- Mobile: stack 2×2 grid

### 6. OpeningHours
- Hours table BIG (text-2xl), filled brand color "OTWARTE TERAZ" badge prominent
- "24/7" jeśli włączone — full-screen claim "DZIAŁAMY 24/7" na surfaceMuted

### 7. ContactForm
- Big inputs (text-lg, padding-y 4), focus ring brand 3px
- Button BIG (text-xl, padding-y 6), filled brand, hover scale 1.03 + shadow drop
- "ZADZWOŃ +48 ..." link DUŻY (text-3xl) jako alternatywa nad formą — "Lub po prostu zadzwoń"
- Success: confetti animacja (Dynamic likes celebrate) + redirect po 2s

### 8. Sticky bottom CTA mobile (CRITICAL)
- Zawsze widoczny na mobile
- Background brand color, white text, full-width
- Lewa: telefon clickable | Prawa: WhatsApp / Booksy clickable
- Hide on scroll-up, show on scroll-down (UX pattern)

### 9. Footer
- Dark background (nawet w light mode wariant!) — kontrast z białymi sekcjami
- Tekst muted, ale telefon + adres prominent
- NIP/KRS small ale czytelne
- Big "ZADZWOŃ TERAZ" pill na końcu — repeat CTA

---

## Sekcje opcjonalne (mapa do toggle)

**Pre-checkbox ENABLED dla Dynamic:**
- FOMO counter ("X osób zadzwoniło dziś") — DZIAŁA w Dynamic, psuje Eleganta
- Leadpop modal (exit-intent — "Zaczekaj! Daj nam jeszcze chwilę")
- Newsletter SMS (Dynamic kocha SMS marketing)
- Trust badges row (4 prominent)
- Chatbot (jeśli klient ma capacity)
- Booksy / Calendly embed jeśli relevant (siłownia, kosmetyczka dynamic)
- Wolt/Glovo / Delivery (fast-food, restauracja)
- Mapa strefy działania (usługi mobilne)

**Pre-checkbox DISABLED ale dostępne:**
- Galeria (dla niektórych branż ma sens — siłownia, tatuaż, kursy)
- Wideo embed (intro vlog, demo)
- Sekcja "Zespół" (dla większych firm)
- FAQ rozszerzona

**Anti-recommend (Dynamic nie powinien):**
- Sekcja "Historia firmy" długi text — przeszkadza w urgency
- Publikacje / case studies — to Professional/Editorial domain
- Carousel testimoniali (Elegant pattern) — za wolne

---

## Co odróżnia Dynamiczny od pozostałych 3

| Atrybut | Dynamiczny |
|---------|------------|
| Hero layout default | **split** (text left + image right) |
| Image w hero? | **TAK** — action shot, real person/produkt |
| Liczba CTA w hero | **2** (primary phone + secondary form/whatsapp) |
| Sticky top bar? | **TAK** (zawsze, mobile + desktop) — z telefonem |
| Sticky bottom mobile? | **TAK CRITICAL** |
| Animacje | **wszystkie** + ease-spring na CTA, scale 1.05+, shadow lift |
| Reviews | **3-column grid krótkich** |
| Trust signals | **4 BIG badges row** filled icons |
| Bento grid? | **TAK** z featured card (1× wyróżniona) |
| Dark mode | **wariant 3 dark by default** |
| Kolory | **mocne brand + ostry kontrast + alarm accent** |
| Whitespace | **20-30%** (gęste!) |
| Emoji w UI | **NIGDY** — filled icons agresywne zastępują |
| Conversion focus? | **MAX** — każdy ekran ma CTA |

---

## Demo klient (fixture `demo-dynamiczny.mixturemarketing.pl`)

Sugestia: **Ślusarz Kowalski 24/7 — Rzeszów (awaryjne otwieranie zamków)**
- Variant: `red-action`
- Para fontów: A (Barlow Condensed + Inter)
- Sekcje opcjonalne: Trust badges (4), FOMO counter, Mapa strefy, WhatsApp prominent
- Logo: bold monogram "K" na czerwonym kółku

Skopiować z `demo-fixtures/craftsman.config.ts`, zaktualizować preset.

---

## Otwarte pytania do Ciebie (jutro)

1. **Polska nazwa "Dynamiczny"** — alternatywy: "Sprzedażowy", "Mocny", "Energiczny", "Konwersyjny". Decyzja wpływa na UI.
2. **Czy `neon-noir` (dark variant) jako 3-ci wariant** — czy klient powinien móc go wybrać, czy Dynamic ma być zawsze "light + bold"? Dark dla młodzieżowych branż (siłownia/klub/gaming) to game-changer.
3. **FOMO counter — TAK domyślnie** w Dynamic? — Wiem że stuk-puk wątpliwy etycznie. Można dać klientowi pełną kontrolę (zostawione false, klient sam włącza w `/addons`).
4. **Live status w hero** ("12 osób zadzwoniło dziś") — to wymaga D1 query at SSR time (z lead table). Dorobić jako separate component dispatcher, czy poczekać do Faza X.5?
5. **Sticky top bar** — robimy ją zawsze na każdej podstronie, czy tylko strona główna? (Argument za zawsze: klient z każdej podstrony może natychmiast zadzwonić.)

---

**Następny brief:** [04-magazynowy.md](04-magazynowy.md)
