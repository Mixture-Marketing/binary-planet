# CLAUDE.md — binary-planet (internal MixtureMarketing.pl)

Ten plik jest auto-ładowany w każdej sesji. **Zacznij od niego.**

## Czym jest projekt

Wewnętrzna usługa SaaS agencji **MixtureMarketing.pl**: subskrypcyjne strony www + local SEO + GBP dla mikrofirm w PL (149–299 zł/mc). Kodename `binary-planet` (tylko tech-internal, brand klienta-facing = MixtureMarketing). Nie jest to standalone produkt z osobną spółką/domeną.

**Aktualna faza:** Faza 0 preflight (start 2026-05-18, target end 2026-06-01).

## Mapa repo

```
d:\KOD\binary-planet\
├── CLAUDE.md             ← jesteś tu
├── preflight.md          ← tracker Fazy 0 (9 sekcji, statusy)
├── regon-request.md      ← draft maila do GUS (REGON BIR1)
├── legal-questions.md    ← 37 pytań do prawnika RODO/IT
├── runbooks/             ← operacje + incident response (Track A done)
│   ├── README.md         ← indeks runbooków + struktura
│   ├── severity-matrix.md
│   ├── alert-routing.md
│   ├── secrets-inventory.md
│   ├── P1-*.md           ← 4 critical runbooks (site offline, lead form, stripe, d1)
│   ├── P2-*.md           ← 3 high runbooks (gbp, ssl, anthropic)
│   ├── P3-sveltia-bug.md
│   └── ops-*.md          ← rotate-secrets, onboard-new-client, restore-from-backup
├── packages/             ← monorepo libs (Track B done)
│   ├── web-core/             ← @mixturemarketing/web-core (11 subpath modules)
│   │   ├── src/local/        ← ✅ Track D done — LocalBusiness + 15 subtypes + sitemap + robots + llms + PL helpers
│   │   ├── src/forms/        ← ✅ Track F done — Turnstile + rate limit + Resend + fallback queue + AES-GCM PII + RODO
│   │   ├── src/security/     ← ✅ Track K-security done — CSP strict + HSTS + Permissions-Policy + SRI + 11 integrations
│   │   ├── src/programmatic/ ← ✅ Track E done — service × location engine + Jaccard similarity + HCU lint
│   │   ├── src/seo/          ← ✅ Track L-seo done — meta + Article + Org + Breadcrumb + FAQ + WebSite + WebPage + hreflang
│   │   ├── src/a11y/         ← ✅ Track A11y done — skip link + focus trap + live region + disclosure + breadcrumb + WCAG contrast + reduced motion
│   │   ├── src/feature-flags/← ✅ Track Feature Flags done — KV-cached per-klient toggles + budget caps + kill switches
│   │   ├── src/consent/      ← ✅ Track Consent done — RODO banner + Google Consent Mode v2 + preferences modal + audit log
│   │   ├── src/zaraz/        ← ✅ Track Zaraz done — CF Zaraz tool config generators (7 platforms) + runtime trackEvent
│   │   └── src/ads/          ← ✅ Track Ads done — conversion helpers + GCLID + Meta CAPI server-side + GAds OCT
│   └── logger/               ← @mixturemarketing/logger (v0.0.1 funkcjonalny)
├── apps/
│   ├── starter/          ← mm-starter — ✅ Track I + I2 + Sveltia done (Astro 5 + CF + Tailwind v4 + content collections + /admin Sveltia CMS)
│   ├── control-plane/    ← mm-control-plane — ✅ Track J done (Hono hub API + cron + 24 tests)
│   │   ├── migrations/   ← ✅ Track C done — 9 SQL files, 37 tables, 110 indexes
│   │   ├── src/api/      ← Hono routes, middleware (auth/logger/error), lib
│   │   ├── src/repos/    ← data access (clients, leads, webhook-events)
│   │   ├── src/scheduled/← cron dispatcher + health-check + backup
│   │   └── test/         ← integration tests w node:sqlite mock D1
│   ├── admin/            ← mm-admin — ✅ Track J2 done (Astro 5 admin dashboard + magic link auth + 7 pages, shared D1)
│   └── marketing/        ← mm-marketing — placeholder (TODO)
├── package.json          ← root workspace
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json    ← strict + noUncheckedIndexedAccess + verbatimModuleSyntax
├── eslint.config.js      ← flat config, typed lint
├── .prettierrc / .editorconfig / .gitignore / .npmrc / .nvmrc
└── plan/
    ├── INDEX.md          ← mapa wszystkich 26 chunków planu
    ├── 00-main.md        ← główny plan (fazy 0–8)
    └── A-Y-*.md          ← aneksy
```

## Komendy

```bash
# Wymaga: Node 20.18+, pnpm 9.12+
# (pnpm via npx pnpm@9.12.0 ... jeśli nie zainstalowane globalnie)

$env:NODE_AUTH_TOKEN="<gh_pat_or_dummy>"     # PowerShell
pnpm install
pnpm typecheck     # tsc --noEmit, project references
pnpm test          # vitest run (7 testów, pass)
pnpm build         # tsc -b → dist/
pnpm lint
pnpm format
```

