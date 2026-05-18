# APPENDIX Y — Final go-no-go checklist przed pierwszym klientem (po Fazie 3)

Lista kontrolna (~50 elementów) MUSI być 100% green przed otwarciem rezerwacji dla pierwszego płacącego klienta:

## Legal & Compliance
- [ ] DPA template (odo24.pl + minimal customization) gotowy
- [ ] Regulamin świadczenia usług gotowy + odstąpienie 14 dni dla DG jednoosobowych
- [ ] Polityka prywatności auto-gen działa per klient
- [ ] Cookie consent banner (Consent Mode v2) działa
- [ ] Klauzule informacyjne Art. 13/14 w wizardzie + formularzu lead
- [ ] RCP wewnętrzny napisany (zgodnie z UODO wzór)
- [ ] OC IT cyber 500k zł kupione i opłacone
- [ ] Sub-procesory lista publiczna na stronie

## Tech & Security
- [ ] Multi-tenancy isolation: TenantScopedRepo + ESLint rule deployed
- [ ] Per-tenant encryption PII w D1
- [ ] API key bound to client_id verified (request body ignored)
- [ ] Negative test suite cross-tenant deployed (CI gate)
- [ ] Provisioning Saga z compensating actions deployed
- [ ] Storage split: D1 + Analytics Engine + Logpush działa
- [ ] Fleet-deploy.yml + canary 5/25/100 + Renovate skonfigurowane
- [ ] Backup D1 daily R2 dumps działają (test restore wykonany)
- [ ] CSP headers, security headers A+ (securityheaders.com)

## Operations
- [ ] Runbook directory complete (P1/P2/P3 procedures)
- [ ] Severity matrix + alert routing skonfigurowany
- [ ] Secret rotation pipeline działa
- [ ] Synthetic monitor (CF Workers Scheduled) deployed
- [ ] `@binary-planet/logger` + Logpush + R2 Parquet działa
- [ ] Cost monitoring cron + anomaly alerting

## SEO & Content
- [ ] 6 theme presets (5 + food odroczone) gotowe
- [ ] Każdy preset ma branżowy SEO playbook
- [ ] EEAT prompts z war stories required
- [ ] Programmatic cap 10 + similarity <50% w CI
- [ ] Linkbuilding moduł podstawowy (tier 1 Starter)

## Business
- [ ] Cold outreach pipeline (200 firm w Rzeszowie lista)
- [ ] Cold call script tested
- [ ] CRM `prospects` table działa
- [ ] Landing strony własnej działa
- [ ] Stripe + Przelewy24 produkty utworzone i test transactions OK
- [ ] Fakturownia.pl integracja działa (test invoice issued)
- [ ] Email warming (Resend domain DKIM/SPF) zakończony

## Pre-launch validation
- [ ] 5 closed prospects na liście rezerwacji ("powiem tak gdy gotowe")
- [ ] LinkedIn profile updated + 5-10 posts o budowie produktu
- [ ] 1 case study przygotowany (np. własna strona binary-planet.pl jako example)
- [ ] Demo video 60-90s nagrany
