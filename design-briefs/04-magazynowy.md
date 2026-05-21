# Styl: Magazynowy (Editorial)

> **Slug w kodzie:** `editorial`
> **PL Label (UI klienta):** **Magazynowy**
> **Tagline klienta:** "Dla tych, którzy mają historię do opowiedzenia"
> **Master design system:** [00-master-design-system.md](00-master-design-system.md)

---

## Filozofia projektowa

**Strona = magazyn lifestyle.** Asymetryczne układy, big typo na blokach kolorów, dużo długiego tekstu mieszanego z dużymi zdjęciami, pull quotes wewnątrz artykułów, ornament dividers, "od redakcji" feel. Dziedzic NYT Cooking, Eater, Substack publications i Apple "today" section.

**Co tu działa:** klient kupuje DOŚWIADCZENIE i HISTORIĘ. "Założył w 1987" matters. "Ksiądz polecił winnicę" matters. Konwersja przez STORYTELLING + AUTORITET + EMOCJE. Czyta się jak artykuł, nie jak landing.

**Co tu nie działa:** branże gdzie czas reakcji = wszystko (Dynamic territory), strony "ile to kosztuje, zadzwoń" (Czysty territory), pure visual brands bez story (czysto Elegant).

**Wyróżnik vs konkurencji:** **niemal nikt w PL nie robi w tym stylu**. To okazja na unikalność dla marek z historią.

---

## Dla kogo (naturalnie pasuje)

- Restauracja z historią (rodzinna, długo działająca, regionalna kuchnia)
- Hotel butikowy / villa / agroturystyka klimatyczna
- Winnica / browar rzemieślniczy / palarnia kawy
- Marka osobista (ekspert, autor książek, dziennikarz, mowca)
- Cukiernia rzemieślnicza z legendą
- Rzemiosło premium (stolarz artystyczny, ślusarz design, garncarz)
- Ekologiczne gospodarstwo / farma sera / piekarnia chleba
- Galeria sztuki / antyki / collectibles
- Studio fotografii artystycznej
- Klub muzyczny / kino studyjne / festiwal
- Wydawnictwo / autor / coach z książką
- Konsultant z "thought leadership" (publikacje, wystąpienia)
- Marka odzieżowa slow fashion
- Restauracja z gwiazdką (Michelin / Gault Millau)

Klient z **content depth** — minimum 5 stron eseju o swojej firmie/produkcie/wartościach.

---

## Inspiracje (referencyjne strony)

| Strona | URL | Co warto stamtąd wziąć |
|--------|-----|------------------------|
| NYT Cooking | https://cooking.nytimes.com | Hierarchia recipe stories + duża typografia + serif headlines |
| Eater | https://eater.com | Restaurant reviews z autorem-stylem, image-heavy + long-form |
| Substack featured publications | https://substack.com | Editorial layouts dla writers — fokus na headline+intro |
| Apple "Today at Apple" | https://apple.com/today | Bento layouts z asymetrią, dużymi blokami koloru |
| Aesop x Editorial | https://aesop.com/u/journal | Aesop ma sekcję magazine — perfect crossover Elegancki/Magazynowy |
| Stripe Press | https://press.stripe.com | Book promo pages z eseistic intro, custom typography |
| Linear init | https://linear.app/init | Pre-launch editorial w stylu zinów |
| Apartment Therapy | https://apartmenttherapy.com | Lifestyle magazine ale dla wnętrz — mix article+product |
| Maison Margiela editorial | https://maisonmargiela.com | High-fashion magazine vibe |
| Casa Brutus PL | https://casabrutus.com | Japoński magazyn architektoniczny — gęste, content-heavy |
| The Marginalian | https://themarginalian.org | Long-form blog z 20 lat — czysto editorial |
| Plant-Based on a Budget | https://plantbasedonabudget.com | Recipe blog z osobowością — może być pattern dla cukierni |

