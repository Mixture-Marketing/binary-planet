# Resend domain verification + DKIM dla mixturemarketing.pl

Bez weryfikacji domeny Resend wysyła emaile z **`onboarding@resend.dev`** (zła deliverability + nie wygląda profesjonalnie). Po weryfikacji wysyłasz z **`leads@mixturemarketing.pl`** / `panel@mixturemarketing.pl` / `kontakt@mixturemarketing.pl`.

Konfiguracja: **3 rekordy DNS w CF** + 5 minut.

## 1. Załóż konto Resend

1. **https://resend.com/signup** — email + password
2. Po zalogowaniu: **Domains → Add Domain** → wpisz `mixturemarketing.pl`
3. Resend pokaże **3 rekordy DNS** do dodania w strefie domeny (na CF):

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | `send.mixturemarketing.pl` (auto) | `feedback-smtp.eu-west-1.amazonses.com` | 10 | Auto |
| TXT | `send.mixturemarketing.pl` (SPF) | `v=spf1 include:amazonses.com ~all` | — | Auto |
| TXT | `resend._domainkey.mixturemarketing.pl` (DKIM) | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...` (długi klucz) | — | Auto |

> Wartości są **per-Twoje-konto** — Resend wygeneruje unikalny DKIM klucz. Skopiuj DOKŁADNIE z dashboard, każdy znak ma znaczenie.

## 2. Dodaj rekordy w CF DNS

**https://dash.cloudflare.com → mixturemarketing.pl → DNS → Records → Add record**

### Rekord 1: MX (mail exchange)

| Field | Value |
|-------|-------|
| Type | `MX` |
| Name | `send` (CF auto-doda `.mixturemarketing.pl`) |
| Mail server | `feedback-smtp.eu-west-1.amazonses.com` |
| Priority | `10` |
| TTL | `Auto` |
| Proxy status | **DNS only** (szary chmurka — MX nie może być przez CF proxy!) |

### Rekord 2: TXT SPF

| Field | Value |
|-------|-------|
| Type | `TXT` |
| Name | `send` |
| Content | `v=spf1 include:amazonses.com ~all` |
| TTL | `Auto` |

### Rekord 3: TXT DKIM (najdłuższy — może 200+ znaków)

| Field | Value |
|-------|-------|
| Type | `TXT` |
| Name | `resend._domainkey` |
| Content | `p=<długi klucz publiczny>` (skopiuj DOKŁADNIE z Resend) |
| TTL | `Auto` |

> **UWAGA dla DKIM:** klucz może mieć cudzysłowy w Resend UI — w CF wklej **bez cudzysłowów** (CF doda automatycznie). Jeśli skopiujesz z cudzysłowami, dostaniesz "invalid TXT value".

### Opcjonalnie: rekord 4 — DMARC (rekomendowany)

| Type | Name | Content |
|------|------|---------|
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@mixturemarketing.pl; pct=100; adkim=s; aspf=s` |

DMARC daje raporty od Gmail/Outlook o tym kto wysyła emaile z Twojej domeny. Zaczynamy z `p=none` (tylko monitor) → po miesiącu zmieniamy na `p=quarantine`.

## 3. Verify w Resend

W Resend dashboard:
1. **Domains → mixturemarketing.pl → Verify DNS records**
2. Po dodaniu rekordów w CF, czekaj 1-5 minut (TTL propagation)
3. Klik "Verify" — Resend sprawdza wszystkie 3 rekordy
4. Status powinien zmienić się z `Pending` na `Verified`

Jeśli któryś rekord fail:
- **MX:** sprawdź czy nie jest proxy'owany (musi być DNS only — szary chmurka)
- **SPF:** czy nie masz drugiego SPF (możesz mieć tylko jeden TXT z `v=spf1`)
- **DKIM:** zwykle problem z cudzysłowami przy kopiowaniu — usuń je z value

## 4. Get API key

1. **API Keys → Create API Key**
2. Name: `MixtureMarketing — control-plane`
3. Permission: **Full access** (lub `Sending access` only — wystarczy)
4. Domain: `mixturemarketing.pl` (restrict do tej domeny)
5. Skopiuj `re_xxx...` — pokaże się tylko raz

## 5. Skonfiguruj w binary-planet

```powershell
cd D:\KOD\binary-planet\apps\control-plane

# .dev.vars (lokalnie)
notepad .dev.vars
```

