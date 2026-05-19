# Mixture Visual Design System — Reference for AI Agents

> **Cel pliku:** zachowanie spójności wizualnej między `mixturemarketing.pl` a kolejnymi aplikacjami firmy (Binary Planet i inne).
> Ten plik jest skierowany do agentów AI implementujących UI. Reguły są **opisowe**, nie sugestywne — stosuj je dosłownie, chyba że ekran wymaga jawnego odstępstwa.
>
> **Stack referencyjny:** React 19 + Tailwind CSS v4 + lucide-react (ikony).
> Jeśli budujesz w innym frameworku (Astro/Svelte/Next), zachowaj tokeny (kolory, font-stack, radius, shadows, motion) — komponenty zaimplementuj po swojemu, ale z identycznym wyglądem.

---

## 1. DNA marki — 30-sekundowy brief

- **Charakter:** "techniczna precyzja + kreatywny luz". Nowoczesny B2B z duszą software house'u, ale nie corpo-suchy.
- **Mood:** confident, lekki, glass-morphism dawkowany oszczędnie, dużo białej przestrzeni, soft gradients.
- **Antywzorce:** unikaj ciemnych UI jako default'a, neonowych cyberpunkowych akcentów, agresywnego "bro tech" toolkitu (cyan + matrix green), płaskich Bootstrap-like layoutów.
- **Język komunikacji:** drugoosobowy ("dla Ciebie", "rozwiążemy"), konkrety nad ozdobnikami, polskie znaki obowiązkowe, liczby zamiast superlatyw ("od 3 900 zł" zamiast "atrakcyjna cena").

---

## 2. Color tokens (single source of truth)

Wszystkie kolory są w `index.css` jako CSS variables w bloku `@theme` (Tailwind v4 native syntax). Skopiuj 1:1 do nowego projektu:

```css
@theme {
  /* PRIMARY PALETTE — używaj tylko tych do akcentów i CTA */
  --color-primary: #61b6de;        /* blue — accents, hover glows, primary CTA tint */
  --color-accent-dark: #3a8fb7;    /* primary darker — hover states on primary */
  --color-secondary: #3f3d91;      /* indigo — main buttons background, brand "voice" */
  --color-dark: #213261;           /* navy — headings, body emphasis */

  /* SEMANTIC */
  --color-success: #00c853;        /* green — confirmations only */
  --color-instagram: #e1306c;      /* pink — social accent, rarely standalone */

  /* BRAND ALIASES (semantyczne kopie powyższych) */
  --color-brand-blue: #61b6de;
  --color-brand-indigo: #3f3d91;
  --color-brand-navy: #213261;
  --color-brand-pink: #e1306c;
  --color-brand-green: #00c853;
  --color-brand-yellow: #f4b400;   /* tylko jako warning / amber pin */

  /* SURFACES */
  --color-deep-dark: #0b1120;      /* footer i ciemne reverse sections */
  --color-light-gray: #f9fafb;     /* body background light variant */
  --color-slate-dark: #0f172a;     /* alt dark surface */
  --color-slate-border: #1e293b;

  /* HIGH-CONTRAST GRAYS (WCAG AA na light bg) */
  --color-gray-400: #4b5563;       /* zamieniliśmy default Tailwind 400 (#9ca3af) */
  --color-gray-500: #374151;       /* zamieniliśmy default Tailwind 500 (#6b7280) */
}
```

### Użycie kolorów — reguły

