/**
 * @mixturemarketing/web-core/zaraz
 *
 * Scope: Cloudflare Zaraz server-side tag management config generator.
 *
 *  - wrangler.toml [zaraz] block builder per klient
 *  - Tag generators per integration:
 *      - Plausible (cookieless, no consent — default ON)
 *      - GA4 server-side (z Consent Mode v2 signals)
 *      - Google Ads conversion + remarketing
 *      - Meta Pixel server-side (Conversions API)
 *      - Microsoft Clarity (wymaga consent — heatmaps to PII!)
 *      - TikTok Pixel server-side
 *  - Auto-generation z client.config.integrations
 *  - Event tracking helpers: trackEvent(name, params, consent_state)
 *
 * Korzyści (z planu I.1):
 *  - CWV boost: -200-400ms LCP vs client-side GTM
 *  - 30-40% traffic recovery vs adblockers (first-party origin)
 *  - Native Consent Mode v2 support
 *  - Free tier: 1M events/mc per Worker
 *
 * Reference: plan/I-analytics.md (I.1).
 */

export const MODULE_NAME = "zaraz" as const;
