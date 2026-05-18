/**
 * PII helpers: deterministic hash (lookup/dedup) + AES-GCM encrypt (storage at rest).
 *
 * Runs in Cloudflare Workers — uses Web Crypto API only (no node:crypto).
 *
 * v0.1 decision: encryption is OPTIONAL. If env.PII_ENCRYPTION_KEY_B64 is undefined,
 * we hash-only (D1 *_enc columns stay NULL). Production should always provide key
 * (per-tenant key wrapped by D1_ENCRYPTION_KEY master).
 */

/** sha256 of UTF-8 string, returned as hex (64 chars). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bufferToHex(digest);
}

/** Hash with a salt (prevents rainbow attacks on common email/phone). */
export async function sha256HexSalted(input: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${input}`);
}

/**
 * Normalize email before hashing (lowercase, trim).
 * Deterministic — same email always hashes to same value (enables dedup queries).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone before hashing — strip everything except digits and leading +.
 * "+48 17 123 45 67" → "+48171234567"
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  // If user wrote "0048..." replace with "+48..."
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  // If user wrote "504-...-..." without country code, prepend Polish (most common case).
  if (!cleaned.startsWith("+") && cleaned.length === 9) return `+48${cleaned}`;
  return cleaned;
}

/**
 * Encrypt a UTF-8 string with AES-GCM-256. Returns base64-encoded (iv || ciphertext).
 *
 * Key must be 32 raw bytes (base64-decoded). Use {@link decodeKey} to parse from env.
 */
export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit GCM iv
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.byteLength);
  return bufferToBase64(combined.buffer);
}

/** Decrypt a base64(iv || ciphertext) blob produced by {@link encryptString}. */
export async function decryptString(blob: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(base64ToBuffer(blob));
  if (combined.length < 13) {
    throw new Error("PII: ciphertext too short to contain IV");
  }
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

/**
 * Decode a base64-encoded 32-byte key into a CryptoKey.
 * Use this once on cold-start, cache the result.
 */
export async function decodeKey(base64: string): Promise<CryptoKey> {
  const raw = new Uint8Array(base64ToBuffer(base64));
  if (raw.length !== 32) {
    throw new Error(`PII: expected 32-byte key, got ${raw.length} bytes`);
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Generate a new random 32-byte AES-GCM key, returned as base64. Useful for CLI / first-run setup. */
export async function generateKey(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bufferToBase64(raw.buffer);
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