| Kontekst | Token |
|---|---|
| Tło sekcji domyślnej | `bg-gray-50` (#F9FAFB) lub `bg-white` |
| Tło sekcji ciemnej / footera | `bg-[#0B1120]` lub `bg-dark` |
| Heading 1-3 | `text-dark` |
| Body text | `text-gray-700` (#374151 wg overrideu) |
| Caption / meta | `text-gray-500` lub `text-gray-600` |
| Link inline w tekście | `text-primary hover:underline` |
| Primary CTA background | `bg-gradient-to-br from-secondary to-[#5A58AD]` |
| Border subtle | `border-gray-100` na light bg, `border-white/5` na dark |
| Glow / accent na hover primary CTA | `shadow-[0_8px_25px_-5px_rgba(97,182,222,0.6)]` |

**ZAKAZ:** używania default Tailwind grays bez świadomej decyzji — masz nadpisane `gray-400/500` dla WCAG. Default'owe pure grays (np. text-gray-400 dla tekstu) zawalą kontrast.

---

## 3. Typography

**Font stack:** system font stack (brak custom webfont) — Tailwind v4 default `font-sans` jest celowo akceptowany. To wybór performance'owy: brak font-loading delay, brak FOIT/FOUT, dobry rendering na każdym OS.

```css
font-family:
  ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Jeśli **musisz** dodać webfont w nowej aplikacji — wybierz **Inter Variable** (preload + `font-display: swap`). Nie używaj fontów dekoracyjnych dla headingów.

### Scale (Tailwind classes)

| Element | Klasa | Rendered |
|---|---|---|
| Display (Hero H1) | `text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.05] md:leading-[0.95]` | 36px → 96px |
| H1 page | `text-4xl md:text-6xl font-extrabold leading-tight` | 36px → 60px |
| H2 section | `text-3xl md:text-4xl font-bold` | 30px → 36px |
| H3 card | `text-xl md:text-2xl font-bold` | 20px → 24px |
| Body large (lead) | `text-xl text-gray-700 leading-relaxed font-medium` | 20px |
| Body | `text-base text-gray-700` | 16px |
| Caption | `text-sm text-gray-600` | 14px |
| Micro / chip | `text-xs font-bold uppercase tracking-wider` lub `text-xxs font-black uppercase tracking-[0.2em]` | 12 / 10px |

**Custom font sizes (zdefiniowane w `@theme`):**
- `--font-size-xxs: 0.625rem` (10px) — chipy, eyebrow text
- `--font-size-xxxs: 0.5rem` (8px) — tylko legal/meta

**Weight scale:** `font-medium` (500), `font-semibold` (600), `font-bold` (700), `font-extrabold` (800), `font-black` (900). NIE używaj `font-light` (300) ani `font-thin` (100) — wyglądają mizernie na rozdzielczościach <2x.

**Letter-spacing dla uppercase chip:** `tracking-[0.2em]` to brand-defining detail. Każdy badge / eyebrow ma to tracking.

---

## 4. Spacing & layout

- **Container:** `container mx-auto px-4 sm:px-6 lg:px-8` lub własny komponent `<Container>` (max-w-screen-2xl).
- **Section padding:** `py-20 md:py-24` (pionowo), domyślnie `pt-32` jeśli pierwsza sekcja pod fixed nav.
- **Grid gap:** `gap-6 md:gap-8` dla kart, `gap-12` dla większych bloków.
- **Card padding:** `p-6 md:p-8` (zwykłe), `p-8 md:p-12` (premium / hero cards).
- **Border radius scale:**
  - `rounded-xl` (12px) — chipy, buttony secondary, inputy
  - `rounded-2xl` (16px) — KARTY domyślne ★
  - `rounded-3xl` (24px) — premium cards, hero containers, CTA bands
  - `rounded-full` — primary CTA buttons, pill chips, ikony okrągłe

---

## 5. Shadows / elevation

Tylko 3 warstwy:

| Poziom | Klasa | Use case |
|---|---|---|
| **Subtle** | `shadow-sm` | Karty na białym tle, statyczne |
| **Medium** | `shadow-lg` | Karty hover / floating elements |
| **Strong premium** | `shadow-2xl` lub custom `shadow-[0_20px_40px_-15px_rgba(97,182,222,0.2)]` | Modale, hero cards, primary CTA hover glow |

**Hover lift:** `motion-safe:hover:-translate-y-1` + zmiana shadow. To brand-defining microinteraction — stosuj na wszystkich klikalnych kartach.

**ZAKAZ:** ciężkich black drop-shadows. Cienie zawsze z brand-blue tint na hover (jak primary glow powyżej).

---

## 6. Komponenty — wzorce

### 6.1 Button (5 wariantów)

```tsx
// Source of truth: components/common/Button.tsx
const baseStyles =
  'inline-flex items-center justify-center font-bold rounded-full transition-all duration-300 transform active:scale-95 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#213261] focus:ring-offset-[#F5F7FA]';

const sizeStyles = {
  sm: 'px-6 py-3 text-sm',
  md: 'px-8 py-3 text-base',
  lg: 'px-10 py-4 text-lg',
};

const variantStyles = {
  primary:
    'bg-gradient-to-br from-secondary to-[#5A58AD] text-white shadow-lg ' +
    'hover:shadow-[0_8px_25px_-5px_rgba(97,182,222,0.6)] motion-safe:hover:-translate-y-1',
  secondary:
    'bg-transparent border-2 border-secondary text-secondary ' +
    'hover:bg-secondary hover:text-white hover:shadow-lg motion-safe:hover:-translate-y-1',
  outline:
    'border-2 border-secondary text-secondary hover:bg-secondary hover:text-white',
  ghost:
    'text-secondary hover:text-accent-dark hover:bg-secondary/5',
  white:
    'bg-white text-secondary hover:bg-gray-50 shadow-lg hover:shadow-xl ' +
    'motion-safe:hover:-translate-y-1',
};
```

**Reguły:**
- `primary` — TYLKO główne CTA per sekcja (max 1)
- `secondary` — drugorzędne CTA obok primary (np. "Zobacz cennik")
- `outline` — w blokach z białym tłem na ciemnych sekcjach
- `ghost` — w kartach jako "Czytaj więcej"
- `white` — na ciemnych tłach (footer CTA, dark hero)
- Icon z `lucide-react` — domyślnie po prawej (`iconPosition="right"`), z auto-translate na hover
- ZAWSZE `rounded-full` (capsule shape)

### 6.2 GlassCard

```tsx
// Source: components/common/GlassCard.tsx
<div className="
  relative overflow-hidden
  bg-white/70 backdrop-blur-md
  border border-white/50
  shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]
  rounded-2xl
  transition-all duration-300
  motion-safe:hover:scale-[1.02]
  motion-safe:hover:border-primary
  motion-safe:hover:shadow-[0_20px_40px_-15px_rgba(97,182,222,0.2)]