**Moodboard kierunek:** Eater meets Apple Today meets Substack. Asymetryczne, big typo, długie teksty mieszane z dużymi zdjęciami, "od redakcji" autor pojawia się w bylinie.

---

## Conversion workflow — przez storytelling

**Klient trafia na stronę Trattoria Bocca (restauracja z historią rodzinną):**

```
[Ekran 1 — hero asymetryczny, magazine-style]
Left 60%:
└── Tiny "byline" overhead: "RODZINNA TRATTORIA · KRAKÓW · OD 2015"
└── h1 Fraunces 80px (huge): "Pasta jak u babci. Z prawdziwej Toskanii."
└── p lead 22px: "Spaghetti carbonara robione codziennie. Bez śmietany. Z guanciale z farmy pod Sieną."
└── small "→ Zobacz menu" (link, nie button)

Right 40%:
└── Image: szef kuchni nad plate full-bleed (overlap top edge)
└── Caption italic small: "Marco Bocca, szef kuchni, codziennie sam robi pastę."

[Ekran 2 — full-bleed image]
└── Wnętrze restauracji, light golden hour
└── Caption overlay: "Stara kamienica przy Floriańskiej, 2 sale, 28 miejsc."

[Ekran 3 — "Od redakcji" / "Nasza historia" section]
└── Pull quote (h2 Fraunces 48px italic): "Trattoria to nie restauracja. To zaproszenie do domu rodziny."
└── 3 paragrafy długiego tekstu (max 60ch line)
└── Subtle drop cap pierwsza litera (serif large)
└── Footnote small italic: "— Marco Bocca, założyciel"

[Ekran 4 — bento grid menu (asymetryczne!)]
└── 6 dań w grid z różnymi rozmiarami (1 duża karta + 4 średnie + 1 wąska)
└── Każda karta: nazwa Fraunces + składniki italic + cena mono small
└── Image w niektórych kartach, w innych tekst-only
└── Karta "Polecane przez Marco" wyróżniona pełnym kolorem accent

[Ekran 5 — "W prasie" / "Co o nas piszą"]
└── 3 cytaty z gazet/magazynów (jeśli klient ma):
    └── Gazeta Wyborcza Kraków "[krótki cytat]" — 2024
    └── Restauracje.pl "Najlepsza carbonara w Krakowie" — 2025
    └── Polityka  "[cytat]" — 2023
└── Logo gazet stonowane B&W

[Ekran 6 — "Zarezerwuj stolik" + adres + godziny]
└── Asymetryczny split — formularz left, mapa right z napisem "Floriańska 18 · Kraków"
└── Hours table z dziennym status

[Ekran 7 — "Czytaj dalej" — blog / newsletter signup]
└── 3 ostatnie wpisy "Z naszej kuchni" lub "Z winnicy"
└── Newsletter signup discrete (footer-adjacent)

[Footer — magazine masthead style]
└── Logo + tagline + masthead-style NIP/adres
```

**6 etapów conversion z master doc — kolejność OK przesunąć:**
1. POZNANIE — hero z big typo + image hint ✓
2. ZAUFANIE — historia firmy + "w prasie" ✓ (autorytet zastępuje badges)
3. PRZYDATNOŚĆ — menu bento grid ✓
4. DOWÓD — cytaty z prasy + historia ✓ (mocniejsze niż "5 gwiazdek Google")
5. PRZESZKODY — godziny + adres + mapa ✓
6. AKCJA — rezerwacja stolika (subtle, nie shouting) ✓

**Specyfika Magazynowego:** etap 2 (ZAUFANIE) buduje się **przez historię**, nie przez badges. Klient nie czyta "1200+ klientów" — czyta "Marco gotuje codziennie". To buduje attachment.

---

## Palety kolorów (3 warianty)

Każdy wariant: **ziemiste, naturalne, "magazynowe drukarskie" kolory + jeden mocny accent dla wyróżnień**.

