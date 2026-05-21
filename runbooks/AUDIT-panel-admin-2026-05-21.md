# Panel + Admin E2E Audit — 2026-05-21

Metodologia: każda strona pod `apps/{panel,admin}/src/pages/**/*.astro` + `pages/api/**/*.ts` — cross-check każdy interaktywny element (form action, fetch URL, link href) względem istniejących routes/endpoints.

**Live:**
- https://panel.mixturemarketing.pl/login
- https://app.mixturemarketing.pl/login

Counts: panel 14 pages + 12 API, admin 14 pages + 8 API.

---

## mm-PANEL (klient panel)

### P0 — BLOCKERS

**P0-PANEL-1: Raporty `Pobierz PDF` button → 404**
- `apps/panel/src/pages/raporty.astro:23` konstruuje `pdf_url = "/api/raporty/download?month=..."` — **brak endpointu**. Anchor `:54` zwróci 404 gdy tylko Track 26 wstawi pierwszy `monthly_reports` row. Empty state ukrywa to TERAZ ale ships broken.
- **Fix:** stwórz `apps/panel/src/pages/api/raporty/download.ts` — GET R2 signed URL lub stream PDF z R2 bucket.

**P0-PANEL-2: Ustawienia `Logo firmy` link → 404**
- `apps/panel/src/pages/ustawienia.astro:906` linkuje do `/ustawienia/logo` — strona nie istnieje (dir `pages/ustawienia/` absent). Upload form na tej samej stronie DZIAŁA (POSTs do `/api/settings/logo-upload`), więc link tylko myli.
- **Fix:** usuń dead link (form już jest inline) lub utwórz `/ustawienia/logo.astro` jako dedicated page.

### P1 — WYSOKIE

**P1-PANEL-1: Leady — brak mutation statusu (mega gap)**
- `apps/panel/src/pages/leady.astro` pokazuje status badges (`new/contacted/qualified/won/lost`), tekst mówi że panel służy do zarządzania leadami, ale **NIE MA UI do zmiany statusu** + brak `/api/leads/[id]` endpoint.
- **Impact:** Klient nie może oznaczyć leada jako "won" → dashboard stat cards `wonLeads` zawsze 0 → cały Raporty revenue dead.
- **Fix:** dodaj `PATCH /api/leads/[id]` (status field) + dropdown w UI.

**P1-PANEL-2: Faktury PDF link → Stripe test dashboard (klient nie widzi)**
- `faktury.astro:79-85` linkuje do `dashboard.stripe.com/test/invoices/...` — klient nie ma Stripe account.
- **Fix:** użyj Stripe `hosted_invoice_url` (na payment row — DODAJ kolumnę lub fetch on-demand z Stripe API).

**P1-PANEL-3: RODO erasure no client-side validation / loading state**
- `rodo.astro:83` form POSTs bezpośrednio bez JS feedback. Backend rejection redirect do `/rodo?error=invalid_email` działa (`api/rodo/erasure.ts:40`).
- **Fix:** dodaj client-side loading state ("Wysyłanie..." na button) + inline error rendering bez full reload.

**P1-PANEL-4: Settings forms — success state fragile**
- Multiple forms (hero/hours/logo) używają "Zapisane ✓ (rebuild w toku)" jako button text — nie resetuje się dla wszystkich.
- Hours form (`:945`) nie resetuje button po success.
- **Fix:** ujednolicić setTimeout 2s reset dla wszystkich Save buttons.

**P1-PANEL-5: Integrations/Instagram/Competitor-monitoring API nie re-checkują addon status**
- UI gates by `addon active`, ale API endpoints (`save.ts`) prawdopodobnie nie re-check. Klient który deaktywuje addon między page load a save wciąż zapisuje config.
- **Fix:** w każdym save.ts dodaj `requireAddonActive(env.DB, clientId, "addon-slug")` jako first guard.

### P2 — ŚREDNIE

**P2-PANEL-1: Sidebar nie pokazuje aktywnych addonów**
- `apps/panel/src/components/Sidebar.astro:16-24`: Dashboard / Leady / Faktury / Raporty / Dodatki / Ustawienia / RODO — ale NIE Integracje, Instagram, Competitor-monitoring, Onboarding.
- Klienci docierają tylko via `/addons` lub `/ustawienia`.
- **Fix:** conditional sidebar entries based on `client.activeAddons`.

**P2-PANEL-2: Onboarding wizard submit button text**
- `onboarding.astro:622-647` na submit failure scrolluje do errors ale button text resets do "Zatwierdź..." z duplicated arrow `→`.

**P2-PANEL-3: Addons używa native `confirm()`**
- `addons.astro:235` — nie WCAG-friendly, nie da się stylować. Zastąpić modal component.

**P2-PANEL-4: Leady filters = full page reload**
- Anchor links (`<a href="/leady?status=...">`) zamiast client-side filtering. UX slow.

### P3 — POLISH

- `competitor-monitoring.astro:65` hardcoded URL `https://{businessName.toLowerCase()}/opinia` — `businessName` nie jest domeną, display bug. Use `primary_domain`.
- `faktury.astro:34` komentarz mix PL/EN: "Stripe invoice ID (will be replaced w Fakturownia number in Track 27)".
- `getConsentSummary` w `lib/db.ts` — verify że `total_leads` nie include already-erased.

---

## mm-ADMIN (agency panel)

### P0 — BLOCKERS

