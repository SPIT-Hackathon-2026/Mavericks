/**
 * P2P Transfer Screen
 *
 * Send mode:  Select repo → Select commits → Generate QR → Wait → Transfer complete
 * Receive mode: Scan QR → Connect → View diff → Accept / Reject
 *
 * Transport layer: AsyncStorage relay (same-device demo).
 * For real multi-device, swap p2pService storeSession/getSession
 * with a WebSocket or TCP socket driver — no UI code changes needed.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  Wifi,
  QrCode,
  FolderGit2,
  CheckCircle,
  Smartphone,
  Zap,
  GitCommit as GitCommitIcon,
  ChevronRight,
  XCircle,
  ArrowLeft,
  ScanLine,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import SegmentedControl from '@/components/SegmentedControl';
import GlowButton from '@/components/GlowButton';
import DiffViewer from '@/components/DiffViewer';
import { gitEngine } from '@/services/git/engine';
import {
  createSenderSession,
  getSession,
  updateSessionState,
  decodeQRPayload,
  buildRealDiffFiles,
} from '@/services/p2p/p2pService';
import type { P2PSession, QRPayload, DiffFile } from '@/services/p2p/p2pService';
import type { GitCommit } from '@/types/git';

// ─── Step types ───────────────────────────────────────────────────────────────

type SendStep = 'select-repo' | 'select-commits' | 'qr-ready' | 'complete';
type ReceiveStep = 'scanner' | 'connecting' | 'review-diff' | 'accepted';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseRing() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.2, 0] });
  return (
    <Animated.View
      style={[styles.pulseRing, { transform: [{ scale }], opacity }]}
      pointerEvents="none"
    />
  );
}

function CommitRow({
  commit,
  selected,
  onPress,
}: {
  commit: GitCommit;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.commitRow, selected && styles.commitRowSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <GitCommitIcon size={16} color={selected ? Colors.accentPrimary : Colors.textMuted} />
      <View style={styles.commitInfo}>
        <Text style={styles.commitMsg} numberOfLines={1}>{commit.message}</Text>
        <Text style={styles.commitMeta}>
          {commit.shortSha} · {commit.author} · {commit.date}
        </Text>
        <View style={styles.commitStats}>
          {commit.filesChanged > 0 && (
            <Text style={styles.commitStatFiles}>{commit.filesChanged} files</Text>
          )}
          {commit.additions > 0 && (
            <Text style={styles.commitStatAdd}>+{commit.additions}</Text>
          )}
          {commit.deletions > 0 && (
            <Text style={styles.commitStatDel}>-{commit.deletions}</Text>
          )}
        </View>
      </View>
      {selected ? (
        <CheckCircle size={18} color={Colors.accentPrimary} />
      ) : (
        <View style={styles.unselectedCircle} />
      )}
    </TouchableOpacity>
  );
}

function TransferComplete({ session, onDone }: { session: P2PSession; onDone: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80 }).start();
    haptic(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  return (
    <View style={styles.completeContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], marginBottom: Spacing.lg }}>
        <CheckCircle size={64} color={Colors.accentPrimary} strokeWidth={1.5} />
      </Animated.View>
      <Text style={styles.completeTitle}>Transfer Complete</Text>
      <Text style={styles.completeSubtitle}>
        {session.diffFiles.length} file{session.diffFiles.length !== 1 ? 's' : ''} sent to receiver
      </Text>
      <View style={styles.completeMeta}>
        <View style={styles.completeMetaRow}>
          <Text style={styles.completeMetaLabel}>Repository</Text>
          <Text style={styles.completeMetaValue}>{session.repoName}</Text>
        </View>
        <View style={styles.completeMetaRow}>
          <Text style={styles.completeMetaLabel}>Session</Text>
          <Text style={styles.completeMetaValue}>{session.sessionToken}</Text>
        </View>
      </View>
      <View style={{ marginTop: Spacing.xl, width: '100%' }}>
        <GlowButton title="Done" onPress={onDone} fullWidth />
      </View>
    </View>
  );
}

function QRScanner({
  onScanned,
  onCancel,
}: {
  onScanned: (data: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  if (!permission) {
    return (
      <View style={styles.scannerContainer}>
        <ActivityIndicator color={Colors.accentPrimary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.scannerContainer}>
        <QrCode size={48} color={Colors.accentPrimary} strokeWidth={1} />
        <Text style={styles.permissionText}>Camera access is needed to scan QR codes.</Text>
        <View style={{ marginTop: Spacing.md }}>
          <GlowButton title="Grant Camera Permission" onPress={requestPermission} />
        </View>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: Spacing.md }}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.scannerWrapper}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (!scanned.current) {
            scanned.current = true;
            haptic(Haptics.ImpactFeedbackStyle.Heavy);
            onScanned(data);
          }
        }}
      />
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerCutout}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.scannerInstruction}>Align QR code within the frame</Text>
      </View>
      <TouchableOpacity style={styles.scannerCancelBtn} onPress={onCancel}>
        <ArrowLeft size={20} color={Colors.textPrimary} />
        <Text style={styles.scannerCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TransferScreen() {
  const insets = useSafeAreaInsets();
  const { repositories, settings } = useGit();

  const [mode, setMode] = useState(0);

  // Send state
  const [sendStep, setSendStep] = useState<SendStep>('select-repo');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const [senderSession, setSenderSession] = useState<P2PSession | null>(null);
  const [qrString, setQrString] = useState<string>('');
  const [deviceIp, setDeviceIp] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((token: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const session = await getSession(token);
      if (session && session.state === 'complete') {
        stopPolling();
        setSenderSession(session);
        setSendStep('complete');
        haptic(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Commit loading state for send flow
  const [repoCommits, setRepoCommits] = useState<GitCommit[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);

  useEffect(() => {
    if (!selectedRepoId) {
      setRepoCommits([]);
      return;
    }
    setIsLoadingCommits(true);
    gitEngine
      .getCommits(selectedRepoId)
      .then(setRepoCommits)
      .catch(() => setRepoCommits([]))
      .finally(() => setIsLoadingCommits(false));
  }, [selectedRepoId]);

  // Receive state
  const [receiveStep, setReceiveStep] = useState<ReceiveStep>('scanner');
  const [scannedPayload, setScannedPayload] = useState<QRPayload | null>(null);
  const [receivedDiff, setReceivedDiff] = useState<DiffFile[]>([]);
  const [receiveSession, setReceiveSession] = useState<P2PSession | null>(null);
  const [isComputingDiff, setIsComputingDiff] = useState(false);

  const handleModeChange = (idx: number) => {
    setMode(idx);
    if (idx === 0) {
      setSendStep('select-repo');
      setSenderSession(null);
      setQrString('');
      setSelectedCommits(new Set());
      setSelectedRepoId(null);
    } else {
      setReceiveStep('scanner');
      setScannedPayload(null);
      setReceivedDiff([]);
      setReceiveSession(null);
      setIsComputingDiff(false);
    }
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);
  const availableCommits = repoCommits;

  const toggleCommit = (sha: string) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCommits((prev) => {
      const next = new Set(prev);
      next.has(sha) ? next.delete(sha) : next.add(sha);
      return next;
    });
  };

  const handleGenerateQR = async () => {
    if (!selectedRepo) return;
    setIsCreatingSession(true);
    haptic();
    try {
      // If no commits explicitly selected, share all available commits (capped at 20)
      const commitShas = selectedCommits.size > 0
        ? Array.from(selectedCommits)
        : availableCommits.slice(0, 20).map(c => c.sha);

      const result = await createSenderSession(
        selectedRepo.id,
        selectedRepo.name,
        settings.userConfig.name,
        commitShas,
        settings.githubToken,
      );
      setSenderSession(result.session);
      setQrString(result.qrString);
      setDeviceIp(result.deviceIp);
      setSendStep('qr-ready');
      startPolling(result.session.sessionToken);
    } catch (e) {
      Alert.alert('Error', 'Could not create transfer session.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const resetSend = () => {
    stopPolling();
    setSendStep('select-repo');
    setSenderSession(null);
    setQrString('');
    setSelectedRepoId(null);
    setSelectedCommits(new Set());
  };

  const handleQRScanned = async (data: string) => {
    const payload = decodeQRPayload(data);
    if (!payload) {
      Alert.alert('Invalid QR', 'This QR code is not a GitLane transfer code.', [
        { text: 'OK', onPress: () => setReceiveStep('scanner') },
      ]);
      return;
    }
    setScannedPayload(payload);
    setReceiveStep('connecting');

    try {
      const session = await getSession(payload.sessionToken);

      // Use session diffs if available and non-empty
      if (session && session.diffFiles.length > 0) {
        setReceiveSession(session);
        setReceivedDiff(session.diffFiles);
        setReceiveStep('review-diff');
        return;
      }

      // Session exists but has empty diffs (failed on sender), or no session at all
      // (multi-device: session lives on sender). Either way, compute diffs
      // on the receiver from the commit SHAs embedded in the QR payload.
      setIsComputingDiff(true);
      setReceiveStep('review-diff');
      if (session) setReceiveSession(session);

      try {
        const diffs = await buildRealDiffFiles(
          payload.repoId,
          payload.commits,
          settings.githubToken,
          payload.githubOwner,   // baked in by sender — receiver uses their own token
          payload.githubRepo,
        );
        setReceivedDiff(diffs);
      } catch (diffErr) {
        console.warn('[P2P] receiver diff build failed', diffErr);
        setReceivedDiff([]);
      } finally {
        setIsComputingDiff(false);
      }
    } catch {
      Alert.alert('Connection Error', 'Could not connect to sender.', [
        { text: 'Retry', onPress: () => setReceiveStep('scanner') },
      ]);
    }
  };

  const handleAcceptDiff = async () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (receiveSession) {
      await updateSessionState(receiveSession.sessionToken, 'complete');
    }
    setReceiveStep('accepted');
  };

  const handleRejectDiff = () => {
    haptic();
    Alert.alert(
      'Reject Changes',
      'Are you sure you want to reject these incoming changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            setReceiveStep('scanner');
            setScannedPayload(null);
            setReceivedDiff([]);
            setReceiveSession(null);
          },
        },
      ]
    );
  };

  // ─── Render: Send ────────────────────────────────────────────────────────────

  function renderSend() {
    if (sendStep === 'select-repo') {
      return (
        <>
          <Text style={styles.sectionLabel}>SELECT REPOSITORY</Text>
          {repositories.length === 0 ? (
            <View style={styles.emptyState}>
              <FolderGit2 size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No repositories found.</Text>
              <Text style={styles.emptySubText}>Clone or create a repo first.</Text>
            </View>
          ) : (
            repositories.map((repo) => (
              <TouchableOpacity
                key={repo.id}
                style={[styles.repoOption, selectedRepoId === repo.id && styles.repoOptionSelected]}
                onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Light); setSelectedRepoId(repo.id); }}
                activeOpacity={0.75}
              >
                <FolderGit2 size={22} color={selectedRepoId === repo.id ? Colors.accentPrimary : Colors.textMuted} />
                <View style={styles.repoOptionContent}>
                  <Text style={styles.repoOptionName}>{repo.name}</Text>
                  <Text style={styles.repoOptionMeta}>{repo.currentBranch} · {repo.commitCount} commits · {repo.size}</Text>
                </View>
                {selectedRepoId === repo.id ? (
                  <CheckCircle size={18} color={Colors.accentPrimary} />
                ) : (
                  <ChevronRight size={16} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            ))
          )}
          {selectedRepoId && (
            <View style={{ marginTop: Spacing.lg }}>
              <GlowButton
                title="Select Commits →"
                onPress={() => setSendStep('select-commits')}
                fullWidth
                icon={<GitCommitIcon size={18} color="#fff" />}
              />
            </View>
          )}
        </>
      );
    }

    if (sendStep === 'select-commits') {
      return (
        <>
          <TouchableOpacity style={styles.backRow} onPress={() => setSendStep('select-repo')}>
            <ArrowLeft size={16} color={Colors.textSecondary} />
            <Text style={styles.backText}>Back to Repository</Text>
          </TouchableOpacity>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SELECT COMMITS TO SHARE</Text>
            <Text style={styles.sectionHint}>
              {selectedCommits.size > 0 ? `${selectedCommits.size} selected` : 'tap to select'}
            </Text>
          </View>
          {isLoadingCommits ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl }}>
              <ActivityIndicator color={Colors.accentPrimary} />
              <Text style={[styles.sectionHint, { marginTop: 8 }]}>Loading commits…</Text>
            </View>
          ) : availableCommits.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl }}>
              <Text style={styles.sectionHint}>No commits found in this repository.</Text>
            </View>
          ) : availableCommits.map((commit, idx) => (
            <CommitRow
              key={`${commit.sha}-${idx}`}
              commit={commit}
              selected={selectedCommits.has(commit.sha) || selectedCommits.has(commit.shortSha)}
              onPress={() => toggleCommit(commit.sha)}
            />
          ))}
          <View style={styles.generateQRSection}>
            <View style={styles.diffSummary}>
              <Wifi size={14} color={Colors.accentPrimary} />
              <Text style={styles.diffSummaryText}>Only diffs will be transferred — not the full repo</Text>
            </View>
            <GlowButton
              title={selectedCommits.size === 0
                ? 'Share All Recent Commits'
                : `Generate QR — ${selectedCommits.size} commit${selectedCommits.size !== 1 ? 's' : ''}`}
              onPress={handleGenerateQR}
              fullWidth
              loading={isCreatingSession}
              icon={<QrCode size={18} color="#fff" />}
            />
          </View>
        </>
      );
    }

    if (sendStep === 'qr-ready' && senderSession) {
      return (
        <View style={styles.qrContainer}>
          <View style={styles.qrInfoCard}>
            <FolderGit2 size={16} color={Colors.accentPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.qrInfoRepo}>{senderSession.repoName}</Text>
              <Text style={styles.qrInfoMeta}>
                {senderSession.diffFiles.length} file{senderSession.diffFiles.length !== 1 ? 's' : ''} · diff only
              </Text>
            </View>
            <View style={styles.sessionTokenBadge}>
              <Text style={styles.sessionTokenText}>{senderSession.sessionToken}</Text>
            </View>
          </View>

          <View style={styles.qrWrapper}>
            <PulseRing />
            <View style={styles.qrBox}>
              <QRCode
                value={qrString}
                size={210}
                color={Colors.textPrimary}
                backgroundColor={Colors.bgSecondary}
                quietZone={12}
              />
            </View>
          </View>

          <Text style={styles.qrCaption}>
            Ask receiver to open GitLane → Transfer → Receive → Scan QR
          </Text>

          <View style={styles.networkRow}>
            <View style={styles.networkBadge}>
              <View style={styles.networkDot} />
              <Wifi size={12} color={Colors.accentPrimary} />
              <Text style={styles.networkText}>{deviceIp}</Text>
            </View>
            <View style={styles.networkBadge}>
              <Zap size={12} color={Colors.accentPrimary} />
              <Text style={styles.networkText}>Waiting for receiver…</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>CHANGES TO BE SENT</Text>
          <View style={{ minHeight: 300, width: '100%' }}>
            <DiffViewer
              files={senderSession.diffFiles}
              repoName={senderSession.repoName}
              commitCount={senderSession.commits.length || 3}
            />
          </View>

          <TouchableOpacity style={styles.cancelRow} onPress={resetSend}>
            <XCircle size={16} color={Colors.textMuted} />
            <Text style={styles.cancelRowText}>Cancel Transfer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (sendStep === 'complete' && senderSession) {
      return <TransferComplete session={senderSession} onDone={resetSend} />;
    }

    return null;
  }

  // ─── Render: Receive ─────────────────────────────────────────────────────────

  function renderReceive() {
    if (receiveStep === 'scanner') {
      return (
        <QRScanner
          onScanned={handleQRScanned}
          onCancel={() => handleModeChange(0)}
        />
      );
    }

    if (receiveStep === 'connecting') {
      return (
        <View style={styles.connectingContainer}>
          <ActivityIndicator size="large" color={Colors.accentPrimary} />
          <Text style={styles.connectingTitle}>Connecting to Sender</Text>
          {scannedPayload && (
            <>
              <Text style={styles.connectingMeta}>{scannedPayload.repoName} · {scannedPayload.deviceIp}</Text>
              <Text style={styles.connectingMeta}>Session: {scannedPayload.sessionToken}</Text>
            </>
          )}
        </View>
      );
    }

    if (receiveStep === 'review-diff') {
      return (
        <View style={styles.reviewContainer}>
          <View style={styles.incomingBar}>
            <Smartphone size={16} color={Colors.accentPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.incomingTitle}>
                {scannedPayload?.senderName ?? 'Unknown Sender'} wants to share
              </Text>
              <Text style={styles.incomingMeta}>
                {scannedPayload?.repoName} · {scannedPayload?.commits.length} commit{scannedPayload?.commits.length !== 1 ? 's' : ''} · diffs only
              </Text>
            </View>
            <View style={styles.connectedPill}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <DiffViewer
              files={receivedDiff}
              repoName={scannedPayload?.repoName}
              commitCount={scannedPayload?.commits.length}
              loading={isComputingDiff}
            />
          </View>
          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectDiff}>
              <XCircle size={18} color={Colors.accentDanger} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptDiff}>
              <Check size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (receiveStep === 'accepted') {
      return (
        <View style={styles.completeContainer}>
          <CheckCircle size={64} color={Colors.accentPrimary} strokeWidth={1.5} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.completeTitle}>Changes Accepted</Text>
          <Text style={styles.completeSubtitle}>
            {receivedDiff.length} file{receivedDiff.length !== 1 ? 's' : ''} applied from {scannedPayload?.repoName}
          </Text>
          <View style={{ marginTop: Spacing.xl, width: '100%' }}>
            <GlowButton
              title="Done"
              onPress={() => {
                setReceiveStep('scanner');
                setScannedPayload(null);
                setReceivedDiff([]);
                setReceiveSession(null);
              }}
              fullWidth
            />
          </View>
        </View>
      );
    }

    return null;
  }

  // ─── Root render ─────────────────────────────────────────────────────────────

  const isFullscreenScanner = mode === 1 && receiveStep === 'scanner';
  const isFullscreenReview = mode === 1 && receiveStep === 'review-diff';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>P2P Transfer</Text>
        <View style={styles.headerBadge}>
          <Zap size={12} color={Colors.accentPrimary} />
          <Text style={styles.headerBadgeText}>Diff Only · Local WiFi</Text>
        </View>
      </View>

      {!isFullscreenScanner && (
        <View style={styles.segmentWrap}>
          <SegmentedControl
            segments={['Send', 'Receive']}
            selectedIndex={mode}
            onChange={handleModeChange}
          />
        </View>
      )}

      {isFullscreenScanner || isFullscreenReview ? (
        renderReceive()
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 0 ? renderSend() : renderReceive()}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accentPrimary },
  segmentWrap: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHint: { fontSize: 12, color: Colors.accentPrimary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  backText: { fontSize: 14, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500' as const },
  emptySubText: { fontSize: 13, color: Colors.textMuted },
  repoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  repoOptionSelected: { borderColor: Colors.accentPrimary, backgroundColor: Colors.accentPrimaryDim },
  repoOptionContent: { flex: 1 },
  repoOptionName: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary },
  repoOptionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  commitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  commitRowSelected: { borderColor: Colors.accentPrimary, backgroundColor: Colors.accentPrimaryDim },
  commitInfo: { flex: 1 },
  commitMsg: { fontSize: 13, fontWeight: '600' as const, color: Colors.textPrimary },
  commitMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  commitStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  commitStatFiles: { fontSize: 11, color: Colors.textMuted },
  commitStatAdd: { fontSize: 11, color: Colors.accentPrimary, fontWeight: '600' as const },
  commitStatDel: { fontSize: 11, color: Colors.accentDanger, fontWeight: '600' as const },
  unselectedCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  generateQRSection: { marginTop: Spacing.lg, gap: Spacing.sm },
  diffSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accentPrimaryDim,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  diffSummaryText: { fontSize: 12, color: Colors.accentPrimary, flex: 1 },
  qrContainer: { alignItems: 'center' },
  qrInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.lg,
  },
  qrInfoRepo: { fontSize: 14, fontWeight: '600' as const, color: Colors.textPrimary },
  qrInfoMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sessionTokenBadge: { backgroundColor: Colors.bgTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  sessionTokenText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accentPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  qrWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md },
  pulseRing: {
    position: 'absolute',
    width: 260, height: 260,
    borderRadius: 130,
    backgroundColor: Colors.accentPrimaryDim,
  },
  qrBox: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  qrCaption: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  networkRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentPrimary },
  networkText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accentPrimary },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelRowText: { fontSize: 14, color: Colors.textMuted },
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  completeTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary, marginBottom: Spacing.sm },
  completeSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  completeMeta: {
    width: '100%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  completeMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  completeMetaLabel: { fontSize: 13, color: Colors.textMuted },
  completeMetaValue: { fontSize: 13, fontWeight: '600' as const, color: Colors.textPrimary },
  scannerWrapper: { flex: 1, position: 'relative' },
  scannerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerCutout: {
    width: 260, height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: Colors.accentPrimary },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scannerInstruction: { marginTop: Spacing.xl, fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  scannerCancelBtn: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  scannerCancelText: { fontSize: 14, color: Colors.textPrimary },
  permissionText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  cancelLink: { fontSize: 14, color: Colors.accentPrimary },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  connectingTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary },
  connectingMeta: { fontSize: 13, color: Colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  reviewContainer: { flex: 1 },
  incomingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  incomingTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.textPrimary },
  incomingMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentPrimary },
  connectedText: { fontSize: 11, color: Colors.accentPrimary, fontWeight: '600' as const },
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDanger,
  },
  rejectBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.accentDanger },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 2,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentPrimary,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
});
