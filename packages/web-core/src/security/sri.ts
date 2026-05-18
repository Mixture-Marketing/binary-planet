/**
 * Subresource Integrity (SRI) helpers.
 *
 * Generates `integrity="sha384-..."` attribute values for external scripts/styles.
 * Build-time tooling — call once per release for known external assets, embed result.
 *
 * Per W3C spec: https://www.w3.org/TR/SRI/
 */

export type SriAlgorithm = "sha256" | "sha384" | "sha512";

const ALG_MAP: Record<SriAlgorithm, AlgorithmIdentifier> = {
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

export interface GenerateSriInput {
  /** Raw content bytes (e.g. fetch() body of the script). */
  content: ArrayBuffer | Uint8Array | string;
  /** Hash algorithm. Default 'sha384' (good balance of strength + size). */
  algorithm?: SriAlgorithm;
  /** If true, include multiple algos space-separated (defense-in-depth). */
  multipleAlgos?: boolean;
}

/**
 * Compute SRI hash for a single asset.
 * Returns the `integrity` attribute value, e.g. "sha384-abc...==" (without quotes).
 */
export async function generateSriHash(input: GenerateSriInput): Promise<string> {
  const algo = input.algorithm ?? "sha384";
  if (input.multipleAlgos) {
    const algos: SriAlgorithm[] = ["sha384", "sha512"];
    const hashes = await Promise.all(
      algos.map(async (a) => {
        const h = await hashSingle(input.content, a);
        return `${a}-${h}`;
      }),
    );
    return hashes.join(" ");
  }
  const hash = await hashSingle(input.content, algo);
  return `${algo}-${hash}`;
}

/**
 * Fetch + hash a URL. Useful for build-time tooling that pins external assets.
 * NOTE: returned hash assumes the URL response is stable — verify reproducibility
 * before pinning (some CDNs serve different bytes per region/UA).
 */
export async function generateSriHashForUrl(
  url: string,
  options: { algorithm?: SriAlgorithm; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`SRI: failed to fetch ${url}: ${res.status}`);
  }
  const content = await res.arrayBuffer();
  return generateSriHash({ content, ...(options.algorithm && { algorithm: options.algorithm }) });
}

/** Verify content matches a given SRI hash. Used in CI lint to detect external asset drift. */
export async function verifySriHash(
  content: ArrayBuffer | Uint8Array | string,
  integrity: string,
): Promise<boolean> {
  // integrity may have multiple "algo-hash" tokens — any matching one passes.
  const tokens = integrity.trim().split(/\s+/);
  for (const token of tokens) {
    const [algo, expected] = token.split("-", 2);
    if (!algo || !expected) continue;
    if (!(algo in ALG_MAP)) continue;
    const actual = await hashSingle(content, algo as SriAlgorithm);
    if (timingSafeEqual(actual, expected)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

async function hashSingle(
  content: ArrayBuffer | Uint8Array | string,
  algo: SriAlgorithm,
): Promise<string> {
  const bytes: BufferSource =
    typeof content === "string"
      ? new TextEncoder().encode(content)
      : content instanceof Uint8Array
        ? (content as unknown as BufferSource)
        : new Uint8Array(content);
  const digest = await crypto.subtle.digest(ALG_MAP[algo], bytes);
  return bufferToBase64(digest);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
