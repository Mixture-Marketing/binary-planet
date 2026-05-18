# Setup Playbook — administracyjne TODO (13 zadań)

Krok-po-kroku przewodnik dla zadań które Ty robisz manualnie. Każde zadanie:
- **Link** do strony do założenia
- **Co kliknąć** (krok po kroku)
- **Co zapisać** (gdzie + jako co)
- **Czas** szacunkowy
- **Co odblokuje** (impact)

**Kolejność rekomendowana** (od największego impact / najmniejszego czasu):

| # | Task | Czas | Koszt/mc | Odblokuje |
|---|------|------|----------|-----------|
| 1 | F10 git init + push GH | 5 min | $0 | CI/CD, GH Actions secrets |
| 2 | B7 GH org plan check | 1 min | $0 | nic — info gathering |
| 3 | H5 chat channel decyzja | 5 min | $0 | alerts routing |
| 4 | B6 Better Stack | 5 min | $0 | uptime monitoring |
| 5 | B8 CF Workers Paid | 5 min | $5 | **gating dla wszystkich Workers deploy** |
| 6 | B9 CF for SaaS activate | 2 min | $0 + usage | klient custom domains |
| 7 | H7 1Password + YubiKey | 30 min + 200 zł YubiKey | $0-7 | pre-launch gating dla bezp. sekretów |
| 8 | B1 Anthropic API | 10 min | ~$200 | blog AI, content gen |
| 9 | B3 Resend + DKIM | 20 min | $0–20 | form lead emails (prod) |
| 10 | A4 Fakturownia | 15 min | $0 trial | invoicing pierwszego klienta |
| 11 | B2 DataForSEO Basic | 10 min | $50 | keyword rankings (Faza 5) |
| 12 | B5 OVHcloud API | 15 min | $0 | auto-rejestracja domen klientów (Faza 3) |
| 13 | B4 SMSAPI.pl | 20 min + KYC | 100 zł prepaid | review request SMS (Faza 5) |

**Łączny czas:** ~2h aktywnego klikania + czekanie na KYC (B4, jeśli wymaga) + zakup YubiKey.

---

## ✅ ZROBIONE PRZEZE MNIE

### F10. git init + initial commit ✅

```
Repo: d:\KOD\binary-planet\
Branch: main
Initial commit: 7bfa002 ("Initial commit: binary-planet skeleton (Tracks A-L)")
Files: ~190 plików
Linie: ~36 700 (kod + testy)
```

**Co dalej (Ty kliknij):**

```bash
# 1. Stwórz repo na GitHubie:
gh repo create MixtureMarketing/binary-planet --private \
  --description "MixtureMarketing internal SaaS — local SEO sites for Polish micro-businesses"

# 2. Dodaj remote + push:
cd d:/KOD/binary-planet
git remote add origin https://github.com/MixtureMarketing/binary-planet.git
git push -u origin main
```

**Notatka:** `MixtureMarketing` to **user account**, NIE organization (`gh api orgs/mixturemarketing` → 404). Działa to dla GH Packages (lowercase scope), ale długoterminowo lepiej **utworzyć organizację** (Faza 4+): pozwala VA collaborators, separate billing, audit log.

### B7. GH org check ✅

- `MixtureMarketing` — user account, 10+ private/public repos
- Created: 2024-11-19
- Token scope OK (read:org, write:packages, repo)
- `gh auth status` → logged in via keyring

### H5. Chat channel — rekomendacja: Discord ✅

**Dlaczego Discord (vs Slack/Telegram):**

| Cecha | Slack | Discord | Telegram |
|-------|-------|---------|----------|
| Webhooks unlimited | ❌ Free plan 10 | ✅ Free unlimited | ✅ Bot unlimited |
| Mobile push | ✅ | ✅ | ✅ best |
| Rich embeds | ✅ | ✅ best (kolor + buttons) | ❌ markdown only |
| Per-channel mute | ✅ | ✅ | ✅ |
| Free plan history | 90 dni | ∞ | ∞ |
| Wzrost zespołu (VA) | $7/usr | $0 | $0 |
| Wbudowane stałe widoki | ✅ | ✅ | ❌ chat only |

