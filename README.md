# binary-planet (MixtureMarketing internal SaaS)

Wewnętrzna usługa SaaS agencji **MixtureMarketing.pl** — subskrypcyjne strony www + local SEO + GBP dla mikrofirm w PL.

Patrz [CLAUDE.md](CLAUDE.md) dla pełnego kontekstu projektu.

## Struktura

```
binary-planet/
├── packages/
│   ├── web-core/          @mixturemarketing/web-core — biblioteka SEO/local/forms/a11y/...
│   └── logger/            @mixturemarketing/logger — structured logging dla Workers
├── apps/
│   ├── starter/           mm-starter — template Astro 5 + CF Workers + Tailwind v4
│   ├── control-plane/     mm-control-plane — admin dashboard + Hub API (Astro + Hono + D1)
│   └── marketing/         mm-marketing — publiczna landing
├── runbooks/              operacje + incident response
├── plan/                  rozbity plan projektu (26 chunków)
└── *.md                   preflight / legal / regon trackers
```

## Setup (po pierwszym sklonowaniu)

```bash
# Wymagane:
# - Node 20.18+ (patrz .nvmrc)
# - pnpm 9.12+ (corepack enable && corepack prepare pnpm@9.12.0 --activate)
# - GitHub PAT z scope: read:packages (dla pulling @mixturemarketing/* z GH Packages)

export NODE_AUTH_TOKEN=ghp_...
pnpm install
pnpm typecheck
pnpm test
```

## Workflow

```bash
pnpm dev            # turbo run dev (wszystkie pakiety w watch)
pnpm build          # turbo run build
pnpm lint           # ESLint flat config
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit z project references
pnpm format         # prettier write
```

## Convention

- **TypeScript strict** + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`
- **Imports:** type-only przez `import type { X }` lub `import { type X }`
- **Workspace packages:** `@mixturemarketing/*` (scope musi match GitHub org)
- **Subpath exports w web-core:** `import { ... } from "@mixturemarketing/web-core/seo"`
- **Commit messages:** EN, imperative ("add", "fix", "refactor"), conventional commits opcjonalnie

## Status

**Faza 0 preflight** — patrz [preflight.md](preflight.md).
**Track B (monorepo skeleton)** — done.
