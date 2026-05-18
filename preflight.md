# Faza 0 Preflight — Tracker

**Model:** Wewnętrzna usługa agencji **MixtureMarketing.pl** (NIE standalone produkt).
**Brand:** MixtureMarketing (istniejący), kodename `binary-planet` tylko jako tech-internal.
**Domena główna:** `mixturemarketing.pl` (subdomeny dla infra: `app.`, `api.`, `cms.`).
**Start:** 2026-05-18
**Target zakończenie Fazy 0:** 2026-06-01 (~2 tyg)

---

## Sekcja A — Konta firmowe / płatnicze (większość już ISTNIEJE w agencji)

| # | Zadanie | Status | Notatka |
|---|---------|--------|---------|
| A1 | Konto firmowe MixtureMarketing | ✅ JEST | weryfikuj czy obsługuje subskrypcje recurring |
| A2 | Stripe — konto + KYC + Subscriptions | ✅ JEST | recurring działa |
| A3 | Przelewy24 — konto + KYC | 🔴 TODO | dla BLIK/przelewy PL (rynek PL preferuje) — założyć + KYC |
| A4 | Fakturownia.pl + API key | 🔴 TODO | założyć lub jeśli jest — wygenerować API key z `invoice.create` |
| A5 | Forma opodatkowania (ryczałt 12% IT vs zasady ogólne) | ⏳ VERIFY | decyzja z księgową — czy SaaS subskrypcja kwalifikuje się jako PKWiU IT |
| A6 | OC IT/cyber (500k zł, plan U.5) | 🔴 TODO | Hestia/Warta/PZU — research + oferta |

---

## Sekcja B — API keys / SaaS subskrypcje (NOWE, do założenia)

| # | Zadanie | Status | Koszt/mc | Notatka |
|---|---------|--------|----------|---------|
| B1 | Anthropic API account + payment | 🔴 TODO | ~$200–500 | wstępny budget cap $200, dla blog AI + content gen |
| B2 | DataForSEO Basic plan | 🔴 TODO | ~$50 | startowy plan, scale up po fazie 4 |
| B3 | Resend.com account + domain DKIM | 🔴 TODO | $0–20 | DKIM dla `app.mixturemarketing.pl` + `bp.mixturemarketing.pl` (lub osobno na klienta) |
| B4 | SMSAPI.pl prepaid | 🔴 TODO | 100 zł start | dla review request SMS |
| B5 | OVHcloud API key | 🔴 TODO | $0 | dla auto-rejestracji domen klientów .pl |
| B6 | Better Stack (Uptime) free tier | 🔴 TODO | $0 | 10 monitorów free |
| B7 | GitHub org plan (Pro/Team) | ⏳ VERIFY | $4/usr | org JEST, sprawdź plan (Free vs Team) — Team daje więcej Actions minutes + Packages |
| B8 | Cloudflare account upgrade → Workers Paid | 🔴 TODO | $5 | konto Free osobiste — upgrade + (rozważ utworzenie org dla agencji w CF) |
| B9 | Cloudflare for SaaS — activate | 🔴 TODO | $0+usage | per custom hostname billing |
| B10 | Google Cloud project (GBP API + Service Account) | 🔴 TODO | $0 | OAuth consent screen + Service Account |
| B11 | Sveltia CMS — git-based (nic do założenia) | ✅ N/A | $0 | embed w repo każdego klienta |

---

## Sekcja C — Legal / Compliance (KRYTYCZNE, blokery launch)

| # | Zadanie | Status | Notatka |
|---|---------|--------|---------|
| C1 | Konsultacja prawnik RODO/IT (5–10k zł) | 🔴 TODO | lista pytań → `legal-questions.md` (do przygotowania) |
| C2 | DPA template (processor role, SaaS internal) | 🔴 TODO | po konsultacji prawnika |
| C3 | Regulamin świadczenia usług elektronicznych | 🟡 UPDATE | JEST — potrzebny update pod model subskrypcji SaaS + SLA + cancellation/refund |
| C4 | Polityka prywatności (controller + processor) | 🟡 UPDATE | JEST — potrzebny update o sub-procesory (CF, Anthropic, Resend, SMSAPI) + processor role |
| C5 | RODO klauzule informacyjne (Art. 13/14) | 🔴 TODO | w formach klientów + w panel logowania |
| C6 | Rejestr czynności przetwarzania (Art. 30) | 🔴 TODO | wbudować w D1 audit_log + manual doc |

