# @mixturemarketing/web-core/security

HTTP security headers + CSP builder. Target: **securityheaders.com grade A+**. Track K-security done.

## Quick start

### Astro (z middleware)

```ts
// src/middleware.ts
import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";

export const onRequest = async (context, next) => {
  const nonce = generateNonce();
  context.locals.nonce = nonce; // dostępne w komponentach jako Astro.locals.nonce

  const response = await next();
  return applySecurityHeaders(response, {
    nonce,
    integrations: {
      turnstile: true,        // dla form handler
      plausible: true,         // domyślne analytics
      hubApi: true,            // dla /api/feature-flags itp.
    },
  });
};
```

W komponencie:

```astro
---
const { nonce } = Astro.locals;
---
<script nonce={nonce}>
  // inline kod tylko z nonce — bez nonce CSP blokuje
</script>
```

### Hono

```ts
import { Hono } from "hono";
import { securityMiddleware } from "@mixturemarketing/web-core/security";

const app = new Hono();
app.use("*", securityMiddleware({
  integrations: { turnstile: true, plausible: true },
}));

app.get("/", (c) => {
  const nonce = c.get("nonce"); // automatycznie generowany przez middleware
  return c.html(`<script nonce="${nonce}">...</script>`);
});
```

### Worker fetch (raw)

```ts
import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";

export default {
  async fetch(request: Request, env: Env) {
    const nonce = generateNonce();
    const response = await myRenderer(request, { nonce });
    return applySecurityHeaders(response, { nonce, integrations: { plausible: true } });
  },
};
```

## Co jest w default policy

| Header | Wartość | Cel |
|--------|---------|-----|
| `Content-Security-Policy` | strict + `strict-dynamic` + nonce | anti-XSS, anti-injection |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | force HTTPS 2y |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `X-Frame-Options` | `DENY` | clickjacking (belt-and-suspenders z CSP `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | PII w referrer prevention |
| `Permissions-Policy` | 28 features → `()` | wyłącza wszystko niepotrzebne (kamera, mikrofon, geo, payment, FLoC) |
| `Cross-Origin-Opener-Policy` | `same-origin` | window.opener attacks |
| `Cross-Origin-Resource-Policy` | `same-site` | speculative side-channel |
| `X-Permitted-Cross-Domain-Policies` | `none` | Flash legacy |

## CSP default (z nonce)

```
default-src 'self';
script-src 'self' 'strict-dynamic' 'nonce-{NONCE}';
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:;
font-src 'self' data:;
connect-src 'self';
media-src 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
manifest-src 'self';
worker-src 'self';
upgrade-insecure-requests
```

## Integrations (gotowe do włączenia)

Każda dodaje minimalny zestaw CSP entries:

| Flag | Adds |
|------|------|
| `turnstile` | `challenges.cloudflare.com` (script + frame) |
| `zaraz` | `cdn.zaraz.com`, `*.zaraz.cloud` |
| `plausible` | `plausible.io` (script + connect); custom origin via `{plausible: {origin: '...'}}` dla self-hosted |
| `ga4` | GTM + GA endpoints |
| `googleAds` | GTM + googleadservices + doubleclick |
| `metaPixel` | `connect.facebook.net`, `*.facebook.com` |
| `tiktokPixel` | `analytics.tiktok.com` |
| `clarity` | `clarity.ms` (wymaga consent! patrz `web-core/consent`) |
| `googleMaps` | maps.googleapis + gstatic |
| `youtube` | youtube + youtube-nocookie + i.ytimg |
| `hubApi` | `api.mixturemarketing.pl` (lub custom `baseUrl`) |

## API surface

| Function | Returns | Purpose |
|----------|---------|---------|
| `generateNonce()` | `string` (~22 chars base64) | Per-request nonce dla CSP + inline scripts |
| `quoteNonce(n)` | `'nonce-...'` | Format do CSP directive |
| `buildSecurityHeaders(opts)` | `Record<string,string>` | Wszystkie headery jako obiekt |
| `applySecurityHeaders(res, opts)` | `Response` | Nowy Response z dodanymi headerami |
| `securityMiddleware(opts)` | middleware fn | Hono-style, auto nonce + headery |
| `buildPermissionsPolicy(input?)` | `string` | Value dla `Permissions-Policy` |
| `defaultCspDirectives({nonce?})` | `CspDirectives` | Baseline strict CSP |
| `mergeCsp(base, ...overrides)` | `CspDirectives` | Dedupe + merge directives |
| `renderCsp(directives)` | `string` | Final CSP header value |
| `turnstileCsp()` / `plausibleCsp()` / ... | `CspDirectives` | Integration extensions |
| `generateSriHash({content})` | `Promise<string>` | SRI integrity attribute |
| `verifySriHash(content, hash)` | `Promise<boolean>` | CI lint dla external assets |

## Strict CSP rationale

- **`strict-dynamic`** — eliminuje potrzebę allowlistowania każdego CDN. Skrypt z nonce może załadować inne skrypty, te też się wykonają (transitively)
- **nonce per request** — atakujący nie zna nonce → nie może wstrzyknąć działającego `<script>`
- **`script-src-attr 'none'`** — brak inline event handlers (`onclick=`, `onerror=`) — częsty XSS vector w starych Astro `client:load` patterns
- **`object-src 'none'`** — eliminuje legacy `<object>`/`<embed>`/`<applet>` ataki
- **`base-uri 'self'`** — atakujący nie może wstrzyknąć `<base href="evil.com">` żeby przekierować względne URL
- **`frame-ancestors 'none'`** — anti-clickjacking; nadpisuje deprecated `X-Frame-Options`
- **`upgrade-insecure-requests`** — auto-upgrade `http://` → `https://` na klientach legacy

## Co świadomie NIE jest w v0.1

- **Reporting API / report-uri** — Faza 5+; wymaga endpointu odbierającego raporty
- **Trusted Types** — Edge feature, niski coverage, dodać gdy >70% userów wspiera
- **`require-trusted-types-for`** — j.w.
- **COEP `require-corp`** — opt-in, default off (kills 3rd-party embeds bez `Cross-Origin-Resource-Policy` na ich stronie)
- **`Expect-CT`** — deprecated by browsers June 2021

## Verification

Po deploy każdego klienta, lint w CI:

```bash
curl -I https://<klient-domain>/ | grep -i 'content-security-policy\|strict-transport\|x-content-type'
```

Test koncowy via securityheaders.com — cel A+.

## Reference

- Plan: [00-main.md "Faza 1 #5"](../../../../plan/00-main.md)
- Plan: [I-analytics.md (Consent Mode v2 — CSP allow rules)](../../../../plan/I-analytics.md)
- W3C CSP3 spec: https://www.w3.org/TR/CSP3/
- W3C SRI spec: https://www.w3.org/TR/SRI/
- Permissions-Policy spec: https://www.w3.org/TR/permissions-policy/
- securityheaders.com grading: https://securityheaders.com/
- OWASP Secure Headers: https://owasp.org/www-project-secure-headers/
