/**
 * GitHub Profile & Contributions API
 * Fetches real user data using the authenticated token.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubProfile {
  login: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string;
  createdAt: string;
  followers: number;
  following: number;
  publicRepos: number;
  totalPrivateRepos: number;
  htmlUrl: string;
}

export interface ContributionDay {
  date: string;       // YYYY-MM-DD
  count: number;
}

export interface ContributionYear {
  year: number;
  totalContributions: number;
  weeks: { contributionDays: ContributionDay[] }[];
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: {
    commits?: { sha: string; message: string }[];
    ref?: string;
    ref_type?: string;
    action?: string;
    size?: number;
  };
}

export interface ProfileStats {
  totalCommits: number;
  totalRepos: number;
  totalBranches: number;
  totalMerges: number;
}

export interface RecentActivity {
  type: 'commit' | 'repo' | 'branch' | 'other';
  msg: string;
  repo: string;
  detail: string;
  date: string;
  dateStr: string;  // YYYY-MM-DD
}

// ─── REST API ─────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

function headers(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `token ${token}`,
  };
}

/** Fetch the authenticated user's profile */
export async function fetchGitHubProfile(token: string): Promise<GitHubProfile> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const d = await res.json();
  return {
    login: d.login,
    name: d.name ?? null,
    email: d.email ?? null,
    bio: d.bio ?? null,
    location: d.location ?? null,
    avatarUrl: d.avatar_url,
    createdAt: d.created_at,
    followers: d.followers ?? 0,
    following: d.following ?? 0,
    publicRepos: d.public_repos ?? 0,
    totalPrivateRepos: d.total_private_repos ?? d.owned_private_repos ?? 0,
    htmlUrl: d.html_url,
  };
}

// ─── GraphQL: Contribution Calendar ──────────────────────────────────────────

export async function fetchContributions(
  token: string,
  year: number,
): Promise<ContributionYear> {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;

  const query = `
    query($from: DateTime!, $to: DateTime!) {
      viewer {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      ...headers(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { from, to } }),
  });

  if (!res.ok) throw new Error(`GitHub GraphQL error ${res.status}`);
  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? 'GraphQL error');
  }

  const cal = json.data.viewer.contributionsCollection.contributionCalendar;

  return {
    year,
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w: any) => ({
      contributionDays: w.contributionDays.map((d: any) => ({
        date: d.date,
        count: d.contributionCount,
      })),
    })),
  };
}

/** Convert ContributionYear to a flat Record<date, count> map */
export function contribYearToMap(cy: ContributionYear): Record<string, number> {
  const map: Record<string, number> = {};
  for (const week of cy.weeks) {
    for (const day of week.contributionDays) {
      if (day.count > 0) {
        map[day.date] = day.count;
      }
    }
  }
  return map;
}

// ─── REST: Events for activity feed & stats ─────────────────────────────────

export async function fetchUserEvents(
  token: string,
  username: string,
  pages = 3,
): Promise<GitHubEvent[]> {
  const all: GitHubEvent[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(
      `${GITHUB_API}/users/${username}/events?per_page=100&page=${page}`,
      { headers: headers(token) },
    );
    if (!res.ok) break;
    const data = (await res.json()) as GitHubEvent[];
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

/** Derive stats from events */
export function deriveStatsFromEvents(events: GitHubEvent[]): ProfileStats {
  let totalCommits = 0;
  const repos = new Set<string>();
  let totalBranches = 0;
  let totalMerges = 0;

  for (const e of events) {
    repos.add(e.repo.name);
    if (e.type === 'PushEvent') {
      totalCommits += e.payload.commits?.length ?? e.payload.size ?? 1;
    }
    if (e.type === 'CreateEvent' && e.payload.ref_type === 'branch') {
      totalBranches++;
    }
    if (e.type === 'PullRequestEvent' && e.payload.action === 'closed') {
      totalMerges++;
    }
  }

  return {
    totalCommits,
    totalRepos: repos.size,
    totalBranches,
    totalMerges,
  };
}

/** Build recent activity list from events */
export function buildRecentActivity(events: GitHubEvent[], limit = 20): RecentActivity[] {
  const activities: RecentActivity[] = [];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const e of events) {
    if (activities.length >= limit) break;
    const d = new Date(e.created_at);
    const dateLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    const dateStr = e.created_at.slice(0, 10);

    if (e.type === 'PushEvent') {
      const count = e.payload.commits?.length ?? e.payload.size ?? 1;
      if (count > 0) {
        activities.push({
          type: 'commit',
          msg: `Created ${count} commit${count !== 1 ? 's' : ''} in 1 repository`,
          repo: e.repo.name,
          detail: `${count} commit${count !== 1 ? 's' : ''}`,
          date: dateLabel,
          dateStr,
        });
      }
    } else if (e.type === 'CreateEvent') {
      if (e.payload.ref_type === 'repository') {
        activities.push({
          type: 'repo',
          msg: 'Created 1 repository',
          repo: e.repo.name,
          detail: 'New repo',
          date: dateLabel,
          dateStr,
        });
      } else if (e.payload.ref_type === 'branch') {
        activities.push({
          type: 'branch',
          msg: `Created branch ${e.payload.ref ?? ''}`,
          repo: e.repo.name,
          detail: `Branch: ${e.payload.ref ?? ''}`,
          date: dateLabel,
          dateStr,
        });
      }
    } else if (e.type === 'PullRequestEvent' && e.payload.action === 'closed') {
      activities.push({
        type: 'other',
        msg: 'Merged a pull request',
        repo: e.repo.name,
        detail: 'PR merged',
        date: dateLabel,
        dateStr,
      });
    }
  }

  return activities;
}

/** Fetch total repo count (may be higher than events-based count) */
export async function fetchRepoCount(token: string): Promise<{ public: number; private: number; total: number }> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const d = await res.json();
  const pub = d.public_repos ?? 0;
  const priv = d.total_private_repos ?? d.owned_private_repos ?? 0;
  return { public: pub, private: priv, total: pub + priv };
}
