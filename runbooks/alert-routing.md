# Alert Routing

Konfiguracja kanałów alertów + on-call discipline. Implementacja `.ts` w `mm-control-plane/src/alerting/router.ts` (do zbudowania w Fazie 3).

## Channels (do skonfigurowania)

| Channel ID | Kanał | Adres | Status |
|------------|-------|-------|--------|
| `sms:jakub` | SMS Twilio/SMSAPI | +48 ... | 🔴 TODO — wybór provider (preferuję SMSAPI bo i tak go używamy) |
| `email:jakub` | Email | info@mixturemarketing.pl | ✅ JEST |
| `email:digest` | Email daily digest | info@mixturemarketing.pl | 🔴 TODO — osobny inbox lub label |
| `chat:critical` | Discord #critical | webhook URL | 🔴 TODO — utwórz Discord server `MixtureMarketing Ops` + 3 channels |
| `chat:ops` | Discord #ops | webhook URL | 🔴 TODO |
| `chat:digest` | Discord #digest | webhook URL | 🔴 TODO |
| `email:va` | Email VA | TBD (Faza 8) | 🚫 BLOCKED — po hire VA |
| `sms:va` | SMS VA | TBD (Faza 8) | 🚫 BLOCKED |

**✅ DECYZJA: Discord.** Powody:
- Free unlimited webhooks (Slack ma 10 na free plan)
- Free unlimited history (Slack 90 dni)
- Per-channel notification rules
- Rich embeds z kolorami (czerwony P1, żółty P2, etc.)
- Mobile push działa out-of-box
- VA growth path: $0 koszt (Slack $7/usr/mc)

**Setup (3 min — po założeniu serwera):**
1. https://discord.com/register
2. Stwórz server "MixtureMarketing Ops"
3. Stwórz 3 channels: `#critical` (P1 only), `#ops` (P2+P3), `#digest` (daily summary)
4. Per kanał: Settings → Integrations → Webhooks → New Webhook → Copy URL
5. Zapisz w 1Password jako `DISCORD_WEBHOOK_CRITICAL`, `DISCORD_WEBHOOK_OPS`, `DISCORD_WEBHOOK_DIGEST`
6. W Faza 1 (gdy budujemy alert router w mm-control-plane) → wstawimy jako wrangler secrets

## Routing table

```typescript
// mm-control-plane/src/alerting/router.ts (Faza 3)
const alertRoutes = {
  P1: ['sms:jakub', 'email:jakub', 'chat:critical'],
  P2: ['email:jakub', 'chat:ops'],
  P3: ['email:digest', 'chat:ops'],
  P4: ['chat:digest'],
};

// W Fazie 8 po hire VA:
const alertRoutesWithVA = {
  P1: ['sms:jakub', 'sms:va', 'email:jakub', 'chat:critical'],
  P2: ['email:va', 'email:jakub', 'chat:ops'],         // VA primary, Jakub cc
  P3: ['email:digest', 'chat:ops'],                    // VA picks up daily
  P4: ['chat:digest'],
};
```

## Discord embed format (P1)

Rich embed dla maksymalnej czytelności na mobile:

```json
{
  "embeds": [{
    "title": "🚨 P1 — Site offline: kowalski-slusarz.pl",
    "description": "HTTP 521 from health check\nDuration: 7 min",
    "color": 15158332,
    "fields": [
      { "name": "Client", "value": "clk_abc123", "inline": true },
      { "name": "Started", "value": "2026-05-18 14:23 UTC", "inline": true },
      { "name": "Runbook", "value": "[P1-client-site-offline](https://github.com/MixtureMarketing/binary-planet/blob/main/runbooks/P1-client-site-offline.md)" }
    ],
    "footer": { "text": "alt_xyz · ack: app.mixturemarketing.pl/alerts/alt_xyz" }
  }]
}
```

Colors: P1=red `15158332`, P2=yellow `15844367`, P3=blue `3447003`, P4=gray `9807270`.

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
