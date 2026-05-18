/**
 * Opening hours helpers — make it ergonomic to express common patterns.
 *
 * Examples:
 *   weekdays("08:00", "18:00")           // Mon–Fri
 *   weekends("10:00", "14:00")           // Sat–Sun
 *   open24_7()                           // 7 days, 00:00–00:00 (schema.org convention)
 *   schedule({ weekdays: ["08:00", "18:00"], saturday: ["09:00", "14:00"], sunday: "closed" })
 */

import type { DayOfWeek, OpeningHoursInput, TimeOfDay } from "./schema/types.js";
import { timeOfDayRegex } from "./schema/validators.js";

export const ALL_DAYS: readonly DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAYS: readonly DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const WEEKEND: readonly DayOfWeek[] = ["Saturday", "Sunday"];

export function weekdays(opens: TimeOfDay, closes: TimeOfDay): OpeningHoursInput {
  assertTime(opens);
  assertTime(closes);
  return { dayOfWeek: WEEKDAYS, opens, closes };
}

export function weekends(opens: TimeOfDay, closes: TimeOfDay): OpeningHoursInput {
  assertTime(opens);
  assertTime(closes);
  return { dayOfWeek: WEEKEND, opens, closes };
}

export function singleDay(day: DayOfWeek, opens: TimeOfDay, closes: TimeOfDay): OpeningHoursInput {
  assertTime(opens);
  assertTime(closes);
  return { dayOfWeek: day, opens, closes };
}

export function days(
  list: readonly DayOfWeek[],
  opens: TimeOfDay,
  closes: TimeOfDay,
): OpeningHoursInput {
  if (list.length === 0) throw new Error("days() requires at least one day");
  assertTime(opens);
  assertTime(closes);
  return { dayOfWeek: list, opens, closes };
}

/** 24/7 — schema.org convention: opens="00:00" closes="23:59" all 7 days. */
export function open24_7(): OpeningHoursInput[] {
  return [{ dayOfWeek: ALL_DAYS, opens: "00:00", closes: "23:59" }];
}

/**
 * High-level schedule builder. Pass a record per "group" of days, each
 * either a [opens, closes] tuple or "closed" sentinel.
 *
 * @example
 *   schedule({
 *     weekdays: ["08:00", "18:00"],
 *     saturday: ["09:00", "14:00"],
 *     sunday: "closed",
 *   })
 */
export interface ScheduleInput {
  weekdays?: readonly [TimeOfDay, TimeOfDay] | "closed";
  saturday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  sunday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  monday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  tuesday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  wednesday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  thursday?: readonly [TimeOfDay, TimeOfDay] | "closed";
  friday?: readonly [TimeOfDay, TimeOfDay] | "closed";
}

const DAY_KEY_TO_NAME: Readonly<Record<string, DayOfWeek>> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function schedule(input: ScheduleInput): OpeningHoursInput[] {
  const out: OpeningHoursInput[] = [];
  const explicitDays = new Set<DayOfWeek>();

  // Per-day overrides take precedence over `weekdays`.
  for (const [key, name] of Object.entries(DAY_KEY_TO_NAME)) {
    const slot = input[key as keyof ScheduleInput];
    if (slot === undefined) continue;
    explicitDays.add(name);
    if (slot === "closed") continue;
    out.push({ dayOfWeek: name, opens: slot[0], closes: slot[1] });
  }

  // Apply weekdays for any Mon–Fri not explicitly overridden.
  if (input.weekdays && input.weekdays !== "closed") {
    const remaining = WEEKDAYS.filter((d) => !explicitDays.has(d));
    if (remaining.length > 0) {
      out.push({ dayOfWeek: remaining, opens: input.weekdays[0], closes: input.weekdays[1] });
    }
  }

  for (const h of out) {
    assertTime(h.opens);
    assertTime(h.closes);
  }
  return out;
}

function assertTime(t: string): void {
  if (!timeOfDayRegex.test(t)) {
    throw new Error(`Invalid time format "${t}" — must be HH:MM (24h)`);
  }
}
