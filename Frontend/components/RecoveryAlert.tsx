import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { gitEngine, TransactionEntry } from '@/services/git/engine';
import Colors from '@/constants/colors';

interface PendingGroup {
  repoId: string;
  dir: string;
  entries: TransactionEntry[];
}

export default function RecoveryAlert() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingGroup[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasPendingMerge, setHasPendingMerge] = useState(false);
  const [mergeRepoId, setMergeRepoId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('[RecoveryAlert] Checking for PENDING transactions…');
        const results = await gitEngine.getPendingTransactions();
        if (mounted) {
          setPending(results);
          // Check specifically for pending merge operations
          for (const group of results) {
            const mergeTx = group.entries.find(
              (e) => e.message?.startsWith('MERGE_IN_PROGRESS')
            );
            if (mergeTx) {
              setHasPendingMerge(true);
              setMergeRepoId(group.repoId);
              console.log('[RecoveryAlert] Found pending MERGE in', group.repoId);
              break;
            }
          }
          console.log('[RecoveryAlert]', results.length > 0
            ? `Found ${results.reduce((s, r) => s + r.entries.length, 0)} PENDING tx(s)`
            : 'No pending transactions ✓');
        }
      } catch (err) {
        console.warn('[RecoveryAlert] check failed', err);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking || dismissed || pending.length === 0) return null;

  const totalPending = pending.reduce((s, r) => s + r.entries.length, 0);

  return (
    <View style={styles.banner}>
      <View style={styles.inner}>
        <Text style={styles.icon}>⚠️</Text>
        <View style={styles.text}>
          <Text style={styles.title}>
            {hasPendingMerge ? 'Merge In Progress' : 'Interrupted Operations Detected'}
          </Text>
          <Text style={styles.subtitle}>
            {hasPendingMerge
              ? `A merge was interrupted in ${mergeRepoId}. Resume to avoid data loss.`
              : `${totalPending} operation${totalPending > 1 ? 's' : ''} did not complete in ${pending.map(p => p.repoId).join(', ')}`
            }
          </Text>
          {pending.map(group =>
            group.entries.map(entry => (
              <Text key={entry.id} style={styles.detail}>
                • {entry.type}: {entry.message ?? '(no message)'}
              </Text>
            )),
          )}

          {hasPendingMerge && (
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={() => {
                setDismissed(true);
                router.push('/merge-conflicts');
              }}
            >
              <Text style={styles.resumeBtnText}>Resume Merge Resolution →</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setDismissed(true)} style={styles.dismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#3a2000',
    borderWidth: 1,
    borderColor: '#ff9500',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  icon: { fontSize: 22, marginRight: 10, marginTop: 2 },
  text: { flex: 1 },
  title: {
    color: '#ff9500',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  detail: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  resumeBtn: {
    marginTop: 8,
    backgroundColor: '#ff9500',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resumeBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  dismiss: {
    padding: 4,
    marginLeft: 8,
  },
  dismissText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
