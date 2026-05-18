# @mixturemarketing/web-core

Core biblioteka dla wszystkich stron klientów MixtureMarketing — SEO, local, formularze, a11y, security, analytics, consent. Single package, multi-module via subpath exports.

**Status:** v0.0.1 — skeleton (Track B). Implementacja modułów: Faza 1.

## Importowanie

```ts
import { LocalBusinessSchema } from "@mixturemarketing/web-core/local";
import { createFormHandler } from "@mixturemarketing/web-core/forms";
import { buildCsp, securityHeaders } from "@mixturemarketing/web-core/security";
import { ConsentBanner, consentDefault } from "@mixturemarketing/web-core/consent";
```

**NIE** importuj z root entry (`@mixturemarketing/web-core`) — przez subpath dostajesz tree-shaking + clear deps.

## Moduły

| Subpath | Scope | Priority Faza 1 |
|---------|-------|-----------------|
| [`/seo`](src/seo) | Meta + Article + Org + Breadcrumb + FAQ + WebSite + WebPage + hreflang | **✅ DONE Track L-seo** |
| [`/local`](src/local) | **LocalBusiness + 15 subtypów** + sitemap + robots + llms.txt + PL helpers | **✅ DONE Track D** |
| [`/forms`](src/forms) | Turnstile + rate limit + Resend + fallback queue + RODO + AES-GCM PII | **✅ DONE Track F** |
| [`/a11y`](src/a11y) | Skip link + focus trap + live region + disclosure + breadcrumb + WCAG contrast + reduced motion | **✅ DONE Track A11y** |
| [`/security`](src/security) | CSP + HSTS + Permissions-Policy + SRI + nonce + 11 integration extensions | **✅ DONE Track K-security** |
| [`/feature-flags`](src/feature-flags) | KV-cached per-klient toggles + budget caps + global kill switches | **✅ DONE Track Feature Flags** |
| [`/regon`](src/regon) | GUS BIR1 SOAP client (NIP → firma) | P1 (gating: REGON key) |
| [`/programmatic`](src/programmatic) | service × location pages z guard rails (HCU-safe + similarity lint) | **✅ DONE Track E** |
| [`/consent`](src/consent) | RODO banner + Google Consent Mode v2 + preferences modal + audit log integration | **✅ DONE Track Consent** (gating: prawnik review) |
| [`/zaraz`](src/zaraz) | CF Zaraz server-side tagging config | P2 |
| [`/ads`](src/ads) | Conversion events ready + audiences | P3 (Faza 7 add-on) |

## Build

```bash
pnpm --filter @mixturemarketing/web-core build      # tsc -b
pnpm --filter @mixturemarketing/web-core test       # vitest
pnpm --filter @mixturemarketing/web-core typecheck
```

## Publishing

GitHub Packages (private). Wymaga GH PAT z `write:packages`:

```bash
NODE_AUTH_TOKEN=ghp_... pnpm --filter @mixturemarketing/web-core publish
```

Versioning: semver, ale na razie 0.0.x (pre-launch). 0.1.0 po pierwszej end-to-end live stronie klienta.
