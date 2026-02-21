/**
 * In-App Notification Service
 *
 * A message queue that shows notifications sequentially as in-app banners.
 * Each notification is displayed for a set duration, then the next one appears.
 * Uses expo-haptics for tactile feedback.
 *
 * Works in Expo Go — no native push notification dependency.
 */

import * as Haptics from 'expo-haptics';

const TAG = '[NotificationService]';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
}

type NotificationListener = (notification: NotificationItem | null) => void;

class NotificationService {
  private queue: NotificationItem[] = [];
  private currentNotification: NotificationItem | null = null;
  private listeners: Set<NotificationListener> = new Set();
  private displayTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;

  /** Duration each notification is shown (ms) */
  private displayDuration = 4000;

  /** Subscribe to notification changes. Returns unsubscribe fn. */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.currentNotification);
    return () => this.listeners.delete(listener);
  }

  private emit(notification: NotificationItem | null) {
    for (const fn of this.listeners) {
      try { fn(notification); } catch {}
    }
  }

  /** No-op init for API compat — nothing to set up for in-app notifications */
  async init(): Promise<void> {
    console.log(TAG, 'Initialized (in-app notification queue)');
  }

  /** Show a notification — queues it if another is already showing */
  async show(opts: {
    title: string;
    body: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }): Promise<void> {
    const item: NotificationItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: opts.title,
      body: opts.body,
      type: opts.type ?? 'info',
      timestamp: Date.now(),
    };

    this.queue.push(item);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.currentNotification = item;
    this.emit(item);

    // Haptic feedback based on type
    try {
      switch (item.type) {
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch {}

    // Show for displayDuration, then move to next
    this.displayTimer = setTimeout(() => {
      this.currentNotification = null;
      this.emit(null);
      this.isProcessing = false;

      // Small gap between notifications so animations don't collide
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 400);
      }
    }, this.displayDuration);
  }

  // ── Convenience methods for push queue events ───────────────────────────

  async pushQueued(repoName: string, branch: string): Promise<void> {
    await this.show({
      title: '📥 Push Added to Queue',
      body: `"${repoName}" (${branch}) queued — will auto-sync when back online`,
      type: 'info',
    });
  }

  async syncStarted(count: number): Promise<void> {
    await this.show({
      title: '🔄 Back Online — Syncing',
      body: `Syncing ${count} queued push${count > 1 ? 'es' : ''}…`,
      type: 'info',
    });
  }

  async pushExecuted(repoName: string, branch: string): Promise<void> {
    await this.show({
      title: '✅ Push Executed',
      body: `"${repoName}" (${branch}) pushed — changes are live on remote`,
      type: 'success',
    });
  }

  async pushFailed(repoName: string, error: string): Promise<void> {
    await this.show({
      title: '❌ Push Failed',
      body: `"${repoName}": ${error}`,
      type: 'error',
    });
  }

  async syncComplete(successCount: number, failCount: number): Promise<void> {
    if (failCount === 0) {
      await this.show({
        title: '🎉 Sync Complete',
        body: `All ${successCount} queued push${successCount > 1 ? 'es' : ''} synced successfully!`,
        type: 'success',
      });
    } else {
      await this.show({
        title: '⚠️ Sync Finished',
        body: `${successCount} synced, ${failCount} failed`,
        type: 'warning',
      });
    }
  }
}

export const notificationService = new NotificationService();