### Wariant 1: `forest-amber` (default) — Las + bursztyn
```
brand:        #2d4a36       ← deep forest green
brandFg:      #fef8f0
accent:       #c47a2e       ← warm amber/honey
surface:      #fef8f0       ← warm cream (NIE biały)
surfaceMuted: #f0e6d4       ← warm beige tan
text:         #1a1410       ← deep ink
textMuted:    #5c4f3f       ← muted brown
border:       #d9c8a8
```
Best for: restauracja regionalna, winnica, ekologiczne, slow food

### Wariant 2: `slate-rose` — Łupek + zgaszony róż
```
brand:        #475569       ← slate blue-grey
brandFg:      #ffffff
accent:       #be5a6e       ← muted rose/wine
surface:      #f8f5f3       ← warm white
surfaceMuted: #e8e2dd       ← stone grey
text:         #1c1c20
textMuted:    #5a5460
border:       #d4ccc4
```
Best for: hotel butikowy, marka osobista, wydawnictwo, galeria

### Wariant 3: `cream-cobalt` — Krem + kobalt
```
brand:        #1e40af       ← cobalt blue (mocny, ale magazynowy)
brandFg:      #fef8f0
accent:       #d97706       ← orange burnt
surface:      #fef8f0       ← cream
surfaceMuted: #ede4d3
text:         #0a1424
textMuted:    #475568
border:       #d8cebc
```
Best for: cukiernia, klub muzyczny, kino studyjne, kreatywni z energią

### Dark mode (opcja)
Magazynowy ciemny = "vintage paperback" feel — tło `#1a1410` (deep ink), tekst `#f0e6d4` (cream), accent jaśniejszy bursztyn.

---

## Typografia (3 pary fontów — najwięcej dla Magazynowego)

### Para A: Fraunces + IBM Plex Sans (default)
- **Display:** [Fraunces](https://fonts.google.com/specimen/Fraunces) variable 100-900 + opt-size + soft-feature — modern serif z retro vibe
- **Body:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) 400-500 — czytelne, neutralne
- Best for: restauracja, marka osobista, journal/blog dominant

