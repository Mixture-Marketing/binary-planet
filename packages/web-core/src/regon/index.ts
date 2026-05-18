/**
 * @mixturemarketing/web-core/regon
 *
 * Scope: REGON BIR1 API client (GUS — Główny Urząd Statystyczny).
 *
 *  - SOAP client (BIR1 is SOAP, brak natywnego REST proxy)
 *  - DaneSzukajPodmioty by NIP / REGON / KRS
 *  - DanePobierzPelnyRaport (full report z PKD codes, address, legal form)
 *  - Response normalization → ClientBusinessData shape
 *  - Session token caching (BIR API uses session ~60 min)
 *  - Retry with exponential backoff
 *  - Test fixtures (sandbox key "abcde12345abcde12345" for dev)
 *
 * Wymaga: REGON_USER_KEY env var (po otrzymaniu z GUS, ~1-2 tyg czekania).
 *
 * Reference: plan/00-main.md (Faza 1, krytyczny plik #3), regon-request.md.
 */

export const MODULE_NAME = "regon" as const;
