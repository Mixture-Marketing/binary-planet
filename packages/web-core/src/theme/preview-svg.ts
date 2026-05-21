/**
 * Theme preview SVG generator — inline mini-preview per style + variant.
 *
 * Generuje SVG ~280×180 z wizualną reprezentacją palety + układu danego stylu.
 * Używane w panelu klienta przy wyborze motywu/wariantu.
 *
 * Każdy styl ma własny "wireframe" odpowiadający charakterystyce komponentów:
 *   - minimalist: centered hero, 2x3 bento grid
 *   - elegant: image-bg hero z overlay, narrow list usług
 *   - dynamic: split hero + prominent CTA, featured card
 *   - editorial: asymmetric hero z byline strip, 12-col bento
 */

import type { ThemeTokens } from "./color-generator.js";

export type PreviewStyle = "minimalist" | "elegant" | "dynamic" | "editorial";

/**
 * Builds inline SVG mini-preview (~280×180) for a given theme/variant tokens.
 */
export function previewSvg(style: PreviewStyle, tokens: ThemeTokens, label?: string): string {
  switch (style) {
    case "minimalist": return svgMinimalist(tokens, label);
    case "elegant":    return svgElegant(tokens, label);
    case "dynamic":    return svgDynamic(tokens, label);
    case "editorial":  return svgEditorial(tokens, label);
  }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ---------------------------------------------------------------------------
// MINIMALIST — centered hero, single accent, 2x3 bento
// ---------------------------------------------------------------------------
function svgMinimalist(t: ThemeTokens, label?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="280" height="180" role="img" aria-label="${escapeXml(label ?? "Czysty preview")}" style="display:block;border-radius:8px;overflow:hidden;">
  <rect width="280" height="180" fill="${t.surface}"/>
  <rect x="0" y="0" width="280" height="28" fill="${t.surface}" stroke="${t.border}" stroke-width="0.5"/>
  <rect x="10" y="10" width="36" height="8" rx="1" fill="${t.text}"/>
  <rect x="180" y="11" width="46" height="6" rx="1" fill="${t.textMuted}" opacity="0.6"/>
  <rect x="232" y="6" width="40" height="16" rx="3" fill="none" stroke="${t.brand}" stroke-width="1.2"/>
  <text x="252" y="17" font-family="sans-serif" font-size="6" fill="${t.brand}" text-anchor="middle">Umów</text>
  <text x="140" y="62" font-family="serif" font-weight="600" font-size="14" fill="${t.text}" text-anchor="middle">Wielki nagłówek</text>
  <rect x="80" y="72" width="120" height="3" rx="1.5" fill="${t.textMuted}" opacity="0.4"/>
  <rect x="100" y="80" width="80" height="3" rx="1.5" fill="${t.textMuted}" opacity="0.4"/>
  <g transform="translate(20, 105)">
    <rect width="76" height="58" fill="${t.surface}" stroke="${t.border}"/>
    <rect x="8" y="10" width="40" height="5" rx="1" fill="${t.text}"/>
    <rect x="8" y="20" width="50" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="26" width="46" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="44" width="20" height="6" rx="1" fill="${t.brand}"/>
  </g>
  <g transform="translate(102, 105)">
    <rect width="76" height="58" fill="${t.surface}" stroke="${t.border}"/>
    <rect x="8" y="10" width="40" height="5" rx="1" fill="${t.text}"/>
    <rect x="8" y="20" width="46" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="26" width="50" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="44" width="20" height="6" rx="1" fill="${t.brand}"/>
  </g>
  <g transform="translate(184, 105)">
    <rect width="76" height="58" fill="${t.surface}" stroke="${t.border}"/>
    <rect x="8" y="10" width="40" height="5" rx="1" fill="${t.text}"/>
    <rect x="8" y="20" width="42" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="26" width="48" height="3" rx="1" fill="${t.textMuted}" opacity="0.5"/>
    <rect x="8" y="44" width="20" height="6" rx="1" fill="${t.brand}"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// ELEGANT — image-bg hero with overlay, narrow services list
// ---------------------------------------------------------------------------
function svgElegant(t: ThemeTokens, label?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="280" height="180" role="img" aria-label="${escapeXml(label ?? "Elegancki preview")}" style="display:block;border-radius:8px;overflow:hidden;">
  <defs>
    <linearGradient id="elegOverlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.text}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${t.text}" stop-opacity="0.6"/>
    </linearGradient>
    <pattern id="elegPat" patternUnits="userSpaceOnUse" width="4" height="4">
      <rect width="4" height="4" fill="${t.surfaceMuted}"/>
      <circle cx="2" cy="2" r="0.5" fill="${t.accent}" opacity="0.15"/>
    </pattern>
  </defs>
  <rect width="280" height="180" fill="${t.surface}"/>
  <!-- Hero image area -->
  <rect x="0" y="0" width="280" height="105" fill="url(#elegPat)"/>
  <rect x="0" y="0" width="280" height="105" fill="url(#elegOverlay)"/>
  <text x="140" y="50" font-family="serif" font-style="italic" font-weight="600" font-size="18" fill="${t.surface}" text-anchor="middle">${escapeXml("Salon")}</text>
  <rect x="80" y="60" width="120" height="3" rx="1.5" fill="${t.surface}" opacity="0.75"/>
  <rect x="115" y="78" width="50" height="14" rx="7" fill="${t.brand}"/>
  <text x="140" y="88" font-family="serif" font-style="italic" font-size="7" fill="${t.brandFg}" text-anchor="middle">Umów wizytę</text>
  <!-- Services list -->
  <g transform="translate(40, 120)">
    <rect width="200" height="14" fill="none"/>
    <rect x="0" y="3" width="80" height="6" rx="1" fill="${t.text}"/>
    <rect x="170" y="4" width="30" height="5" rx="1" fill="${t.accent}"/>
    <line x1="0" y1="14" x2="200" y2="14" stroke="${t.border}" stroke-width="0.5"/>
  </g>
  <g transform="translate(40, 138)">
    <rect x="0" y="3" width="92" height="6" rx="1" fill="${t.text}"/>
    <rect x="170" y="4" width="30" height="5" rx="1" fill="${t.accent}"/>
    <line x1="0" y1="14" x2="200" y2="14" stroke="${t.border}" stroke-width="0.5"/>
  </g>
  <g transform="translate(40, 156)">
    <rect x="0" y="3" width="68" height="6" rx="1" fill="${t.text}"/>
    <rect x="170" y="4" width="30" height="5" rx="1" fill="${t.accent}"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// DYNAMIC — split hero, prominent CTA, featured card, bold typo
// ---------------------------------------------------------------------------
function svgDynamic(t: ThemeTokens, label?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="280" height="180" role="img" aria-label="${escapeXml(label ?? "Dynamiczny preview")}" style="display:block;border-radius:8px;overflow:hidden;">
  <rect width="280" height="180" fill="${t.surface}"/>
  <!-- Top sticky bar -->
  <rect x="0" y="0" width="280" height="14" fill="${t.brand}"/>
  <text x="8" y="10" font-family="sans-serif" font-weight="700" font-size="6" fill="${t.brandFg}">AWARYJNE 24/7</text>
  <rect x="220" y="3" width="54" height="8" rx="1" fill="${t.accent}"/>
  <text x="247" y="9" font-family="sans-serif" font-weight="700" font-size="6" fill="${t.text}" text-anchor="middle">ZADZWOŃ</text>
  <!-- Hero split -->
  <rect x="10" y="22" width="34" height="8" rx="1" fill="${t.brand}"/>
  <text x="27" y="28" font-family="sans-serif" font-weight="700" font-size="5" fill="${t.brandFg}" text-anchor="middle">PILNE</text>
  <text x="10" y="50" font-family="sans-serif" font-weight="800" font-size="17" fill="${t.text}">OTWORZYMY</text>
  <text x="10" y="65" font-family="sans-serif" font-weight="800" font-size="17" fill="${t.text}">KAŻDY ZAMEK</text>
  <rect x="10" y="74" width="60" height="14" rx="3" fill="${t.brand}"/>
  <text x="40" y="84" font-family="sans-serif" font-weight="700" font-size="8" fill="${t.brandFg}" text-anchor="middle">ZADZWOŃ</text>
  <rect x="76" y="74" width="60" height="14" rx="3" fill="none" stroke="${t.brand}" stroke-width="1"/>
  <text x="106" y="84" font-family="sans-serif" font-weight="600" font-size="8" fill="${t.brand}" text-anchor="middle">WhatsApp</text>
  <!-- Image right -->
  <rect x="160" y="22" width="110" height="68" rx="4" fill="${t.surfaceMuted}"/>
  <circle cx="215" cy="56" r="14" fill="${t.brand}" opacity="0.3"/>
  <!-- Trust badges row -->
  <rect x="10" y="100" width="260" height="22" rx="3" fill="${t.surfaceMuted}"/>
  <text x="40" y="113" font-family="sans-serif" font-weight="800" font-size="10" fill="${t.brand}" text-anchor="middle">1200+</text>
  <text x="100" y="113" font-family="sans-serif" font-weight="800" font-size="10" fill="${t.brand}" text-anchor="middle">23min</text>
  <text x="170" y="113" font-family="sans-serif" font-weight="800" font-size="10" fill="${t.brand}" text-anchor="middle">24/7</text>
  <text x="240" y="113" font-family="sans-serif" font-weight="800" font-size="10" fill="${t.brand}" text-anchor="middle">5★</text>
  <!-- Featured card -->
  <rect x="10" y="130" width="80" height="44" rx="3" fill="${t.brand}"/>
  <text x="50" y="146" font-family="sans-serif" font-weight="800" font-size="7" fill="${t.brandFg}" text-anchor="middle">POLECANE</text>
  <text x="50" y="163" font-family="sans-serif" font-weight="800" font-size="11" fill="${t.brandFg}" text-anchor="middle">od 100zł</text>
  <rect x="98" y="130" width="80" height="44" rx="3" fill="${t.surface}" stroke="${t.border}" stroke-width="1.5"/>
  <text x="138" y="163" font-family="sans-serif" font-weight="800" font-size="11" fill="${t.brand}" text-anchor="middle">od 50zł</text>
  <rect x="186" y="130" width="80" height="44" rx="3" fill="${t.surface}" stroke="${t.border}" stroke-width="1.5"/>
  <text x="226" y="163" font-family="sans-serif" font-weight="800" font-size="11" fill="${t.brand}" text-anchor="middle">wycena</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// EDITORIAL — masthead, asymmetric bento, big serif typography
// ---------------------------------------------------------------------------
function svgEditorial(t: ThemeTokens, label?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="280" height="180" role="img" aria-label="${escapeXml(label ?? "Magazynowy preview")}" style="display:block;border-radius:8px;overflow:hidden;">
  <rect width="280" height="180" fill="${t.surface}"/>
  <!-- Masthead -->
  <line x1="0" y1="22" x2="280" y2="22" stroke="${t.text}" stroke-width="1.5"/>
  <text x="20" y="14" font-family="sans-serif" font-size="5" letter-spacing="0.5" fill="${t.textMuted}">PONIEDZIAŁEK</text>
  <text x="140" y="16" font-family="serif" font-weight="700" font-size="14" fill="${t.text}" text-anchor="middle">TRATTORIA</text>
  <text x="260" y="14" font-family="sans-serif" font-size="5" letter-spacing="0.5" fill="${t.textMuted}" text-anchor="end">KRAKÓW</text>
  <!-- Byline overhead -->
  <text x="20" y="32" font-family="sans-serif" font-size="5" letter-spacing="0.4" fill="${t.textMuted}">RODZINNA · OD 2015</text>
  <!-- Hero asymmetric: 60% text + 40% image -->
  <text x="20" y="52" font-family="serif" font-weight="700" font-size="17" fill="${t.text}">Pasta jak</text>
  <text x="20" y="68" font-family="serif" font-weight="700" font-size="17" fill="${t.text}">u babci.</text>
  <rect x="20" y="76" width="100" height="2" rx="1" fill="${t.textMuted}" opacity="0.4"/>
  <rect x="20" y="82" width="85" height="2" rx="1" fill="${t.textMuted}" opacity="0.4"/>
  <text x="20" y="98" font-family="serif" font-style="italic" font-size="7" fill="${t.brand}">→ Zobacz menu</text>
  <rect x="170" y="32" width="100" height="78" rx="2" fill="${t.surfaceMuted}"/>
  <text x="220" y="60" font-family="serif" font-style="italic" font-size="10" fill="${t.textMuted}" text-anchor="middle" opacity="0.5">photo</text>
  <!-- 3-dots divider -->
  <circle cx="135" cy="120" r="1" fill="${t.accent}"/>
  <circle cx="140" cy="120" r="1" fill="${t.accent}"/>
  <circle cx="145" cy="120" r="1" fill="${t.accent}"/>
  <!-- Asymmetric bento: 1 big + 2 small -->
  <rect x="20" y="130" width="160" height="44" fill="${t.brand}"/>
  <rect x="32" y="138" width="20" height="4" rx="1" fill="${t.accent}"/>
  <text x="32" y="155" font-family="serif" font-weight="700" font-size="11" fill="${t.brandFg}">Polecane</text>
  <text x="32" y="167" font-family="serif" font-style="italic" font-size="7" fill="${t.brandFg}" opacity="0.85">od 38 zł</text>
  <rect x="186" y="130" width="74" height="20" fill="${t.surfaceMuted}" stroke="${t.border}"/>
  <text x="223" y="143" font-family="serif" font-weight="600" font-size="8" fill="${t.text}" text-anchor="middle">Pizza</text>
  <rect x="186" y="154" width="74" height="20" fill="${t.surfaceMuted}" stroke="${t.border}"/>
  <text x="223" y="167" font-family="serif" font-weight="600" font-size="8" fill="${t.text}" text-anchor="middle">Wina</text>
</svg>`;
}
