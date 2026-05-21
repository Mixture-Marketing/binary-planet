# System kolorów — palety predefined + auto-generation z brand color

> **Część refactor stylów (Faza X).** Companion do [00-master-design-system.md](00-master-design-system.md) i 4 briefów per-styl.
> **Decyzja Jakuba 2026-05-20:** klient widzi kolorowe kółka palet + preview stylu, ALBO podaje 1-2 kolory firmowe i system dobiera resztę. System dba o WCAG kontrast + harmonię kolorystyczną.

---

## TL;DR

3 ścieżki dla klienta przy wyborze kolorów (UI w `/ustawienia → Wygląd → Paleta`):

1. **Wybierz gotową paletę** — 3 predefinowane palety per styl (12 total) jako kolorowe kółka + preview wizualny
2. **Custom z 1 brand color** — klient wpisuje HEX swojej firmy, **system automatycznie generuje** całą paletę (accent, surface, text, border) z color theory + WCAG check
3. **Custom z 2 kolorów** — klient daje brand + accent, system dobiera resztę i ostrzega jeśli kontrast słaby

Wszystkie 3 ścieżki dają wyniki **WCAG 2.2 AA compliant** (kontrast ≥4.5:1 tekst, ≥3:1 UI). Klient nie może "zepsuć kolorystyki" bo system go pilnuje.

---

## Stack techniczny

### Biblioteka: `@material/material-color-utilities` (oficjalna Google)

