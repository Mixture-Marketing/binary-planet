/**
 * Polish address normalization + validation helpers.
 *
 * Used by:
 *  - onboarding wizard step 4 (klient potwierdza dane firmy z REGON autofetch)
 *  - schema validators (cross-check NIP/REGON data vs wprowadzone ręcznie)
 */

import { POLISH_VOIVODESHIPS, type PolishVoivodeship } from "./schema/types.js";
import { polishPostalCodeRegex } from "./schema/validators.js";

/**
 * Map of common voivodeship aliases (capitalized, with prepositions, English names) → canonical form.
 * REGON API returns various forms ("WIELKOPOLSKIE", "wielkopolskie", "WLKP" — wszystkie spotkane).
 */
const VOIVODESHIP_ALIASES: Readonly<Record<string, PolishVoivodeship>> = {
  // canonical forms
  "dolnośląskie": "dolnośląskie",
  "kujawsko-pomorskie": "kujawsko-pomorskie",
  "lubelskie": "lubelskie",
  "lubuskie": "lubuskie",
  "łódzkie": "łódzkie",
  "małopolskie": "małopolskie",
  "mazowieckie": "mazowieckie",
  "opolskie": "opolskie",
  "podkarpackie": "podkarpackie",
  "podlaskie": "podlaskie",
  "pomorskie": "pomorskie",
  "śląskie": "śląskie",
  "świętokrzyskie": "świętokrzyskie",
  "warmińsko-mazurskie": "warmińsko-mazurskie",
  "wielkopolskie": "wielkopolskie",
  "zachodniopomorskie": "zachodniopomorskie",

  // common EN aliases
  "lower silesia": "dolnośląskie",
  "lower silesian": "dolnośląskie",
  "kuyavian-pomeranian": "kujawsko-pomorskie",
  "lublin": "lubelskie",
  "lubusz": "lubuskie",
  "lodz": "łódzkie",
  "lesser poland": "małopolskie",
  "masovian": "mazowieckie",
  "mazovia": "mazowieckie",
  "opole": "opolskie",
  "subcarpathian": "podkarpackie",
  "podlachian": "podlaskie",
  "podlasie": "podlaskie",
  "pomerania": "pomorskie",
  "pomeranian": "pomorskie",
  "silesia": "śląskie",
  "silesian": "śląskie",
  "holy cross": "świętokrzyskie",
  "warmian-masurian": "warmińsko-mazurskie",
  "greater poland": "wielkopolskie",
  "west pomerania": "zachodniopomorskie",
  "west pomeranian": "zachodniopomorskie",

  // common abbreviations (REGON-style)
  "dol": "dolnośląskie",
  "kup": "kujawsko-pomorskie",
  "lub": "lubelskie",
  "lbu": "lubuskie",
  "ldz": "łódzkie",
  "mlp": "małopolskie",
  "maz": "mazowieckie",
  "opo": "opolskie",
  "pdk": "podkarpackie",
  "pdl": "podlaskie",
  "pom": "pomorskie",
  "sla": "śląskie",
  "swk": "świętokrzyskie",
  "wmz": "warmińsko-mazurskie",
  "wlkp": "wielkopolskie",
  "zpm": "zachodniopomorskie",
};

/**
 * Normalize a voivodeship string to canonical lowercase Polish form.
 * Returns null if input cannot be recognized.
 */
export function normalizeVoivodeship(input: string): PolishVoivodeship | null {
  const key = input.trim().toLowerCase().replace(/^województwo\s+/i, "").replace(/\s+/g, " ");
  const direct = VOIVODESHIP_ALIASES[key];
  if (direct && (POLISH_VOIVODESHIPS as readonly string[]).includes(direct)) {
    return direct;
  }
  // Last resort: substring match (handles "Województwo Mazowieckie" → "mazowieckie")
  for (const v of POLISH_VOIVODESHIPS) {
    if (key.includes(v)) return v;
  }
  return null;
}

/** True if string matches Polish postal code format (NN-NNN). */
export function isValidPolishPostalCode(input: string): boolean {
  return polishPostalCodeRegex.test(input);
}

/**
 * Normalize a postal code: trim, accept variants like "35060" → "35-060".
 * Returns canonical form or null if cannot be normalized.
 */
export function normalizePolishPostalCode(input: string): string | null {
  const cleaned = input.trim().replace(/\s/g, "");
  if (polishPostalCodeRegex.test(cleaned)) return cleaned;
  // "35060" → "35-060"
  if (/^\d{5}$/.test(cleaned)) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return null;
}

/**
 * Major Polish cities — used for service area autocomplete in onboarding wizard.
 * Not exhaustive; supplemented by GeoApify API in production. This is the offline baseline.
 */
export const MAJOR_POLISH_CITIES: readonly string[] = [
  "Warszawa",
  "Kraków",
  "Łódź",
  "Wrocław",
  "Poznań",
  "Gdańsk",
  "Szczecin",
  "Bydgoszcz",
  "Lublin",
  "Białystok",
  "Katowice",
  "Gdynia",
  "Częstochowa",
  "Radom",
  "Sosnowiec",
  "Toruń",
  "Kielce",
  "Rzeszów",
  "Gliwice",
  "Zabrze",
  "Olsztyn",
  "Bielsko-Biała",
  "Bytom",
  "Zielona Góra",
  "Rybnik",
  "Ruda Śląska",
  "Opole",
  "Tychy",
  "Gorzów Wielkopolski",
  "Dąbrowa Górnicza",
  "Płock",
  "Elbląg",
  "Wałbrzych",
  "Włocławek",
  "Tarnów",
  "Chorzów",
  "Koszalin",
  "Kalisz",
  "Legnica",
  "Grudziądz",
  "Słupsk",
  "Jaworzno",
  "Jastrzębie-Zdrój",
  "Nowy Sącz",
  "Jelenia Góra",
  "Siedlce",
  "Mysłowice",
  "Konin",
  "Piła",
  "Piotrków Trybunalski",
  "Lubin",
  "Inowrocław",
  "Ostrowiec Świętokrzyski",
  "Suwałki",
  "Stargard",
  "Gniezno",
  "Ostrów Wielkopolski",
  "Siemianowice Śląskie",
  "Głogów",
  "Pabianice",
  "Leszno",
  "Łomża",
  "Żory",
  "Zamość",
  "Pruszków",
  "Tomaszów Mazowiecki",
  "Ełk",
  "Tarnowskie Góry",
  "Przemyśl",
  "Stalowa Wola",
  "Mielec",
  "Krosno",
  "Tarnobrzeg",
  "Sanok",
  "Boguchwała",
  "Tyczyn",
  "Łańcut",
];
