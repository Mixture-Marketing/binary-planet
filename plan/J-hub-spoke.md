# APPENDIX J — Hub-and-Spoke API Architecture

## J.1 Diagram architektury

```
                    ┌──────────────────────────┐
                    │   Control Plane (HUB)    │
                    │  api.binary-planet.pl    │
                    │  ┌────────────────────┐  │
                    │  │   Astro Dashboard  │  │
                    │  │  (admin UI dla Jakuba)│  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │   Hono API routes  │  │
                    │  │  /api/leads        │  │
                    │  │  /api/events       │  │
                    │  │  /api/health       │  │
                    │  │  /api/feature-flags│  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │  Scheduled Workers │  │
                    │  │  - GSC daily pull  │  │
                    │  │  - GA4 daily pull  │  │
                    │  │  - GBP daily pull  │  │
                    │  │  - DataForSEO weekly│ │
                    │  │  - Backup daily    │  │
                    │  │  - Health 5min     │  │
                    │  │  - Reports monthly │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │   D1 + KV + R2     │  │
                    │  └────────────────────┘  │
                    └──────────┬───────────────┘
                               │ HTTPS + API key auth
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌─────────┐      ┌─────────┐      ┌─────────┐
        │Client A │      │Client B │      │Client C │
        │ Worker  │      │ Worker  │      │ Worker  │
        │  (Astro)│      │  (Astro)│      │  (Astro)│
        └─────────┘      └─────────┘      └─────────┘
        slusarz-         mechanik-         ksiegowy-
        kowalski.pl      nowak.pl          smith.pl

                    External APIs (only HUB calls):
                    - Google Search Console API
                    - Google Analytics 4 Data API
                    - Google Business Profile API
                    - DataForSEO API
                    - Anthropic API (Claude)
                    - Resend API (email)
                    - SMSAPI.pl (SMS)
                    - Stripe + Przelewy24 API
                    - REGON BIR1 API (onboarding only)
                    - OVHcloud API (domain registration)
```

## J.2 Komunikacja Hub ↔ Spoke

**Spoke → Hub (push, REST API):**

Każda strona klienta dostaje `BP_CLIENT_API_KEY` (Worker secret, generowany w provisioning). Endpointy:

```
POST https://api.binary-planet.pl/api/leads
Headers: X-BP-Client-Key: ck_live_xxx
Body: { source, name, email, phone, message, service_interest, consent }

POST https://api.binary-planet.pl/api/events
Headers: X-BP-Client-Key: ck_live_xxx
Body: { event_name, params, visitor_id_hash, consent_state }

POST https://api.binary-planet.pl/api/health
Headers: X-BP-Client-Key: ck_live_xxx
Body: { worker_version, cwv_metrics, errors_last_hour }

GET https://api.binary-planet.pl/api/feature-flags
Headers: X-BP-Client-Key: ck_live_xxx
Response: { modules: {...}, last_updated: ISO }
```

**Hub → Spoke (pull/push):**

Hub może wymusić rebuild strony klienta przez GitHub API (trigger deploy workflow). Używane przy:
- Aktualizacji modułów (klient kupił dodatek → trigger redeploy)
- Aktualizacji wersji core (security patch w `@binary-planet/web-core` → bump dependency → redeploy)
- Forced cache flush

**Hub → External APIs (pull):**

Centralny scheduler (CF Cron Triggers):
- `0 2 * * *` — daily GSC pull dla wszystkich klientów (1 service account call per klient, batch)
- `0 3 * * *` — daily GA4 pull
- `0 4 * * *` — daily GBP insights + reviews fetch
- `0 5 * * 1` — weekly DataForSEO keyword rankings
- `0 6 * * *` — daily backup
- `*/5 * * * *` — health check ping wszystkich klientów

## J.3 Authentication & Rate limits

- `BP_CLIENT_API_KEY` per klient, zapisany jako Worker secret w spoke + zaszyfrowany w D1 `clients.api_key_hash`
- Rate limit per klient: 100 req/min na hub API endpoint (KV rate limit), wystarczy dla normalnego ruchu
- Anomaly detection: jeśli klient nagle robi 1000 req/min → alert + auto-throttle
- Key rotation: API endpoint `/api/keys/rotate` (admin only), nowy klucz pushowany do Worker secret + zapis hash do D1

## J.4 Failure modes

| Scenariusz | Co się dzieje |
|---|---|
| Hub down 1h | Strony klientów (statyczne) działają. Spoke `core/forms` ma **fallback queue**: jeśli hub nie odpowiada w 3s, lead zapisuje się w lokalnej KV szprychy + szprycha wysyła email DIRECTLY do ślusarza przez Resend (backup API key w secret szprychy). Cron co 5 min próbuje sync z hub. Po przywróceniu — wszystkie leady resync'owane do central D1. **Klient nigdy nie traci leadów.** |
| Spoke (1 klient) down | Tylko ten klient affected. Health check Worker po 2 fail w 10 min → alert do Jakuba + auto-attempt redeploy. |
| External API (Google) down | Cron pull failuje → retry w następnym cyklu. Dashboard pokazuje "Last sync: 2 days ago" warning. |
| D1 down | Migracja na backup D1 region (read replica), albo eventual consistency z R2 backup snapshots. |

---
