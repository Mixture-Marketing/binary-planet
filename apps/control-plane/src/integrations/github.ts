/**
 * GitHub integration — fork starter repo + commit client.config.ts.
 *
 * Production: uses GITHUB_PAT (Personal Access Token with `repo` scope).
 * Dry-run: returns deterministic stub.
 *
 * Reference: https://docs.github.com/en/rest/repos/forks + /repos/contents.
 */

import type { Env } from "../env.js";

export interface GithubResult {
  ok: boolean;
  message: string;
  /** Full repo URL when created. */
  repo_url?: string;
  /** Commit SHA when committed. */
  commit_sha?: string;
}

function dryRun(env: Env): boolean {
  return (env.PROVISIONING_DRY_RUN ?? "true").toLowerCase() === "true";
}

function ghOrg(env: Env): string {
  return env.GITHUB_ORG ?? "MixtureMarketing";
}

function ghSourceRepo(env: Env): string {
  return env.GITHUB_SOURCE_REPO ?? "MixtureMarketing/binary-planet";
}

/** Create a new repo for the klient (forked from binary-planet, but as a fresh repo not literal GH fork). */
export async function githubCreateClientRepo(
  env: Env,
  params: { client_id: string; description: string },
): Promise<GithubResult> {
  const repoName = `${params.client_id}-site`;
  const repoUrl = `https://github.com/${ghOrg(env)}/${repoName}`;

  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would create repo ${repoUrl} (template: ${ghSourceRepo(env)})`,
      repo_url: repoUrl,
    };
  }
  if (!env.GITHUB_PAT) return { ok: false, message: "GITHUB_PAT missing" };

  // Production: POST /repos/{template_owner}/{template_repo}/generate
  // Body: { owner: GITHUB_ORG, name: repoName, description, private: true }
  // Header: Authorization: Bearer <PAT>
  try {
    const res = await fetch(`https://api.github.com/repos/${ghSourceRepo(env)}/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_PAT}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "mm-control-plane",
      },
      body: JSON.stringify({
        owner: ghOrg(env),
        name: repoName,
        description: params.description.slice(0, 350),
        private: true,
        include_all_branches: false,
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true, message: "Repo created", repo_url: repoUrl };
  } catch (e) {
    return { ok: false, message: `GitHub fetch failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/** Commit a file to the klient repo (e.g. apps/starter/src/client.config.ts content). */
export async function githubCommitFile(
  env: Env,
  params: {
    repo_owner: string;
    repo_name: string;
    path: string;
    content: string;
    message: string;
    branch?: string;
  },
): Promise<GithubResult> {
  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would commit ${params.path} (${params.content.length} bytes) to ${params.repo_owner}/${params.repo_name}`,
      commit_sha: `dryrun-${Date.now().toString(16)}`,
    };
  }
  if (!env.GITHUB_PAT) return { ok: false, message: "GITHUB_PAT missing" };

  const branch = params.branch ?? "main";
  const url = `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}/contents/${params.path}`;
  try {
    // Production needs to fetch SHA of existing file first if updating.
    // For initial commit after `generate`, no SHA needed.
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_PAT}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "mm-control-plane",
      },
      body: JSON.stringify({
        message: params.message,
        content: btoa(unescape(encodeURIComponent(params.content))),
        branch,
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `GitHub commit ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const json = (await res.json()) as { commit?: { sha?: string } };
    return { ok: true, message: "File committed", commit_sha: json.commit?.sha };
  } catch (e) {
    return { ok: false, message: `GitHub commit fetch failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
