# APPENDIX S — Synteza Critical Review (5 agentów)

5 ekspertów (tech architect, business strategist, legal/RODO, SEO consultant, DevOps/SRE) niezależnie zrobiło review. **Wszyscy 5 zwrócili verdict: NEEDS REWORK**. Sumaryczne findings:

## S.1 Top 5 KRYTYCZNYCH problemów (z każdej review)

### Problem 1: **AKWIZYCJA KLIENTÓW = PUSTE POLE** (Business)

To największy gap całego planu. ~5 linii w 1600-liniowym planie. CAC mikrofirmy przez paid ads w PL: 400-1500 zł. LTV Starter (149 zł × 12 mc) = 1788 zł. **LTV/CAC = 1.2x** — healthy SaaS to 3-5x. Mikrofirma w Rzeszowie nie googluje "agencja SEO".

**Mitigation:** Zanim Faza 0 (techniczna), zrób **Faza -1: walidacja rynku** (4 tyg):
- Pilotowa MANUAL sprzedaż 5 klientów (1 dzień per strona ręcznie)
- Fake door test: landing + 200 zł Google Ads, mierzysz CPC i konwersję
- 15 customer discovery interviews (nie sprzedaż — rozmowa)
- Doorknock 20 LOI (Letters of Intent) w izbach gospodarczych

**Jeśli nie zamkniesz 5 sprzedaży w 4 tyg → nie zamkniesz 100 z auto-wizardem.** Oszczędzasz 4-6 mc pracy i 30-50k zł.

### Problem 2: **RUNTIME ARCHITECTURE: 1 Worker per klient nie skaluje** (Tech)

Bump wersji core dla 100 klientów = 100 osobnych redeployów. Custom Hostnames płatne >100 (po free tier $0.10/hostname/mc). 

**Mitigation:** Rozważ **multi-tenant single Worker dla runtime**, 1 repo per klient dla source-of-truth. Build produkuje content bundle do R2, Worker route'uje per `host` header. Redeploy core = 1 deploy zamiast 100. Izolacja designu na poziomie bundle'a, nie Workera.

### Problem 3: **D1 jako event store = bottleneck** (Tech)

D1 limity (~10 GB, ~50 concurrent writes). Eventy (`page_view`, `scroll_depth_75`, `engagement_time_30s`) z 500 stron × visitors = wyczerpują D1 w 6 mc.

**Mitigation:**
- **Workers Analytics Engine** dla eventów (purpose-built, tani)
- **Logpush + R2 Parquet** dla audit_log, health_checks
- D1 tylko dla state: clients, subscriptions, leads (transactional), citations, gbp_reviews, blog_drafts

### Problem 4: **MEDICAL/LEGAL = ryzyko AI Act + odpowiedzialność deliktowa** (Legal)

AI Act od 02.08.2026 — disclosure obligatoryjne. Auto-AI-content dla opisów usług medycznych = potencjalnie high-risk system. Halucynacja → odpowiedzialność solidarna agencji z gabinetem (Art. 415 KC).

**Mitigation: WYKLUCZ medical/legal z MVP.** Wracają w fazie 7+ z osobnym "Compliance Pro" tierem (+200 zł/mc, ludzka redakcja, EU-only stack, dedykowany disclaimer, krótka retencja 3 mc dla leadów medical).

### Problem 5: **Solo 100-250 klientów nierealne** (DevOps + Business)

Plan: 60h/mc przy 100 klientach. **Realnie: 95-130h/mc** (review + incident response + provisioning cleanup + update propagation + cost reconciliation + customer support + sales).

**Mitigation:**
- Break-even praktyczny: **50-70 klientów**, NIE 100
- VA hire trigger: **40 klientów**, NIE faza 8
- Cap solo + 1 VA: **100-120 klientów**, NIE 250
- Dla 250 klientów: Ty + 1 VA + junior part-time (~12-15k zł/mc, ~30% net MRR)

## S.2 Top 10 dodatkowych zmian do wdrożenia

### Tech
6. **Multi-tenancy isolation**: repository pattern z `withTenant(clientId)` scope, lint AST blokujący raw SQL bez `client_id`, API key bound to client_id (request body nie może podawać innego)
7. **Provisioning Saga**: każdy step z compensating action + idempotency keys (Stripe webhook może przyjść 2×)
8. **Staging/preview per klient**: `preview.[client-slug].binary-planet.pl` z auto-buildem na każdy PR (must-have od dnia 1, nie nice-to-have)
9. **Sveltia OAuth proxy**: doprecyzować — service account z dostępem do wszystkich repo (centralizacja ryzyka), nie GitHub per klient

### Business
10. **Sales funnel + financial planning**: target CAC per channel, conversion rate założenia, monthly new customer targets, break-even analysis, runway calculation, best/base/worst scenarios, trigger pointy ("jeśli X nie spełnione w mc 6 to Y")
11. **Channel testing roadmap**: 1) referral (1 mc free dla obu, target 30% MRR), 2) partnerstwa z biurami rachunkowymi (B2B2C), 3) doorknock + lokalne PR, 4) cold outbound do firm bez stron
12. **Renewal incentive + health score**: 2-month free na 24mc commit, health score per klient (red/yellow/green), interwencja przy 0 leadów w mc 1-3
13. **2 tiery na start zamiast 3**: Starter + Standard. Premium dodaj po 6 mc relacji (custom upgrade, nie standardowy tier — eliminuje kanibalizację)