">
  {/* zawartość */}
</div>
```

Używaj **tylko** w sekcjach z `<AmbientBackground />` lub z gradient'owym tłem (efekt glass widać tylko gdy jest co rozmywać). Na czystym białym GlassCard nie ma sensu — użyj zwykłej karty `bg-white shadow-sm border border-gray-100 rounded-2xl`.

### 6.3 Zwykła karta (default workhorse)

```html
<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100
            hover:shadow-lg hover:border-primary/30 transition-all">
  <div class="w-12 h-12 bg-[#F0F7FF] text-secondary rounded-xl
              flex items-center justify-center mb-4">
    <Icon size={24} />
  </div>
  <h3 class="font-bold text-lg mb-2">Tytuł</h3>
  <p class="text-sm text-gray-600">Opis</p>
</div>
```

Wzorzec używany ~80% miejsc. Ikon tile `w-12 h-12 bg-[#F0F7FF] text-secondary rounded-xl` jest brand-defining.

### 6.4 Eyebrow chip (badge)

```html
<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full
            bg-blue-100 text-blue-800 text-sm font-bold uppercase
            tracking-wider mb-6">
  <Icon size={16} />
  <span>Kategoria · Lokalizacja</span>
</div>
```

Kolor zależy od sekcji: `bg-blue-100 text-blue-800` (web), `bg-violet-100 text-violet-800` (SEO/marketing), `bg-pink-100 text-pink-800` (interactive/branding), `bg-emerald-100 text-emerald-700` (success/case study), `bg-orange-100 text-orange-700` (produkcja/przemysł), `bg-indigo-100 text-indigo-700` (IT/software).

### 6.5 Gradient text (brand headlines)

```html
<span class="text-transparent bg-clip-text
             bg-gradient-to-r from-primary to-secondary">
  Słowo akcentowe
</span>
```

Stosuj na 1 słowo w H1 hero (nie więcej). Na inne H1/H2 → solid `text-dark`.

### 6.6 CTA band (sekcja końcowa)

```html
<div class="bg-dark rounded-3xl p-12 text-white relative overflow-hidden">
  <div class="relative z-10">
    <h2 class="text-3xl md:text-4xl font-bold mb-6">Headline</h2>
    <p class="text-xl text-blue-100 mb-8 max-w-2xl">Opis</p>
    <Button variant="primary">Akcja</Button>
  </div>
  <div class="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64
              bg-primary rounded-full opacity-20 blur-3xl"></div>
  <div class="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64
              bg-secondary rounded-full opacity-40 blur-3xl"></div>
</div>
```

To brand-defining final-CTA pattern: ciemne tło + 2 blob'y blur jako accent. Replikuj w każdej dłuższej podstronie.

### 6.7 Premium gradient card (linked CTA)

```html
<div class="bg-gradient-to-br from-violet-50 to-white rounded-3xl
            p-8 md:p-12 border border-violet-100">
  <!-- 2-column grid: text + sub-card -->
</div>
```

Kolor gradientu dobierz do kontekstu (violet dla SEO, blue dla web dev, pink dla brand). Zawsze `from-{kolor}-50 to-white border-{kolor}-100`.

---

## 7. Ikony

**Biblioteka:** `lucide-react` (jedyna dopuszczona). Nie mieszaj z Heroicons / Phosphor / Font Awesome.

**Rozmiary:**
- W chipie: `size={14}` lub `size={16}`
- W tile karty: `size={24}`
- W hero / decorative: `size={28-32}`

**Stroke:** używaj defaultu (1.5px). Nie zmieniaj strokeWidth.

**Kolor:** dziedziczy z parenta przez `text-{color}` Tailwind. Najczęściej `text-primary` lub `text-secondary` na ikonach akcentujących.

---

## 8. Motion / animacje

**Domyślny timing:** `transition-all duration-300` (300ms ease).

**Brand microinteractions (zachowaj 1:1):**
1. Hover lift karta: `motion-safe:hover:-translate-y-1` + shadow upgrade
2. Hover scale CTA primary: `motion-safe:hover:-translate-y-1`
3. Click feedback: `active:scale-95`
4. Icon translate w button: `motion-safe:group-hover:translate-x-1` (right icon) / `-translate-x-1` (left icon)
5. Reveal on scroll: dedykowany komponent `AnimateOnScroll` (intersection observer + opacity + translateY). Stagger przez `delay={index * 100}`.

**Custom keyframes** (w `@theme`):
- `--animate-fade-in-up`: użyj w hero descriptions
- `--animate-blob`: do dekoracji blob w hero/CTA
- `--animate-shimmer`: do loading skeleton
- `--animate-marquee`: tylko logo-wall / testimonial slider

**Defer:** użyj `useDeferUntilLoad` (custom hook) dla animacji decorative (post-LCP). Animacja przed `window.load` zabija LCP.

**Accessibility:** ZAWSZE `motion-safe:` prefix na hover transforms (respektuje `prefers-reduced-motion`).

---

## 9. Patterns / nawyki dobre i złe

### Rób tak ✅

- **Section divider:** każda sekcja = `<AnimateOnScroll>` wrapper + section padding `py-20 md:py-24` + container.
- **Hero ma 1 H1** z 3 liniami: line1 (text-dark), line2 (text-dark), line3 (gradient text) — patrz HERO_CONTENT.title struktura.
- **CTA wertykalne stacking na mobile** (`flex-col sm:flex-row`), zawsze full-width `w-full sm:w-auto` na mobile.
- **Micro-copy pod CTA**: pill chips uppercase z `text-xxs font-black tracking-[0.2em] text-gray-600` (np. "Wycena 24h • Bez zobowiązań").
- **Forms:** input `rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20`.
- **Trust signals**: ambient/decorative jako `opacity-50 group-hover:opacity-100 grayscale group-hover:grayscale-0`.

### Nie rób tak ❌

- Black drop shadows (`shadow-black/40` etc.) — używaj tinted brand shadows.
- Cyan / mint / teal (≠ brand-blue #61B6DE). Brand-blue jest "miękki" — nie zastępuj go cyanem.
- Default Tailwind text-gray-400 dla content text — kontrast WCAG fail.
- Border radius `rounded-md` / `rounded` (8px / 4px) na kartach. Brand używa 16/24/full.
- Gradient text na całym H1 (tylko 1 słowo akcentu).
- Custom Material-style buttons (elevation, ripple). Trzymaj capsule + lift.
- Emoji w UI (zachowuj profesjonalizm B2B). Ikony lucide zamiast 🚀.

---

## 10. Dark mode (jeśli będzie potrzebny)

`mixturemarketing.pl` jest light-only — celowo. Jeśli Binary Planet wymaga dark mode:

- Surface: `bg-slate-dark` (#0F172A) lub `bg-deep-dark` (#0B1120) jako body bg
- Card: `bg-slate-800 border-slate-700`
- Text: `text-slate-100` / `text-slate-300` / `text-slate-400`
- Akcenty kolorów **bez zmian** — primary #61B6DE i secondary #3F3D91 działają na dark bg
- Border: `border-white/5` lub `border-slate-700`
- Glow hover na primary: identyczna formuła `shadow-[0_8px_25px_-5px_rgba(97,182,222,0.6)]`

**Test:** każdy ekran w dark mode musi mieć **min 1 element brand-blue** widoczny. Inaczej staje się generycznym dark UI.

---

## 11. Brand voice (copywriting hooks)

Wpływa na UI o tyle, że mikrokopia musi być spójna:

- **CTA primary:** czasownik w 2. os. + obiekt. "Oblicz koszt projektu", "Zamów audyt", "Umów konsultację" (nie: "Kliknij tutaj", "Wyślij", "OK").
- **Mikrokopia pod CTA:** social proof + brak ryzyka. "Wycena 24h • Bez zobowiązań", "Bezpłatna konsultacja 45-60 min".
- **Empty state / loading:** konkrety zamiast "Ładowanie…". "Liczę widełki cenowe…", "Sprawdzam dostępność terminów…".
- **Error:** "Coś poszło nie tak. Spróbuj ponownie lub napisz na info@…" (nie: "Error 500").

---

## 12. Plik referencyjny — co jeszcze warto skopiować

Z repo `mixturemarketing.pl` warto pożyczyć 1:1 do nowej aplikacji:

| Plik | Zastosowanie |
|---|---|
| `components/common/Button.tsx` | Master button komponent — 5 wariantów |
| `components/common/GlassCard.tsx` | Glass effect card |
| `components/common/Container.tsx` | Max-width container |
| `components/common/AmbientBackground.tsx` | Blob backgrounds dla hero/sections |
| `components/common/AnimateOnScroll.tsx` | Intersection observer reveal |
| `components/common/TextReveal.tsx` | Hero H1 stagger reveal |
| `hooks/useDeferUntilLoad.ts` | Animation defer post-LCP |
| `index.css` (sekcja `@theme`) | Wszystkie design tokens |

---

## 13. Checklist dla AI agenta budującego nowy ekran

Zanim oddasz ekran do code review, sprawdź:

- [ ] Wszystkie kolory pochodzą z `@theme` tokens (nie hex'e ad-hoc w className)
- [ ] Heading hierarchy: 1× H1, sensowna kolejność H2 → H3
- [ ] Karty mają `rounded-2xl` (16px), nie `rounded-md`
- [ ] CTA primary jest dokładnie 1 na sekcję
- [ ] Wszystkie hover transitions mają `motion-safe:` prefix
- [ ] Ikony są z `lucide-react`, rozmiar 14/16/24/32
- [ ] Padding sekcji: `py-20 md:py-24`
- [ ] Mobile-first: testowane w 375px wide
- [ ] Body text contrast ≥ 4.5:1 (WCAG AA)
- [ ] Focus ring widoczny: `focus:ring-2 focus:ring-[#213261]`
- [ ] Brak emoji w produkcyjnym UI
- [ ] CTA copy w 2. os. ("Zamów", "Sprawdź"), nie "Kliknij"

---

## 14. Quick-look reference (kopiuj-wklej)

**Hero section starter:**

```jsx
<section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-gray-50 pt-32 pb-20">
  <AmbientBackground />
  <Container className="relative z-10">
    <div className="text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                      bg-blue-100 text-blue-800 text-xs font-bold uppercase
                      tracking-[0.2em] mb-6">
        <Sparkles size={14} /> <span>Eyebrow · Lokalizacja</span>
      </div>
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-dark
                     leading-tight mb-6">
        Główny nagłówek z{' '}
        <span className="text-transparent bg-clip-text
                         bg-gradient-to-r from-primary to-secondary">
          akcentem
        </span>
      </h1>
      <p className="text-xl text-gray-700 leading-relaxed font-medium mb-10 max-w-2xl mx-auto">
        Lead paragraph 1-2 zdania.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="primary" size="lg" icon={<ArrowRight size={20} />}>
          Główne CTA
        </Button>
        <Button variant="secondary" size="lg">Drugorzędne CTA</Button>
      </div>
    </div>
  </Container>
</section>
```

**Standard 3-column features:**

```jsx
<section className="py-20 md:py-24 bg-gray-50">
  <Container>
    <div className="text-center max-w-3xl mx-auto mb-16">
      <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">Section title</h2>
      <p className="text-lg text-gray-600">Section subtitle</p>
    </div>
    <div className="grid md:grid-cols-3 gap-6 md:gap-8">
      {features.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="bg-white p-6 rounded-2xl shadow-sm
                                    border border-gray-100 hover:shadow-lg
                                    hover:border-primary/30 transition-all">
          <div className="w-12 h-12 bg-[#F0F7FF] text-secondary rounded-xl
                          flex items-center justify-center mb-4">
            <Icon size={24} />
          </div>
          <h3 className="font-bold text-lg mb-2 text-dark">{title}</h3>
          <p className="text-sm text-gray-600">{desc}</p>
        </div>
      ))}
    </div>
  </Container>
</section>
```

---

**Wersja:** 2026-05-19 · stan zgodny z `mixturemarketing.pl` (commit `main`)
**Maintainer:** sync z `D:\KOD\Mixture\MixtureMarketing-stona\index.css` i `components/common/`