**Setup Discord (3 min):**
1. `https://discord.com/register` jeśli nie masz konta
2. Stwórz server "MixtureMarketing Ops"
3. Stwórz channels: `#critical`, `#ops`, `#digest`
4. Per kanał: Settings → Integrations → Webhooks → New Webhook → Copy URL
5. Zapisz w 1Password / Bitwarden jako `discord_webhook_critical`, `discord_webhook_ops`, `discord_webhook_digest`
6. W Faza 1 (gdy budujemy alert router w mm-control-plane) — wstawimy webhook URL jako wrangler secret

Konfigurację webhook routing dodaję teraz do [runbooks/alert-routing.md](runbooks/alert-routing.md).

---

## 🔴 DO ZROBIENIA PRZEZ CIEBIE — kolejność od najwyższego impactu

### B6. Better Stack (free) — 5 min, $0

**Co:** Uptime monitoring + status page placeholder. Free tier daje 10 monitorów.

**Kroki:**
1. https://betterstack.com/sign-up
2. Sign up via Google / email
3. Po zalogowaniu: Heartbeats → Create heartbeat → "mm-control-plane"
4. Period: 5 min (matches our cron `*/5 * * * *`)
5. **Zapisz URL** w 1Password jako `BETTER_STACK_HEARTBEAT_URL`
6. (Faza 5) — wstawimy do mm-control-plane jako wrangler secret; control-plane co 5 min ping'uje ten URL

**Co odblokuje:** External validation że nasz Worker żyje (nasz health-check cron monituje klientów, Better Stack monituje NAS).

---

### B8. Cloudflare Workers Paid — 5 min, **$5/mc** — **KRYTYCZNE GATING**

**Co:** Upgrade CF plan z Free → Workers Paid. Wymagane dla:
- Cron Triggers (Workers Free ma tylko 1 cron, Paid unlimited)
- D1 produkcyjne limity (5GB storage + 50M reads/day vs Free 5M)
- KV produkcyjne limity
- R2 storage
- 30s CPU time (Free: 50ms)

**Kroki:**
1. https://dash.cloudflare.com → konto Free
2. Workers & Pages → klik any worker (lub stwórz hello-world) → "Plans" / lub direct: https://dash.cloudflare.com/workers/plans
3. Workers Paid → $5/mc → Add payment method → Subscribe

**Decyzja konta:**

| Opcja | Plus | Minus |
|-------|------|-------|
| Konto osobiste Jakuba (current) | Najszybsze | Tied to personal email, hard to transfer |
| Nowe konto z `info@mixturemarketing.pl` | Clean separation, transferable | Setup od zera |

**Rekomendacja:** Stwórz nowe konto pod `info@mixturemarketing.pl` lub `cf@mixturemarketing.pl`, jeśli nie masz. Potem `Members` → invite osobiste konto jako Administrator (dual access). To daje "MixtureMarketing-owned" konto które można przekazać.

**Po upgrade:**
- Zapisz konto Cloudflare jako `cloudflare_owner_email` w 1Password
- Wygeneruj API token: My Profile → API Tokens → Create Token → Custom token
  - Permissions: Workers Scripts (Edit), Workers KV Storage (Edit), Workers R2 Storage (Edit), D1 (Edit), DNS (Edit), Cache (Purge), Account (Read)
  - Account Resources: Include — specific account
  - Zone Resources: Include — All zones (lub specific mixturemarketing.pl)
- Zapisz token jako `CF_API_TOKEN` w 1Password

**Co odblokuje:** **Pełen deploy stack**. Bez tego mm-control-plane + mm-starter nie pojadą prod. Zacznij od tego po Better Stack.

---

### B9. Cloudflare for SaaS activate — 2 min, $0 + usage

**Co:** Aktywacja Custom Hostnames API. Pozwala każdemu klientowi mieć własny domain (`kowalski-slusarz.pl`) wskazujący na nasz Worker.

**Kroki:**
1. Po B8 (Workers Paid aktywne): CF dashboard → SSL/TLS → Custom Hostnames
2. Najpierw potrzebujesz **fallback origin** (placeholder Worker który zwraca 200)
3. Klik "Enable" / setup wizard
4. Wybierz zone `mixturemarketing.pl` jako apex zone dla custom hostnames

