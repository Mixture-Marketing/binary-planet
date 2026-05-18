/**
 * JSON response helpers. Standard shape across all routes:
 *   success: { ok: true, ...data }
 *   error:   { ok: false, error: { code, message } }
 */

export interface SuccessBody<T> {
  ok: true;
  data?: T;
  [k: string]: unknown;
}

export interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

/** Standardized error codes (public-facing). */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_MISSING_KEY"
  | "AUTH_INVALID_KEY"
  | "AUTH_REVOKED"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_REPLAY"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "INTERNAL_ERROR";

export function ok<T>(data?: T, extra?: Record<string, unknown>): SuccessBody<T> {
  const body: SuccessBody<T> = { ok: true };
  if (data !== undefined) body.data = data;
  if (extra) Object.assign(body, extra);
  return body;
}

export function err(code: ApiErrorCode, message: string): ErrorBody {
  return { ok: false, error: { code, message } };
}