[GitHub link](https://github.com/material-foundation/material-color-utilities). Oficjalna biblioteka Material You / Material 3 do generowania palet kolorów z jednego source color.

**Dlaczego ta:**
- Używa **HCT color space** (Hue, Chroma, Tone) — perceptually uniform jak OKLCH ale lepiej dla brand color generation
- **Z jednego HEX** generuje pełny scheme: primary/secondary/tertiary/error/neutral × 13 odcieni każdy
- **WCAG built-in** — tony są zaprojektowane żeby zawsze mieć właściwy kontrast
- **8 KB gzipped** — działa w Cloudflare Workers + Astro SSR
- **MIT license** — można używać w komercyjnym projekcie bez licencji
- Wsparcie dla **dark mode** automatycznie (każdy ton ma odpowiednik dark)

### Alternatywne biblioteki (rozważone)

| Biblioteka | Pro | Con | Decyzja |
|------------|-----|-----|---------|
| **@material/material-color-utilities** | Auto pełny scheme z 1 HEX, dark mode auto | Material You aesthetic dominuje | ✅ **DEFAULT** |
| **chroma.js** | Świetne color math, OKLCH support, popularna | Wymaga ręcznej logiki dla pełnej palety | Backup do custom calculations |
| **culori** | Najnowsze, ESM-first, lightweight, OKLCH native | Mniejsza społeczność, mniej presetów | Alternative dla advanced features |
| **Radix Colors** | 12-step automatic scales | Wymaga predefined source colors | Inspiracja, nie używamy bezpośrednio |
| **Poline** | Ciekawe esoteric palety | Za artystyczne dla businessów | NIE używamy |

---

## 3 ścieżki UX w panelu klienta

### Ścieżka 1: Predefined palette picker (default, najszybsze)

UI w `/ustawienia → Wygląd → Paleta`:

```
+----------------------------------------------+
| Wybierz paletę kolorów                       |
|                                              |
| ( ) [●●●●] mono-blue (default)               |
|         Granat + biel + orange accent        |
|         [Preview hero thumbnail]             |
|                                              |
| ( ) [●●●●] mono-black                        |
|         Czerń + biel + solar yellow          |
|         [Preview hero thumbnail]             |
|                                              |
| ( ) [●●●●] mono-emerald                      |
|         Zieleń + krem + stonowane złoto      |
|         [Preview hero thumbnail]             |
|                                              |
| ( ) [⊕] Dostosuj kolory mojej firmy ↓        |
+----------------------------------------------+
```

**Każde "kółko"** to row z 4-6 kolorowych circle (brand, accent, surface, surfaceMuted, text, border) + nazwa palety + jednolinijowy opis + miniatura hero (200×120px PNG generated podczas builda).

Klient klika radio → save → trigger rebuild.

### Ścieżka 2: Custom z 1 brand color (auto-generation)

Gdy klient kliknie "Dostosuj kolory mojej firmy" → ekran rozwija się:

```
+----------------------------------------------+
| Wpisz główny kolor firmy                     |
|                                              |
| [#c0392b]  [Color picker swatch]             |
|                                              |
| ✓ WCAG kontrast: 4.7:1 (AAA dla white text)  |
|                                              |
| Wygenerowana paleta (możesz dopracować):     |
| ●  Brand:    #c0392b   (twoja firma)         |
| ●  Accent:   #f39c12   (auto — orange)       |
| ●  Surface:  #ffffff   (auto)                |
| ●  Muted:    #faf6f5   (auto)                |
| ●  Text:     #1a0c08   (auto — kontrast OK)  |
| ●  Border:   #efe0dc   (auto)                |
|                                              |
| [Preview hero thumbnail]                     |
| [Preview services thumbnail]                 |
|                                              |
| [Zaakceptuj] [Wpisz drugi kolor]             |
+----------------------------------------------+
```

**Co system robi pod spodem (Material Color Utilities):**
1. `themeFromSourceColor(0xc0392b)` → generuje full scheme HCT
2. Brand = source color (klient mówi co)
3. Accent = secondary color z scheme (~120° hue shift z brand, harmonijne)
4. Surface = light tonal palette ton 99 (~biały z subtle brand tint)
5. SurfaceMuted = light tonal palette ton 95
6. Text = light tonal palette ton 10 (dark on light bg)
7. Border = light tonal palette ton 90
8. Dark mode = ten sam scheme z inverted tones (auto)

Wszystko **automatycznie** WCAG 2.2 AA compliant (Material 3 tones są pre-validated).

### Ścieżka 3: Custom z 2 kolorów (brand + accent override)

Klient klika "Wpisz drugi kolor" → rozwija się drugi picker:

```
+----------------------------------------------+
| Kolor akcentu (CTA, wyróżnienia)             |
|                                              |
| [#f39c12]  [Color picker swatch]             |
|                                              |
| ✓ Kontrast brand×accent: 3.2:1 (UI minimum)  |
| ⚠ Sugestia: użyj cieplejszego accent dla     |
|   lepszego kontrastu z brand                 |
|                                              |
| Pozostałe kolory (auto):                     |
| [...]                                        |
|                                              |
| [Zaakceptuj] [Wróć do 1 koloru]              |
+----------------------------------------------+
```

System:
- Liczy kontrast brand×accent — jeśli <3:1 ostrzega
- Liczy kontrast accent×text — jeśli <4.5:1 ostrzega
- Resztę palety dobiera z neutral tonal palette Material You

### Reset do palety motywu

Każda ścieżka ma "Wróć do palety motywu (mono-blue)" button — czyści custom HEX i przywraca predefined.

---

## Implementacja techniczna

### 1. Schema (już mamy częściowo)

`client.config.schema.ts`:
```typescript
theme: z.object({
  preset: z.enum(["minimalist", "elegant", "dynamic", "editorial"]),
  variant: z.string().min(1).max(40),        // 'mono-blue' lub 'custom-...'
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // NOWE: jeśli klient dał tylko 1 brand color, accent generujemy.
  // Jeśli dał 2, oba zapisujemy. Pozostałe (surface/text/border) zawsze auto.
})
```

### 2. Color generation helper

W `packages/web-core/src/theme/color-generator.ts`:

```typescript
import { themeFromSourceColor, hexFromArgb, argbFromHex } from "@material/material-color-utilities";

export function generatePaletteFromBrand(
  brandHex: string,
  accentHex?: string,
  isDark: boolean = false,
): ThemeTokens {
  const scheme = themeFromSourceColor(argbFromHex(brandHex));
  const colors = isDark ? scheme.schemes.dark : scheme.schemes.light;

  return {
    brand:        accentHex ? hexFromArgb(argbFromHex(brandHex)) : hexFromArgb(colors.primary),
    brandFg:      hexFromArgb(colors.onPrimary),
    accent:       accentHex ?? hexFromArgb(colors.secondary),
    surface:      hexFromArgb(colors.surface),
    surfaceMuted: hexFromArgb(colors.surfaceVariant),
    text:         hexFromArgb(colors.onSurface),
    textMuted:    hexFromArgb(colors.onSurfaceVariant),
    border:       hexFromArgb(colors.outlineVariant),
  };
}
```

### 3. Preview thumbnails

Per styl × per variant: pre-generated PNG 200×120 podczas builda (statyczne):
- `apps/panel/public/theme-previews/minimalist-mono-blue.png`
- `apps/panel/public/theme-previews/elegant-rose-cream.png`
- itd. (12 plików)

Generuje skrypt build-time przez Playwright screenshot każdego demo workera + crop hero.

### 4. Custom palette live preview (no rebuild needed)

Gdy klient zmienia HEX picker:
- JS generuje palette w przeglądarce (Material utilities client-side, też 8KB)
- Aktualizuje `<style>` z nowymi tokens
- Hero/services preview w iframe aktualizuje się live
- Klient widzi "tak będzie wyglądać" przed Save

### 5. WCAG check w UI

```typescript
function contrastRatio(hex1: string, hex2: string): number {
  // standard WCAG luminance ratio formula
}

// W UI:
const brandContrast = contrastRatio(brand, brandFg);
if (brandContrast < 4.5) {
  warn(`Kontrast tekstu na tle brand: ${brandContrast.toFixed(1)}:1 — może być trudny do czytania`);
}
if (brandContrast >= 7) {
  badge("AAA"); // best contrast
} else if (brandContrast >= 4.5) {
  badge("AA");  // acceptable
} else {
  badge("FAIL"); // disallow save
}
```

---

## Per-styl palette modifications

Każdy styl ma własną "neutralność tła" — system bierze to pod uwagę przy generacji:

| Styl | Surface base | Charakterystyka |
|------|--------------|-----------------|
| **Czysty** | Pure white `#ffffff` lub cool grey `#fafafa` | Maksymalnie neutralna |
| **Elegancki** | Warm cream `#fdfaf6` lub ivory `#fbf9f4` | Ciepło-pastelowy bias |
| **Dynamiczny** | Pure white LUB pure black (dark variant) | Maksymalny kontrast |
| **Magazynowy** | Warm cream `#fef8f0` z lekkim tan tint | "Papier magazynu" feel |

W color-generator: dla każdego stylu parametr `surfaceBias` modyfikuje wygenerowany surface ton (Czysty=0, Elegancki=+5 warm, Dynamiczny=0, Magazynowy=+8 warm).

---

## Predefinowane palety (wszystkie 12 — referencja)

Z briefów per styl, zebrane razem (HEX + opis):

### Czysty (Minimalist)
- `mono-blue` — Granat #0a4cff + biel + orange accent #ff5c1f
- `mono-black` — Czerń #0a0a0a + biel + solar yellow #fbbf24
- `mono-emerald` — Zieleń #0d5d3b + krem + złoto #b8945f

### Elegancki (Elegant)
- `rose-cream` — Dusty rose #c4546d + krem + antique gold #b08d57
- `sage-ivory` — Szałwia #5d7560 + kość słoniowa + honey gold #c9a96e
- `mocha-blush` — Mocha #6b4423 + pale cream + bronze #d4a574

### Dynamiczny (Dynamic)
- `red-action` — Czerwień #dc2626 + biel + solar yellow #fbbf24
- `electric-blue` — Electric blue #1d4ed8 + biel + magenta #ec4899
- `neon-noir` — Cyan #00ffd1 + czerń + orange neon #ff9500 (dark default)

### Magazynowy (Editorial)
- `forest-amber` — Forest green #2d4a36 + warm cream + amber #c47a2e
- `slate-rose` — Slate #475569 + stone + muted rose #be5a6e
- `cream-cobalt` — Cobalt #1e40af + cream + orange burnt #d97706

---

## Color suggestion presets (dla autosuggestion w panelu)

Gdy klient wpisze 1 brand color, oprócz Material You auto-generation, sugerujemy też **harmonie kolorystyczne** wg color theory:

| Typ harmonii | Co to | Generacja |
|--------------|-------|-----------|
| **Monochromatyczna** | Brand + jego odcienie tylko | accent = brand z -20% saturation |
| **Komplementarna** | Brand + przeciwny na color wheel | accent = brand + 180° hue |
| **Analogiczna** | Brand + sąsiad na color wheel | accent = brand + 30° hue |
| **Triadyczna** | 3 kolory równo rozmieszczone | accent = brand + 120° hue |
| **Split-complementary** | Brand + 2 sąsiedzi przeciwnego | accent = brand + 150° hue |

UI:
```
Sugerowane warianty accent:
[●] Monochromatyczna (#a0322c — burgund)
[●] Komplementarna (#2cc0b8 — turquoise)  ← najmocniejszy kontrast
[●] Analogiczna (#c08e2c — burgund-gold)
[●] Triadyczna (#2cc032 — emerald)
```

Klient klika sugestię → accent się ustawia → preview update.

---

## Edge cases / failsafes

| Edge case | Reakcja systemu |
|-----------|-----------------|
| Klient wpisze nieprawidłowy HEX (#xy11) | Walidacja regex, error inline |
| Klient wybierze brand który ma <4.5:1 z białym (np. jasny żółty `#ffeb3b`) | System sugeruje "Tekst będzie trudny do czytania — czy chcesz ciemny tekst zamiast białego?" (auto-switch brandFg) |
| Klient wybierze custom brand + accent z kontrastem <2:1 (np. dwa pastele) | Ostrzeżenie + dezaktywacja Save dopóki nie poprawi (HARD GATE) |
| Klient wybierze 100% czerni + 100% białego | OK — to klasyczny Czysty mono-black |
| Klient wybierze 2 odcienie brand (mono shift) | OK — to monochromatyczna paleta, ostrzeżenie tylko że "Twoja paleta jest spójna, ale brakuje akcentu — rozważ kolor uzupełniający" |
| Klient resetuje custom | Wraca do predefined variant ostatnio zapisanego (lub default jeśli pierwszy raz) |

---

## Dark mode integration

Material Color Utilities **z definicji** generuje też dark variant — taki sam scheme, ale ze swapem light↔dark tonów. Klient w `/ustawienia → Wygląd` ma toggle:

```
Tryb strony:
( ) Tylko jasny    (default)
( ) Tylko ciemny   (np. dla siłowni, klubu)
(•) Automatyczny   (zgodnie z systemem użytkownika — preferred-color-scheme)
```

Auto-tryb = `<html data-theme="auto">` + CSS media query `prefers-color-scheme: dark` zamienia tokens. Klient nie musi nic robić — Material Color Utilities zwróci 2 schemy (light + dark), Astro inline'uje oba.

---

## Workflow build → save → render

```
1. Klient w /ustawienia wybiera paletę (Path 1, 2 lub 3)
   │
   ▼
2. JS live-preview update (Material Color Utilities w przeglądarce)
   │
   ▼
3. Klient klika "Zapisz"
   │
   ▼
4. POST /api/settings/save  kind="theme"
   - body: { preset, variant, brandColor, accentColor, darkMode }
   - walidacja Zod (HEX regex, contrast minimum)
   - UPDATE config_json.theme w D1
   │
   ▼
5. /api/admin/addons/deploy-trigger
   - SELECT config_json
   - wrapConfigAsTs() → nowy client.config.ts
   - githubCommitFile() do klient repo
   - cfDeployWorker() → workflow_dispatch
   │
   ▼
6. GH Actions build:
   - apps/starter/src/themes/registry.ts importuje generatePaletteFromBrand()
   - Jeśli brandColor/accentColor w config → auto-generuje tokens
   - Jeśli nie → bierze predefined variant z registry
   │
   ▼
7. wrangler deploy
   │
   ▼
8. Strona klienta live z nową paletą (~2 min)
```

---

## Otwarte pytania do Ciebie

1. **Material Color Utilities OK?** — Czy zgadza się że używamy tej biblioteki (Google, MIT, 8KB, używana przez Android/Web/Flutter)? Alternatywa: chroma.js + własna logika (więcej kodu, ale więcej kontroli nad efektem). **Rekomendacja: Material.**

2. **Tryb auto / light / dark** — domyślny tryb dla nowych klientów: `auto` (zgodnie z systemem użytkownika), `light` (tradycyjne, safer), czy `light + dark mode toggle button` widoczny w nawigacji strony klienta? **Rekomendacja: auto + toggle widoczny.**

3. **Preview thumbnails** — generujemy 12 statycznych PNG (build-time Playwright screenshots) ALBO **mini live preview iframe** w panelu który pokazuje aktualną paletę na uproszczonej stronie testowej? Iframe = bardziej "wow" ale 2× więcej pracy. **Rekomendacja: PNG statyczne na start, iframe w Fazie 2.**

4. **Live preview podczas wyboru custom HEX** — `<style>` swap w przeglądarce (klient widzi natychmiast) czy "Zapisz potem zobaczysz" (~2 min rebuild)? Pierwsze = lepszy UX, więcej kodu JS. **Rekomendacja: live preview w panelu, bez rebuilda dopóki klient nie kliknie Zapisz.**

5. **Color harmony suggestions** — czy implementujemy 5 typów harmonii (monochrom/komplementarna/...) w v1 czy zostawiamy tylko Material You auto? **Rekomendacja: Material w v1, harmony suggestions w Fazie 2.**

---

**Następny brief:** masz teraz 5 plików (00-master + 4 style + 05-color). Zobacz [TODO-styles-refactor-plan.md](../TODO-styles-refactor-plan.md) dla pełnej mapy.