**Pricing:** Free do 100 custom hostnames, potem $0.10/hostname/mc. Dla nas to znacznie taniej niż każdy klient własny CF account.

**Co odblokuje:** Klient kupuje stronę → my deploy Worker → klient dostaje DNS instructions → custom hostname się weryfikuje → SSL auto-renew. Critical dla Faza 3 onboarding workflow.

---

### H7. 1Password / Bitwarden + YubiKey — 30 min + 200 zł zakup

**Co:** Password manager + hardware 2FA dla **wszystkich** sekretów (master vault).

**Rekomendacja:** **1Password Business** ($8/usr/mc) lub **Bitwarden Premium** ($10/rok).

| Funkcja | 1Password Business | Bitwarden Premium |
|---------|-------------------|-------------------|
| Cena | $8/usr/mc | $10/rok per user |
| Hardware key (YubiKey) | ✅ | ✅ |
| Sharing z VA później | ✅ best | ✅ via shared collections |
| Cloud lub self-hosted | Cloud | Cloud OR self-hosted (Vaultwarden) |
| Polski intl. | ✅ | ✅ |

**Rekomendacja: Bitwarden** — taniej, OS, jeśli zechcesz self-host później (Vaultwarden działa w 50MB RAM).

**YubiKey zakup:** 
- **YubiKey 5C NFC** (~200 zł, https://www.yubico.com/store/) — USB-C + NFC, działa z telefonem
- Lub **YubiKey 5 NFC** (USB-A, ~180 zł) jeśli laptop ma USB-A

**Po setupie:**
1. Vault: stwórz folder "MixtureMarketing — Production Secrets"
2. Włącz 2FA hardware key na vault + GitHub + Cloudflare + Stripe + Anthropic
3. Backup recovery codes na drugim YubiKey (kup 2, drugi w sejfie/u rodziny)

**Pre-launch gating:** Bez tego NIE deployujemy klienta nr 1 (zbyt duże ryzyko key leakage).

---

### B1. Anthropic API key + payment — 10 min, ~$200/mc cap

**Co:** API key dla Claude Opus 4.7 / Sonnet 4.6 — używane w blog AI (Faza 7), content gen (Faza 3 onboarding wizard), GBP review response suggester (Faza 5).

**Kroki:**
1. https://console.anthropic.com/ → Sign Up
2. Account Settings → Plans → Workspace Plan: zostaw "Build" (pay-as-you-go)
3. Settings → Billing → Add payment method (karta firmowa MixtureMarketing)
4. Settings → Billing → **Set monthly cost limit: $200** (hard cap)
5. Settings → API Keys → Create Key → Name: "mm-control-plane-prod-2026q2"
6. **Skopiuj klucz** (zaczyna się od `sk-ant-api03-...`) — wyświetlany TYLKO RAZ
7. Zapisz w 1Password jako `ANTHROPIC_API_KEY` + tag `provider:anthropic` `env:production`
8. (Faza 1) — `wrangler secret put ANTHROPIC_API_KEY --env production`

**Co odblokuje:** Wszystkie AI features. Tier 1 daje 50 RPM / 40k input TPM — wystarczy dla startu.

---

### B3. Resend + DKIM dla mixturemarketing.pl — 20 min, $0–20/mc

**Co:** Email API do forward leadów z formularzy klientów. Plan Free: 100 emails/dzień, 3000/mc — wystarczy do ~30 klientów.

**Kroki:**

1. **Resend signup:** https://resend.com/ → Sign Up via Google / email firmowy
2. Dashboard → Domains → Add Domain → wpisz `mixturemarketing.pl`
3. Region: **EU (Frankfurt)** — RODO + lower latency dla PL klientów
4. **Resend pokaże 3 DNS records do dodania.** Format zwykle:

```
Type: MX
Name: send
Value: feedback-smtp.eu-west-1.amazonses.com
Priority: 10

Type: TXT
Name: send
Value: v=spf1 include:amazonses.com ~all

Type: TXT
Name: resend._domainkey
Value: p=<long DKIM public key>
```

5. **Dodaj do DNS w Cloudflare** (Cloudflare dash → DNS → Records → Add):
   - **WAŻNE:** Wszystkie 3 z **Proxy status = DNS only** (gray cloud), nie Proxied (orange)
6. Wróć do Resend → klik "Verify Domain" → czekaj 5–10 min na propagację
7. Po verified: Dashboard → API Keys → Create → Name: `mm-spoke-prod`, Permission: "Sending access" only
8. Zapisz w 1Password jako `RESEND_API_KEY` + `RESEND_FROM=leads@mixturemarketing.pl`

**Co odblokuje:** Form lead emails działają w produkcji. Bez tego web-core/forms wysyła leady tylko do hub D1, klient nie dostaje email.

**Sanity check po setupie:**
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer <KLUCZ>" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "leads@mixturemarketing.pl",
    "to": "info@mixturemarketing.pl",
    "subject": "Test Resend",
    "text": "Działa"
  }'
