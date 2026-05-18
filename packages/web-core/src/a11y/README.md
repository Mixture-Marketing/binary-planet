# @mixturemarketing/web-core/a11y

Accessibility primitives — WCAG 2.1 AA compliance helpers. Track A11y done.

**Status:** v0.0.1 funkcjonalny. **8 komponentów + 3 helpery + 2 CSS utilities + 1 contrast calc.** 70 testów.

Targets:
- axe-core **0 violations** w generated HTML
- WCAG 2.1 **AA** (4.5:1 contrast, full keyboard nav, landmark structure)
- Manual **NVDA / VoiceOver** verification

**Design:** pure TypeScript, framework-agnostic. HTML helpers zwracają stringi, runtime helpers operują na istniejącym DOM. Astro/React wrapuje wedle potrzeby.

## API surface

### Static (HTML / CSS generation — SSR-safe)

| Function | Returns | Purpose |
|----------|---------|---------|
| `skipLink(opts?)` | `{html, css}` | "Przejdź do treści głównej" link (WCAG 2.4.1) |
| `visuallyHidden(text)` | `string` (HTML) | Wrap text w sr-only span |
| `VISUALLY_HIDDEN_CSS` | `string` (CSS) | .sr-only + .visually-hidden + focusable variants |
| `SR_ONLY_CLASS` | `"sr-only"` | Constant |
| `focusVisibleStyles(opts?)` | `string` (CSS) | :focus-visible only outlines (WCAG 2.4.7) |
| `accessibleIcon({icon, label})` | `string` (HTML) | Icon + sr-only label dla icon-only buttons |
| `decorativeIcon(icon)` | `string` (HTML) | Icon w aria-hidden span (label gdzieś indziej) |
| `buildBreadcrumbHtml(items, opts?)` | `string` (HTML) | Nav + ol z aria-current=page, separator aria-hidden |
| `BREADCRUMB_CSS` | `string` (CSS) | Default breadcrumb styling |
| `landmarkAttrs(role, label?)` | `Record<string, string>` | ARIA role + aria-label attrs |
| `renderAttrs(attrs)` | `string` | Render attribute map as HTML string |
| `LANDMARK_ROLES` | constant map | banner/navigation/main/complementary/contentinfo/search/form/region |

### WCAG contrast calculator

| Function | Returns | Purpose |
|----------|---------|---------|
| `contrastRatio(fg, bg)` | `number ≥ 1.0` | WCAG ratio formula |
| `checkContrast(fg, bg)` | `ContrastReport` | Pełen report z grade AAA/AA/AA-large/fail |
| `meetsAA(ratio)` | `boolean` | ≥4.5 (normal text) |
| `meetsAALarge(ratio)` | `boolean` | ≥3.0 (≥18pt or ≥14pt bold) |
| `meetsAAA(ratio)` | `boolean` | ≥7.0 |
| `meetsAAALarge(ratio)` | `boolean` | ≥4.5 |
| `parseHex(hex)` | `RGB` | #fff, #ffffff, #ffffff80 |
| `parseColor(input)` | `RGB` | hex OR rgb(...) OR rgba(...) |
| `relativeLuminance(rgb)` | `number 0..1` | WCAG dfn-relative-luminance |

### Motion preference

| Function | Returns | Purpose |
|----------|---------|---------|
| `prefersReducedMotion()` | `boolean` | SSR-safe matchMedia check |
| `onReducedMotionChange(cb)` | `cleanup fn` | Subscribe to OS-level changes |
| `conditionalAnimationCss({full, reduced})` | `string` (CSS) | @media (prefers-reduced-motion) branches |

### Runtime (require DOM — call from `<script>` w Astro/browser)

| Function | Returns | Purpose |
|----------|---------|---------|
| `focusTrap(container, opts?)` | `cleanup fn` | Modal focus trap z Esc + Tab cycling + restore previous |
| `findFocusable(container)` | `HTMLElement[]` | List focusable descendants |
| `createLiveRegion(opts?)` | `LiveRegion` | aria-live=polite element + announce() / clear() / destroy() |
| `createDisclosure(trigger, content, opts?)` | `DisclosureController` | aria-expanded toggle + auto aria-controls |
| `autoWireDisclosures(root?)` | `cleanup fn` | Auto-wire wszystkich `[data-disclosure-trigger="id"]` |

## Quick start

### Astro: skip link + landmarks