### Legal
14. **Wykluczenie medical/legal + profesjonalne dokumenty**:
   - Konsultacja prawnika RODO/IT (Maruta Wachta, DGTL, Bird&Bird PL): **4-8k zł** (nie 2-3k jak plan szacował)
   - Dokumenty MUST-HAVE: DPA (poprawne klauzule), Regulamin świadczenia usług (z prawem odstąpienia mikrofirm jednoosobowych Art. 38a), RCP, **DPIA** (>250 klientów = trigger), TIA dla każdego sub-procesora US, klauzule informacyjne Art. 13/14 do formularza
   - Realne koszty prawne rok 1: **25-50k zł** (konsultacje + retainer 600-1200 zł/mc + pen-test + IP/znak towarowy + OC zawodowe)
15. **AI Act compliance**:
   - Disclaimer "treść z udziałem AI" w stopce stron z AI-content
   - Audit log AI generations (kto, kiedy, prompt, output)
   - Pseudonimizacja PII przed wysłaniem do Claude
16. **DSAR procedure end-to-end**: kto przyjmuje wniosek od podmiotu danych końcowego (np. Anna która wypełniła form u ślusarza prosi o swoje dane)? 30 dni response (Art. 12(3))

### SEO
17. **Programmatic cap obniżony do 10 na start, max 40 po 6 mc**: skaluj based on GSC impressions. Noindex strony <10 impressions/mc po 6 mc. Similarity threshold body <50% (nie 70%), 4-gram overlap <30%
18. **Branżowe SEO playbooki** (must-have przed Fazą 2): intent mapping per branża × keywords (top 20) × schema fields × content format × link sources
19. **Linkbuilding jako osobny moduł** (`core/linkbuilding`): tier 1 (cech, izba, OSP, lokalna gazeta), tier 2 (HARO PL, guest posts), tier 3 (digital PR). Citations to NIE są linki
20. **EEAT prompty rewrite**: wymagać w wizardzie 3-5 war stories od klienta + lista narzędzi/marek + aktualne ceny. Bez tego AI content jest generyczny

### DevOps
21. **Storage split**: D1 (state) + Workers Analytics Engine (events) + Logpush+R2 Parquet (audit_log, health)
22. **Update propagation**: Renovate bot dla auto-bumps, canary deploys (5% → 25% → 100%), grouped updates, fleet command script
23. **Monitoring**: replace Better Stack z CF Workers Scheduled + D1 (skaluje bez kosztów), severity matrix P1/P2/P3, runbook directory, auto-remediation dla typowych issues
24. **Cost monitoring**: daily cron check Anthropic/DataForSEO/SMSAPI/Resend usage, anomaly detection (>2× daily avg → alert), per-client cost attribution
25. **CWV per-tier budgets**: Starter ≥95, Standard ≥90, Premium ≥85 (bo A/B + Clarity + blog widgets)
26. **Secret rotation strategy**: bulk rotate via Wrangler API + per-worker inventory + GBP OAuth refresh monitor cron

### Time-to-value komunikacja
27. **Realistyczna komunikacja**: 6 mc minimum dla Starter (nie 30 dni). Miasta >300k: 9-12 mc. Miasta <50k: 3-4 mc. **Brutalna prawda w sprzedaży** — buduje zaufanie, eliminuje "po co płacę"

## S.3 Realne ekonomika po rewizji

| Metryka | Plan v4 | Plan po review |
|---|---|---|
| Time-to-value | "30 dni quick wins" | 6 mc minimum local pack appearance |
| Czas/mc 100 klientów | 60h | **95-130h** |
| Break-even | 100 klientów | **50-70 klientów** |
| VA hire | Faza 8 | **40 klientów** |
| Cap solo+VA | 250 | **100-120** |
| Koszty prawne rok 1 | 5-10k zł | **25-50k zł** |
| Hidden costs (GH Actions, monitoring, ubezpieczenie) | nieujęte | **~5-10k zł/rok** |
| NET MRR przy 100 klientach | 20 370 zł | ~15 000 zł (po dodatkowych kosztach) |

## S.4 Sugerowana rewizja Fazy 0-1

**Faza -1: Walidacja rynku (4-6 tyg) — NOWA, MUST-HAVE**
- Pilotowa manual sprzedaż 5 klientów
- Fake door test (Google Ads landing)
- 15 customer discovery interviews
- Doorknock 20 LOI
- Decyzja GO/PIVOT/NO-GO na podstawie wyników

**Faza 0: Setup infra + prawnik (2 tyg)**
- Konsultacja prawnika (4-8k zł)
- DPA, Regulamin, RCP, DPIA, TIA, klauzule informacyjne — profesjonalne dokumenty
- REGON API request do GUS
- Decyzja: wykluczyć medical/legal z MVP
- Ustalenie 2 tierów na start (Starter + Standard, NIE 3)
- API keys + accounts (Stripe, P24, Anthropic, DataForSEO, SMSAPI, Resend, Fakturownia)
- GitHub org + npm registry

**Faza 1: web-core v0.1 + Branżowe SEO playbooki (2-3 tyg)**
- Branżowe playbooki (intent mapping, keywords, schema) PRZED implementacją modułów
- web-core: seo, local, forms, a11y, security, feature-flags, regon, programmatic (cap 10), eeat, consent, zaraz, ads, citation, linkbuilding (NOWY moduł)
- Storage split decyzja: D1 + Analytics Engine + Logpush
- Multi-tenant isolation: repository pattern + linting

---
