import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const SETTINGS_KEY = 'gitlane:settings';
const RECENTS_KEY = 'gitlane:recentRepos';

async function ensureDir(path: string) {
  try {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  } catch (err: unknown) {
    const message = (err as Error)?.message ?? '';
    if (!message.includes('already exists')) {
      throw err;
    }
  }
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

export const storage = {
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
  async readCache<T>(repoPath: string, key: string): Promise<T | null> {
    const path = cacheFile(repoPath);
    try {
      const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      const json = JSON.parse(raw) as Record<string, unknown>;
      return (json[key] as T) ?? null;
    } catch {
      return null;
    }
  },
  async writeCache(repoPath: string, key: string, value: unknown) {
    const path = cacheFile(repoPath);
    await ensureDir(gitDir(repoPath));
    let existing: Record<string, unknown> = {};
    try {
      const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
    existing[key] = value;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(existing), { encoding: FileSystem.EncodingType.UTF8 });
  },
  async appendTransaction(repoPath: string, entry: unknown) {
    const path = txFile(repoPath);
    await ensureDir(gitDir(repoPath));
    let tx: unknown[] = [];
    try {
      const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      tx = JSON.parse(raw) as unknown[];
    } catch {
      tx = [];
    }
    tx.push(entry);
    await FileSystem.writeAsStringAsync(path, JSON.stringify(tx), { encoding: FileSystem.EncodingType.UTF8 });
  },
};
