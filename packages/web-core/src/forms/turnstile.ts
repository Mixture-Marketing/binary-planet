/**
 * Cloudflare Turnstile token verification.
 *
 * Free, privacy-friendly alternative to reCAPTCHA. Verifies non-interactively (Managed mode).
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyInput {
  secret: string;
  token: string;
  /** End-user IP — strongly recommended for additional risk scoring. */
  remoteIp?: string;
  /** Idempotency key — pass a unique ID to allow safe retries. */
  idempotencyKey?: string;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** Timeout in ms. Default 3000. */
  timeoutMs?: number;
}

export interface TurnstileVerifyResult {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  /** Error codes per CF docs. */
  "error-codes"?: string[];
}

export class TurnstileError extends Error {
  public readonly errorCodes: string[];
  public readonly underlying?: unknown;

  constructor(message: string, errorCodes: string[] = [], underlying?: unknown) {
    super(message);
    this.name = "TurnstileError";
    this.errorCodes = errorCodes;
    this.underlying = underlying;
  }
}

/**
 * Verify a Turnstile token against CF's API.
 * Throws TurnstileError on network/timeout. Returns result object on response (check .success).
 */
export async function verifyTurnstileToken(input: TurnstileVerifyInput): Promise<TurnstileVerifyResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 3000;

  const formData = new FormData();
  formData.append("secret", input.secret);
  formData.append("response", input.token);
  if (input.remoteIp) formData.append("remoteip", input.remoteIp);
  if (input.idempotencyKey) formData.append("idempotency_key", input.idempotencyKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new TurnstileError(`Turnstile verify HTTP ${res.status}`, []);
    }

    return (await res.json()) as TurnstileVerifyResult;
  } catch (err) {
    if (err instanceof TurnstileError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TurnstileError("Turnstile verify timeout", ["timeout"], err);
    }
    throw new TurnstileError(
      err instanceof Error ? err.message : "Turnstile verify network error",
      [],
      err,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
