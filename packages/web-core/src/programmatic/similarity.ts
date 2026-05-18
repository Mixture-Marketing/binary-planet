/**
 * Content similarity detection — Jaccard over k-shingles.
 *
 * Why k-shingles (k-grams)?
 *   - Captures local word context, not just bag-of-words
 *   - 3-word shingles are standard for "is this paraphrased duplicate?" detection
 *   - O(n) memory per page; O(p²) pairwise comparisons but for cap=10 → 45 pairs trivial
 *
 * Workflow:
 *   1. tokenize(text) → array of normalized tokens (lowercase, no punctuation, no stop words optional)
 *   2. shingles(tokens, k=3) → Set of "word1 word2 word3" tuples
 *   3. jaccardSimilarity(setA, setB) → |A∩B| / |A∪B|
 *
 * Calibration: pages on same topic with different content cluster around 0.3-0.5.
 * Near-duplicates ("city swap") jump to 0.85+. Threshold 0.7 is conservative middle ground.
 */

const DEFAULT_K = 3;

/** Strip diacritics, lowercase, split on word boundaries. Drops 1-char tokens + numbers-only. */
export function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 2 && !/^\d+$/.test(tok));
}

/** Produce k-shingles ("word1 word2 word3") from tokens. */
export function shingles(tokens: ReadonlyArray<string>, k: number = DEFAULT_K): Set<string> {
  const result = new Set<string>();
  if (tokens.length < k) {
    // Edge case: very short text. Use single tokens (unigrams) as fallback shingles.
    for (const tok of tokens) result.add(tok);
    return result;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    result.add(tokens.slice(i, i + k).join(" "));
  }
  return result;
}

/** Jaccard similarity coefficient ∈ [0, 1]. 0 = disjoint, 1 = identical. */
export function jaccardSimilarity<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  // Iterate over the smaller set for speed
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) {
    if (large.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/** Convenience: text-to-text similarity (tokenize + shingle + jaccard). */
export function textSimilarity(textA: string, textB: string, k: number = DEFAULT_K): number {
  const a = shingles(tokenize(textA), k);
  const b = shingles(tokenize(textB), k);
  return jaccardSimilarity(a, b);
}

export interface SimilarityPair {
  slugA: string;
  slugB: string;
  ratio: number;
}

/**
 * Pairwise similarity report for a set of pages.
 * Returns matrix entries sorted by ratio DESC. Use for HCU lint + UI dashboard.
 */
export function pairwiseSimilarity(
  pages: ReadonlyArray<{ slug: string; text: string }>,
  k: number = DEFAULT_K,
): SimilarityPair[] {
  // Precompute shingles once per page
  const shingleSets = pages.map((p) => ({ slug: p.slug, set: shingles(tokenize(p.text), k) }));
  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < shingleSets.length; i++) {
    for (let j = i + 1; j < shingleSets.length; j++) {
      const a = shingleSets[i]!;
      const b = shingleSets[j]!;
      pairs.push({
        slugA: a.slug,
        slugB: b.slug,
        ratio: jaccardSimilarity(a.set, b.set),
      });
    }
  }
  pairs.sort((p, q) => q.ratio - p.ratio);
  return pairs;
}
