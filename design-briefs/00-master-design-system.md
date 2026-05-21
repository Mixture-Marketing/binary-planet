# Master Design System — wspólne fundamenty dla 4 stylów

> Część refactor stylów (Faza X). Companion do [TODO-styles-refactor-plan.md](../TODO-styles-refactor-plan.md). Per-styl: [01-czysty.md](01-czysty.md) · [02-elegancki.md](02-elegancki.md) · [03-dynamiczny.md](03-dynamiczny.md) · [04-magazynowy.md](04-magazynowy.md).
> **Data:** 2026-05-20. **Zasada przewodnia:** clarity over decoration. Sprzedaż, nie show.

---

## Zasada nr 1: bez emoji w kodzie i UI

Wszystkie ikony renderujemy z **profesjonalnej biblioteki SVG**, nie z Unicode emoji. Powody:
- Spójność cross-platform (emoji na Windows wygląda inaczej niż na macOS i Android)
- A11y (screen reader czyta "fire" zamiast 🔥 zależnie od locale)
- Brand integrity — emoji w stronie kosmetyczki za 349 zł/mc obniża postrzeganą wartość
- SEO (Lighthouse karze za nieoptymalne fonty emoji)

**Domyślna biblioteka:** [Lucide](https://lucide.dev) — MIT, ~1500 ikon, stroke-based, tree-shakeable. Już mamy częściowo zaimplementowane w [packages/web-core/src/ui/icon-paths.ts](../packages/web-core/src/ui/icon-paths.ts).

**Alternatywy per styl** (zobacz brief stylu po szczegóły):
| Styl | Biblioteka ikon | Charakter |
|------|-----------------|-----------|
| Czysty (Minimalist) | Lucide stroke 1.5px | thin, hairline, single-tone |
| Elegancki (Elegant) | Phosphor "regular" 1.25px lub Heroicons outline | thin, refined |
| Dynamiczny (Dynamic) | Lucide stroke 2.5px lub Material Symbols filled | bold, solid, eye-catching |
| Magazynowy (Editorial) | Mix: serif-style icon set (custom) + Lucide dla utility | distinctive |

Każdy styl ma plik `themes/{style}/icons.ts` który mapuje icon names na konkretne SVG paths.

### Ornamenty / dingbats dla Magazynowego

Zdecydowane 2026-05-20: **mix gotowe + custom**.

**Gotowe biblioteki (priority order):**
1. [Phosphor Icons](https://phosphoricons.com) "duotone" weight — ma kilkaset ornamentów (gwiazdki, kropki, hairlines)
2. [SVG Repo](https://www.svgrepo.com) (CC0 license, public domain) — kolekcje "flourish dividers" + "ornament dividers" — 500+ darmowych
3. [Iconoir](https://iconoir.com) — ma kilka ornament-style ikon
4. [Heroicons](https://heroicons.com) outline — fallback dla utility

**Co wybieramy:** 5-7 ornament SVG z SVG Repo (CC0, można modyfikować + komercja), znormalizowane do naszego style:
- `divider-3-dots` — 3 kropki w linii poziomej (między sekcjami)
- `divider-diamond` — diamond + hairline (między artykułami)
- `divider-fleuron` — fleuron ornament (między rozdziałami)
- `corner-flourish` — ornament narożny (decoration card)
- `quote-mark-large` — duży cudzysłów dla pull quotes
- `star-fine` — gwiazdka cienka (reviews)
- `arrow-flourish` — ornamentalny arrow

Pliki: `packages/web-core/src/ui/ornaments.ts` — eksportuje SVG paths jak `ICON_PATHS`. Magazynowy używa, pozostałe style **mogą** (Elegancki też).

**Jeśli któreś nie pasuje (po pierwszym screenshocie demo workera) — robię custom SVG** (3-5 minut per ornament w Figmie/Illustrator + export).

---

## 2026 trendy które adoptujemy (cherry-pick, nie wszystko)

| Trend 2026 | Adopcja u nas | Gdzie? |
|------------|---------------|--------|
| **Bento grids** (functional minimalism) | TAK | Czysty + Magazynowy ServicesList/Gallery |
| **Bold typography** (oversized headlines) | TAK | Dynamiczny + Magazynowy hero |
| **Dark mode** jako pełny system (nie toggle) | **TAK w v1** | każdy z 4 stylów ma palety dark — klient wybiera w `/ustawienia → Wygląd → Tryb`: Auto (default) / Tylko jasny / Tylko ciemny |
| **Kinetic typography** (text animacja) | OSTROŻNIE | Tylko Dynamiczny + Magazynowy hero; A11y respect `prefers-reduced-motion` |
| **Micro-interactions** | TAK | Wszystkie style — focus-visible, hover lift, button press, scroll reveal |
| **Mobile thumb-zone** primary CTA na dole | TAK | Globalnie — sticky bottom CTA na mobile dla Booksy/zadzwoń |
| **AI personalization** | NIE w v1 | Zbyt skomplikowane dla mikrofirm, potencjał w Faza 3 |
| **Trust-based design** (NIP/KRS, reviews, gwarancja) | TAK | Wszystkie style — footer + dedicated trust section |
| **Performance** (LCP <2s) | TAK | Wymóg — Lighthouse Performance ≥90 dla wszystkich szablonów |
| **Clarity over decoration** | TAK | Cardinal rule — odrzucamy dekorację która nie służy konwersji |
| **Brutalism / chaos** | NIE | Nie pasuje do mikrofirm szukających trust |
| **Glassmorphism** | NIE | Out of fashion w 2026, accessibility issues |
| **3D / WebGL** | NIE w v1 | Performance hit + complexity, dla większych marek |

---

## Conversion workflow — wspólny szkielet dla 4 stylów

Każda strona musi prowadzić użytkownika przez **6 etapów**, w tej kolejności, w pierwszych 2 ekranach:

```
1. POZNANIE     "Co to jest?"        → Hero (nazwa + value prop + miasto)
2. ZAUFANIE     "Czy to legit?"       → Trust signals (NIP/lata działania/opinie/badges)
3. PRZYDATNOŚĆ  "Czy dla mnie?"       → Usługi z jasnym pricingiem
4. DOWÓD        "Komu pomogli?"       → Reviews real (nie stock)
5. PRZESZKODY   "Co mnie zatrzymuje?" → FAQ + godziny + lokalizacja
6. AKCJA        "Co mam zrobić?"      → Sticky CTA (zadzwoń/umów/zamów)
```

**Każdy styl realizuje to inaczej wizualnie**, ale ta kolejność jest święta. Reorder dozwolony tylko dla Magazynowego (storytelling może odwrócić 1↔4 — narracja przed faktami).

---

## Mobile-first decyzje globalne

- **Breakpoints:** 360 (S phone) / 768 (tablet) / 1024 (laptop) / 1440 (desktop). Custom queries dla 1920+ tylko jeśli content tego wymaga.
- **Thumb-zone CTA:** wszystkie style mają sticky bottom CTA na mobile (zadzwoń + umów). Desktop pokazuje w hero.
- **Tap targets:** min 44×44px (WCAG). Buttony min 48×48 dla Dynamicznego.
- **Font size body:** 16px+ na mobile, 17-18px na desktop.
- **Line height:** 1.5 dla body, 1.1-1.2 dla headlines.
- **Max paragraph width:** 65ch (~600px) dla czytelności.

---

## Spacing scale (rem, mobile-first)

Wspólny dla wszystkich stylów. Każdy styl może wybrać "luzność" przez gęstość: Czysty=spacious, Dynamiczny=compact.

```
xs    0.25rem    (4px)
sm    0.5rem     (8px)
md    1rem       (16px) ← base
lg    1.5rem     (24px)
xl    2rem       (32px)
2xl   3rem       (48px)
3xl   4rem       (64px)
4xl   6rem       (96px)
5xl   8rem       (128px)
```

Container: max-width `1280px`, padding-x `1rem` mobile, `2rem` desktop.

---

## Typography per styl — defaulty + opcje (decyzja 2026-05-20)

Zdecydowane: każdy styl ma **1 default + 2-3 opcje** do wyboru klienta w `/ustawienia → Wygląd → Typografia`.

| Styl | **DEFAULT** | Opcja B | Opcja C |
|------|-------------|---------|---------|
| **Czysty** | **Inter** (display + body, universal) | Geist Sans + Geist Mono (tech vibe) | Manrope + JetBrains Mono (warmer) |
| **Elegancki** | **Playfair Display + Lora** (classic premium) | Cormorant Garamond + Source Sans (refined) | Fraunces + Inter (modern retro) |
| **Dynamiczny** | **Barlow Condensed + Inter** (universal action) | Archivo Black + Archivo (heaviest impact) | Anton + Manrope (slim youth) |
| **Magazynowy** | **Fraunces + IBM Plex Sans** (variable + opt-size) | Crimson Pro + Inter (free GT Sectra alt) | Cormorant Garamond + Inter (classical) |

**Powody wyboru defaultów:**
- **Czysty: Inter** zamiast Geist — bardziej uniwersalny, lepiej w PL polskimi diakrytykami, większe wsparcie weights
- **Elegancki: Playfair+Lora** — klasyk Squarespace, najbardziej "premium" feel out-of-the-box
- **Dynamiczny: Barlow Condensed+Inter** — condensed = przyciąga uwagę bez krzyku, Inter body = czytelność
- **Magazynowy: Fraunces+IBM Plex Sans** — Fraunces ma `opsz` axis (auto-adjust dla różnych sizes) + soft-feature axis (klasyczne ↔ modern), IBM Plex jest neutralny + ma świetne polskie znaki

**Wszystkie fonty z Google Fonts (free, OFL/Apache).** Brak płatnych w v1 (jak GT Sectra czy Editorial New) — to opcja w Fazie 2 jeśli klient zapłaci za extension.

**Loader strategy:**
- Hub generuje font URL per styl + per font-pair z `fonts.googleapis.com/css2?family=...&display=swap`
- `<link rel="preconnect">` do `fonts.googleapis.com` i `fonts.gstatic.com` w `<head>`
- Tylko 2-3 weights ładowane initial (400, 600, 700) — reszta lazy gdy potrzebne
- Fallback metric matching: font-display swap + font-size-adjust (Tailwind v4 + Inter ma świetne metric overrides)

---

## Type scale (modular, base 16px)

| Token | rem | px | Use |
|-------|-----|-----|-----|
| `text-xs` | 0.75 | 12 | meta, captions |
| `text-sm` | 0.875 | 14 | secondary |
| `text-base` | 1 | 16 | body |
| `text-lg` | 1.125 | 18 | lead paragraph |
| `text-xl` | 1.25 | 20 | sub-heading |
| `text-2xl` | 1.5 | 24 | h3 |
| `text-3xl` | 1.875 | 30 | h2 |
| `text-4xl` | 2.25 | 36 | h1 mobile |
| `text-5xl` | 3 | 48 | h1 desktop |
| `text-6xl` | 3.75 | 60 | hero mobile |
| `text-7xl` | 4.5 | 72 | hero desktop |
| `text-8xl` | 6 | 96 | display Dynamic/Editorial |

Per styl override w `themes/{style}/tokens.ts`.

---

## Motion / animations

**Reduce motion respected:** zawsze `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }` jako global.

Wspólne easing tokens:
```
ease-out-quart    cubic-bezier(0.25, 1, 0.5, 1)     ← default
ease-in-out-quart cubic-bezier(0.83, 0, 0.17, 1)    ← emphasis
ease-spring       cubic-bezier(0.34, 1.56, 0.64, 1) ← bounce (Dynamic only)
```

Durations:
- micro (button press, focus): 120ms
- short (hover, dropdown): 200ms
- medium (page transition): 400ms
- long (hero reveal): 600ms max

Per-styl użycie:
- **Czysty:** wyłącznie micro + short, ease-out-quart, fade + 2px translate
- **Elegancki:** short + medium, ease-in-out-quart, fade + 4px translate, subtle scale 1.02 on hover
- **Dynamiczny:** wszystkie + ease-spring na CTA, scale 1.05 + shadow lift
- **Magazynowy:** medium + long, scroll-triggered reveal (intersection observer), parallax umiarkowane

---

## Performance budgets (Lighthouse 90+ wymagane)

| Metryka | Cel | Jak osiągamy |
|---------|-----|--------------|
| LCP | < 2.0s | Hero image preload, Google Fonts preconnect, no render-blocking JS |
| INP | < 200ms | Vanilla JS gdzie się da, React tylko w panelu klienta |
| CLS | < 0.05 | Hero image width/height explicit, font fallback metric matching |
| Total transfer | < 200KB initial | Tree-shake icons, no full font weights — tylko 2-3 |
| Time to Interactive | < 3s na 4G | Defer non-critical JS (consent banner, analytics, chat) |

Cloudflare Workers Free + Astro SSR + asset CDN = baseline pod te budgety.

---

## CMS schema — jak klient edytuje rich content (Sveltia)

**Sveltia CMS** = git-based CMS który zapisuje treści jako **markdown w GitHub repo klienta**. Klient w przeglądarce widzi formularz, Sveltia commituje pliki MD.

**Pytanie:** jak obsługujemy specjalne elementy magazynowe (drop caps, pull quotes, ornamenty inline, formatowanie pełnotekstowe)? Klient mikrofirma nie zna Markdown.

**Decyzja 2026-05-20:** **dedicated frontmatter fields** (Option D z briefu), NIE shortcodes ani MDX.

### Schema dla sekcji "Historia / O nas" (Magazynowy + opcjonalnie inne style)

`content/sections/historia.md`:
```yaml
---
title: "Pasta jak u babci. Z prawdziwej Toskanii."
authorByline: "— Marco Bocca, założyciel"
pullQuote: "Trattoria to nie restauracja. To zaproszenie do domu rodziny."
dropCapEnabled: true
heroImage: /uploads/marco-w-kuchni.jpg
heroImageCaption: "Marco Bocca, szef kuchni, codziennie sam robi pastę."
ornament: "fleuron"  # divider między paragrafami
---

# Marco od dziecka pomagał babci

Od kiedy pamiętam, kuchnia była sercem domu rodzinnego. Babcia Lucia uczyła mnie pasta, podając dla nas dni wszystkie. Z 12 lat zacząłem służyć kolacje sąsiadom...

(klient pisze zwykłe markdown — paragraphs, **bold**, *italic*, ## sekcje)
```

### W Sveltia CMS panel klienta widzi:

```
+----------------------------------------------+
| Sekcja: Historia / O nas                     |
|                                              |
| Tytuł nagłówka (h1):                         |
| [Pasta jak u babci. Z prawdziwej Toskanii.]  |
|                                              |
| Podpis autora (opcjonalnie):                 |
| [— Marco Bocca, założyciel]                  |
|                                              |
| Cytat wyróżniony / Pull quote (opcjonalnie): |
| [Trattoria to nie restauracja...]            |
|                                              |
| Włącz drop cap (duża 1. litera)?  [✓] TAK    |
|                                              |
| Zdjęcie nagłówkowe:                          |
| [Upload]  marco-w-kuchni.jpg                 |
| Podpis pod zdjęciem (italic):                |
| [Marco Bocca, szef kuchni...]                |
|                                              |
| Ornament dzielący paragrafy:                 |
| ( ) Brak  (•) Fleuron  ( ) 3 kropki  ( ) Diamond |
|                                              |
| Treść artykułu (markdown lub WYSIWYG):       |
| [Rich text editor 10 wierszy]                |
+----------------------------------------------+
```

### Render w Astro (Magazynowy)

`themes/editorial/sections/Historia.astro`:
```astro
---
import { getEntry } from "astro:content";
import Ornament from "@mixturemarketing/web-core/ornaments/Ornament.astro";

const entry = await getEntry("sections", "historia");
const { data, body } = entry;
---

<article class="historia-section">
  <h1>{data.title}</h1>

  {data.heroImage && (
    <figure>
      <img src={data.heroImage} alt={data.heroImageCaption ?? ""} />
      {data.heroImageCaption && <figcaption>{data.heroImageCaption}</figcaption>}
    </figure>
  )}

  {data.pullQuote && (
    <blockquote class="pull-quote">{data.pullQuote}</blockquote>
  )}

  <div class={data.dropCapEnabled ? "has-drop-cap" : ""} set:html={body} />

  {data.ornament !== "none" && <Ornament kind={data.ornament} />}

  {data.authorByline && <p class="author-byline">{data.authorByline}</p>}
</article>
```

CSS:
```css
.has-drop-cap > p:first-of-type::first-letter {
  font-family: var(--font-display);
  font-size: 5em;
  float: left;
  line-height: 0.85;
  margin: 0.1em 0.1em 0 0;
  color: var(--color-brand);
}

.pull-quote {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-style: italic;
  border-left: 3px solid var(--color-brand);
  padding-left: 1.5rem;
  margin: 2.5rem 0;
}
```

### Per styl użycie schemy "Historia"

- **Magazynowy** — sekcja KLUCZOWA, pre-enabled, drop cap default ON, ornament default "fleuron"
- **Elegancki** — opcjonalnie, drop cap OFF default, ornament OFF, używana dla "Nasza filozofia"
- **Czysty** — sekcja krótka "O nas" bez drop cap, bez ornamentu, max 200 słów
- **Dynamiczny** — anti-recommend (Dynamic nie ma "Historia" — Dynamic ma "Co robimy")

**Klient nie musi znać markdown.** Sveltia daje WYSIWYG editor dla `body` field (bold/italic/headings/lists). Specjalne elementy (pull quote, drop cap, ornament) to **toggle/select w formie**, nie w tekście.

---

## A11y (WCAG 2.2 AA minimum)

- **Contrast:** wszystkie kombinacje brand×brandFg muszą mieć ratio ≥4.5:1 (text) / ≥3:1 (UI). `contrastFg()` w registry już to liczy dla custom HEX.
- **Focus visible:** każdy interactive element ma widoczny focus ring (2px outline + offset 2px). Style-specific kolor (brand lub accent).
- **Keyboard:** wszystko dostępne klawiaturą; tab order logiczny (góra-dół, lewa-prawa).
- **Screen reader:** ikony decorative mają `aria-hidden="true"`, ikony funkcjonalne mają `aria-label`.
- **Skip link:** `[Pomiń nawigację → przejdź do treści]` jako first focusable (już mamy w web-core/a11y).
- **Forms:** każdy input ma `<label>` (nie placeholder-only), error messages mają `aria-describedby`.
- **Headings:** semantyczna hierarchia h1→h2→h3 bez przeskoków.

---

## Trust signals — globalny wymóg w 4 stylach

Każdy styl musi mieć **te elementy zaufania widoczne**:

1. **NIP + KRS w stopce** (B2B credibility w PL)
2. **Lata działania firmy** ("Od 2012 roku" lub "Założona 2019") — albo "Otwarta od 2026" honestly
3. **3+ realne opinie Google** (nie stock testimonials) — z imieniem, datą, źródłem
4. **Adres + telefon w stopce** (LocalBusiness schema markup)
5. **Polityka prywatności + Regulamin** linki w stopce
6. **SSL** badge nie potrzebny — kłódka w pasku adresu wystarcza, ale CF auto

Per styl różni się wizualnie (Elegancki = subtle, Dynamiczny = prominent badges), ale wszystkie obecne.

---

## Co klient zawsze może zmienić (we wszystkich stylach)

Z [TODO-styles-refactor-plan.md](../TODO-styles-refactor-plan.md):
- Styl (4 opcje)
- Wariant kolorystyczny (3 palety per styl)
- Kolor brand + akcent (custom HEX, auto-contrast)
- Para fontów (2-3 opcje per styl)
- Hero layout variant (centered / split / image-bg)
- Akcent buttonów (bold / soft / outline)
- Logo (PNG/JPG/SVG/WebP, max 500KB)
- Sekcje opcjonalne (Galeria / Menu / Cennik / Zespół / Historia / Wideo / FAQ — włącz/wyłącz, kolejność)
- Treść w CMS Sveltia (`/admin/`) — blog, FAQ, sekcje rich-text
- Tryb (Light / Dark — opcja per styl) ← **NOWE 2026**

---

## Co klient NIE może (świadomy lock)

- Custom CSS / HTML (security + maintenance hell)
- Dowolny kolor tła/tekstu/borderu (zostają z variant — kontrast WCAG)
- Dowolny font spoza listy (consistency)
- Zmiana układu sekcji opcjonalnych poza dispatcher (np. dwie galerie obok siebie)
- Zmiana nazwy firmy / NIP / branży / domeny — wymaga kontaktu z agencją

---

## Co dalej

1. Przeczytaj 4 briefy stylów: [Czysty](01-czysty.md), [Elegancki](02-elegancki.md), [Dynamiczny](03-dynamiczny.md), [Magazynowy](04-magazynowy.md)
2. Zatwierdź nazwy + zakresy lub zaproponuj zmiany
3. Po akceptacji → wracam do kodu od Fazy X.1 w głównym planie
