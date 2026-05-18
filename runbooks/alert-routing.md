# Alert Routing

Konfiguracja kanałów alertów + on-call discipline. Implementacja `.ts` w `mm-control-plane/src/alerting/router.ts` (do zbudowania w Fazie 3).

## Channels (do skonfigurowania)

| Channel ID | Kanał | Adres | Status |
|------------|-------|-------|--------|
| `sms:jakub` | SMS Twilio/SMSAPI | +48 ... | 🔴 TODO — wybór provider (preferuję SMSAPI bo i tak go używamy) |
| `email:jakub` | Email | info@mixturemarketing.pl | ✅ JEST |
| `email:digest` | Email daily digest | info@mixturemarketing.pl | 🔴 TODO — osobny inbox lub label |
| `slack:critical` | Slack #critical | webhook URL | 🔴 TODO — wybór: Slack vs Discord vs Telegram |
| `slack:ops` | Slack #ops | webhook URL | 🔴 TODO |
| `email:va` | Email VA | TBD (Faza 8) | 🚫 BLOCKED — po hire VA |
| `sms:va` | SMS VA | TBD (Faza 8) | 🚫 BLOCKED |

**Decyzja do podjęcia:** kanał chat — Slack (standard) vs Discord (tańszy, lepsze webhooki) vs Telegram (najtańszy, instant push na phone bez Slack app). Rekomendacja: **Discord** (free unlimited webhooks, bot dla rich embeds, mobile push działa out-of-box).

## Routing table

```typescript
// mm-control-plane/src/alerting/router.ts (Faza 3)
const alertRoutes = {
  P1: ['sms:jakub', 'email:jakub', 'slack:critical'],
  P2: ['email:jakub', 'slack:ops'],
  P3: ['email:digest', 'slack:ops'],
  P4: ['slack:ops'],
};

// W Fazie 8 po hire VA:
const alertRoutesWithVA = {
  P1: ['sms:jakub', 'sms:va', 'email:jakub', 'slack:critical'],
  P2: ['email:va', 'email:jakub', 'slack:ops'],        // VA primary, Jakub cc
  P3: ['email:digest', 'slack:ops'],                   // VA picks up daily
  P4: ['slack:ops'],
};
```

## On-call discipline

### In-hours (Pon–Pt 09:00–18:00)

- P1 reagujesz w **15 min**
- Phone + Slack desktop on, notifications nie wyciszone
- Jeśli na spotkaniu — przerywasz na P1

### Weekend (Sob 09:00–14:00 active, reszta passive)

- P1 reagujesz w **30 min** (Sob 09–14) / **60 min** (Sob popołudnie, Niedz)
- Phone on, Slack mobile push enabled
- Reszta — niedz 18:00 sprawdzasz digest

### Sleep mode (23:00–07:00)

- P1 → **tylko SMS** (e-maili nie sprawdzasz)
- P2/P3/P4 → digest rano (`email:digest` cron 07:00)
- Phone w "Do not disturb" z exception dla SMS Jakuba

### PTO / urlop

- Z 14 dni wyprzedzeniem: ogłoszenie + setup auto-response
- VA na call (jeśli zatrudniona) → P1 + P2
- Backup contact (osoba pełnomocna) → P1 jeśli VA niedostępna
- Bez VA + bez backup → max 3 dni offline, klient w regulaminie zna SLA "best effort weekend/holiday"

## Alert deduplication

Jeden incydent → jeden alert (nie 50). Reguły:

- **5 min window:** ten sam `client_id` + `alert_type` → tylko 1 alert
- **Flapping detection:** alert resolved + re-fires w <10 min → P1 escalation (incident może być cykliczny)
- **Mass incident:** >3 klientów dotkniętych w 5 min → P1 dla całej platformy (np. CF region down), 1 alert agregowany

Implementacja: KV `alert_dedup_<hash>` z TTL 5 min.

## Alert format (template)

```
[P1] Site offline: kowalski-slusarz.pl
Client: clk_abc123
Started: 2026-05-18 14:23:11 UTC
Duration: 7 min
Symptom: HTTP 521 on health check
Runbook: https://app.mixturemarketing.pl/runbooks/P1-client-site-offline
Acknowledge: https://app.mixturemarketing.pl/alerts/alt_xyz/ack
```

SMS format (160 chars):
```
[P1] kowalski-slusarz.pl offline 7min. HTTP521. RB: bit.ly/rb-offline
```

## Acknowledge flow

1. Alert przychodzi, dashboard pokazuje "OPEN" (czerwony)
2. Klikasz "Acknowledge" → status "ACKED", deduplication off (kolejne podobne nie spammują)
3. Pracujesz nad fixem (workflow w runbooku)
4. Resolve → "RESOLVED", deduplication on znowu

Bez acknowledge w 5 min od P1 → re-alert (SMS ponownie). Bez ack w 15 min → escalation do backup contact.

## Status page integration

P1 affecting >1 klienta + active >5 min → auto-publish na `status.mixturemarketing.pl` (Faza 6).
P1 single client → email do tego klienta + dashboard banner.

## Update log

- **2026-05-18** — pierwsza wersja, channels do skonfigurowania