**P0-ADMIN-1: Onboarding [client_id]/config — brak manual provisioning override**
- `apps/admin/src/pages/onboarding/[client_id]/config.astro` ma dry-run button (`/api/onboarding/dry-run`), ale **admin nie może manualnie oznaczyć provisioning jako `done`** z UI. Fallback ol mówi "wróć do admina i zmień status" ale brak edit controla.
- **Impact:** Jeśli cron nie działa, admin stuck — musi SQL D1 bezpośrednio.
- **Fix:** dodaj `PATCH /api/clients/[id]/provisioning-status` + UI dropdown (pending/done/failed) na config page.

### P1 — WYSOKIE

**P1-ADMIN-1: Klienci list — brak search, brak create button link**
- `apps/admin/src/pages/clients/index.astro:31-49` ma status filter chips ale brak search input. Sidebar ma `/onboarding/new` dla creation ale `clients/index.astro` powinien też linkować.
- **Fix:** dodaj `<input type="search" placeholder="Szukaj klienta...">` + "Nowy klient →" link na top.

**P1-ADMIN-2: Client detail page — read-only (BRAK edit capability)**
- `apps/admin/src/pages/clients/[id].astro` displays everything read-only. Nie można zmienić tier, suspend/churn klient, dodać notes. Brak `/api/clients/[id]` PATCH endpoint.
- **Impact:** Większy gap feature.
- **Fix:** dodaj `PATCH /api/clients/[id]` (tier, status, internal_notes) + edit form na page.

**P1-ADMIN-3: Alerts — brak snooze + brak manual create**
- `alerts.astro:128-145` wires tylko ack/resolve. Brak snooze, brak manual create.
- **Fix path:** `POST /api/alerts/[id]/snooze` (duration param) + manual alert creation z `POST /api/alerts`.

**P1-ADMIN-4: Operations cron-run — brak error visibility**
- `operations.astro:92-97` hardcoded job list. Jeśli hub nie ma joba (`dataforseo_weekly`, `ai_blog_weekly`) — call zwraca error w status label ale brak clear UI distinction.
- **Fix:** rozróżnij "not configured" vs "failed" w UI badge.

**P1-ADMIN-5: Inbox/Leady — brak filter/search/actions**
- `apps/admin/src/pages/inbox/leads.astro` to read-only table. Brak filtrowania po klient, dacie, statusie. Brak per-lead actions.
- **Fix:** dodaj filter chips + per-lead "Open in panel klienta" link + "Mark spam" action.

### P2 — ŚREDNIE

**P2-ADMIN-1: AdminLayout — brak global search / command-K**
- Manageable dla v0.1 ale jak liczba klientów rośnie staje się friction.

**P2-ADMIN-2: Provisioning page retry — cross-page navigation friction**
- `provisioning.astro:140` mówi operatorowi kliknąć klient → "Retry provisioning". Można surface inline retry button na każdym failed row.

**P2-ADMIN-3: `/api/cron/run` whitelist — duplicate w UI + API**
- `api/cron/run.ts:15` allowed jobs whitelist matches UI buttons. Dodanie nowego cron = update w 2 miejscach.
- **Fix:** wyciągnąć listę do `shared/cron-jobs.ts` importowanego przez oba.

**P2-ADMIN-4: Onboarding/new wizard — brak progress indicator**
- `onboarding/new.astro` ma 9 sections z required fields scattered. Brak progress bar / step nav.
- **Fix:** dodaj sticky top progress bar (1/9 → 9/9) + ARIA `aria-current="step"`.

**P2-ADMIN-5: Login verify endpoint mismatch (cosmetic)**
- `middleware.ts:15` whitelist `/api/auth/verify` ale endpoint nie istnieje — verification jest na `/login/verify` (page). Same w panel middleware. Cosmetic.

### P3 — POLISH

- `clients/index.astro:23` tier label dict brak `professional` (Track 25 dodał — Starter/Standard/Premium/Professional). Wyświetli raw `professional` slug. Same w `wallet.astro:100` — tam HANDLED, inconsistency.
- `wallet.astro:130` używa `style="color: {expr}"` — Astro wymaga JSX `{...}`, może render literal. Verify.
- Badge class inconsistency: `alerts.astro` używa `badge-error`, `provisioning.astro` używa `badge-error` + `badge-danger` mix.
- `addons.astro` admin: tier label dict brak `professional`.

---

## Cross-cutting findings

- **API endpoint z no UI:** none — wszystkie `/api/**` są wired.
- **UI implying missing endpoint:** 3 critical gaps:
  - `/api/raporty/download` (panel) — P0
  - `/api/clients/[id]` PATCH (admin) — P1
  - `/api/leads/[id]` (panel) — P1
- **Auth gate robust:** middleware redirect unauth → `/login?next=...`, prevents logged-in users hitting `/login`, magic-link verify creates Secure HttpOnly cookie, D1 validation every request.
- **Empty states** mostly handled (dashboard, leady, faktury, raporty, alerts, inbox).
- **Stripe test URL leak** in faktury — production needs `hosted_invoice_url`.

---

## Top 5 fixes THIS WEEK (priority)

1. **`/api/raporty/download`** w panel — bez tego Raporty feature ships broken dnia gdy Track 26 wstawi pierwszy report row.
2. **Lead-status mutation** w panel klient (PATCH endpoint + dropdown) — bez tego dashboard "Wygrane / Przychód" zawsze 0.
3. **Faktury PDF link** → Stripe `hosted_invoice_url` zamiast test dashboard.
4. **Remove dead `/ustawienia/logo` link** (lub utwórz page) — form jest inline.
5. **Client edit w admin** (tier/status/notes) — currently admin musi hit D1 directly.
