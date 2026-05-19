# Sveltia CMS OAuth proxy setup — Track 9

## Background

Sveltia CMS na stronie klienta (np. `kowalski-slusarz.pl/admin/`) potrzebuje commitować zmiany do GitHuba. Direct OAuth z przeglądarki nie zadziała (klient nie ma `client_secret`), więc używamy **server-side proxy** w hubie (`api.mixturemarketing.pl/api/sveltia/*`) który robi handshake z GitHub i zwraca access_token do popup'a Sveltia przez `postMessage`.

## 1. Stwórz GitHub OAuth App

**Settings → Developer settings → OAuth Apps → New OAuth App**:
- **Application name:** `MixtureMarketing — Sveltia CMS`
- **Homepage URL:** `https://mixturemarketing.pl`
- **Application description:** `Server-side OAuth proxy for klient CMS panels (Sveltia/Decap).`
- **Authorization callback URL:** `https://api.mixturemarketing.pl/api/sveltia/callback`

Po stworzeniu:
- Skopiuj **Client ID** (publiczny, format `Iv1.xxx`)
- Kliknij **Generate a new client secret** → skopiuj **natychmiast**

> **Organization OAuth App vs Personal:** zalecane stworzyć OAuth App pod **organizacją MixtureMarketing** (Settings → Developer settings) zamiast osobistym kontem. Dzięki temu permissions są shared między VA + Ty + przyszli pracownicy.

## 2. Wpisz secrety

```powershell
cd D:\KOD\binary-planet\apps\control-plane
notepad .dev.vars
```

```
GITHUB_OAUTH_CLIENT_ID="Iv1.abc123..."
GITHUB_OAUTH_CLIENT_SECRET="secret..."
```

Production:
```powershell
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_ID
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
```

## 3. Per-klient Sveltia config

Każdy klient ma własny repo (`MixtureMarketing/{slug}-site`) — Sveltia config musi to wskazywać. Track 4 (provisioning) generuje `apps/starter/public/admin/config.yml` z poprawnym `repo:` baked in:

```yaml
backend:
  name: github
  repo: MixtureMarketing/kowalski-slusarz-site   # ← per-klient
  branch: main
  base_url: https://api.mixturemarketing.pl/api/sveltia
  auth_endpoint: auth

local_backend: true   # auto-detect npx @sveltia/cms-proxy-server w dev
```

## 4. Flow

```
1. Klient otwiera kowalski-slusarz.pl/admin/
2. Sveltia ładuje config.yml + spera "Login with GitHub"
3. Klient klika login → Sveltia otwiera popup:
   https://api.mixturemarketing.pl/api/sveltia/auth?provider=github&site_id=kowalski-slusarz.pl&scope=repo
4. Hub generuje random state, zapisuje w KV (10min TTL),
   redirectuje do https://github.com/login/oauth/authorize?client_id=...&state=...&scope=repo
5. Klient autoryzuje w GitHub
6. GitHub redirectuje na https://api.mixturemarketing.pl/api/sveltia/callback?code=...&state=...
7. Hub:
   a. Sprawdza state w KV (anti-CSRF, one-time)
   b. POST github.com/login/oauth/access_token z client_id + client_secret + code
   c. GitHub zwraca access_token
   d. Hub renderuje HTML page:
      <script>
        window.opener.postMessage('authorization:github:success:{"token":"ghu_...","provider":"github"}', origin);
        window.close();
      </script>
8. Sveltia w głównym oknie odbiera message, zapisuje token w localStorage
9. Klient może teraz: dodawać posty → commit do swojego repo → CF Pages auto-deploy
```

## 5. Wymagana zgoda OAuth

GitHub poprosi klienta o autoryzację dostępu do:
- **Read+Write na repo** (scope `repo`) — Sveltia musi commit'ować

Klient musi mieć **konto GitHub + dostęp do repo `MixtureMarketing/{slug}-site`**.

> **Dla klientów bez konta GH:** VA loguje się swoim GitHubem (z dostępem do `MixtureMarketing` org), używa Sveltia w imieniu klienta. V0.2 może uprościć przez "service account GH" + edycję klienta przez panel klienta zamiast Sveltii.

## 6. Sanity check lokalnie

Sveltia OAuth wymaga **public URL** dla callback (GitHub nie redirectuje na localhost domain — choć localhost samo działa). Local test:

1. Odpal hub: `pnpm --filter mm-control-plane exec wrangler dev --port 8787`
2. Postawić `https://api.mixturemarketing.pl/api/sveltia/callback` jako Authorization callback URL w OAuth App (na czas testów) ALBO użyć cloudflared tunnel: `cloudflared tunnel --url http://localhost:8787`
3. Update OAuth App's callback URL → tunnel URL
4. W browserze otwórz `http://localhost:8787/api/sveltia/auth?provider=github&site_id=test.pl&scope=repo`
5. Powinno zredirectować na github.com/login/oauth/authorize

Dla tylko logicznego testu (bez OAuth):
```powershell
curl -i "http://localhost:8787/api/sveltia/auth?provider=github&site_id=test.pl"
# Oczekuj: 302 Location: https://github.com/login/oauth/authorize?client_id=...
```

## 7. Failure modes

| Co | Symptom | Reakcja |
|----|---------|---------|
| Brak `GITHUB_OAUTH_CLIENT_ID` | `500 OAuth not configured` | Set secret + redeploy |
| Klient zamknął popup OAuth | Sveltia czeka 60s, potem error toast | Klient klika "Log in" jeszcze raz |
| State expired (>10min idle w popup) | "Invalid or expired state" HTML | Klient zamyka popup + login znowu |
| GitHub user denied | `authorization:github:error:access_denied` postMessage | Sveltia pokazuje toast "denied" |
| Klient nie ma dostępu do repo | OAuth się powiedzie, ale Sveltia próbuje commit i dostaje 403 | Dodaj klienta jako collaborator w repo (Track 4-prod auto-doda) |

## 8. Bezpieczeństwo

- **State** — random 24 bytes, base64url, KV TTL 10min, single-use (delete-on-read)
- **Origin pinning** — `postMessage` target origin = `origin` z requestu start (zapisane w state). Fallback `*` tylko jeśli brak.
- **Token leak** — access_token przekazywany przez `postMessage` (nie URL/localStorage hub) → tylko legitimate popup-opener relationship dostaje token.
- **HttpOnly cookie?** — Decap/Sveltia używa `localStorage` (klient-side persistent), nie cookie. To by tymczasowo nie pasowało.

## 9. Rotation

Jeśli client_secret wycieknie:
1. GitHub → OAuth App settings → **Generate a new client secret**
2. `pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_SECRET`
3. `wrangler deploy`

Stary secret zostaje aktywny ~30s — klienci w trakcie OAuth mogą dostać błąd, ale nowe próby działają.

## 10. Per-klient OAuth Apps (TBD v0.2)

V0.1: jedna globalna OAuth App MixtureMarketing dla wszystkich klientów. Klient widzi "MixtureMarketing — Sveltia CMS" w autoryzacji.

V0.2 opcjonalnie: per-klient OAuth App = klient widzi "{Klient business name} CMS" — bardziej white-label. Wymaga GitHub App API (orchestrated) zamiast manual create. Niezbędne tylko przy enterprise klientach.
