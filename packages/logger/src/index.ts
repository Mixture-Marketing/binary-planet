/**
 * @mixturemarketing/logger
 *
 * Structured JSON logging for Cloudflare Workers.
 * Output → console.log → captured by CF Logpush → R2 parquet (filter level >= 'warn').
 *
 * Usage:
 *   const log = new Logger({ requestId, clientId, module: "forms" });
 *   log.info("lead submitted", { leadId, source });
 *   log.error("turnstile failed", err, { ip });
 *
 * Hono middleware:
 *   app.use(loggerMiddleware);
 *   // in handlers: c.get("logger").info(...);
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogContext {
  requestId: string;
  clientId?: string;
  userId?: string;
  module?: string;
  workerName?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId: string;
  clientId?: string;
  userId?: string;
  module?: string;
  workerName?: string;
  data?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export class Logger {
  constructor(private readonly ctx: LogContext) {}

  child(extra: Partial<LogContext>): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>, err?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.ctx.requestId,
      ...(this.ctx.clientId !== undefined && { clientId: this.ctx.clientId }),
      ...(this.ctx.userId !== undefined && { userId: this.ctx.userId }),
      ...(this.ctx.module !== undefined && { module: this.ctx.module }),
      ...(this.ctx.workerName !== undefined && { workerName: this.ctx.workerName }),
      ...(data && { data }),
      ...(err && {
        error: {
          name: err.name,
          message: err.message,
          ...(err.stack !== undefined && { stack: err.stack }),
        },
      }),
    };
    // Logpush captures console output; serialize as one JSON line.
    const json = JSON.stringify(entry);
    if (level === "error" || level === "critical") {
      console.error(json);
    } else if (level === "warn") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit("debug", message, data);
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.emit("info", message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.emit("warn", message, data);
  }
  error(message: string, err?: Error, data?: Record<string, unknown>): void {
    this.emit("error", message, data, err);
  }
  critical(message: string, err?: Error, data?: Record<string, unknown>): void {
    this.emit("critical", message, data, err);
  }
}

/**
 * Generate or extract a request ID from headers.
 * Honors incoming `X-Request-ID` if present (for tracing across spoke ↔ hub).
 */
export function getRequestId(headers: Headers): string {
  return headers.get("X-Request-ID") ?? crypto.randomUUID();
}