```

---

### A4. Fakturownia.pl + API key — 15 min, $0 trial / ~39 zł/mc

**Co:** Faktury VAT auto-generowane po opłacie klienta (Stripe webhook → Fakturownia API → PDF + JPK_V7 export). Polski VAT compliance.

**Kroki:**
1. https://app.fakturownia.pl/signup (lub https://fakturownia.pl/ → "Wypróbuj za darmo")
2. Trial 14 dni, potem wybierz plan:
   - **Premium** (39 zł/mc) wystarczy dla pierwszych ~50 faktur/mc
3. Settings → Konfiguracja firmy → wpisz dane MixtureMarketing (NIP, adres, REGON, numer KRS jeśli sp.)
4. Settings → Numeracja faktur → wzór: `FV/{Y}/{M}/{N}` lub `MM/{Y}/{NNNN}`
5. Settings → API → wygeneruj token
6. Zapisz w 1Password jako `FAKTUROWNIA_API_TOKEN` + `FAKTUROWNIA_ACCOUNT_NAME` (np. "mixturemarketing")

**Co odblokuje:** Auto-invoice po payment. Bez tego musisz wystawiać faktury manualnie (~5 min × X klientów / mc).

---

### B2. DataForSEO Basic — 10 min, $50/mc

**Co:** Keyword rankings + SERP analysis + backlinks. Dla Faza 5 (citation tracking) i Faza 7 (blog topic clustering).

**Kroki:**
1. https://dataforseo.com/sign-up
2. Verify email
3. Plans → Basic ($50/mc) → ale **NIE płać jeszcze** — wybierz "Pay as you go" na początku ($1 minimum deposit, opłaty za request)
4. API Access → wygeneruj credentials (login + password — basic auth, nie token)
5. Zapisz w 1Password jako `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`

**Decyzja billing:** Pay-as-you-go pierwsze 3 mc → przelicz koszty z faktycznego użycia → przejdź na Basic gdy stabilne.

**Co odblokuje:** Faza 5 keyword tracking. Możesz odłożyć — nie blocker dla pierwszego klienta.

---

### B5. OVHcloud API key — 15 min, $0

**Co:** API do auto-rejestracji domen klientów (`.pl` przez OVH najtaniej, ~25 zł/rok).

**Kroki:**
1. https://www.ovh.pl/ → konto firmowe (jeśli nie masz, możesz użyć osobistego)
2. https://api.ovh.com/createToken/ — kreator tokena
3. Application name: `mm-control-plane-domain-mgmt`
4. Application description: `Automatic .pl domain registration for client sites`
5. Validity: **unlimited** (CF zarządza zone, OVH tylko registrar)
6. Rights — minimum scope:
   - `GET /domain/zone/*`
   - `POST /domain/order/cart`
   - `PUT /domain/zone/*`
   - `GET /me`
7. Submit → otrzymasz 3 wartości:
   - **Application Key** (`AppKey`)
   - **Application Secret** (`AppSecret`)
   - **Consumer Key** (`ConsumerKey`)
8. Zapisz w 1Password jako `OVH_APP_KEY`, `OVH_APP_SECRET`, `OVH_CONSUMER_KEY`

**Pre-fund OVH account:** Dodaj ~500 zł do salda OVH (Settings → Payment methods). Każda rejestracja domeny automatycznie pobiera z salda — bez salda fail.

**Co odblokuje:** Wizard step 11 (klient wybiera domenę) działa auto bez Twojej interwencji. Można odłożyć — w pierwszych klientach możesz rejestrować ręcznie.

---

### B4. SMSAPI.pl — 20 min + KYC, 100 zł prepaid

**Co:** SMS dla review request flow (po form-submit → 7 dni → SMS z linkiem do GBP review).

**Kroki:**
1. https://www.smsapi.pl/ → Rejestracja konta firmowego
2. Aktywuj NIP (wpisz NIP MixtureMarketing, system weryfikuje przez BIR)
3. Akceptacja regulaminu + RODO
4. Wybierz nazwę nadawcy (Sender ID):
   - Opcja A: **"MixtureMrkt"** (max 11 znaków alfanumeryczne) — Twoja marka
   - Opcja B: **"INFO"** (predefined free)
   - Opcja C: **"<KlientName>"** (per klient, wymaga osobnej weryfikacji każda)
5. Wybierz typ konta: **Pro** (większy limit, lepsze ceny)
6. Doładuj saldo — minimum **100 zł** (~330 SMS-ów)
7. Settings → OAuth 2.0 / API Token → wygeneruj token
8. Zapisz w 1Password jako `SMSAPI_TOKEN`

**KYC:** SMSAPI weryfikuje firmowość konta — może zająć **1–3 dni roboczych** dla pierwszego konta. Jeśli pilne — masz alternative: Twilio (droższe, instant).

**Co odblokuje:** Faza 5 review request flow. Można odłożyć aż do pierwszego klienta z tier Standard+.

---

## Workflow zalecany — pierwszy weekend

**Sobota (~1h):**
1. F10 push do GitHubu (`gh repo create` + `git push`) — 5 min
2. B7 — już done ✅
3. H5 — Discord 3 channels — 5 min
4. B6 Better Stack signup + heartbeat URL — 5 min
5. B8 CF Workers Paid upgrade — 5 min
6. B9 CF for SaaS activate — 2 min
7. **PAUZA** — zamów YubiKey (czekanie ~2–5 dni na dostawę)

**Niedziela / wieczór (~30 min):**
8. B1 Anthropic key — 10 min
9. B3 Resend signup + DNS records w CF — 20 min
10. **Verify Resend** — może wymagać 10 min czekania na DNS propagation

**Następny tydzień (po YubiKey):**
11. H7 1Password / Bitwarden + YubiKey enroll — 30 min
12. **Przenieś wszystkie sekrety z poprzednich kroków do vault z hardware 2FA**
13. A4 Fakturownia setup — 15 min
14. B5 OVH API key — 15 min

**Później (gdy potrzebne):**
15. B2 DataForSEO — kiedy zaczynamy Faza 5
16. B4 SMSAPI + KYC — kiedy zaczynamy Faza 5 review flow

---

## Po wszystkim — verify

Stwórz plik `.dev.vars` w `apps/control-plane/` (NIE commituj — w `.gitignore`):

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
RESEND_API_KEY=re_...
RESEND_FROM=leads@mixturemarketing.pl
SMSAPI_TOKEN=...
FAKTUROWNIA_API_TOKEN=...
FAKTUROWNIA_ACCOUNT_NAME=mixturemarketing
OVH_APP_KEY=...
OVH_APP_SECRET=...
OVH_CONSUMER_KEY=...
BETTER_STACK_HEARTBEAT_URL=https://uptime.betterstack.com/api/v1/heartbeat/...
DISCORD_WEBHOOK_CRITICAL=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_OPS=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_DIGEST=https://discord.com/api/webhooks/.../...
```

Te wartości potem przeniesiemy do produkcji przez `wrangler secret put` — `.dev.vars` jest tylko dla `wrangler dev --local`.

**Update preflight.md** z każdym ✅ done — patrz [preflight.md](preflight.md) sekcje A, B, C, H.
