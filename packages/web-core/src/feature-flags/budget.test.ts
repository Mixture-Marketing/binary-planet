import { describe, expect, it } from "vitest";

import { checkBudget } from "./budget.js";

describe("checkBudget", () => {
  it("returns exceeded=false when no cap", async () => {
    const r = await checkBudget({
      clientId: "clk_1",
      category: "ai_monthly_usd",
      fetchSpent: async () => 50,
    });
    expect(r.exceeded).toBe(false);
    expect(r.spent).toBe(50);
    expect(r.cap).toBeUndefined();
    expect(r.usagePct).toBeNull();
  });

  it("returns exceeded=true when spent >= cap", async () => {
    const r = await checkBudget({
      clientId: "clk_1",
      category: "ai_monthly_usd",
      cap: 100,
      fetchSpent: async () => 105,
    });
    expect(r.exceeded).toBe(true);
    expect(r.usagePct).toBe(105);
  });

  it("returns exceeded=false when spent < cap", async () => {
    const r = await checkBudget({
      clientId: "clk_1",
      category: "ai_monthly_usd",
      cap: 100,
      fetchSpent: async () => 60,
    });
    expect(r.exceeded).toBe(false);
    expect(r.usagePct).toBe(60);
  });

  it("treats cap=0 as unlimited (no exceeded)", async () => {
    const r = await checkBudget({
      clientId: "clk_1",
      category: "ai_monthly_usd",
      cap: 0,
      fetchSpent: async () => 1000,
    });
    expect(r.exceeded).toBe(false);
    expect(r.usagePct).toBeNull();
  });

  it("spent exactly at cap triggers exceeded", async () => {
    const r = await checkBudget({
      clientId: "clk_1",
      category: "ai_monthly_usd",
      cap: 100,
      fetchSpent: async () => 100,
    });
    expect(r.exceeded).toBe(true);
    expect(r.usagePct).toBe(100);
  });
});
