import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Logger, getRequestId } from "./index.js";

describe("Logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a JSON line with required fields", () => {
    const log = new Logger({ requestId: "req-1", module: "forms" });
    log.info("hello", { x: 1 });
    expect(logSpy).toHaveBeenCalledOnce();
    const arg = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    expect(parsed["requestId"]).toBe("req-1");
    expect(parsed["module"]).toBe("forms");
    expect(parsed["level"]).toBe("info");
    expect(parsed["message"]).toBe("hello");
    expect(parsed["data"]).toEqual({ x: 1 });
    expect(typeof parsed["timestamp"]).toBe("string");
  });

  it("routes warn to console.warn and error to console.error", () => {
    const log = new Logger({ requestId: "req-2" });
    log.warn("careful");
    log.error("boom", new Error("ouch"));
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalledOnce();
    const errLine = errSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(errLine) as Record<string, unknown>;
    expect(parsed["level"]).toBe("error");
    const errObj = parsed["error"] as { name: string; message: string };
    expect(errObj.message).toBe("ouch");
  });

  it("child logger inherits + overrides context", () => {
    const root = new Logger({ requestId: "req-3", module: "forms" });
    const child = root.child({ clientId: "clk_abc", module: "leads" });
    child.info("scoped");
    const arg = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    expect(parsed["requestId"]).toBe("req-3");
    expect(parsed["clientId"]).toBe("clk_abc");
    expect(parsed["module"]).toBe("leads");
  });

  it("getRequestId honors incoming header", () => {
    const headers = new Headers({ "X-Request-ID": "trace-xyz" });
    expect(getRequestId(headers)).toBe("trace-xyz");
  });

  it("getRequestId generates UUID when no header", () => {
    const id = getRequestId(new Headers());
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
