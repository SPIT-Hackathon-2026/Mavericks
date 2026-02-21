/**
 * Offline Push Queue
 *
 * Stores push requests when the device is offline.
 * When connectivity is restored, drains the queue automatically.
 * Provides a listener system so the UI can show toasts / badges.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { gitEngine } from '@/services/git/engine';
import { notificationService } from '@/services/notifications/notificationService';

const TAG = '[PushQueue]';
const STORAGE_KEY = 'gitlane:pushQueue';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QueuedPush {
  id: string;
  repoId: string;
  repoName: string;
  branch: string;
  queuedAt: number;
  status: 'queued' | 'pushing' | 'completed' | 'failed';
  error?: string;
}

type QueueListener = (event: {
  type: 'queued' | 'syncing' | 'success' | 'failed' | 'drain-start' | 'drain-end';
  push?: QueuedPush;
  remaining?: number;
  message: string;
}) => void;

// ── Helpers ────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadQueue(): Promise<QueuedPush[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedPush[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedPush[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

// ── Push Queue Singleton ───────────────────────────────────────────────────

class PushQueueManager {
  private listeners: Set<QueueListener> = new Set();
  private networkCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private wasOnline = true;

  /** Subscribe to queue events. Returns an unsubscribe function. */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Parameters<QueueListener>[0]) {
    for (const fn of this.listeners) {
      try { fn(event); } catch {}
    }
  }

  /** Start background network monitoring. Call once at app boot. */
  startMonitoring() {
    if (this.networkCheckInterval) return;
    console.log(TAG, 'Starting network monitoring');

    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const online = !!(state.isConnected && state.isInternetReachable);

        // Came back online → drain the queue
        if (online && !this.wasOnline) {
          console.log(TAG, 'Network restored — draining push queue');
          this.drainQueue();
        }

        this.wasOnline = online;
      } catch {
        this.wasOnline = false;
      }
    };

    check();
    this.networkCheckInterval = setInterval(check, 8_000);
  }

  /** Stop background monitoring. */
  stopMonitoring() {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }

  /** Check if the device is currently online. */
  async isOnline(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return !!(state.isConnected && state.isInternetReachable);
    } catch {
      return false;
    }
  }

  /** Enqueue a push request (called when offline). */
  async enqueue(repoId: string, repoName: string, branch: string): Promise<QueuedPush> {
    const queue = await loadQueue();

    // De-duplicate: if there's already a queued (not failed) push for the same repo+branch, skip
    const existing = queue.find(
      (p) => p.repoId === repoId && p.branch === branch && p.status === 'queued'
    );
    if (existing) {
      console.log(TAG, `Push already queued for ${repoId}/${branch}`);
      this.emit({
        type: 'queued',
        push: existing,
        remaining: queue.filter((p) => p.status === 'queued').length,
        message: `Push request for "${repoName}" is already in the queue`,
      });
      return existing;
    }

    const entry: QueuedPush = {
      id: genId(),
      repoId,
      repoName,
      branch,
      queuedAt: Date.now(),
      status: 'queued',
    };

    queue.push(entry);
    await saveQueue(queue);

    const remaining = queue.filter((p) => p.status === 'queued').length;
    console.log(TAG, `Enqueued push for ${repoId}/${branch} (${remaining} pending)`);

    this.emit({
      type: 'queued',
      push: entry,
      remaining,
      message: `📥 Push request added to queue for "${repoName}" (${branch}) — will auto-sync when back online`,
    });

    // Fire device notification
    notificationService.pushQueued(repoName, branch);

    return entry;
  }

  /** Get all pending (queued) pushes. */
  async getPending(): Promise<QueuedPush[]> {
    const queue = await loadQueue();
    return queue.filter((p) => p.status === 'queued');
  }

  /** Get count of pending pushes. */
  async pendingCount(): Promise<number> {
    return (await this.getPending()).length;
  }

  /** Process all queued pushes. Requires a GitHub token. */
  async drainQueue(token?: string): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const online = await this.isOnline();
    if (!online) {
      this.isSyncing = false;
      return;
    }

    const queue = await loadQueue();
    const pending = queue.filter((p) => p.status === 'queued');

    if (pending.length === 0) {
      this.isSyncing = false;
      return;
    }

    console.log(TAG, `Draining ${pending.length} queued push(es)`);
    this.emit({
      type: 'drain-start',
      remaining: pending.length,
      message: `🔄 Back online! Syncing ${pending.length} queued push${pending.length > 1 ? 'es' : ''}…`,
    });

    // Fire device notification
    notificationService.syncStarted(pending.length);

    // If no token passed, try to read from stored settings
    let authToken = token;
    if (!authToken) {
      try {
        const raw = await AsyncStorage.getItem('gitlane:settings');
        if (raw) {
          const settings = JSON.parse(raw);
          authToken = settings.githubToken ?? null;
        }
      } catch {}
    }

    if (!authToken) {
      console.warn(TAG, 'Cannot drain — no GitHub token available');
      this.isSyncing = false;
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const entry of pending) {
      entry.status = 'pushing';
      await saveQueue(queue);

      this.emit({
        type: 'syncing',
        push: entry,
        remaining: pending.length - successCount - failCount,
        message: `⏳ Executing push for "${entry.repoName}" (${entry.branch})…`,
      });

      try {
        await gitEngine.push(entry.repoId, authToken);
        entry.status = 'completed';
        successCount++;

        console.log(TAG, `Push succeeded: ${entry.repoId}/${entry.branch}`);
        this.emit({
          type: 'success',
          push: entry,
          remaining: pending.length - successCount - failCount,
          message: `✅ Push executed in "${entry.repoName}" (${entry.branch}) — changes are live on remote`,
        });

        // Fire device notification
        notificationService.pushExecuted(entry.repoName, entry.branch);
      } catch (err) {
        entry.status = 'failed';
        entry.error = err instanceof Error ? err.message : String(err);
        failCount++;

        console.error(TAG, `Push failed: ${entry.repoId}/${entry.branch}`, err);
        this.emit({
          type: 'failed',
          push: entry,
          remaining: pending.length - successCount - failCount,
          message: `❌ Push failed for "${entry.repoName}": ${entry.error}`,
        });

        // Fire device notification
        notificationService.pushFailed(entry.repoName, entry.error ?? 'Unknown error');
      }

      await saveQueue(queue);
    }

    // Clean completed entries (keep failed for visibility)
    const cleaned = queue.filter((p) => p.status !== 'completed');
    await saveQueue(cleaned);

    this.emit({
      type: 'drain-end',
      remaining: failCount,
      message:
        failCount === 0
          ? `🎉 Sync complete — all ${successCount} queued push${successCount > 1 ? 'es' : ''} executed successfully!`
          : `⚠️ Sync finished — ${successCount} push${successCount > 1 ? 'es' : ''} succeeded, ${failCount} failed`,
    });

    // Fire device notification for sync completion
    notificationService.syncComplete(successCount, failCount);

    this.isSyncing = false;
  }

  /** Remove all entries (e.g. on sign-out). */
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const pushQueue = new PushQueueManager();
