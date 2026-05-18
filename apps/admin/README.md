# mm-admin — panel administracyjny MixtureMarketing

**Stack:** Astro 5 (SSR) + Cloudflare Workers + Tailwind v4 + D1 (shared z `mm-control-plane`).
**Deploy target:** `app.mixturemarketing.pl`.
**Status:** ✅ Track J2 done (v0.1).

## Architektura

Czysty Astro app z adapterem `@astrojs/cloudflare` w trybie `output: "server"`. Współdzieli **tę samą bazę D1 (`mm-control-plane`)** co Hono hub API — zapis idzie przez hub API (kolejki/cron), admin głównie czyta + zarządza ustawieniami klientów.

```
apps/admin/
├── astro.config.mjs       ← CF adapter + Tailwind v4 plugin + platformProxy
├── wrangler.toml          ← shared D1/KV/R2 bindings + secrets list
├── src/
│   ├── middleware.ts      ← auth gate + CSP nonce + security headers
│   ├── env.d.ts           ← typed Astro.locals (user, nonce, runtime)
│   ├── lib/
│   │   ├── auth.ts        ← magic link + session cookie + Resend email
│   │   └── db.ts          ← D1 query helpers (stats, clients, leads, alerts)
│   ├── layouts/
│   │   ├── AdminLayout.astro  ← sidebar + main, requires auth
│   │   └── LoginLayout.astro  ← centered card, no auth
│   ├── components/
│   │   ├── Sidebar.astro
│   │   └── StatCard.astro
│   ├── pages/
│   │   ├── index.astro              ← Overview (4 stat cards + recent leads + alerts)
│   │   ├── login.astro              ← Email form → /api/auth/send-link
│   │   ├── login/verify.astro       ← Token → sets cookie → redirect
│   │   ├── clients/index.astro      ← Lista klientów + status filter
│   │   ├── clients/[id].astro       ← Szczegóły klienta + lead history
│   │   ├── inbox/leads.astro        ← Cross-client leads (100 most recent)
│   │   ├── alerts.astro             ← Open alerts (P1→P4)
│   │   ├── operations.astro         ← AI usage + health + cron runs
│   │   └── api/auth/
│   │       ├── send-link.ts         ← POST: create + email magic link
│   │       └── logout.ts            ← POST: revoke session + clear cookie
│   └── styles/admin.css   ← Tailwind v4 + custom design tokens
└── public/favicon.svg
```

## Auth (magic link)

1. User wpisuje email na `/login` → POST `/api/auth/send-link`.
2. Server szuka `admin_users` po email (status='active'), tworzy wpis w `admin_sessions` z 15-min expiry, generuje token `${sessionId}.${random32B}`.
3. Resend wysyła email z linkiem `/login/verify?token=…`.
4. Klik → `verifyMagicLink` rozszerza expiry do 24h, ustawia HttpOnly+Secure+SameSite=Lax cookie `mm_admin_session`.
5. Middleware na każdym requeście waliduje session, populuje `Astro.locals.user`.
6. Logout: POST `/api/auth/logout` → `revokeSession` + clear cookie.

**Dev mode:** brak `RESEND_API_KEY` → link logowany do konsoli zamiast wysyłki.

## Strony

| Path | Co pokazuje |
|------|-------------|
| `/` | Overview: 4 stat cards (klienci, leady dzisiaj/tydzień, alerty), top 5 leadów, top 5 alertów |
| `/clients` | Lista wszystkich klientów + filter status (active/pending/provisioning/paused/suspended/churned) |
| `/clients/[id]` | Szczegóły klienta: status, tier, lock-in, leady, moduły, notatki |
| `/inbox/leads` | 100 najnowszych leadów ze wszystkich klientów |
| `/alerts` | Otwarte alerty posortowane P1→P4 + runbook links |
| `/operations` | AI calls 24h + cost, health checks 1h, ostatnie 30 cron runs |

## Bindings (wrangler.toml)

| Binding | Typ | Współdzielone z |
|---------|-----|------------------|
| `DB` | D1 `mm-control-plane` | mm-control-plane |
| `CONFIG` | KV | mm-control-plane |
| `ADMIN_SESSIONS` | KV (separate) | tylko admin |
| `UPLOADS` | R2 `mm-uploads` | mm-control-plane |

**Secrets:** `RESEND_API_KEY`, `RESEND_FROM`, `SESSION_SIGNING_KEY`, `D1_ENCRYPTION_KEY` — set via `wrangler secret put`.

## Komendy

```bash
pnpm --filter mm-admin dev          # astro dev (localhost:4321, dev D1 via wrangler platformProxy)
pnpm --filter mm-admin build        # → dist/_worker.js/
pnpm --filter mm-admin preview      # wrangler dev na produkcyjnym buildzie
pnpm --filter mm-admin typecheck    # astro check
```

## Bezpieczeństwo

- CSP z `applySecurityHeaders` z `@mixturemarketing/web-core/security`, `integrations: { hubApi: true }`, **bez** trackerów marketingowych
- `img-src 'self' data:` (stricter niż starter)
- `<meta name="robots" content="noindex, nofollow">` w `AdminLayout` + `LoginLayout`
- HttpOnly + Secure + SameSite=Lax cookies
- Per-request CSP nonce
- Tokeny: 32 bajty random, base64url, sha256 hashed gdy storage (FUTURE: dla v0.1 storage przez sessionId+expiry)

## TODO (v0.2+)

- separate `magic_link_tokens` table z hashed token + email index (zamiast sessionId-as-link)
- 2FA TOTP dla roli `admin`
- audit log na każdą akcję (clients edit, status changes, etc.)
- bulk operations (CSV export leadów, mass status update)
- write-side: nie tylko czytaj — formularze do edycji klienta, ack alerts, etc.
- testy integracyjne (vitest + node:sqlite mock D1 — wzór z mm-control-plane)