### Para B: GT Sectra + Inter
- **Display:** GT Sectra (premium, **wymaga licencji $** — alternatywa z Google Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces)) lub [Crimson Pro](https://fonts.google.com/specimen/Crimson+Pro) za free
- **Body:** [Inter](https://fonts.google.com/specimen/Inter) 400-500
- Best for: high-end magazyn feel, hotel butikowy

### Para C: Editorial New + Söhne (free alts: Fraunces + Inter)
- **Display:** Editorial New (Pangram Pangram, **płatne** — alternatywa z Google: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond))
- **Body:** Söhne lub Inter
- Best for: kreatywne, awangardowe

### Specjalnie dla Magazynowego: drop caps + ornament dividers
- **Drop cap:** pierwsza litera paragraph (Fraunces 800, 80px, float-left)
- **Ornament dividers:** custom SVG między sekcjami (cienka linia + 3 kropki + dingbat)
- **Pull quotes:** italic Fraunces 36-48px, vertical line lewa brand 3px

---

## Ikony — biblioteka i styl

**Mix podejścia:**
- [Lucide](https://lucide.dev) regular 1.5px dla utility ikon (phone, mail, map-pin)
- Custom SVG **dingbats / ornaments** dla decoration (5-10 wzorów: gwiazdki ostre, diamenty, fleurons, zawijasy)
- **Initial caps** — pierwsza litera artykułu jako "icon" Fraunces 800
- Numbers w mono (IBM Plex Mono) dla artykułów numerowanych, dat, cen

Konkretne ikony:
- Hero: brak (Magazynowy nie potrzebuje icon w hero — typo + image robi)
- Section divider: ornament SVG custom (3 kropki diamenty)
- Footer: utility lucide stonowane
- Date format: "25 LUTEGO 2026" small caps, tracking-wide (nie ikona)

**Emoji NIE.** Dingbats SVG są kontrolowane.

---

## Komponenty per-style

### 1. Hero (asymetryczny variant — unique)
```
[Top byline strip — full-width]
small caps tracking-wide:
"RODZINNA TRATTORIA · KRAKÓW · OD 2015"

[Main split 60/40]
Left:
└── h1 Fraunces 80-100px (HUGE)
└── max 14ch per line, max 3 wiersze
└── p lead 22-26px italic Fraunces
└── small "→ Zobacz menu" link (nie button — Magazynowy nie ma "kup teraz" energy)

Right:
└── Image full-bleed (extends top/bottom beyond container)
└── Caption italic small under: "Krótki opis czego/kto na zdjęciu"
```

**Asymetria critical** — Magazynowy never centered hero. Always offset.

### 2. Header
- Top bar masthead-style — like newspaper
- Logo centered LARGE (lub left-aligned z big serif wordmark)
- Date small caps right side: "ŚRODA · 20 MAJA 2026" (live date)
- Nav stonowane, italic small caps
- Mobile: hamburger + logo + date

### 3. ServicesList → "Karta" / "Menu" (bento asymetryczny)
- Grid 12-column z różnymi card sizes (1 big 8×col + 2 small 4×col + 1 wide 12×col)
- Każda karta: nazwa Fraunces + ingredients italic + cena mono + image opcjonalnie
- Card "polecane" = pełny kolor accent + bigger
- Hover: subtle scale + brand color underline

### 4. ReviewsSection → "W prasie" / "Co o nas piszą"
- 3 cytaty z **gazet/magazynów** (nie Google reviews)
- Format: "[Cytat]" italic Fraunces 28px + logo gazety (B&W) + data
- Background: surfaceMuted, generous padding
- Alternative dla klientów bez prasy: pull quotes z opinii Google ale **bez gwiazdek** (Magazynowy nie pokazuje 5★ — to wulgarne)

### 5. "Historia / Od redakcji" section (NOWA — Magazynowy specific)
- Pull quote duży (h2 Fraunces 48px italic)
- 3-5 paragrafów długiego tekstu (max 65ch)
- Drop cap pierwsza litera
- Subtle author byline: "— [Imię], [funkcja]" small caps
- Może mieć inline image w środku tekstu (text wraps)

### 6. Gallery (asymetryczny bento)
- Nie grid 3×3 — różne rozmiary, asymetria
- Każda image z caption italic small
- Lightbox click full-screen

### 7. OpeningHours
- Wcale nie "OPEN NOW" filled badge (Dynamic style) — subtle text-based status
- Hours w mono table, dzisiejszy dzień bold + brand
- Hours note italic ("Otwarci w święta... kuchnia czynna do 22:30")

### 8. ContactForm / Reservation
- Form z label-based fields (nie floating — Magazynowy chce visible labels)
- Magazine-style: hairline borders, italic labels
- Reservation specific: data + osoby + okazja (textarea)
- Button: ghost style (border-only, brand text), nie filled

### 9. Footer (masthead style!)
- 4 kolumny: Firma | Kontakt | Newsletter signup | Social
- Top divider: ornament SVG
- Logo wordmark large left
- Tagline italic right
- Bottom row: NIP/KRS małe + "© 2026 [Firma]" + impressum link

---

## Sekcje opcjonalne (mapa do toggle)

**Pre-checkbox ENABLED dla Magazynowego:**
- Galeria (różne aspect ratios — asymetria)
- Sekcja "Historia / O nas" (5+ paragrafów rich content) — KLUCZOWA
- Sekcja "Zespół" (z bylinem każdej osoby)
- Sekcja "W prasie" — cytaty z gazet
- Blog / Newsletter signup
- Wideo embed (intro film, manifest)
- Reservation form (Cal.com / Booksy)
- Menu / Karta dań (jeśli food)
- Sekcja "Publikacje" (jeśli marka osobista — książki/artykuły)

**Pre-checkbox DISABLED:**
- Cennik tabelaryczny (Magazynowy "ukrywa" ceny w storytellingu)
- FAQ (zwykle nie pasuje — narrative > FAQ)
- Instagram embed (jeśli klient ma, włącza)
- Trust badges row (Magazynowy ufa story, nie liczbom)

**Anti-recommend (Magazynowy nie powinien):**
- FOMO counter — destroys storytelling
- Leadpop modal — destroys flow
- Chatbot AI — destroys autentyczność (klient czuje że to "magazyn", nie "automat")
- Live status "X osób online" — Dynamic territory
- Wolt/Glovo delivery widget — psuje story (chyba że restauracja celowo eksponuje dostawę)

---

## Co odróżnia Magazynowy od pozostałych 3

| Atrybut | Magazynowy |
|---------|------------|
| Hero layout default | **asymetryczny** (60/40 z byline strip top) |
| Image w hero? | **TAK** ale z caption italic |
| Liczba CTA w hero | **0-1** (subtle link, nie button) |
| Animacje | **medium + long**, scroll-triggered reveal, parallax umiarkowane |
| Reviews | **"W prasie" cytaty** zamiast Google ★★★★★ |
| Trust signals | **historia + autor** (nie badges) |
| Bento grid? | **TAK asymetryczny** (różne sizes) |
| Dark mode | **vintage paperback dark** (opcja, rzadko default) |
| Kolory | **ziemiste + naturalne + mocny accent** |
| Whitespace | **luźny w treści, gęsty wokół typografii** |
| Drop caps? | **TAK** w długim tekście |
| Ornament dividers | **TAK** custom SVG |
| Long-form text? | **TAK ZAWSZE** — bez tekstu Magazynowy upada |
| Emoji w UI | **NIGDY** — ornament SVG + dingbats |

---

## Demo klient (fixture `demo-magazynowy.mixturemarketing.pl`)

Sugestia: **Trattoria Bocca — Kraków (włoska restauracja rodzinna, "Marco gotuje sam od 2015")**
- Variant: `forest-amber`
- Para fontów: A (Fraunces + IBM Plex Sans)
- Sekcje opcjonalne: Historia (5 paragrafów rich), Galeria asymetryczna (8 zdjęć), Menu bento, "W prasie" (3 cytaty), Wideo embed (intro Marco)
- Logo: serif wordmark "BOCCA" z ornament pod (custom)

Skopiować z `demo-fixtures/food.config.ts`, zaktualizować preset + variant + dodać rich content historia.

---

## Otwarte pytania do Ciebie (jutro)

1. **Polska nazwa "Magazynowy"** — alternatywy: "Narracyjny", "Storytellingowy", "Redakcyjny", "Magazyn", "Z historią". Decyzja wpływa na UI.
2. **Custom dingbats / ornament SVG library** — robimy własny set (5-10 wzorów do wszystkich klientów), czy używamy gotowych z Phosphor "duotone"? Pierwszy = unikalność (USP), drugi = szybciej.
3. **CMS Sveltia schema dla "Historia"** — Magazynowy wymaga rich content (markdown z embeded images, drop caps, pull quotes). Sveltia obsługuje markdown ale jak handlebamy drop caps + ornament? Custom shortcodes w MD?
4. **"W prasie" sekcja — wymaga uploads logo + cytaty** — jaki UI w panelu klienta? Repeater jak usługi czy CMS collection?
5. **Magazynowy = długi tekst** — wymagamy od klienta min. 500 słów historii w wizardzie, czy dajemy templatkę "Twoja firma od X roku robi Y ..." do edycji?
6. **Drop caps na mobile** — duża wpływa na czytelność. Czy off-mobile, czy mniejsza wersja?

---

**Wszystkie 4 briefy gotowe. Wracaj do [00-master-design-system.md](00-master-design-system.md) lub [TODO-styles-refactor-plan.md](../TODO-styles-refactor-plan.md).**