---

## Sekcja D — Dostęp do API publicznych (mailowe requesty, wymagają czekania)

| # | Zadanie | Status | Czas oczekiwania | Notatka |
|---|---------|--------|------------------|---------|
| D1 | REGON BIR1 API (GUS) — mailowy wniosek | 🔴 TODO | 1–2 tyg | draft maila → `regon-request.md` |
| D2 | Google Search Console API — service account access | 🔴 TODO | instant | klienci dodają SA jako user (per onboarding) |
| D3 | Google Analytics 4 Data API — service account | 🔴 TODO | instant | jw. |
| D4 | Google Business Profile API — quota request | 🔴 TODO | 2–4 tyg | wymaga uzasadnienia biznesowego do Google |
| D5 | Microsoft Bing Webmaster + Places API | 🔴 TODO | instant | dla citation builder |

---

## Sekcja E — Subdomeny + DNS (architektura)

| # | Subdomena | Cel | Status |
|---|-----------|-----|--------|
| E1 | `app.mixturemarketing.pl` | Control plane / admin dashboard (Astro + Hono) | 🔴 TODO |
| E2 | `api.mixturemarketing.pl` | Hub API (Hono) — Spoke ↔ Hub | 🔴 TODO |
| E3 | `cms.mixturemarketing.pl` | Sveltia CMS bridge (opcjonalnie) | 🔴 TODO |
| E4 | `status.mixturemarketing.pl` | Better Stack status page | 🔴 TODO |
| E5 | `docs.mixturemarketing.pl` | Dokumentacja techniczna dla VA + klientów | 🔴 TODO |
| E6 | DKIM/SPF/DMARC dla email z `mixturemarketing.pl` | Resend + transactional | ⏳ VERIFY | sprawdzić obecne rekordy SPF/DKIM dla maila biznesowego — czy będzie konflikt z Resend |

**Decyzja:** brak osobnego brandu `binary-planet.pl`. Wszystko pod MixtureMarketing.

---

## Sekcja F — GitHub org / monorepo