**Memory:** `C:\Users\Jakub\.claude\projects\d--KOD-binary-planet\memory\` — auto-ładowane.
**Oryginalny plan (3448 linii, NIE czytać całego):** `C:\Users\Jakub\.claude\plans\powazna-sprawa-chce-zaczac-binary-planet.md`. Zamiast tego — chunki w `plan/`.

## Stan agencji (kontekst preflight)

| Co | Status |
|----|--------|
| Stripe + Subscriptions | ✅ JEST |
| GitHub org MixtureMarketing | ✅ JEST |
| DNS mixturemarketing.pl na Cloudflare | ✅ JEST |
| Regulamin + polityka prywatności | 🟡 JEST, wymaga update pod SaaS + DPA template |
| Cloudflare Workers Paid | 🔴 TODO (konto Free osobiste, upgrade $5/mc) |
| Przelewy24, Fakturownia, OC IT cyber 500k zł | 🔴 TODO |
| Anthropic / DataForSEO / Resend / SMSAPI / OVH / Better Stack / Google Cloud | 🔴 TODO (wszystkie nowe konta) |
| REGON BIR1 (1–2 tyg czekania) | 🔴 TODO (draft maila gotowy) |

## Stack technologiczny (potwierdzony)

- **Astro 5** + **Cloudflare Workers** (1 Worker per klient, migration-ready do multi-tenant) + **Tailwind v4**
- Monorepo: **pnpm** + **turbo**
- Pakiety: `@mixturemarketing/web-core` (lub `@mm-internal/*`) — scope do potwierdzenia
- CMS: **Sveltia** git-based (embed w repo klienta, ✅ mm-starter `/admin/` v0.1 — local backend dev, OAuth proxy v0.2)
- Hub API: **Hono** + **D1** + **KV** + **R2** + **Cron Triggers**
- AI: **Anthropic Claude** (Sonnet 4.6 / Opus 4.7)
- Analytics: **Plausible self-hosted** (default, cookieless) + **CF Zaraz** (server-side GA4/Meta Pixel/Google Ads via consent)
- Payments: **Stripe** (cards, recurring) + **Przelewy24** (BLIK, PL transfers)
- Invoicing: **Fakturownia.pl** API
- Email: **Resend** + DKIM
- SMS: **SMSAPI.pl**
- Monitoring: **Better Stack** free tier
- Domain registration (klienci): **OVHcloud API**

## Decyzje strategiczne (z U-final-decisions-v5)

- **Budżet prawny:** 5–10k zł (świadomie niżej niż rekomendowane 15–20k, mitigation: per-tenant encryption PII)
- **Medical/legal/finansowe:** ZOSTAJE z manual content flow; pierwsze 10 klientów pilotowych NIE z tych branż
- **Pre-validation:** cold outreach pierwszy (NIE landing/Ads), pod brandem MixtureMarketing
- **Pierwsza branża pilot:** rekomendacja — craftsman (ślusarz/mechanik), najprostszy ROI (telefony)
- **Tier cenowy:** Starter 149 / Standard 199 / Premium 299 zł
- **Multi-tenancy:** 1 Worker per klient (CF for SaaS), z migration path do multi-tenant w Fazie 5+
- **Storage split:** D1 (transactional) + Analytics Engine (events) + Logpush (audit) — NIE D1 dla wszystkiego

## Konwencje pracy

- **Język:** PL z użytkownikiem, EN w kodzie/commitach
- **Styl:** zwięzłe komunikaty, jedna linia per update, bez "let me explain"
- **Markdown links:** `[name](path)` dla file references (extension wymaga, NIE backticks)
- **Plan jest source of truth** — kontrowersyjne decyzje weryfikuj z [U-final-decisions-v5.md](plan/U-final-decisions-v5.md) (najbardziej aktualne)
- **Każda decyzja zmieniająca plan** → update [preflight.md](preflight.md) lub odpowiedniego chunku planu, plus memory jeśli ma znaczenie cross-session
- **Wszystkie nowe konta SaaS** zakładane na MixtureMarketing (nie nowy podmiot)

## Co teraz (Faza 0)

Patrz [preflight.md](preflight.md) sekcje A–I. Bottlenecki (start jak najszybciej):
1. Mail do GUS (REGON, 1–2 tyg czekania) — uzupełnij dane firmy w [regon-request.md](regon-request.md) i wyślij
2. Research prawnika RODO/IT — kryteria w [legal-questions.md](legal-questions.md) sekcja "Jak znaleźć prawnika"
3. CF Workers Paid upgrade — $5/mc, niezbędne dla D1 + Cron

Po preflight → Faza 1: `@mixturemarketing/web-core` v0.1.

## Czego NIE robić

- Nie planuj rejestracji `binary-planet.pl` / nowych domen brandowych — używamy `mixturemarketing.pl` + subdomeny
- Nie sugeruj nowej spółki/działalności gospodarczej
- Nie ładuj pełnego pliku `powazna-sprawa-chce-zaczac-binary-planet.md` (74k tokenów) — używaj chunków w `plan/`
- Nie commituj nic do gita bez wyraźnej prośby — to nie jest jeszcze repo git
- Nie zakładaj że klient = "binary-planet". Klient widzi MixtureMarketing branded service.
