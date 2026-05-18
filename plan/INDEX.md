# Plan binary-planet — INDEX

Plan rozbity na chunki dla łatwego ładowania. **Oryginał:** `C:\Users\Jakub\.claude\plans\powazna-sprawa-chce-zaczac-binary-planet.md` (3448 linii, ~74k tokenów — NIE ładować całego).

**Pivot 2026-05-18:** "binary-planet" = wewnętrzna usługa SaaS **MixtureMarketing.pl**, nie standalone brand. Wszystkie referencje do "binary-planet.pl" / osobnego konta firmowego są nieaktualne — patrz [project context](../../../.claude/projects/d--KOD-binary-planet/memory/project_context.md).

---

## Główny plan

| Plik | Zakres | Tematy |
|------|--------|--------|
| [00-main.md](00-main.md) | 472 linii | Context, 4 poziomy architektury, pakiety usług, local SEO, stack, **Fazy 0–8**, weryfikacja E2E |

## Aneksy

| Plik | Tematy |
|------|--------|
| [A-rodo.md](A-rodo.md) | RODO/GDPR: DPA, cookie consent, polityka prywatności, IODO, transfer USA |
| [B-themes.md](B-themes.md) | 6 theme presets: craftsman, professional, medical, beauty, local-services, food |
| [C-onboarding-wizard.md](C-onboarding-wizard.md) | UX flow wizardu onboardingu (12 kroków) |
| [D-ai-content-prompts.md](D-ai-content-prompts.md) | AI prompts per branża/sekcja (hero, about, service, FAQ, programmatic) |
| [E-d1-schemas-billing.md](E-d1-schemas-billing.md) | D1 schema control-plane, per-client D1, billing flow Stripe+P24 |
| [F-mcp.md](F-mcp.md) | MCP do instalacji (Stripe, GitHub, Figma) |
| [G-katalogi.md](G-katalogi.md) | Pierwsze 5 polskich katalogów do citation |
| [H-preflight.md](H-preflight.md) | Lista preflight Fazy 0 (ZDEZAKTUALIZOWANE pivotem — patrz [preflight.md](../preflight.md)) |
| [I-analytics.md](I-analytics.md) | Zaraz server-side tagging, Consent Mode v2, GA4 eventy, reklamy |
| [J-hub-spoke.md](J-hub-spoke.md) | Hub-and-Spoke API architektura, komunikacja, auth, failure modes |
| [K-admin-dashboard.md](K-admin-dashboard.md) | Spec widoków admin dashboard (Inbox, klienci, raporty) |
| [L-crm.md](L-crm.md) | CRM sales pipeline w control plane, drip emails, affiliate |
| [M-month1-anti-churn.md](M-month1-anti-churn.md) | Quick wins month 1 (anti-churn) |
| [N-fakturownia-vat.md](N-fakturownia-vat.md) | Fakturownia.pl, polski VAT, JPK_V7 |
| [O-disaster-recovery.md](O-disaster-recovery.md) | DR scenarios, standby Vercel, status page, backups |
| [P-watpliwosci.md](P-watpliwosci.md) | Otwarte pytania i wątpliwości do planu |
| [Q-panel-klienta.md](Q-panel-klienta.md) | Customer portal: widoki, RODO, magic link auth, webhooks |
| [R-diagrams.md](R-diagrams.md) | Wizualne diagramy: system, lead flow, onboarding, Gantt, lifecycle, modules |
| [S-critical-review.md](S-critical-review.md) | Top 5 problemów + 10 dodatkowych zmian po review 5 agentów |
| [T-action-items.md](T-action-items.md) | Decyzje wymagane od Jakuba, ścieżka decyzyjna |
| [U-final-decisions-v5.md](U-final-decisions-v5.md) | **Finalne decyzje v5** + branżowe SEO playbooki + linkbuilding + EEAT + ekonomika + roadmap |
| [V-cold-outreach.md](V-cold-outreach.md) | Cold call/email pipeline (skrypty, KPI, materiały do Fazy 0) |
| [W-12-dni-operacyjnych.md](W-12-dni-operacyjnych.md) | Runbook, severity matrix, secret rotation, observability MVP |
| [X-minor-tweaks.md](X-minor-tweaks.md) | Drobne tweaki z re-review v5 |
| [Y-go-no-go-checklist.md](Y-go-no-go-checklist.md) | Final go/no-go checklist przed pierwszym klientem |

---

## Jak używać

- **Pełny obraz fazy/architektury** → [00-main.md](00-main.md)
- **Decyzje strategiczne / aktualny stan** → [U-final-decisions-v5.md](U-final-decisions-v5.md) (NAJBARDZIEJ AKTUALNY)
- **Compliance / legal** → [A-rodo.md](A-rodo.md) + [legal-questions.md](../legal-questions.md)
- **Operacje / runbook / observability** → [W-12-dni-operacyjnych.md](W-12-dni-operacyjnych.md)
- **Sprzedaż / pre-validation** → [V-cold-outreach.md](V-cold-outreach.md)

Gdy szukasz konkretu — `Grep` po słowach kluczowych w katalogu `plan/`, potem `Read` tylko wybranego pliku.
