/**
 * Geo helpers — coordinate validation, Polish bounds sanity check, distance.
 */

import { geoInputSchema } from "./schema/validators.js";
import type { GeoInput } from "./schema/types.js";

/**
 * Polish territory bounding box (rough, generous margin).
 * Used as sanity check — if klient wprowadzi koordynaty spoza tego boxa, prawdopodobnie błąd.
 */
export const POLAND_BBOX = {
  minLat: 49.0,
  maxLat: 54.84,
  minLng: 14.12,
  maxLng: 24.16,
} as const;

export interface ValidationResult {
  valid: boolean;
  /** Specific issue if invalid. */
  reason?: string;
  /** True if coords are technically valid but suspicious (outside PL bbox). */
  warning?: string;
}

/** Validate latitude/longitude and check Polish bbox sanity. */
export function validateGeo(input: GeoInput): ValidationResult {
  const parsed = geoInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  const { latitude, longitude } = parsed.data;
  const inPL =
    latitude >= POLAND_BBOX.minLat &&
    latitude <= POLAND_BBOX.maxLat &&
    longitude >= POLAND_BBOX.minLng &&
    longitude <= POLAND_BBOX.maxLng;

  if (!inPL) {
    return {
      valid: true,
      warning: `Coordinates outside Poland bbox (lat ${latitude}, lng ${longitude}) — verify with klient`,
    };
  }
  return { valid: true };
}

/**
 * Distance between two points in kilometers (Haversine formula).
 * Used for service area validation, e.g. "klient powiedział że obsługuje Boguchwałę,
 * ale jest w Poznaniu" → 470km, sanity check fail.
 */
export function distanceKm(a: GeoInput, b: GeoInput): number {
  const R = 6371; // km
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Major Polish cities with coords — used for sanity checks + service area defaults. */
export const POLISH_CITY_COORDS: Readonly<Record<string, GeoInput>> = {
  Warszawa: { latitude: 52.2297, longitude: 21.0122 },
  Kraków: { latitude: 50.0647, longitude: 19.945 },
  Łódź: { latitude: 51.7592, longitude: 19.456 },
  Wrocław: { latitude: 51.1079, longitude: 17.0385 },
  Poznań: { latitude: 52.4064, longitude: 16.9252 },
  Gdańsk: { latitude: 54.352, longitude: 18.6466 },
  Szczecin: { latitude: 53.4285, longitude: 14.5528 },
  Lublin: { latitude: 51.2465, longitude: 22.5684 },
  Białystok: { latitude: 53.1325, longitude: 23.1688 },
  Katowice: { latitude: 50.2649, longitude: 19.0238 },
  Rzeszów: { latitude: 50.0413, longitude: 21.999 },
  Olsztyn: { latitude: 53.7784, longitude: 20.4801 },
  Toruń: { latitude: 53.0138, longitude: 18.5984 },
  Kielce: { latitude: 50.8661, longitude: 20.6286 },
  Gorzów_Wielkopolski: { latitude: 52.7368, longitude: 15.2288 },
  Opole: { latitude: 50.6751, longitude: 17.9213 },
};
