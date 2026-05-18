# APPENDIX X — Minor tweaks z re-review v5 (finalna lista)

Wszystkie minor tweaks z re-review do wdrożenia w Fazach 0-2:

## X.1 SEO / Legal

- [ ] **Art. 172 PT — uncoupled SMS marketing checkbox** w formularzu kontaktowym (osobny od "wyślij wiadomość", osobny od email marketing) — 30 min roboty, eliminuje 50k zł kara UODO ryzyko
- [ ] **Pricing page transparency**: "Pierwsze wyniki w mapach 14-21 dni, pierwszy lead 2-4 tyg, stabilizacja 4-6 mc, ROI 6-9 mc" — w umowie pisemnie, eliminuje 80% churn-disputes
- [ ] **CWV/analytics decyzja per tier explicit**:
  - **Starter**: tylko Cloudflare Web Analytics (cookieless, ZERO consent banner)
  - **Standard**: + GA4 z Consent Mode v2 (consent banner required)
  - **Premium**: + Microsoft Clarity opt-in (banner z explicit "analytics + recording")
- [ ] **Linkbuilding KPI per tier explicit**:
  - **Starter** = tier 1 only (citations + cech + izba + LinkedIn — NIE digital PR)
  - **Standard** = tier 1 + tier 2 (HARO PL pitches, guest posts 1/mc)
  - **Premium** = tier 1 + 2 + 3 (digital PR campaigns)

## X.2 Tech

- [ ] **D1 backup strategy explicit**: daily R2 dumps, weekly full snapshot, monthly archival. RTO 4h, RPO 24h.
- [ ] **Negative test suite TenantScopedRepo**: testy cross-tenant access attempts (klient A próbuje sczytać dane klienta B), assert blokowane
- [ ] **Numerical trigger V1→V2 migration**: p95 fleet deploy time >30 min OR >5% failed deploys/mc OR >150 klientów = startuj POC multi-tenant Worker
- [ ] **Fleet-deploy SLO**: rollout fail jeśli >2% klientów ma health check failure w 1h po deploy = automatic rollback
- [ ] **Per-tenant encryption PII w D1**: kolumny `email`, `phone`, `message` szyfrowane per-tenant kluczem (klucze w Workers Secrets, NIE w D1). Mitigation R1 z legal review. 3-5 dni dev.

## X.3 Operations

- [ ] **VA hire przy 25-30 klientach** (NIE 40) — realne 95-130h/mc przy 100 oznacza wcześniejsze przeciążenie
- [ ] **Annual prepay discount** dla anty-churn: 12 mc z góry = 1 mc free (renewal incentive na mc 11-12)
- [ ] **OC IT cyber 500k zł** od początku — szczególnie krytyczne jeśli medical/legal zostaje (~2-4.5k zł/rok)

## X.4 Business

- [ ] **Channel mix po pierwszych 5 klientach (oczekiwany w mc 4-5):**
  - 50% cold call (najwyższy ROI dla local)
  - 25% referral (po pierwszych klientach)
  - 15% partnerstwa (biura rachunkowe, izby)
  - 10% inbound (landing + SEO własnej strony)

## X.5 Pominięte świadomie (akceptujemy ryzyko)

- **Pen-test rok 1** — pominięte, akceptujemy ryzyko (legal agent ostrzega)
- **Retainer prawny** — pominięty, korzystamy z konsultacji jednorazowej + odo24.pl templates
- **RCP/DPIA profesjonalne** — DIY z dostępnych szablonów (UODO publikuje wzór)
- **DSAR procedure formal** — manual process na start, automatyzacja po 50 klientach

---
