import { describe, expect, it } from "vitest";

import { open24_7, schedule, singleDay, WEEKDAYS, weekdays, weekends } from "./hours.js";

describe("hours helpers", () => {
  it("weekdays() builds Mon-Fri", () => {
    const h = weekdays("08:00", "18:00");
    expect(h.dayOfWeek).toEqual(WEEKDAYS);
    expect(h.opens).toBe("08:00");
    expect(h.closes).toBe("18:00");
  });

  it("weekends() builds Sat-Sun", () => {
    const h = weekends("10:00", "14:00");
    expect(h.dayOfWeek).toEqual(["Saturday", "Sunday"]);
  });

  it("singleDay() returns single string day", () => {
    const h = singleDay("Wednesday", "09:00", "17:00");
    expect(h.dayOfWeek).toBe("Wednesday");
  });

  it("open24_7() returns single entry for all days 00:00-23:59", () => {
    const arr = open24_7();
    expect(arr).toHaveLength(1);
    expect(arr[0]?.dayOfWeek).toHaveLength(7);
    expect(arr[0]?.opens).toBe("00:00");
    expect(arr[0]?.closes).toBe("23:59");
  });

  it("throws on invalid time format", () => {
    expect(() => weekdays("8:00", "18:00")).toThrow();
    expect(() => weekdays("08:00", "25:00")).toThrow();
    expect(() => singleDay("Monday", "ab:cd", "12:00")).toThrow();
  });
});

describe("schedule()", () => {
  it("combines weekdays + sat + sunday=closed", () => {
    const out = schedule({
      weekdays: ["08:00", "18:00"],
      saturday: ["09:00", "14:00"],
      sunday: "closed",
    });
    // Should produce 2 entries: weekdays group + saturday. Sunday closed = omitted.
    expect(out).toHaveLength(2);
    const wd = out.find((e) => Array.isArray(e.dayOfWeek));
    expect(wd?.dayOfWeek).toEqual(WEEKDAYS);
    const sat = out.find((e) => e.dayOfWeek === "Saturday");
    expect(sat).toBeDefined();
  });

  it("per-day overrides exclude the day from weekdays group", () => {
    const out = schedule({
      weekdays: ["08:00", "18:00"],
      friday: ["08:00", "15:00"], // shorter Friday
    });
    const wd = out.find((e) => Array.isArray(e.dayOfWeek));
    expect(wd?.dayOfWeek).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday"]);
    const fri = out.find((e) => e.dayOfWeek === "Friday");
    expect(fri?.closes).toBe("15:00");
  });

  it("empty schedule returns empty array", () => {
    expect(schedule({})).toEqual([]);
  });
});
