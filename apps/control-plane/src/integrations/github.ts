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
  /** PR number when PR created. */
  pr_number?: number;
  /** PR URL when PR created. */
  pr_url?: string;
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
        // PUBLIC because org secrets (CF_API_TOKEN/CF_ACCOUNT_ID) only flow to private
        // repos on GitHub Team+ ($4/mo). Free plan + public repos = secrets work.
        // Upgrade to Team and flip this to `true` when first paid klient is real.
        private: false,
        include_all_branches: false,
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    // POST /generate is async — repo exists immediately but template files copy over ~3-8s.
    // Poll until a known template file (apps/starter/src/client.config.ts) is visible.
    const headers = {
      "Authorization": `Bearer ${env.GITHUB_PAT}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mm-control-plane",
    };
    const probeUrl = `https://api.github.com/repos/${ghOrg(env)}/${repoName}/contents/apps/starter/src/client.config.ts?ref=main`;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const probe = await fetch(probeUrl, { headers });
      if (probe.ok) {
        return { ok: true, message: `Repo created (template ready after ${i + 1}s)`, repo_url: repoUrl };
      }
    }
    return { ok: false, message: `Repo created but template files not visible after 15s` };
  } catch (e) {
    return { ok: false, message: `GitHub fetch failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/**
 * Force GitHub Actions to index workflows in a newly-generated klient repo.
 *
 * Problem: when a repo is created from a template via POST /generate, GH Actions
 * does NOT automatically index the workflows. Subsequent `workflow_dispatch` calls
 * return 404 until SOMEONE commits a change inside `.github/workflows/`.
 *
 * Fix: PUT-back the workflow file with a trivial trailing comment.
 * Idempotent — runs once per provision, adds 1 GH API call.
 */
export async function githubForceWorkflowIndex(
  env: Env,
  params: { repo_owner: string; repo_name: string; workflow_filename: string },
): Promise<GithubResult> {
  if (dryRun(env)) {
    return { ok: true, message: `[DRY-RUN] Would touch ${params.workflow_filename} to force indexing` };
  }
  if (!env.GITHUB_PAT) return { ok: false, message: "GITHUB_PAT missing" };

  const headers = {
    "Authorization": `Bearer ${env.GITHUB_PAT}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "mm-control-plane",
  };
  const path = `.github/workflows/${params.workflow_filename}`;
  const url = `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}/contents/${path}`;

  try {
    // 1. Fetch current file + SHA
    const getRes = await fetch(url, { headers });
    if (!getRes.ok) return { ok: false, message: `GH get workflow ${getRes.status}` };
    const file = (await getRes.json()) as { sha: string; content: string };

    // Decode base64 content, append touch comment, re-encode
    const cleaned = file.content.replace(/\s+/g, ""); // GH wraps base64 at 60 chars
    const decoded = atob(cleaned);
    const touched = `${decoded}\n# touch ${Date.now()}\n`;
    const newContent = btoa(touched);

    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "chore: trigger workflow indexing",
        content: newContent,
        sha: file.sha,
        branch: "main",
      }),
    });
    if (!putRes.ok) return { ok: false, message: `GH put workflow ${putRes.status}: ${(await putRes.text()).slice(0, 200)}` };

    return { ok: true, message: `Workflow ${params.workflow_filename} touched (indexing triggered)` };
  } catch (e) {
    return { ok: false, message: `GH workflow touch failed: ${e instanceof Error ? e.message : "unknown"}` };
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
  const headers = {
    "Authorization": `Bearer ${env.GITHUB_PAT}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "mm-control-plane",
  };
  try {
    // Files copied from a template repo already exist — GH requires `sha` for updates.
    // Fetch existing SHA first (404 = file doesn't exist, no sha needed).
    let existingSha: string | undefined;
    const getRes = await fetch(`${url}?ref=${branch}`, { headers });
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha?: string };
      existingSha = existing.sha;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: params.message,
        content: btoa(unescape(encodeURIComponent(params.content))),
        branch,
        ...(existingSha && { sha: existingSha }),
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `GitHub commit ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const json = (await res.json()) as { commit?: { sha?: string } };
    return { ok: true, message: existingSha ? "File updated" : "File created", commit_sha: json.commit?.sha };
  } catch (e) {
    return { ok: false, message: `GitHub commit fetch failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

// ---------------------------------------------------------------------------
// Pull Requests — Track 8 (AI blog drafts open PR for klient review)
// ---------------------------------------------------------------------------

/**
 * Create a new branch from base, commit a file, open PR. Returns PR URL.
 * Used by AI blog workflow: each draft = separate branch + PR.
 */
export async function githubOpenPullRequest(
  env: Env,
  params: {
    repo_owner: string;
    repo_name: string;
    base_branch?: string;
    new_branch: string;
    file_path: string;
    file_content: string;
    commit_message: string;
    pr_title: string;
    pr_body: string;
  },
): Promise<GithubResult> {
  const baseBranch = params.base_branch ?? "main";
  const repoUrl = `https://github.com/${params.repo_owner}/${params.repo_name}`;

  if (dryRun(env)) {
    const fakePrNumber = Math.floor(Math.random() * 1000) + 1;
    return {
      ok: true,
      message: `[DRY-RUN] Would open PR in ${repoUrl} (branch ${params.new_branch} from ${baseBranch}, file ${params.file_path})`,
      pr_number: fakePrNumber,
      pr_url: `${repoUrl}/pull/${fakePrNumber}`,
      commit_sha: `dryrun-${Date.now().toString(16)}`,
    };
  }
  if (!env.GITHUB_PAT) return { ok: false, message: "GITHUB_PAT missing" };

  const headers = {
    "Authorization": `Bearer ${env.GITHUB_PAT}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "mm-control-plane",
  };
  const repoApi = `https://api.github.com/repos/${params.repo_owner}/${params.repo_name}`;

  try {
    // 1. Get base branch SHA
    const baseRes = await fetch(`${repoApi}/git/ref/heads/${baseBranch}`, { headers });
    if (!baseRes.ok) {
      return { ok: false, message: `GH get base ref ${baseRes.status}: ${(await baseRes.text()).slice(0, 200)}` };
    }
    const baseRef = (await baseRes.json()) as { object: { sha: string } };

    // 2. Create new branch (POST refs)
    const newBranchRes = await fetch(`${repoApi}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${params.new_branch}`, sha: baseRef.object.sha }),
    });
    if (!newBranchRes.ok && newBranchRes.status !== 422 /* already exists */) {
      return { ok: false, message: `GH create branch ${newBranchRes.status}: ${(await newBranchRes.text()).slice(0, 200)}` };
    }

    // 3. Commit file on new branch (PUT contents)
    const fileRes = await fetch(`${repoApi}/contents/${params.file_path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: params.commit_message,
        content: btoa(unescape(encodeURIComponent(params.file_content))),
        branch: params.new_branch,
      }),
    });
    if (!fileRes.ok) {
      return { ok: false, message: `GH commit file ${fileRes.status}: ${(await fileRes.text()).slice(0, 200)}` };
    }
    const fileJson = (await fileRes.json()) as { commit?: { sha?: string } };

    // 4. Open PR
    const prRes = await fetch(`${repoApi}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: params.pr_title,
        head: params.new_branch,
        base: baseBranch,
        body: params.pr_body,
      }),
    });
    if (!prRes.ok) {
      return { ok: false, message: `GH open PR ${prRes.status}: ${(await prRes.text()).slice(0, 200)}` };
    }
    const prJson = (await prRes.json()) as { number: number; html_url: string };

    return {
      ok: true,
      message: `PR #${prJson.number} opened`,
      pr_number: prJson.number,
      pr_url: prJson.html_url,
      commit_sha: fileJson.commit?.sha,
    };
  } catch (e) {
    return { ok: false, message: `GH PR flow failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
