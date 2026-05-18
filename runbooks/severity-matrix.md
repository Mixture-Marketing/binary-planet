# Severity Matrix

Definicje poziomów ważności, SLA i eskalacji. Każdy alert MUSI mieć przypisany severity.

## Definicje

### P1 — CRITICAL

**Response:** 15 min (in-hours) / 30 min (weekend) / SMS-only (23:00–07:00)
**Fix:** 1h
**Postmortem:** obowiązkowy (48h)
**Klient powiadomiony:** TAK (w trakcie incydentu, nie po)

**Trigger conditions:**
- Strona klienta offline >5 min (`http_status >= 500` lub timeout)
- Lead form nie zapisuje danych (data loss risk)
- Stripe webhook failures (revenue impact, billing broken)
- Database corruption / data loss / unauthorized access
- Wyciek danych osobowych (RODO breach — także 72h zegar do UODO)
- Hub API (`api.mixturemarketing.pl`) down — kaskadowy fail
- SSL cert wygasł, nie odnawia się (klient widzi "Not secure")

### P2 — HIGH

**Response:** 1h
**Fix:** 24h
**Postmortem:** jeśli widoczne dla klienta
**Klient powiadomiony:** jeśli widoczne (TAK), jeśli tylko backend (NIE od razu)

**Trigger conditions:**
- GBP API failures >30 min (review monitoring broken)
- CWV degradation > tier threshold (LCP >2.5s, INP >200ms, CLS >0.1)
- SSL expiry < 7 dni (działa, ale grozi P1)
- Anthropic API >5% error rate (blog/content gen broken)
- Single client deploy failure (recurring po 3 próbach)
- DataForSEO API quota exceeded
- D1 read/write latency >1s p95
- Cron triggers przeskoczone (GSC daily pull failed 2x)

### P3 — MEDIUM

**Response:** 24h
**Fix:** 7 dni
**Postmortem:** nie wymagany
**Klient powiadomiony:** w monthly report, nie ad-hoc

**Trigger conditions:**
- Sveltia CMS bugs (klient nie może edytować pojedynczej sekcji)
- Dashboard widget errors (admin UI bugs)
- Citation submission failures (1 katalog z 30)
- Email delivery delays (Resend retry working)
- Programmatic page generation timeout (1 z 10)
- Health check intermittent fail (1 fail w 10 min, samo się odzyskało)

### P4 — LOW

**Response:** 7 dni
**Fix:** backlog
**Postmortem:** nie
**Klient powiadomiony:** nie

**Trigger conditions:**
- UI polishing
- Documentation gaps
- Feature requests bez urgency
- Optimization opportunities
- Minor a11y issues (kontrast borderline, focus styles inconsistent)

---

## Mapping → Alert routing

Patrz [alert-routing.md](alert-routing.md) dla pełnej tabeli kto-co-kiedy.

Skrótowo:

| Severity | Kanały | Sleep mode (23–7) | Weekend |
|----------|--------|-------------------|---------|
| P1 | SMS + email + Slack #critical | tylko SMS | SMS + email |
| P2 | email + Slack #ops | digest rano | email |
| P3 | email digest + Slack #ops | digest rano | digest |
| P4 | Slack #ops | digest rano | digest |

---

## Eskalacja

### Solo mode (Faza 0–4, ~5 mc)

1. **Jakub** — wszystkie severities, primary on-call
2. **VA (jeśli zatrudniona)** — P2/P3, batch approval
3. **Backup contact** — partnerska osoba (do ustalenia) — pełnomocnictwo na wypadek hospitalizacji/wypadku — dostęp read-only do panelu + numer Stripe/CF support

### Z VA (Faza 8+, ~40+ klientów)

1. **P1** → Jakub (primary) + VA (backup, 5 min delay)
2. **P2** → VA (primary) + Jakub (cc, escalation jeśli VA nie reaguje w 30 min)
3. **P3** → VA (primary, batch daily)
4. **P4** → VA backlog

---

## SLA breach handling

Jeśli SLA przekroczony:

- **P1 breach** — natychmiastowy postmortem + credit klienta (1 mc free + przeprosiny pisemne) + audit czemu
- **P2 breach** — credit klienta (50% mc) jeśli widoczne + audit
- **P3 breach** — wpis do "Common causes" + ticket do następnego sprintu

SLA breaches > 1/kwartał w P1/P2 = **sygnał do automatyzacji** (P1) lub **VA hire** (P2).

---

## Hours of operation

- **In-hours:** Pon–Pt 09:00–18:00 (czas warszawski)
- **Weekend:** Sob 09:00–14:00 (P1+P2 active monitoring)
- **Sleep mode:** 23:00–07:00 (P1 → SMS, reszta digest rano)
- **PTO:** ogłoszone z 14 dni wyprzedzeniem, backup contact aktywny

Klient widzi to w SLA (regulamin, sekcja "Wsparcie") — pierwsza wersja: response P1 w 30 min in-hours / 60 min weekend / next morning sleep mode. Po Fazie 5 zaostrzamy.

---

## Update log

- **2026-05-18** — pierwsza wersja, oparta na [W-12-dni-operacyjnych W.1.1](../plan/W-12-dni-operacyjnych.md)
