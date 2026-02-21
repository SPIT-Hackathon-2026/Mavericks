import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send, Download, Wifi, QrCode, FolderGit2, CheckCircle,
  Smartphone, ArrowRight, Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import SegmentedControl from '@/components/SegmentedControl';
import GlowButton from '@/components/GlowButton';

function QRDisplay() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.qrSection}>
      <Animated.View style={[styles.qrFrame, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.qrCorner, styles.qrTopLeft]} />
        <View style={[styles.qrCorner, styles.qrTopRight]} />
        <View style={[styles.qrCorner, styles.qrBottomLeft]} />
        <View style={[styles.qrCorner, styles.qrBottomRight]} />
        <View style={styles.qrInner}>
          <QrCode size={120} color={Colors.accentPrimary} strokeWidth={1} />
        </View>
      </Animated.View>
      <Text style={styles.qrCaption}>Scan with another GitLane device</Text>
      <View style={styles.networkBadge}>
        <Wifi size={14} color={Colors.accentPrimary} />
        <Text style={styles.networkText}>GitLane-A7B3</Text>
      </View>
    </View>
  );
}

function TransferProgress() {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(progressAnim, { toValue: 1, duration: 4000, useNativeDriver: false })
    ).start();
  }, []);

  const width = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '75%'] });

  return (
    <View style={styles.transferCard}>
      <View style={styles.transferHeader}>
        <View style={styles.peerInfo}>
          <Smartphone size={18} color={Colors.accentPrimary} />
          <View>
            <Text style={styles.peerName}>Pixel 7 — John</Text>
            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>Sending packfile...</Text>
          <Text style={styles.progressPercent}>45%</Text>
        </View>
        <Text style={styles.progressDetail}>45 MB / 120 MB  •  2.5 MB/s  •  30s remaining</Text>
      </View>
    </View>
  );
}

export default function TransferScreen() {
  const insets = useSafeAreaInsets();
  const { repositories } = useGit();
  const [mode, setMode] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [transferState, setTransferState] = useState<'select' | 'waiting' | 'connected'>('select');

  const startTransfer = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setTransferState('waiting');
    setTimeout(() => setTransferState('connected'), 3000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>P2P Transfer</Text>
        <View style={styles.headerBadge}>
          <Zap size={12} color={Colors.accentPrimary} />
          <Text style={styles.headerBadgeText}>Local Network</Text>
        </View>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={['Send', 'Receive']}
          selectedIndex={mode}
          onChange={setMode}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {mode === 0 ? (
          <>
            {transferState === 'select' && (
              <>
                <Text style={styles.sectionLabel}>SELECT REPOSITORY</Text>
                {repositories.map(repo => (
                  <TouchableOpacity
                    key={repo.id}
                    style={[
                      styles.repoOption,
                      selectedRepo === repo.id && styles.repoOptionSelected,
                    ]}
                    onPress={() => setSelectedRepo(repo.id)}
                    activeOpacity={0.7}
                  >
                    <FolderGit2 size={24} color={selectedRepo === repo.id ? Colors.accentPrimary : Colors.textMuted} />
                    <View style={styles.repoOptionContent}>
                      <Text style={styles.repoOptionName}>{repo.name}</Text>
                      <Text style={styles.repoOptionMeta}>{repo.size} • {repo.commitCount} commits</Text>
                    </View>
                    {selectedRepo === repo.id && (
                      <CheckCircle size={20} color={Colors.accentPrimary} />
                    )}
                  </TouchableOpacity>
                ))}

                {selectedRepo && (
                  <View style={styles.methodSection}>
                    <Text style={styles.sectionLabel}>CONNECTION METHOD</Text>
                    {['Wi-Fi Direct', 'Hotspot', 'Bluetooth'].map((method, i) => (
                      <TouchableOpacity key={method} style={[styles.methodOption, i === 0 && styles.methodOptionSelected]}>
                        <Wifi size={18} color={i === 0 ? Colors.accentPrimary : Colors.textMuted} />
                        <Text style={[styles.methodText, i === 0 && styles.methodTextActive]}>{method}</Text>
                        {i === 0 && <CheckCircle size={16} color={Colors.accentPrimary} />}
                      </TouchableOpacity>
                    ))}
                    <View style={{ marginTop: Spacing.lg }}>
                      <GlowButton
                        title="Start Transfer"
                        onPress={startTransfer}
                        fullWidth
                        icon={<Send size={18} color="#FFFFFF" />}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {transferState === 'waiting' && <QRDisplay />}
            {transferState === 'connected' && <TransferProgress />}
          </>
        ) : (
          <View style={styles.receiveSection}>
            <View style={styles.scannerPlaceholder}>
              <View style={[styles.qrCorner, styles.qrTopLeft]} />
              <View style={[styles.qrCorner, styles.qrTopRight]} />
              <View style={[styles.qrCorner, styles.qrBottomLeft]} />
              <View style={[styles.qrCorner, styles.qrBottomRight]} />
              <View style={styles.scannerContent}>
                <QrCode size={48} color={Colors.accentPrimary} strokeWidth={1} />
                <Text style={styles.scannerText}>Point camera at sender&#39;s QR code</Text>
              </View>
            </View>
            <View style={styles.scanActions}>
              <GlowButton
                title="Simulate Receive"
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                fullWidth
                variant="outline"
              />
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  segmentWrap: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
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
  repoOptionSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
  },
  repoOptionContent: {
    flex: 1,
  },
  repoOptionName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  repoOptionMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  methodSection: {
    marginTop: Spacing.sm,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.sm,
    padding: 14,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  methodOptionSelected: {
    borderColor: Colors.accentPrimary,
  },
  methodText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  methodTextActive: {
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  qrFrame: {
    width: 240,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.accentPrimary,
  },
  qrTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  qrTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  qrBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  qrBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  qrInner: {
    width: 180,
    height: 180,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  qrCaption: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  networkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  transferCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginTop: Spacing.xl,
  },
  transferHeader: {
    marginBottom: Spacing.md,
  },
  peerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentPrimary,
  },
  connectedText: {
    fontSize: 12,
    color: Colors.accentPrimary,
  },
  progressSection: {},
  progressTrack: {
    height: 6,
    backgroundColor: Colors.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 3,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  progressPercent: {
    fontSize: 13,
    color: Colors.accentPrimary,
    fontWeight: '600' as const,
  },
  progressDetail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  receiveSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  scannerPlaceholder: {
    width: 280,
    height: 280,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  scannerContent: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  scannerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  scanActions: {
    width: '100%',
    marginTop: Spacing.xl,
  },
});
