# P3: Sveltia CMS bug

**Severity:** P3 — MEDIUM
**Response SLA:** 24h
**Fix SLA:** 7 dni
**Last updated:** 2026-05-18

## Symptoms

- Klient: "nie mogę edytować [sekcji]" / "po zapisaniu zniknęło" / "obrazki się nie wgrywają"
- W Sveltia console: JS errors w DevTools
- Git commits z Sveltia stop (klient próbuje save, nic się nie dzieje)
- Schema validation fail przy commit

## Impact

- Klient nie może self-serve (musi prosić Jakuba o edycję)
- Frustracja → potencjalny churn risk jeśli persistuje
- **Nie krytyczne** — strona działa, tylko CMS broken

## Diagnostic commands

```bash
# 1. Klient prześle screenshot DevTools console + Network tab (zapytaj o to)

# 2. Sprawdź repo klienta — git log Sveltia commits
gh api repos/mixturemarketing/mm-client-<CLIENT_ID>/commits?author=sveltia-bot --limit 5

# 3. Sprawdź Sveltia config klienta
# Plik: mm-client-<CLIENT_ID>/admin/config.yml

# 4. Sprawdź wersję Sveltia
# Plik: mm-client-<CLIENT_ID>/admin/index.html — wersja w <script src=>

# 5. Sprawdź czy GitHub API rate limit (Sveltia commituje via GH API)
gh api rate_limit
```

## Resolution steps

### Scenario A — Schema validation błąd

```bash
# Klient próbuje zapisać pole z wartością która nie pasuje do schema.

# 1. Identify schema mismatch z DevTools error
# 2. Albo: fix schema (zbyt restryktywne) w admin/config.yml
# 3. Albo: edukacja klienta jakie wartości akceptowane (dodaj hint w UI)
```

### Scenario B — Klient stracił dostęp (GitHub OAuth)

```bash
# Sveltia używa GitHub OAuth do commitowania.

# 1. Klient musi re-zalogować się
# 2. Jeśli klient nie ma GH account: nasz "MM Editor" GH App handluje to bez konta klienta
# TODO: po Faza 3 — implementacja
```

### Scenario C — Conflict (klient i Jakub edytowali jednocześnie)

```bash
# Sveltia może mieć stale state.

# 1. Klient odświeża stronę
# 2. Jeśli nadal conflict — manual merge w GH:
# - Klient prześle co chce zmienić
# - Jakub commituje manualnie + redeploy
```

### Scenario D — Image upload fail

```bash
# Sveltia uploaduje obrazki do GH repo (lub R2 jeśli skonfigurowany).

# 1. Sprawdź rozmiar — Sveltia ma limit 25MB (GH limit)
# 2. Jeśli klient próbuje większy: użyj R2 bucket
# TODO: po Faza 3 — image upload do R2 zamiast GH
```

### Scenario E — Bug w samej Sveltii (upstream)

```bash
# 1. Sprawdź Sveltia GH issues
gh issues list --repo sveltia/sveltia-cms --label bug

# 2. Workaround:
# - Pin starszej wersji Sveltii w klient repo
# - Edit manualny przez Jakuba do czasu fix
# - Jeśli krytyczne dla wielu klientów: PR do upstream
```

## Verification

```bash
# 1. Klient testuje save — działa
# 2. Commit pojawia się w GH
# 3. Deploy trigger uruchomił się
# 4. Zmiana widoczna na żywej stronie po deploy (~90s)
```

## Klient communication

```
Temat: Naprawione: edycja [sekcji] w panelu

Dzień dobry,

Naprawiłem problem z edycją [opis]. 
[Co się działo / co poprawione, 1-2 zdania].

Proszę spróbować ponownie i daj znać jeśli coś jeszcze nie działa.

Pozdrawiam,
Jakub
```

## Common causes

*(Pusta)*

## Prevention

- Per-client Sveltia config zawsze validowany przy onboarding
- Update Sveltia tylko po test na demo client + monitoring 48h
- Image upload przez R2 nie GH (limit handling)
