/**
 * @mixturemarketing/web-core/ads
 *
 * Scope: każda strona klienta przygotowana do natychmiastowego włączenia reklam
 *        (Premium tier lub add-on).
 *
 *  - Conversion events ready: lead_form_submit (primary), phone_click (micro),
 *                              quote_completed (micro), email_click, whatsapp_click
 *  - Standard audiences ready:
 *      - visitors (all PVs)
 *      - form_viewers (formularz w viewport, nie wysłany)
 *      - lead_converters (post-submit) — exclude lista
 *  - Dynamic remarketing skeleton dla branż z produktami (e.g. salon beauty z usługami)
 *  - Auto-tagging GCLID dla cross-domain conversion attribution
 *
 *  - Per platform helpers:
 *      - Google Ads conversion snippet generator
 *      - Meta Pixel custom audiences config
 *      - TikTok Pixel (opcjonalne)
 *      - LinkedIn Insight (B2B clients, np. księgowi)
 *
 *  - Klient w Sveltia CMS dodaje swoje ID konwersji → Zaraz config rebuild → reklamy działają.
 *
 * Reference: plan/I-analytics.md (I.3 Reklamy ready).
 */

export const MODULE_NAME = "ads" as const;
