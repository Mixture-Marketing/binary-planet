# Sveltia CMS — panel edycji treści

Klient (lub VA) edytuje treści przez **Sveltia CMS** — git-based headless CMS
(fork Decap/Netlify CMS). Edycje commitują się bezpośrednio do repo klienta,
Astro przy następnym buildzie/requeście odbiera nową treść z `content/`.

## Co można edytować

| Collection | Folder | Typ | Co |
|------------|--------|-----|-----|
| **Aktualności** | `content/posts/` | markdown | Blog/artykuły — tytuł, data, excerpt, cover, tagi, body |
| **FAQ** | `content/faq/` | markdown | Pytanie + kolejność + odpowiedź |
| **Galeria** | `content/gallery/` | json | Image + caption + kolejność |
| **Ustawienia strony** | `content/site/overrides.json` | singleton json | Promo banner, pasek ogłoszeń, hero override |

**Co NIE jest edytowalne przez CMS** (świadoma decyzja):
- Provisioning data — nazwa firmy, NIP, adres, godziny otwarcia, lista usług, theme
  → te idą z `src/client.config.ts` ustawianego przez onboarding wizard
- Strony statyczne (kontakt, polityka prywatności) — szablon
- SEO meta — generowane automatycznie z `client.config.ts` + treści

## Architektura

```
public/admin/index.html       ← loader Sveltia CMS z CDN
public/admin/config.yml       ← definicje collections + backend
public/content/uploads/       ← media library (obrazy)
content/posts/*.md            ← edytowalne markdown
content/faq/*.md
content/gallery/*.json
content/site/overrides.json   ← singleton
src/content.config.ts         ← Astro content collections + zod schemas
```

## Auth (v0.1 — dev only)

Lokalnie używamy `local_backend: true` z Sveltia. Run:

```bash
# Terminal 1 — proxy serwer (fs writes)
npx @sveltia/cms-proxy-server

# Terminal 2 — Astro dev
pnpm --filter mm-starter dev
```

Następnie otwórz [http://localhost:4321/admin/](http://localhost:4321/admin/).
Sveltia wykryje proxy, otworzy panel bez auth, edycje zapisują się bezpośrednio
do `content/`.

## Auth (v0.2 production — TODO)

Production wymaga GitHub OAuth proxy (Sveltia loguje user przez GH, dostaje token,
commituje przez GH API). Plan:

1. **Worker**: `apps/auth-proxy/` — minimal Hono worker eksponujący `/api/auth/github`
   + `/api/auth/github/callback` (handshake OAuth → set HttpOnly cookie z access token)
2. **GitHub OAuth app**: scope `repo` (do commitów), redirect URI = `https://app.mixturemarketing.pl/api/auth/github/callback`
3. **config.yml**: ustawić `backend.base_url: https://app.mixturemarketing.pl`, `auth_endpoint: api/auth/github`
4. **Klient = VA**: początkowo tylko VA mają GH-konta zaproszone do `MixtureMarketing/<klient>-site` repo.
   Klient v0.3+ → email-link auth + Worker proxy commituje w imieniu klienta z service-account GH token.

## Editorial workflow

`publish_mode: editorial_workflow` — edytor robi PR (draft → in review → ready → publish).
Nie merguje bezpośrednio do main. Dla v0.1 z lokalnym backendem ten flow nie jest aktywny
(merge bezpośredni). W production z GH backendem — PRy automatycznie.

## Astro consumption

Czytanie treści w stronach:

```ts
import { getCollection, getEntry } from "astro:content";

// Lista aktualności (tylko opublikowane, najnowsze first)
const posts = (await getCollection("posts"))
  .filter((p) => p.data.published)
  .sort((a, b) => +b.data.date - +a.data.date);

// FAQ (sort by order)
const faqs = (await getCollection("faq"))
  .filter((f) => f.data.published)
  .sort((a, b) => a.data.order - b.data.order);

// Singleton overrides
const overrides = (await getEntry("site", "overrides"))?.data.overrides;
```

Strony konsumujące te collections (TODO osobny track):
- `/aktualnosci/` + `/aktualnosci/[slug]`
- `/faq/` (sekcja na stronie głównej lub osobno)
- `/galeria/` (jeśli klient ma usługę "before/after")

## Reference

- Sveltia: https://github.com/sveltia/sveltia-cms
- Astro Content: https://docs.astro.build/en/guides/content-collections/
