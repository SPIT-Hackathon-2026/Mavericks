/**
 * Offline Profile Cache
 *
 * - Caches GitHub profile, contributions, stats, and activity locally via AsyncStorage.
 * - Tracks local (offline) commits so graphs can update immediately.
 * - Provides merged data (cached remote + local offline).
 * - On sync, merges local commits into the remote data and clears the offline queue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  profile: 'gitlane:profile:user',
  contributions: (year: number) => `gitlane:profile:contribs:${year}`,
  stats: 'gitlane:profile:stats',
  activity: 'gitlane:profile:activity',
  offlineCommits: 'gitlane:profile:offlineCommits',
  lastSyncTime: 'gitlane:profile:lastSync',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedProfile {
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

export interface CachedContributions {
  year: number;
  totalContributions: number;
  contribMap: Record<string, number>;  // YYYY-MM-DD -> count
  fetchedAt: number;
}

export interface CachedStats {
  totalCommits: number;
  totalRepos: number;
  totalBranches: number;
  totalMerges: number;
  fetchedAt: number;
}

export interface CachedActivity {
  items: {
    type: 'commit' | 'repo' | 'branch' | 'other';
    msg: string;
    repo: string;
    detail: string;
    date: string;
    dateStr: string;
  }[];
  fetchedAt: number;
}

export interface OfflineCommit {
  id: string;
  repoName: string;
  date: string;      // YYYY-MM-DD
  message: string;
  timestamp: number;
  synced: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Profile Cache ────────────────────────────────────────────────────────────

export const profileCache = {
  // ── Profile ─────────────────────────────────────────────────
  async getProfile(): Promise<CachedProfile | null> {
    return getJSON<CachedProfile>(KEYS.profile);
  },
  async setProfile(profile: CachedProfile): Promise<void> {
    await setJSON(KEYS.profile, profile);
  },

  // ── Contributions ───────────────────────────────────────────
  async getContributions(year: number): Promise<CachedContributions | null> {
    return getJSON<CachedContributions>(KEYS.contributions(year));
  },
  async setContributions(year: number, data: CachedContributions): Promise<void> {
    await setJSON(KEYS.contributions(year), data);
  },

  // ── Stats ───────────────────────────────────────────────────
  async getStats(): Promise<CachedStats | null> {
    return getJSON<CachedStats>(KEYS.stats);
  },
  async setStats(stats: CachedStats): Promise<void> {
    await setJSON(KEYS.stats, stats);
  },

  // ── Activity ────────────────────────────────────────────────
  async getActivity(): Promise<CachedActivity | null> {
    return getJSON<CachedActivity>(KEYS.activity);
  },
  async setActivity(activity: CachedActivity): Promise<void> {
    await setJSON(KEYS.activity, activity);
  },

  // ── Offline commits ─────────────────────────────────────────
  async getOfflineCommits(): Promise<OfflineCommit[]> {
    return (await getJSON<OfflineCommit[]>(KEYS.offlineCommits)) ?? [];
  },
  async addOfflineCommit(commit: Omit<OfflineCommit, 'id' | 'synced'>): Promise<void> {
    const existing = await this.getOfflineCommits();
    existing.push({
      ...commit,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      synced: false,
    });
    await setJSON(KEYS.offlineCommits, existing);
  },
  async clearSyncedCommits(): Promise<void> {
    const existing = await this.getOfflineCommits();
    const remaining = existing.filter(c => !c.synced);
    await setJSON(KEYS.offlineCommits, remaining);
  },
  async markAllSynced(): Promise<void> {
    const existing = await this.getOfflineCommits();
    const updated = existing.map(c => ({ ...c, synced: true }));
    await setJSON(KEYS.offlineCommits, updated);
  },
  async clearOfflineCommits(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.offlineCommits);
  },

  // ── Last sync ──────────────────────────────────────────────
  async getLastSyncTime(): Promise<number | null> {
    const raw = await AsyncStorage.getItem(KEYS.lastSyncTime);
    return raw ? parseInt(raw, 10) : null;
  },
  async setLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(KEYS.lastSyncTime, String(Date.now()));
  },

  // ── Merge offline commits into contribution map ────────────
  mergeOfflineCommits(
    contribMap: Record<string, number>,
    offlineCommits: OfflineCommit[],
  ): Record<string, number> {
    const merged = { ...contribMap };
    for (const c of offlineCommits) {
      if (!c.synced) {
        merged[c.date] = (merged[c.date] ?? 0) + 1;
      }
    }
    return merged;
  },

  /** Get total commits from offline queue for stats overlay */
  offlineCommitCount(offlineCommits: OfflineCommit[]): number {
    return offlineCommits.filter(c => !c.synced).length;
  },

  // ── Clear all cached data ──────────────────────────────────
  async clearAll(): Promise<void> {
    const keys = [
      KEYS.profile,
      KEYS.stats,
      KEYS.activity,
      KEYS.offlineCommits,
      KEYS.lastSyncTime,
    ];
    // Clear contribution caches for recent years
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      keys.push(KEYS.contributions(y));
    }
    await AsyncStorage.multiRemove(keys);
  },
};
