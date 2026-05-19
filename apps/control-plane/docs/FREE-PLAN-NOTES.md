# Free Workers plan — co działa, czego unikać, workaroundy

**Wniosek:** możesz wystartować MVP na **darmowym planie CF Workers** dla 1-5 pilotowych klientów. Dopiero przy ~50 leadach/dzień albo trwałym deploymencie produkcyjnym (~$5-10 zł/mc oszczędności w obrocie) — upgrade na Workers Paid (~5 zł/mc).

## Limity free plan vs nasze workload

| Zasób | Free | Co u nas |
|-------|------|----------|
| Workers requests | 100k/dzień | Spoke (site klienta) ~50 req/dzień + hub ~200 req/dzień = ~250/dzień per klient. 100k = ~400 klientów teoretycznie. |
| D1 reads | 5M/dzień | Bardzo daleko od limitu (nawet 100 klientów po 1k req/dzień = 100k reads) |
| D1 writes | 100k/dzień | Lead INSERT, session UPDATE, audit log — łatwo zostać poniżej dla 10 klientów |
| KV reads | 100k/dzień | Rate limit lookup + session checks — OK |
| **KV writes** | **1k/dzień** | ⚠️ **TIGHT.** Rate limit pisze KV per IP+email, sessions pisze KV per login. ~30 leadów/dzień × ~5 KV writes każdy = 150 writes. OK do ~5 klientów. |
| R2 storage | 10 GB | Backupy + faktury PDF — 10 GB to ~10k faktur. Wystarczy. |
| Custom domains | unlimited | OK |
| **Cron Triggers** | ❌ **NIE DZIAŁA** | Wymaga Workers Paid od 2023 |

## Co się stanie bez Cron Triggers

| Cron | Co robi | Workaround |
|------|---------|------------|
| `*/2 * * * *` `provision_pending_2min` | Provisioning po Stripe payment | **Manualny przycisk w admin** lub **external cron service** wywołujący `POST /api/admin/cron/run-now { job: "provision_pending_2min" }` co 5-10 min |
| `*/5 * * * *` `health_check_5min` | Monitoring stron klientów | External cron co 15 min |
| `0 8 * * 1` `ai_blog_weekly` | AI generuje drafty | External cron raz w tygodniu |
| `0 6 * * *` `backup_daily` | Backup D1 → R2 | External cron raz dziennie |
| Pozostałe (GSC/GA4 pulls, daily-digest) | v0.1 stubs | Skip dopóki nie masz Anthropic+DataForSEO |

## 🌐 External cron service — setup

### Opcja A: cron-job.org (zalecane, polski/europejski)

1. Zarejestruj się: **https://cron-job.org/en/signup/**
2. Po zalogowaniu **Cronjobs → Create cronjob**:

   | Pole | Wartość |
   |------|---------|
   | Title | `provision-pending` |
   | URL | `https://api.mixturemarketing.pl/api/admin/cron/run-now` |
   | Schedule | Every 10 minutes |
   | Request method | POST |
   | Request headers | `X-BP-Admin-Key: <Twój ADMIN_API_KEY secret>` |
   | Request body | `{"job":"provision_pending_2min"}` |
   | Notifications on failure | Twój email |

3. Powtórz dla każdego jobu:
   - `health-check` co 15 min → `{"job":"health_check_5min"}`
   - `ai-blog-weekly` co tydzień (Monday 08:00) → `{"job":"ai_blog_weekly"}`
   - `backup-daily` co dzień (06:00) → `{"job":"backup_daily"}`

**Free plan cron-job.org:** 50 jobów, 1 min interwał minimum. **0 zł/mc** dla naszych potrzeb.

### Opcja B: EasyCron, Cronitor, Uptime Robot (alternatywy)

Wszystkie wspierają POST + custom headers. EasyCron ma free plan z 1 jobem (mało). Cronitor ma free 5 jobs. Uptime Robot głównie do monitoringu ale można cron.

### Opcja C: GitHub Actions (free dla public, $0 dla private<2000 min/mc)

```yaml
# .github/workflows/run-cron.yml w binary-planet repo
name: External Cron
on:
  schedule:
    - cron: '*/10 * * * *'  # provisioning queue
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://api.mixturemarketing.pl/api/admin/cron/run-now \
            -H "X-BP-Admin-Key: ${{ secrets.ADMIN_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"job":"provision_pending_2min"}'
```

Plus secret `ADMIN_API_KEY` w Settings → Secrets and variables → Actions.

## 🔧 Setup ADMIN_API_KEY

