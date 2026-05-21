/**
 * DataForSEO API client — minimal subset for Track 24f-3 (Monitoring konkurencji).
 *
 * Auth: Basic auth header with login:password.
 * Docs: https://docs.dataforseo.com/v3/serp/google/organic/live/regular/
 *
 * We use Live SERP (instant results, no callback) for simplicity.
 * Cost: ~$0.0006 per query at "regular" depth (10 results). For 10 keywords × weekly × 100 klients
 *       = ~24 zł/mc total budget (about 2.5 zł per klient).
 */

const API_BASE = "https://api.dataforseo.com/v3";

export interface DataForSeoConfig {
  login: string;
  password: string;
  fetchImpl?: typeof fetch;
}

export interface SerpOrganicResult {
  position: number;
  domain: string;
  url: string;
  title: string;
  description?: string;
}

export interface SerpLiveResult {
  keyword: string;
  location_code: number;
  language_code: string;
  total_count: number;
  organic: SerpOrganicResult[];
  /** Cost charged in USD (then converted to grosze). */
  cost_usd: number;
}

function basicAuth(login: string, password: string): string {
  return btoa(`${login}:${password}`);
}

/**
 * Single SERP query — Google Organic, live regular endpoint.
 * Returns top organic results (default depth 10).
 */
export async function fetchSerpLive(
  cfg: DataForSeoConfig,
  params: { keyword: string; location_code: number; language_code?: string; depth?: number },
): Promise<SerpLiveResult> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const auth = basicAuth(cfg.login, cfg.password);

  const body = [
    {
      keyword: params.keyword,
      location_code: params.location_code,
      language_code: params.language_code ?? "pl",
      depth: params.depth ?? 10,
      device: "desktop",
      os: "windows",
    },
  ];

  const res = await fetchImpl(`${API_BASE}/serp/google/organic/live/regular`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      cost?: number;
      result?: Array<{
        keyword: string;
        location_code: number;
        language_code: string;
        items_count?: number;
        items?: Array<{
          type?: string;
          rank_group?: number;
          rank_absolute?: number;
          position?: string;
          domain?: string;
          url?: string;
          title?: string;
          description?: string;
        }>;
      }>;
    }>;
  };

  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task failed: ${task?.status_message ?? "no task"}`);
  }
  const result = task.result?.[0];
  if (!result) {
    throw new Error("DataForSEO no result");
  }

  const organic: SerpOrganicResult[] = (result.items ?? [])
    .filter((i) => i.type === "organic")
    .slice(0, 10)
    .map((i, idx) => ({
      position: i.rank_absolute ?? idx + 1,
      domain: i.domain ?? "",
      url: i.url ?? "",
      title: i.title ?? "",
      ...(i.description && { description: i.description }),
    }));

  return {
    keyword: result.keyword,
    location_code: result.location_code,
    language_code: result.language_code,
    total_count: result.items_count ?? 0,
    organic,
    cost_usd: task.cost ?? 0,
  };
}

/**
 * For a given SERP result, find the rank of a specific domain (substring match
 * to handle www. / mobile. / m. variants).
 * Returns position number (1-10) or null if not in top results.
 */
export function findDomainPosition(serp: SerpLiveResult, domain: string): number | null {
  const needle = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
  for (const r of serp.organic) {
    const rDomain = r.domain.toLowerCase().replace(/^www\./, "");
    if (rDomain === needle || rDomain.endsWith(`.${needle}`)) return r.position;
  }
  return null;
}
