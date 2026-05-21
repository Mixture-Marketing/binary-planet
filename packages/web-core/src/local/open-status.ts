/**
 * Compute "is open now" + next-open message from OpeningHoursInput.
 * SSR-safe (no `window`), works in Cloudflare Workers (workerd).
 *
 * Caveats:
 *   - Caller must supply a Date instance (or relies on `new Date()` which is OK in
 *     CF Workers per-request — Date.now() returns request time).
 *   - Doesn't handle Polish public holidays (TODO: hours.holidays override).
 *   - Crossing midnight (e.g. fri 12:00–01:00) — supported via wrap to next day.
 */

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface OpenStatusInput {
  hours: Partial<Record<DayKey, [string, string] | "closed">> & { note?: string };
  /** "Awaryjnie 24/7" override — if hours.note contains 24/7 keyword, status is always "open". */
  emergency24h?: boolean;
  /** Optional Date for testing; defaults to `new Date()`. */
  now?: Date;
  /** Locale tag for day name formatting. Default "pl-PL". */
  locale?: string;
}

export type OpenStatus =
  | { kind: "open"; closesAt: string; closesAtToday: boolean }
  | { kind: "closed"; opensAt: string; opensDay: string }
  | { kind: "emergency24h" }
  | { kind: "unknown" };

const DAY_ORDER: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const PL_DAY_NAMES: Record<DayKey, string> = {
  monday: "poniedziałek",
  tuesday: "wtorek",
  wednesday: "środa",
  thursday: "czwartek",
  friday: "piątek",
  saturday: "sobota",
  sunday: "niedziela",
};

function dayKeyFromDate(d: Date): DayKey {
  // JS getDay() returns 0=Sunday..6=Saturday
  const idx = d.getDay();
  const map: Record<number, DayKey> = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday",
  };
  return map[idx]!;
}

function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Auto-detect emergency 24/7 from note text. Returns true if note contains "24/7", "24h", "całodobow*".
 */
export function isEmergency24h(note?: string): boolean {
  if (!note) return false;
  return /24\s*\/?\s*7|24\s*h(?:\b|our)|całodobow/i.test(note);
}

export function computeOpenStatus(input: OpenStatusInput): OpenStatus {
  if (input.emergency24h || isEmergency24h(input.hours.note)) {
    return { kind: "emergency24h" };
  }

  const now = input.now ?? new Date();
  const today = dayKeyFromDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayHours = input.hours[today];
  if (Array.isArray(todayHours)) {
    const [openStr, closeStr] = todayHours;
    const openMin = timeToMinutes(openStr);
    const closeMin = timeToMinutes(closeStr);
    if (openMin >= 0 && closeMin >= 0) {
      // Handle past-midnight close (e.g. 12:00–01:00 next day)
      const closesNextDay = closeMin <= openMin;
      const effectiveCloseMin = closesNextDay ? closeMin + 24 * 60 : closeMin;
      const effectiveNowMin = nowMinutes < openMin && closesNextDay ? nowMinutes + 24 * 60 : nowMinutes;
      if (effectiveNowMin >= openMin && effectiveNowMin < effectiveCloseMin) {
        return { kind: "open", closesAt: closeStr, closesAtToday: !closesNextDay };
      }
    }
  }

  // Closed now — find next open slot.
  const startIdx = DAY_ORDER.indexOf(today);
  for (let i = 0; i < 7; i++) {
    const candidateIdx = (startIdx + i) % 7;
    const candidate = DAY_ORDER[candidateIdx]!;
    const ch = input.hours[candidate];
    if (Array.isArray(ch)) {
      const [openStr] = ch;
      const openMin = timeToMinutes(openStr);
      if (openMin < 0) continue;
      // If it's today AND now is before open time → open later today
      if (i === 0 && nowMinutes < openMin) {
        return { kind: "closed", opensAt: openStr, opensDay: "dzisiaj" };
      }
      if (i === 0) continue; // already past today's open window
      const dayLabel = i === 1 ? "jutro" : PL_DAY_NAMES[candidate];
      return { kind: "closed", opensAt: openStr, opensDay: dayLabel };
    }
  }
  return { kind: "unknown" };
}

/**
 * Build a one-line Polish status message suitable for hero/footer.
 *
 * @example
 *   openStatusMessage(computeOpenStatus({ hours })) // → "Otwarte dziś do 22:00"
 */
export function openStatusMessage(status: OpenStatus): string {
  switch (status.kind) {
    case "emergency24h":
      return "Awaryjnie czynni 24/7";
    case "open":
      return status.closesAtToday
        ? `Otwarte dziś do ${status.closesAt}`
        : `Otwarte do ${status.closesAt} (jutro)`;
    case "closed":
      return `Zamknięte — otwieramy ${status.opensDay} o ${status.opensAt}`;
    case "unknown":
      return "Sprawdź godziny pracy";
  }
}