Wygeneruj secret token (32+ znaków, randomowo):
```powershell
# PowerShell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Lub:
```bash
# bash/wsl
openssl rand -base64 32
```

Zapisz **2 razy**:
1. Lokalnie w `.dev.vars`:
   ```
   ADMIN_API_KEY="WygenerowanyToken=="
   ```
2. Production:
   ```powershell
   cd D:\KOD\binary-planet\apps\control-plane
   pnpm exec wrangler secret put ADMIN_API_KEY
   # paste wygenerowany token
   ```
3. W cron-job.org request headers — wklej ten sam token

## 🎮 Manualne odpalanie z admin UI

Po deploy w `app.mixturemarketing.pl/operations`:
1. Rozwiń sekcję **"Manualne uruchomienie cron jobs"**
2. Kliknij przycisk np. **provision_pending_2min**
3. Status pojawi się obok

**UWAGA dev**: w `apps/admin/src/pages/operations.astro` na górze sekcji `<script>` zmienna `ADMIN_API_KEY` jest pusta. To intencjonalnie — nie chcemy commitować secretu do repo. Dla dev wpisz lokalnie OR użyj curl:

```powershell
curl -X POST http://localhost:8787/api/admin/cron/run-now `
  -H "X-BP-Admin-Key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"job":"provision_pending_2min"}'
```

## ⚠️ Kiedy musisz upgrade na Workers Paid ($5/mc)

| Symptom | Co się dzieje | Rozwiązanie |
|---------|---------------|-------------|
| `KV PUT failed: write quota exceeded` | Przekroczyłeś 1k KV writes/dzień | $5/mc Paid → 1M writes/mc |
| `100K Requests/day exceeded` | Przekroczyłeś 100k req/dzień | $5/mc Paid → 10M/mc |
| `Cron triggers not enabled` | Bezpośrednio z błędu | $5/mc Paid włącza cron |
| Spike traffic powoduje rate limit dla klientów | Klienci dostają 1015 errors | $5/mc Paid eliminuje |

### Estymata kiedy upgrade

| Liczba klientów | Leady/dzień | Status |
|-----------------|-------------|--------|
| 1-3 | <20 | Free OK |
| 4-7 | 20-50 | Free TIGHT (KV writes) |
| 8-15 | 50-100 | Workers Paid wymagany |
| 15+ | 100+ | Workers Paid + monitoruj D1 writes |

**Praktyczna rada:** zacznij free, podłącz cron-job.org, **upgrade na Paid przed podpisaniem 4. klienta**.

## 💰 Pełen breakdown miesięcznych kosztów

Per **MixtureMarketing** (Twoja firma) niezależnie od klientów:

| Usługa | Koszt | Niezbędne kiedy |
|--------|-------|------------------|
| **CF Workers Free** | 0 zł | start |
| **CF Workers Paid** | ~$5 = 20 zł | od 4-5 klientów |
| **OVH domena `mixturemarketing.pl`** | ~40 zł / rok = 3.5 zł/mc | masz już |
| **Stripe** | 0 zł stałe + 2.4% + 1 zł od płatności | aktywne |
| **Fakturownia.pl Free** | 0 zł (do ~5 faktur/mc) | start |
| **Fakturownia.pl Mini** | ~25 zł/mc | od 5 klientów |
| **Resend** | 0 zł (3000 email/mc free) | aktywne |
| **SMSAPI.pl** | pay-as-go, ~7-10 gr/SMS | aktywne |
| **Anthropic Claude** | ~14 gr/post × 2 postów × N klientów | aktywne |
| **OVH domeny klientów** | ~40 zł/rok każda — wliczone w cenę pakietu klienta | aktywne |
| **Better Stack monitoring** | 0 zł free | nice-to-have |

**Total miesięcznie dla MM (przy 0 klientów):** ~0-3 zł
**Total dla MM przy 5 klientach (free CF):** ~5-10 zł
**Total dla MM przy 10 klientach (Paid CF):** ~50-70 zł

**Przychód przy 10 klientach × średnio 200 zł = 2000 zł/mc.** Marża ~95%.

## ✅ Decyzja

Jeśli pytanie brzmi "czy zaczniemy darmowo": **TAK**, przy 3 warunkach:
1. Nie korzystamy z cron triggers — używamy `/api/admin/cron/run-now` + cron-job.org
2. Akceptujemy ryzyko że ~5-7 klientów osiągniemy limit KV writes i będziemy musieli upgrade w środku dnia
3. Mamy bufor ($5) na karcie żeby kliknąć **Upgrade to Workers Paid** w 30 sekund jak się okaże

Jeśli pytanie brzmi "co rekomendujesz": **5 zł/mc Paid od początku** — w porównaniu do 1 leadu o wartości 100-500 zł jaki straci klient jeśli system się wywróci na 1k KV writes — to pomijalne.
