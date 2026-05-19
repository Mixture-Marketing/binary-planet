/**
 * Sveltia CMS OAuth proxy — GitHub provider.
 *
 * Flow (Decap-compatible spec):
 *   1. Sveltia opens popup: GET /api/sveltia/auth?provider=github&site_id=<klient-domain>&scope=repo
 *   2. Proxy → 302 to https://github.com/login/oauth/authorize?client_id=...&state=<random>&scope=repo
 *      State stored in KV with 10min TTL (anti-CSRF).
 *   3. User authorizes → GitHub redirects to /api/sveltia/callback?code=...&state=...
 *   4. Proxy validates state, exchanges code → access_token via POST github.com/login/oauth/access_token
 *   5. Returns HTML page with <script> calling window.opener.postMessage(
 *        'authorization:github:success:{"token":"...","provider":"github"}', origin)
 *   6. Sveltia receives the message, stores token, can now commit via GitHub API.
 *
 * Klient's Sveltia config.yml points at this proxy:
 *   backend:
 *     name: github
 *     repo: MixtureMarketing/{client_id}-site
 *     base_url: https://api.mixturemarketing.pl/api/sveltia
 *     auth_endpoint: auth
 *
 * Required env (Worker secrets):
 *   GITHUB_OAUTH_CLIENT_ID
 *   GITHUB_OAUTH_CLIENT_SECRET
 *
 * Required KV binding: CONFIG (re-used) — stores state with prefix "sveltia_oauth_state:"
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../env.js";

export const sveltiaOauthRouter = new Hono<HonoEnv>();

const STATE_KV_PREFIX = "sveltia_oauth_state:";
const STATE_TTL_SEC = 10 * 60;
const GH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GH_TOKEN_URL = "https://github.com/login/oauth/access_token";

interface StateData {
  site_id: string;
  scope: string;
  origin: string;
  created_at: number;
}

function genState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * GET /api/sveltia/auth — start OAuth.
 * Query params (from Sveltia):
 *   - provider=github (only supported value for v0.1)
 *   - site_id=<klient domain>
 *   - scope=repo (default)
 */
sveltiaOauthRouter.get("/auth", async (c) => {
  const env = c.env;
  if (!env.GITHUB_OAUTH_CLIENT_ID) {
    return c.text("OAuth not configured (GITHUB_OAUTH_CLIENT_ID missing)", 500);
  }

  const url = new URL(c.req.url);
  const provider = url.searchParams.get("provider") ?? "github";
  if (provider !== "github") {
    return c.text(`Unsupported provider: ${provider}`, 400);
  }
  const siteId = url.searchParams.get("site_id") ?? "";
  const scope = url.searchParams.get("scope") ?? "repo";

  // Anti-CSRF state
  const state = genState();
  const stateData: StateData = {
    site_id: siteId,
    scope,
    origin: c.req.header("Origin") ?? c.req.header("Referer") ?? "*",
    created_at: Date.now(),
  };
  await env.CONFIG.put(`${STATE_KV_PREFIX}${state}`, JSON.stringify(stateData), {
    expirationTtl: STATE_TTL_SEC,
  });

  // GitHub callback URL = this hub's /callback endpoint
  // Using request URL origin (works in dev where it's http://localhost:8787 too)
  const proxyOrigin = url.origin;
  const callbackUrl = `${proxyOrigin}/api/sveltia/callback`;

  const ghUrl = new URL(GH_AUTHORIZE_URL);
  ghUrl.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  ghUrl.searchParams.set("redirect_uri", callbackUrl);
  ghUrl.searchParams.set("scope", scope);
  ghUrl.searchParams.set("state", state);
  ghUrl.searchParams.set("allow_signup", "false");

  return c.redirect(ghUrl.toString(), 302);
});

/**
 * GET /api/sveltia/callback — GitHub redirected back with code.
 * Exchanges code → access_token, returns HTML that postMessages to opener.
 */
sveltiaOauthRouter.get("/callback", async (c) => {
  const env = c.env;
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return c.text("OAuth not configured", 500);
  }

  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const ghError = url.searchParams.get("error");

  if (ghError) {
    return c.html(buildResultPage("github", "error", `GitHub error: ${ghError}`, "*"));
  }
  if (!code || !state) {
    return c.html(buildResultPage("github", "error", "Missing code or state", "*"));
  }

  // Validate state (anti-CSRF + replay protection)
  const stateRaw = await env.CONFIG.get(`${STATE_KV_PREFIX}${state}`);
  if (!stateRaw) {
    return c.html(buildResultPage("github", "error", "Invalid or expired state", "*"));
  }
  // Consume state (one-time)
  await env.CONFIG.delete(`${STATE_KV_PREFIX}${state}`);

  let stateData: StateData;
  try {
    stateData = JSON.parse(stateRaw) as StateData;
  } catch {
    return c.html(buildResultPage("github", "error", "Corrupted state", "*"));
  }

  // Exchange code for access_token
  let tokenJson: { access_token?: string; token_type?: string; scope?: string; error?: string; error_description?: string };
  try {
    const res = await fetch(GH_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "mm-control-plane",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/sveltia/callback`,
      }),
    });
    tokenJson = (await res.json()) as typeof tokenJson;
  } catch (e) {
    return c.html(
      buildResultPage("github", "error", `Token exchange failed: ${e instanceof Error ? e.message : "unknown"}`, "*"),
    );
  }

  if (tokenJson.error || !tokenJson.access_token) {
    return c.html(
      buildResultPage(
        "github",
        "error",
        `GitHub: ${tokenJson.error ?? "unknown"} ${tokenJson.error_description ?? ""}`,
        "*",
      ),
    );
  }

  return c.html(
    buildResultPage(
      "github",
      "success",
      JSON.stringify({ token: tokenJson.access_token, provider: "github" }),
      stateData.origin,
    ),
  );
});

/**
 * Build the HTML page returned to the popup window. Posts message to opener (Sveltia)
 * with the auth result, then closes itself.
 *
 * Decap/Sveltia listens for `authorization:${provider}:${status}:${payload}` format.
 */
function buildResultPage(provider: string, status: "success" | "error", payload: string, targetOrigin: string): string {
  // payload is either an error message (status=error) or a JSON string (status=success)
  // Decap expects: "authorization:github:success:{...JSON...}" OR "authorization:github:error:message"
  const message = `authorization:${provider}:${status}:${payload}`;
  const safeMessage = JSON.stringify(message);
  const safeOrigin = JSON.stringify(targetOrigin === "*" ? "*" : targetOrigin);

  return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Authorizing…</title>
</head><body style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center;">
<p>Authorizing… ten popup zamknie się automatycznie.</p>
<script>
(function() {
  function send() {
    if (window.opener) {
      window.opener.postMessage(${safeMessage}, ${safeOrigin});
    }
  }
  send();
  // Sveltia/Decap re-asks once more before timing out
  setTimeout(function() { send(); window.close(); }, 100);
})();
</script>
</body></html>`;
}
