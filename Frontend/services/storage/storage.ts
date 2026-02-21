import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as ExpoFile, Directory as ExpoDir, Paths } from 'expo-file-system';

const SETTINGS_KEY = 'gitlane:settings';
const RECENTS_KEY = 'gitlane:recentRepos';
const TAG = '[Storage]';

// Expo document root URI (no trailing slash)
const DOC_ROOT = Paths.document.uri.replace(/\/$/, '');

/** Convert a POSIX path (e.g. /repos/xyz) to a file:// URI under documentDirectory */
function toUri(posixPath: string): string {
  return DOC_ROOT + posixPath;
}

function gitDir(repoPath: string) {
  const base = repoPath.endsWith('/') ? repoPath.slice(0, -1) : repoPath;
  return `${base}/.git`;
}

function cacheFile(repoPath: string) {
  return `${gitDir(repoPath)}/gitlane_cache.json`;
}

function txFile(repoPath: string) {
  return `${gitDir(repoPath)}/gitlane_transactions.json`;
}

/** Read text from a file at a POSIX path, or null if missing */
async function readText(posixPath: string): Promise<string | null> {
  const f = new ExpoFile(toUri(posixPath));
  if (!f.exists) return null;
  return await f.text();
}

/** Write text to a file at a POSIX path, creating parent dirs as needed */
function writeText(posixPath: string, content: string): void {
  const f = new ExpoFile(toUri(posixPath));
  const parent = f.parentDirectory;
  if (!parent.exists) {
    parent.create({ intermediates: true, idempotent: true });
  }
  if (!f.exists) {
    f.create({ intermediates: true, overwrite: true });
  }
  f.write(content);
}

/** Delete a file at a POSIX path silently */
function deleteFile(posixPath: string): void {
  const f = new ExpoFile(toUri(posixPath));
  if (f.exists) {
    f.delete();
  }
}

export const storage = {
  // -- AsyncStorage-backed settings & recents --
  async getSettings<T>(fallback: T): Promise<T> {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  async setSettings(value: unknown) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  },
  async getRecentRepos(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  },
  async setRecentRepos(list: string[]) {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  },

  // -- File-backed cache & transaction log --
  async readCache<T>(repoPath: string, key: string): Promise<T | null> {
    try {
      const raw = await readText(cacheFile(repoPath));
      if (!raw) return null;
      const json = JSON.parse(raw) as Record<string, unknown>;
      return (json[key] as T) ?? null;
    } catch {
      return null;
    }
  },
  async writeCache(repoPath: string, key: string, value: unknown) {
    const path = cacheFile(repoPath);
    let existing: Record<string, unknown> = {};
    try {
      const raw = await readText(path);
      if (raw) existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
    existing[key] = value;
    writeText(path, JSON.stringify(existing));
  },
  async appendTransaction(repoPath: string, entry: unknown) {
    const path = txFile(repoPath);
    let tx: unknown[] = [];
    try {
      const raw = await readText(path);
      if (raw) tx = JSON.parse(raw) as unknown[];
    } catch {
      tx = [];
    }
    tx.push(entry);
    writeText(path, JSON.stringify(tx));
  },
  async deleteCache(repoPath: string) {
    try {
      deleteFile(cacheFile(repoPath));
      console.log(TAG, 'cache deleted', cacheFile(repoPath));
    } catch {
      // file didn't exist - fine
    }
  },
};
