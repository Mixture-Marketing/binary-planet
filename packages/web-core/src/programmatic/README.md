# @mixturemarketing/web-core/programmatic

Service × location page generator z HCU-safe guard rails. Track E done.

Reference: [plan/00-main.md "Faza 1 #2"](../../../../plan/00-main.md), [plan/U-final-decisions-v5.md](../../../../plan/U-final-decisions-v5.md) (cap 10→40, min 500 słów, <70% similarity).

## Dlaczego

Google Helpful Content Update (HCU, 2022+) karze:
- "Thin pages at scale" — strony z mało treści generowane masowo
- "City swap" spam — ten sam tekst z podmienionym miastem
- Pages bez lokalnych elementów (testimonials, landmarks, local FAQ)

Engine egzekwuje guard rails programowo:
- **Word count** ≥500 słów per strona
- **Similarity** <70% Jaccard między dowolnymi dwoma stronami
- **Local elements** required: ≥3 testimonials, ≥3 FAQs, ≥1 landmark
- **Cap** — max 10 stron na start (Faza 2), 40 po validation (Faza 4+)

## Quick start

```ts
import {
  generateProgrammaticPages,
  assertProgrammaticQuality,
  formatReport,
} from "@mixturemarketing/web-core/programmatic";

const result = await generateProgrammaticPages({
  services: clientConfig.services,       // {slug, name, priority?}[]
  locations: clientConfig.location.serviceArea,  // string[] OR LocationInput[]
  slotProvider: async (combo) => ({
    title: `${combo.service.name} ${combo.location.name} — 24/7`,
    description: `...`,                  // 120-160 chars
    h1: `${combo.service.name} w ${combo.location.name}`,
    hero: `...`,
    body: `...`,                          // ≥500 słów total z FAQ/testimonials
    faqs: [                              // ≥3 wymagane
      { question: "...", answer: "..." },
      // ...
    ],
    testimonials: [                      // ≥3 wymagane
      { author: "Jan z Rzeszowa", rating: 5, text: "..." },
      // ...
    ],
    landmarks: [                         // ≥1 wymagane
      { name: "Stadion Resovia", context: "5 minut od stadionu" },
    ],
    ctaText: "Zadzwoń teraz",
  }),
  thresholds: {
    maxPages: 10,
    maxSimilarityRatio: 0.7,
    minWordsPerPage: 500,
  },
});

console.log(formatReport(result));
assertProgrammaticQuality(result);  // throws if any error-severity issue
```

## Pipeline

```
input.services × input.locations
   ↓ buildCombos() — cartesian + priority sort + cap
   ↓ slot provider call (parallel for all combos)
   ↓ per-page lintPage()
        - word count
        - required elements (FAQs, testimonials, landmarks)
        - structural (h1, hero, title length, description range)
   ↓ pairwiseSimilarity() — Jaccard over k-shingles
   ↓ attach similarity issues if any pair > threshold
   ↓ split passed vs failed by error-severity
```

## API

| Function | Returns | Purpose |
|----------|---------|---------|
| `generateProgrammaticPages(input)` | `Promise<GenerateOutput>` | Main entry. Async (slot providers can be async). |
| `assertProgrammaticQuality(output)` | `void / throws` | CI lint helper — throws `ProgrammaticQualityError` on errors |
| `formatReport(output)` | `string` | Human-readable summary for CI logs |
| `buildCombos({services, locations, maxPages, basePath?})` | `{selected, cappedOut}` | Standalone combo gen + cap |
| `slugifyPolish(text)` | `string` | "Rzeszów" → "rzeszow", handles diacritics + ł |
| `lintPage({slug, slots, thresholds})` | `{issues, wordCount}` | Standalone per-page lint |
| `pairwiseSimilarity(pages, k?)` | `SimilarityPair[]` | Cross-page Jaccard matrix |
| `textSimilarity(a, b, k?)` | `number 0..1` | Convenience similarity helper |
| `countWords(markdown)` | `number` | Strips code blocks + images |

## Quality thresholds (defaults)

| Field | Default | Override per `client.tier`? |
|-------|---------|--------------------------|
| `maxPages` | 10 | Yes (Premium: 40 after validation) |
| `minWordsPerPage` | 500 | No |
| `maxSimilarityRatio` | 0.7 | No |
| `requireFaqs` | 3 | No |
| `requireTestimonials` | 3 | No |
| `requireLandmarks` | 1 | No |

## Issue codes

| Code | Severity | Trigger |
|------|----------|---------|
| `word_count_below_min` | error | totalWordCount < minWordsPerPage |
| `similarity_too_high` | error | any pair > maxSimilarityRatio |
| `faqs_below_min` | error | faqs.length < requireFaqs |
| `testimonials_below_min` | error | testimonials.length < requireTestimonials |
| `landmarks_below_min` | error | landmarks.length < requireLandmarks |
| `missing_h1` | error | h1 empty |
| `duplicate_slug` | error | slugify collision between locations |
| `missing_hero` | warning | hero empty |
| `title_too_long` | warning | title > 70 chars (SERP truncation) |
| `description_out_of_range` | warning | description not in 120-160 chars |

## Integration with mm-starter (Track I)

```ts
// astro.config.mjs hook OR pre-deploy script
import { generateProgrammaticPages, assertProgrammaticQuality } from "@mixturemarketing/web-core/programmatic";
import clientConfig from "./src/client.config.ts";

const result = await generateProgrammaticPages({
  services: clientConfig.services,
  locations: clientConfig.location.serviceArea,
  slotProvider: createSlotProvider(clientConfig),  // user-defined
});
assertProgrammaticQuality(result);

// Write each page to src/pages/uslugi/[service]/[location].astro
for (const page of result.pages) {
  // render to .astro and fs.writeFile()
}
```

(Astro integration TODO Track I2 — for now engine is standalone.)

## Implementacja jest CZYSTA

- ✅ No file I/O — caller decides where to write
- ✅ No network — slot provider may call AI/APIs, engine doesn't
- ✅ No Astro/Hono/CF dependencies — works in any TS runtime
- ✅ Functional + pure where possible — testable
- ✅ Parallel slot calls via `Promise.all`

## Tests

10 testów engine + 6 quality + 6 similarity + 10 combos = **32 testy** dla programmatic module.

Pokrywają:
- combo generation + cap + priority + slugify
- shingles + Jaccard math + edge cases (empty, identical, disjoint)
- city-swap detection (real-world HCU scenario)
- per-page lint per code path
- engine orchestration (parallel, cap, similarity, separation)
- linter throw/no-throw, report formatting

## Reference

- Plan: [00-main.md "Faza 1 #2"](../../../../plan/00-main.md)
- Plan: [U-final-decisions-v5.md "Programmatic pages: cap 10..."](../../../../plan/U-final-decisions-v5.md)
- HCU Google docs: https://developers.google.com/search/blog/2022/08/helpful-content-update
- Jaccard similarity: https://en.wikipedia.org/wiki/Jaccard_index
- k-shingles for plagiarism detection: standard pattern in IR literature