```
RESEND_API_KEY="re_..."
RESEND_FROM="leads@mixturemarketing.pl"
```

Production:
```powershell
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM
```

**Te same secrety wstaw też w `mm-admin` + `mm-panel` Workerach** (dla magic linków):
```powershell
cd D:\KOD\binary-planet\apps\admin
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM   # "admin@mixturemarketing.pl"

cd D:\KOD\binary-planet\apps\panel
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM   # "panel@mixturemarketing.pl"
```

## 6. Test wysyłki

W `apps/control-plane/`:
```powershell
node --env-file=.dev.vars -e "
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'leads@mixturemarketing.pl',
    to: 'YOUR_EMAIL@gmail.com',
    subject: 'Resend test from MM',
    html: '<p>Działa!</p>',
  }),
}).then(r => r.text()).then(console.log);
"
```

Oczekiwany output:
```json
{"id":"<uuid>"}
```

Sprawdź skrzynkę gmail — powinien przyjść w <30s, w **Inbox** (nie spam, bo DKIM+SPF).

## 7. Subaddressing per klient (opcjonalnie)

W Resend możesz wysyłać z **dowolnego adresu** w zweryfikowanej domenie:
- `leads@mixturemarketing.pl` — lead notifications
- `panel@mixturemarketing.pl` — magic linki do panelu klienta
- `admin@mixturemarketing.pl` — magic linki do admina
- `noreply@mixturemarketing.pl` — auto-generated raports
- `rozliczenia@mixturemarketing.pl` — faktury z Fakturownia (forwarded by Fakturownia → klient widzi że od MM)

Nie musisz tworzyć osobnych "kont email" w hosting'u — wystarczy że `FROM:` jest w zweryfikowanej domenie.

## 8. Reply-to setup

Klient odpowiada na lead email z `kontakt@klient.pl` (Resend default reply-to = from). Lepsze UX: ustaw `reply_to` na klient email:

```js
fetch('https://api.resend.com/emails', {
  ...
  body: JSON.stringify({
    from: 'leads@mixturemarketing.pl',
    to: 'kowalski@kowalski-slusarz.pl',
    reply_to: 'pani.ania@example.com',  // ← lead email
    subject: 'Nowy lead od pani Ani',
    ...
  }),
});
```

To już jest w naszym kodzie (`packages/web-core/src/forms/resend.ts`) — nie musisz nic zmieniać.

## 9. Rate limits

Resend free tier:
- **3,000 emails/month** za free
- **100/dzień** rate limit
- 1 zweryfikowana domena

Wystarczy dla pierwszych ~10 klientów (każdy generuje ~10-30 emaili/mc: leady + magic linki + monthly reports). Upgrade na Pro ($20/mc) gdy: >100 emails/dzień lub potrzebujesz więcej domen.

## 10. Monitoring deliverability

Po pierwszych 10 emailach sprawdź:
1. Resend dashboard → **Emails** — status każdego emaila (delivered/bounced/spam)
2. Postmark Spamcheck (free): https://www.mail-tester.com — wyślij test email, sprawdza SPF/DKIM/DMARC + content
3. Google Postmaster Tools (po 7 dniach od pierwszej wysyłki): https://postmaster.google.com — daje insights w domain reputation

## 11. Troubleshooting

| Symptom | Co sprawdzić |
|---------|--------------|
| Resend pokazuje `Pending` dłużej niż 30 min | DNS records dodane w CF? `dig TXT resend._domainkey.mixturemarketing.pl` w terminalu |
| `403 You do not have a verified domain` | Verify nie przeszedł — refresh Resend dashboard, klik "Verify" jeszcze raz |
| Emaile lądują w spam | Sprawdź mail-tester.com — najczęściej DKIM albo DMARC missing |
| `401 invalid API key` | Klucz zaczyna się od `re_` (nie `sk_`)? Stary klucz zrotowany w dashboard? |
| Bounce rate > 5% | Klient end-user wpisuje nieprawidłowe emaile — dodaj walidację po stronie form (już mamy: Zod email schema) |

## 12. Rotacja API key

Resend → **API Keys → znajdź klucz → "Reuse" → Delete + Create new**

`wrangler secret put RESEND_API_KEY` z nowym kluczem dla każdej z 3 apek (control-plane, admin, panel).