| # | Zadanie | Status | Notatka |
|---|---------|--------|---------|
| F1 | GitHub org MixtureMarketing | ✅ JEST | sprawdź plan (Free vs Team) — `gh api orgs/mixturemarketing` |
| F2 | npm scope `@mixturemarketing/*` | ✅ DONE | GitHub Packages wymaga scope=org. Monorepo skonfigurowany |
| F3 | Monorepo skeleton (pnpm + turbo) | ✅ DONE | Track B — `package.json` + `pnpm-workspace.yaml` + `turbo.json` |
| F4 | `@mixturemarketing/web-core` v0.0.1 | ✅ DONE (skeleton) | 11 subpath modules, build + typecheck + test green |
| F5 | `@mixturemarketing/logger` v0.0.1 | ✅ DONE (funkcjonalny) | structured JSON logging, 5/5 testów pass |
| F6 | Repo `mm-starter` (apps/starter/) | 🔴 TODO Track I | placeholder README.md |
| F7 | Repo `mm-control-plane` (apps/control-plane/) | 🔴 TODO Track J | placeholder README.md |
| F8 | Repo `mm-marketing` (apps/marketing/) | 🔴 TODO | placeholder README.md |
| F9 | GitHub Actions secrets (CF_API_TOKEN, GHCR PAT, ...) | 🔴 TODO | po faktycznym push do GitHub org |
| F10 | `git init` + initial commit | ✅ DONE | Local repo `d:\KOD\binary-planet\`, branch `main`, commit `7bfa002` |
| F10b | Push do `github.com/MixtureMarketing/binary-planet` | 🔴 TODO | `gh repo create` + `git push -u origin main` — instrukcja w [setup-playbook.md](setup-playbook.md) |
| F11 | pnpm global install (lub corepack enable) | 🟡 OPTIONAL | działa też przez `npx pnpm@9.12.0 ...` |

---

## Sekcja G — Cold outreach material (Faza V.3, równolegle)

| # | Zadanie | Status | Notatka |
|---|---------|--------|---------|
| G1 | Lista 200 firm Rzeszów (cold call) | 🔴 TODO | pkt.pl + Panorama + GBP eksport |
| G2 | Skrypt cold call (PL) | 🔴 TODO | adapt z plan V.1.1 pod brand MixtureMarketing |
| G3 | Template cold email | 🔴 TODO | adapt z V.1.2 |
| G4 | Landing page (`mixturemarketing.pl/lokalne-strony` lub osobna sekcja) | 🔴 TODO | 1 strona + form rezerwacji |
| G5 | Mockupy 3 przykładowych stron (ślusarz, księgowy, beauty) | 🔴 TODO | dla cold call/email assets |
| G6 | One-pager PDF z ofertą + cenami | 🔴 TODO | A4, branded MixtureMarketing |

---

## Sekcja H — Operational (12 dni z Appendix W, równolegle z Fazą 1)

| # | Zadanie | Status | Notatka |
|---|---------|--------|---------|
| H1 | Severity Matrix (P1/P2/P3/P4) | ✅ DONE | [runbooks/severity-matrix.md](runbooks/severity-matrix.md) |
| H2 | Runbook szkielet (4xP1 + 3xP2 + 1xP3 + 3xOps) | ✅ DONE | [runbooks/](runbooks/) — 11 runbooków + README |
| H2a | Pozostałe ops runbooks (deploy-fleet, handoff-to-va) | 🚫 BLOCKED | po Fazie 5 (fleet) / Faza 8 (VA) |
| H3 | Secrets inventory + rotation policy | ✅ DONE | [runbooks/secrets-inventory.md](runbooks/secrets-inventory.md) + [ops-rotate-secrets.md](runbooks/ops-rotate-secrets.md) |
| H4 | Alert routing config | ✅ DONE (design) | [runbooks/alert-routing.md](runbooks/alert-routing.md) — implementacja `.ts` w Fazie 3 |
| H5 | Wybór chat channel | ✅ DONE — Discord | Free unlimited webhooks. Routing zaktualizowany w [alert-routing.md](runbooks/alert-routing.md). Setup serwera czeka na Ciebie (3 min) |
| H6 | Observability MVP (logs + metrics + alerts) | 🚫 BLOCKED | implementacja w Fazie 1 ([W.3](plan/W-12-dni-operacyjnych.md)) |
| H7 | 1Password / Bitwarden vault + hardware 2FA | 🔴 TODO | YubiKey rekomendowane, gating dla pre-launch |

---

## Sekcja I — Decyzje do podjęcia w Fazie 0

- [ ] **Nazwa techniczna pakietów npm:** `@mixturemarketing/*` vs `@mm/*` vs `@mm-internal/*`
- [ ] **Czy klienci widzą "MixtureMarketing"?** White-label czy branded? (decyzja: branded, lock-in na ekspertyzę agencji)
- [ ] **Tier cenowy** — Starter 149 / Standard 199 / Premium 299 zł — finalna walidacja po cold outreach
- [ ] **Pierwsza branża pilot** — NIE medical/legal (decyzja z U.5). Rekomendacja: ślusarz/mechanik (najprostsze, najjaśniejszy ROI dla klienta = telefony)
- [ ] **Sveltia hosting** — git-based wystarczy, czy dla nietechnicznych klientów lepiej deploy Sveltia jako osobny CMS UI?
- [ ] **Forma prawna kontraktów** — umowa o świadczenie usług + regulamin + DPA, czy jedna umowa kompleksowa?

---

## Legenda statusów

- ✅ DONE
- ⏳ VERIFY (prawdopodobnie istnieje w MixtureMarketing, do potwierdzenia)
- 🔴 TODO (nowe, do zrobienia)
- 🚫 BLOCKED (czeka na coś innego)
- ❌ DROPPED (rezygnacja)

---

## Aktualizacje

- **2026-05-18** — start trackera. Pivot z standalone brandu na internal usługę MixtureMarketing.