```astro
---
import { skipLink, VISUALLY_HIDDEN_CSS, focusVisibleStyles } from "@mixturemarketing/web-core/a11y";

const sl = skipLink({ targetId: "main" });
---
<style is:global>{VISUALLY_HIDDEN_CSS}</style>
<style is:global>{sl.css}</style>
<style is:global>{focusVisibleStyles({ outlineColor: "var(--color-brand)" })}</style>

<body>
  <Fragment set:html={sl.html} />
  <main id="main" tabindex="-1">
    <slot />
  </main>
</body>
```

### Modal z focus trap

```astro
<button data-open-modal>Otwórz</button>
<div id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
  <h2 id="modal-title">Tytuł</h2>
  <button data-close-modal>Zamknij</button>
  ...
</div>

<script>
  import { focusTrap } from "@mixturemarketing/web-core/a11y";

  const modal = document.getElementById("modal")!;
  const openBtn = document.querySelector("[data-open-modal]")!;
  const closeBtn = document.querySelector("[data-close-modal]")!;
  let cleanup: (() => void) | null = null;

  openBtn.addEventListener("click", () => {
    modal.removeAttribute("hidden");
    cleanup = focusTrap(modal, {
      onEscape: () => closeBtn.click(),
    });
  });

  closeBtn.addEventListener("click", () => {
    cleanup?.();
    cleanup = null;
    modal.setAttribute("hidden", "");
  });
</script>
```

### Status announcements (live region)

```astro
<script>
  import { createLiveRegion } from "@mixturemarketing/web-core/a11y";

  const status = createLiveRegion({ politeness: "polite" });

  document.querySelector("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.announce("Wysyłam...");
    await fetch("/api/contact", { method: "POST", body: new FormData(e.target) });
    status.announce("Wysłano! Odpowiadamy w 1h.");
  });
</script>
```

### Build-time contrast lint (theme tokens)

```ts
// scripts/check-contrast.ts (or astro.config.mjs hook)
import { checkContrast } from "@mixturemarketing/web-core/a11y";
import { CRAFTSMAN_VARIANTS } from "./src/themes/craftsman/tokens.ts";

for (const [name, tokens] of Object.entries(CRAFTSMAN_VARIANTS)) {
  const r = checkContrast(tokens.text, tokens.surface);
  if (r.grade === "fail") {
    throw new Error(`Theme ${name}: text/surface contrast ${r.ratio} below AA`);
  }
  console.log(`Theme ${name}: text/surface ratio ${r.ratio} (${r.grade})`);
}
```

### Disclosure (FAQ accordion)

```html
<div class="faq">
  <button data-disclosure-trigger="faq-1" aria-expanded="false">
    Ile czasu zajmuje otwarcie zamka?
  </button>
  <div id="faq-1" data-disclosure-content hidden>
    <p>Zwykle 5-15 minut od przyjazdu.</p>
  </div>
</div>

<script>
  import { autoWireDisclosures } from "@mixturemarketing/web-core/a11y";
  autoWireDisclosures();
</script>
```

## Tests

**70 testów w 8 plikach:**
- contrast.test.ts (16) — parseHex/parseColor edge cases, WCAG formula, AAA/AA thresholds, theme color sanity
- motion.test.ts (4) — matchMedia stub, SSR safety, conditional CSS
- skip-link.test.ts (4) — defaults, custom targets, escape, color overrides
- accessible-icon.test.ts (3) — wrapping, escape, decorative variant
- breadcrumb.test.ts (9) — nav role, aria-current, separator aria-hidden, escape, custom label/separator, throws
- focus-trap.test.ts (10) — findFocusable selectors, initial focus, escape callback, restore focus, override target
- live-region.test.ts (10) — politeness, custom id/parent, hidden flag, announce/clear/destroy, SSR safety
- disclosure.test.ts (9) — initially-open/closed, aria-expanded, click toggle, programmatic open/close, onToggle override, auto-wire

## Co świadomie NIE jest w v0.1

- **Tab + Roving tabindex** patterns (komplikacja na potem; mm-starter nie ma tab UIs)
- **Combobox / Listbox** (rzadko w service-business UI)
- **Date picker / Calendar** (klient nie ma booking flow w v0.1)
- **Toast notifications** (live region wystarczy)
- **Pełen modal `<dialog>` polyfill** — focus-trap to fundament, mm-starter wrapuje w komponent jeśli potrzeba

## Reference

- Plan: [00-main.md "Faza 1"](../../../../plan/00-main.md) — a11y target axe 0 violations
- W3C WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- WCAG 2.1: https://www.w3.org/TR/WCAG21/
- A11y Project: https://www.a11yproject.com/
- Pairs with [`/seo.breadcrumbSchema`](../seo/) (JSON-LD complement do breadcrumb HTML)
