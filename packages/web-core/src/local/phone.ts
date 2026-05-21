/**
 * Polish phone number formatting helpers.
 *
 * Polish landlines: +48 [2-digit area code] [7 digits, grouped 3-2-2]
 *   e.g. Rzeszów (17): +48 17 123 45 67
 *        Kraków  (12): +48 12 123 45 67
 *        Warszawa(22): +48 22 123 45 67
 *
 * Polish mobile: +48 [3-digit prefix] [6 digits, grouped 3-3]
 *   prefix 500–799 = mobile carrier
 *   e.g. +48 600 700 800
 *
 * Source: PL Numbering Plan (UKE).
 */

/** Polish landline area codes (2-digit). */
const PL_LANDLINE_AREA_CODES = new Set<string>([
  "12", "13", "14", "15", "16", "17", "18", // małopolskie / podkarpackie / świętokrzyskie
  "22", "23", "24", "25", "29",              // mazowieckie / Warszawa
  "32", "33", "34",                          // śląskie / opolskie
  "41", "42", "43", "44", "46", "48",        // łódzkie / świętokrzyskie
  "52", "54", "55", "56", "58", "59",        // kujawsko-pomorskie / pomorskie
  "61", "62", "63", "65", "67", "68",        // wielkopolskie / lubuskie
  "71", "74", "75", "76", "77",              // dolnośląskie / opolskie
  "81", "82", "83", "84", "85", "86", "87", "89", // lubelskie / podlaskie / warmińsko-mazurskie
  "91", "94", "95",                          // zachodniopomorskie / lubuskie
]);

/**
 * Format a Polish phone number (E.164 +48XXXXXXXXX) for visible display.
 * Returns `+48 XX XXX XX XX` for landlines, `+48 XXX XXX XXX` for mobile, or input unchanged.
 *
 * @example
 *   formatPolishPhone("+48171234567") // → "+48 17 123 45 67"
 *   formatPolishPhone("+48600700800") // → "+48 600 700 800"
 */
export function formatPolishPhone(e164: string): string {
  const match = /^\+48(\d{9})$/.exec(e164);
  if (!match) return e164;
  const digits = match[1]!;
  const firstTwo = digits.slice(0, 2);
  if (PL_LANDLINE_AREA_CODES.has(firstTwo)) {
    // Landline: +48 XX XXX XX XX
    return `+48 ${firstTwo} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  // Mobile: +48 XXX XXX XXX
  return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

/**
 * Build an accessible-name string for screen readers — natural digit grouping,
 * not per-char spaces (which produce robotic readouts).
 *
 * @example
 *   phoneAriaLabel("+48171234567") // → "Zadzwoń pod numer plus 48, 17, 123, 45, 67"
 */
export function phoneAriaLabel(e164: string, prefix = "Zadzwoń pod numer"): string {
  const formatted = formatPolishPhone(e164);
  // Replace "+" with "plus" and rely on commas for natural pauses
  const spoken = formatted.replace(/^\+/, "plus ").replace(/\s+/g, ", ");
  return `${prefix} ${spoken}`;
}
