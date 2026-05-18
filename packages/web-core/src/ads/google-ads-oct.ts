/**
 * Google Ads Offline Conversion Tracking (OCT) helper.
 *
 * Use case: form submission → klient calls back → deal closed (offline conversion).
 * Without OCT: Google sees the click but never the actual revenue → bad ROAS data.
 * With OCT: we upload conversion with original GCLID → Google attributes revenue → optimizer works.
 *
 * Endpoint: Google Ads API v19+ (POST .../customers/{cid}/conversionUploads:upload).
 * Requires: OAuth refresh token, developer token, customer ID, conversion action resource name.
 *
 * For v0.1: this is a stub — full Google Ads API integration is heavy + needs OAuth flow.
 * Real upload happens manually via CSV export from hub D1 + Google Ads UI.
 *
 * Active server-side conversion (click-time): use Google Ads Enhanced Conversions
 * (event_id + hashed email/phone via Zaraz). This is configured in Zaraz tool, not here.
 */

/**
 * Build offline conversion CSV row for manual upload to Google Ads.
 * One row per converted lead.
 *
 * Google CSV format:
 *   Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
 *   Cj0KCQjw...,"Lead - Phone Quote","2026-05-19 14:00:00 Europe/Warsaw","250","PLN"
 */
export interface OfflineConversionRow {
  gclid: string;
  conversionName: string;
  /** ISO datetime — converted to Google's format. */
  conversionTime: Date;
  /** Value in conversion currency (PLN). */
  conversionValue: number;
  currency?: string;
  /** Timezone identifier. Default "Europe/Warsaw". */
  timezone?: string;
}

export function buildOfflineConversionsCsv(rows: ReadonlyArray<OfflineConversionRow>): string {
  const headers = "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency";
  const lines = rows.map((row) => {
    const tz = row.timezone ?? "Europe/Warsaw";
    // Google expects format: "YYYY-MM-DD HH:MM:SS ZoneName"
    const time = formatConversionTime(row.conversionTime, tz);
    return [
      escapeCsvField(row.gclid),
      escapeCsvField(row.conversionName),
      escapeCsvField(time),
      String(row.conversionValue),
      row.currency ?? "PLN",
    ].join(",");
  });
  // Google CSV needs "Parameters:..." header first row in UI
  return ["Parameters:TimeZone=Europe/Warsaw", headers, ...lines].join("\n");
}

function formatConversionTime(date: Date, tz: string): string {
  // YYYY-MM-DD HH:MM:SS Z — Google parser is forgiving
  const pad = (n: number): string => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss} ${tz}`;
}

function escapeCsvField(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
