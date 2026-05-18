# APPENDIX Q — Panel klienta (Customer Portal)

## Q.1 Cel

Każdy klient agencji (ślusarz, księgowy, lekarz) MUSI mieć **własny panel** żeby:
- Widzieć swoje leady w real-time
- Eksportować dane (RODO Art. 20)
- Zarządzać własnym CMS (Sveltia)
- Widzieć metryki swojej strony
- Zarządzać subskrypcją / fakturami
- Mieć poczucie kontroli nad swoimi danymi (psychologia + RODO)

**To jest część hub-and-spoke architektury** — panel klienta to widok do hub'a z perspektywy konkretnego klienta agencji.

## Q.2 Architektura

**Domain:** `panel.binary-planet.pl/[client-slug]` (centralny) lub opcjonalnie `panel.[client-domain].pl` (white-label dla Premium)

**Implementacja:**
- Astro Server Islands (część `binary-planet-control-plane`) z routing per client-slug
- Authentication: magic link email (Resend) + 2FA TOTP (opcjonalne dla Premium)
- Authorization: middleware sprawdza `session.client_id === path.client_id`
- Session storage: KV z 7-day TTL

## Q.3 Widoki w panelu klienta

```
panel.binary-planet.pl/[client-slug]
├── /                       (Dashboard — overview)
├── /leads                  (Lista leadów + filtry + eksport CSV/JSON)
│   ├── /                   (list)
│   └── /[leadId]           (detail, edit notes, mark as won/lost)
├── /reviews                (GBP reviews — preview, status response)
├── /metrics                (Live metryki: GBP views, GSC clicks, GA4 sessions, CWV)
├── /blog                   (Drafty AI do approval/edit, published posts)
├── /cms                    (Embed Sveltia CMS dla klienta — edycja cennika, treści)
├── /modules                (Co masz aktywne, co możesz aktywować — upgrade path)
├── /billing                (Faktury VAT z Fakturowni, historia płatności, change payment method)
├── /preview                (Live preview strony w iframe — co zobaczy odwiedzający)
├── /referral               (Twój kod referral, status, polecenia)
├── /api                    (Webhooks setup, API keys do ich CRM integration)
├── /support                (Ticketing system — pytania do agencji)
└── /settings
    ├── /profile            (Dane firmy, GBP link, dane kontaktowe)
    ├── /security           (2FA, password, sessions)
    ├── /privacy            (Eksport danych RODO, prawo do usunięcia)
    └── /team               (Dodaj sub-userów z ograniczonymi uprawnieniami — Premium tier)
```

## Q.4 Wymagania RODO dla panelu

- **Eksport danych** (Art. 20): klient w `/settings/privacy` klika "Eksportuj wszystkie moje dane" → backend generuje ZIP z (leads CSV, reviews JSON, content markdown, settings JSON, faktury PDF) → email z linkiem ważnym 24h
- **Prawo do usunięcia** (Art. 17): klient klika "Usuń moje konto" → 30 dni cooling-off period z możliwością cofnięcia → po 30 dniach: cascade delete wszystkich danych + audit log o usunięciu
- **Audit log dostępu** (Art. 32): każde logowanie, każdy eksport, każda zmiana zapisywane w `audit_log` table — klient może zobaczyć w `/settings/security/access-log`
- **Sub-processory transparency**: w `/settings/privacy` lista wszystkich sub-procesorów (Cloudflare, Resend, Anthropic, etc.) z DPF/SCC links

## Q.5 Magic Link auth flow

```
1. Klient wpisuje email w panel.binary-planet.pl
2. Backend (Worker) sprawdza: czy ten email jest associated z aktywnym klientem?
3. Jeśli tak: generuje token (signed JWT, 15min TTL) → wysyła email "Kliknij aby się zalogować"
4. Klient klika link → JWT verify → tworzy session (KV, 7d TTL) → redirect /[client-slug]
5. Jeśli Premium tier i klient ma 2FA: prompt o kod TOTP
6. Session cookie HttpOnly, Secure, SameSite=Strict
```

## Q.6 Integracje webhook (dla zaawansowanych klientów)

W `/api` klient może skonfigurować:
- **CRM webhook**: każdy nowy lead → POST do ich Pipedrive/HubSpot/Salesforce/własnego endpointu
- **Slack notify**: nowy lead → wiadomość na Slack channel klienta
- **Email forward**: dodatkowy email recipient dla leadów (np. recepcjonistka)
- **Zapier zap**: webhook compatibility z Zapier dla custom flows

Tylko Premium tier ma webhook configuration (mikrofirmy zwykle nie potrzebują).

---
