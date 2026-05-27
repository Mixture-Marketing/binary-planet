/**
 * POST /api/admin/clients/delete-repo
 *
 * One-off admin endpoint: deletes a klient GitHub repo using hub's GITHUB_PAT
 * (which has `repo` + `delete_repo` scopes). Used for test data cleanup when
 * local gh CLI lacks delete_repo scope.
 *
 * Body: { repo_name: string }   — e.g. "clk_kaorl_m9em4-site"
 * Auth: X-BP-Admin-Key.
 */
import { Hono } from "hono";
import type { HonoEnv } from "../../../env.js";
import { err, ok } from "../../lib/responses.js";

export const adminDeleteKlientRepoRouter = new Hono<HonoEnv>();

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  if (!c.env.ADMIN_API_KEY) return "ADMIN_API_KEY missing";
  if (c.req.header("X-BP-Admin-Key") !== c.env.ADMIN_API_KEY) return "Invalid admin key";
  return null;
}

adminDeleteKlientRepoRouter.post("/", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  let body: { repo_name?: string };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  const repoName = (body.repo_name ?? "").trim();
  if (!/^[a-z0-9_-]+-site$/i.test(repoName)) {
    return c.json(err("VALIDATION_ERROR", "repo_name must match {client_id}-site"), 422);
  }
  if (!c.env.GITHUB_PAT || !c.env.GITHUB_ORG) {
    return c.json(err("INTERNAL_ERROR", "GITHUB_PAT or GITHUB_ORG missing"), 500);
  }

  const url = `https://api.github.com/repos/${c.env.GITHUB_ORG}/${repoName}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${c.env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mm-control-plane",
    },
  });
  if (res.status === 204) {
    return c.json(ok({ deleted: repoName }), 200);
  }
  const text = await res.text();
  return c.json(err("GITHUB_API_ERROR", `HTTP ${res.status}: ${text.slice(0, 200)}`), 502);
});
