import { GitHubRepo } from '@/types/git';
import * as WebBrowser from 'expo-web-browser';

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const results: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.github.com/user/repos?per_page=50&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `token ${token}`,
      },
    });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const data = (await res.json()) as any[];
    const mapped = data.map(d => ({
      id: d.id,
      name: d.name,
      full_name: d.full_name,
      clone_url: d.clone_url,
      private: !!d.private,
      updated_at: d.updated_at,
    })) as GitHubRepo[];
    results.push(...mapped);
    if (data.length < 50) break;
    page += 1;
  }
  // sort by updated_at desc
  return results.sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1));
}

export async function startDeviceAuth(clientId: string, scope = 'repo') {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!res.ok) throw new Error(`GitHub device code error ${res.status}`);
  const data = await res.json();
  return {
    device_code: data.device_code as string,
    user_code: data.user_code as string,
    verification_uri: data.verification_uri as string,
    expires_in: data.expires_in as number,
    interval: data.interval as number,
  };
}

export async function openVerificationUrl(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

export async function pollDeviceToken(clientId: string, deviceCode: string, intervalSec = 5): Promise<string> {
  while (true) {
    await new Promise(r => setTimeout(r, intervalSec * 1000));
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    if (!res.ok) throw new Error(`GitHub token error ${res.status}`);
    const data = await res.json();
    if (data.error === 'authorization_pending') continue;
    if (data.error) throw new Error(data.error_description || data.error);
    return data.access_token as string;
  }
}

// ─── Commit diff via GitHub API ───────────────────────────────────────────────

export interface GitHubFilePatch {
  filename: string;
  previous_filename?: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  patch?: string; // unified diff hunk string from GitHub
}

/**
 * Parses a GitHub remote URL (https or ssh) and returns { owner, repo }.
 * Returns null if the URL is not a GitHub URL.
 */
export function parseGitHubRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  // https://github.com/owner/repo.git  or  git@github.com:owner/repo.git
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Fetches the list of file patches for a single commit from the GitHub API.
 * Returns an empty array if the commit has no files or the API call fails cleanly.
 * Throws on network/auth errors.
 */
export async function fetchGitHubCommitFiles(
  owner: string,
  repo: string,
  sha: string,
  token: string,
): Promise<GitHubFilePatch[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `token ${token}`,
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${sha}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as { files?: any[] };
  return (data.files ?? []) as GitHubFilePatch[];
}
