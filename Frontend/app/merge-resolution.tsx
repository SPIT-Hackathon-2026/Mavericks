import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Check, CheckCircle, Circle, ChevronRight, GitMerge,
  Pencil, ArrowLeft, AlertTriangle, Copy, CornerDownRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import GlowButton from '@/components/GlowButton';
import type { ConflictFile, ConflictHunk } from '@/types/git';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Hunk Diff View ──────────────────────────────────────────────────────────

function HunkView({
  hunk,
  fileId,
  oursBranch,
  theirsBranch,
  onResolve,
}: {
  hunk: ConflictHunk;
  fileId: string;
  oursBranch: string;
  theirsBranch: string;
  onResolve: (hunkId: string, resolution: 'ours' | 'theirs' | 'both' | 'manual', manualContent?: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [manualText, setManualText] = useState(
    hunk.oursContent + '\n' + hunk.theirsContent
  );

  const oursLines = hunk.oursContent.split('\n');
  const theirsLines = hunk.theirsContent.split('\n');

  if (hunk.resolved) {
    return (
      <View style={hunkStyles.resolvedContainer}>
        <View style={hunkStyles.resolvedHeader}>
          <CheckCircle size={14} color={Colors.accentPrimary} />
          <Text style={hunkStyles.resolvedLabel}>
            Resolved ({hunk.resolution})
          </Text>
        </View>
        <View style={hunkStyles.resultBlock}>
          {hunk.resultContent.split('\n').map((line, i) => (
            <Text key={i} style={hunkStyles.codeLine}>{line || ' '}</Text>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={hunkStyles.container}>
      {/* Unified Diff View with conflict markers */}
      <View style={hunkStyles.diffBlock}>
        {/* <<<<<<< OURS header */}
        <View style={[hunkStyles.markerLine, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
          <Text style={hunkStyles.markerText}>{'<<<<<<< '}{oursBranch} (Current)</Text>
        </View>
        {/* OURS lines - green background */}
        {oursLines.map((line, i) => (
          <View key={`o-${i}`} style={hunkStyles.oursLine}>
            <Text style={hunkStyles.linePrefix}>+ </Text>
            <Text style={hunkStyles.codeLine}>{line || ' '}</Text>
          </View>
        ))}
        {/* ======= separator */}
        <View style={hunkStyles.separatorLine}>
          <Text style={hunkStyles.separatorText}>{'======='}</Text>
        </View>
        {/* THEIRS lines - red background */}
        {theirsLines.map((line, i) => (
          <View key={`t-${i}`} style={hunkStyles.theirsLine}>
            <Text style={hunkStyles.linePrefix}>- </Text>
            <Text style={hunkStyles.codeLine}>{line || ' '}</Text>
          </View>
        ))}
        {/* >>>>>>> THEIRS header */}
        <View style={[hunkStyles.markerLine, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
          <Text style={hunkStyles.markerText}>{'>>>>>>> '}{theirsBranch} (Incoming)</Text>
        </View>
      </View>

      {/* Resolution Buttons */}
      <View style={hunkStyles.buttonRow}>
        <TouchableOpacity
          style={[hunkStyles.resBtn, hunkStyles.resBtnOurs]}
          onPress={() => {
            onResolve(hunk.id, 'ours');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Check size={12} color={Colors.accentPrimary} />
          <Text style={[hunkStyles.resBtnText, { color: Colors.accentPrimary }]}>Accept Current</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[hunkStyles.resBtn, hunkStyles.resBtnTheirs]}
          onPress={() => {
            onResolve(hunk.id, 'theirs');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <CornerDownRight size={12} color={Colors.accentDanger} />
          <Text style={[hunkStyles.resBtnText, { color: Colors.accentDanger }]}>Accept Incoming</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[hunkStyles.resBtn, hunkStyles.resBtnBoth]}
          onPress={() => {
            onResolve(hunk.id, 'both');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Copy size={12} color={Colors.accentPurple} />
          <Text style={[hunkStyles.resBtnText, { color: Colors.accentPurple }]}>Accept Both</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[hunkStyles.resBtn, hunkStyles.resBtnManual]}
          onPress={() => {
            setEditMode(!editMode);
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Pencil size={12} color={Colors.accentWarning} />
          <Text style={[hunkStyles.resBtnText, { color: Colors.accentWarning }]}>Manual Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Inline Mini Editor */}
      {editMode && (
        <View style={hunkStyles.editorContainer}>
          <Text style={hunkStyles.editorLabel}>Manual Resolution:</Text>
          <TextInput
            style={hunkStyles.editorInput}
            value={manualText}
            onChangeText={setManualText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
            placeholderTextColor={Colors.textMuted}
            placeholder="Edit the resolved content here..."
          />
          <TouchableOpacity
            style={hunkStyles.applyBtn}
            onPress={() => {
              onResolve(hunk.id, 'manual', manualText);
              setEditMode(false);
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Check size={14} color="#fff" />
            <Text style={hunkStyles.applyBtnText}>Apply Manual Resolution</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Three-Way Diff Panel ────────────────────────────────────────────────────

function ThreeWayView({ file }: { file: ConflictFile }) {
  const [activeTab, setActiveTab] = useState<'base' | 'ours' | 'theirs'>('ours');

  const content = activeTab === 'base' ? file.baseContent
    : activeTab === 'ours' ? file.oursContent
    : file.theirsContent;

  const lines = content.split('\n');

  return (
    <View style={threeWayStyles.container}>
      <View style={threeWayStyles.tabs}>
        {(['base', 'ours', 'theirs'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              threeWayStyles.tab,
              activeTab === tab && threeWayStyles.tabActive,
              tab === 'ours' && activeTab === tab && { borderBottomColor: Colors.accentPrimary },
              tab === 'theirs' && activeTab === tab && { borderBottomColor: Colors.accentDanger },
              tab === 'base' && activeTab === tab && { borderBottomColor: Colors.accentInfo },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              threeWayStyles.tabText,
              activeTab === tab && threeWayStyles.tabTextActive,
              tab === 'ours' && activeTab === tab && { color: Colors.accentPrimary },
              tab === 'theirs' && activeTab === tab && { color: Colors.accentDanger },
              tab === 'base' && activeTab === tab && { color: Colors.accentInfo },
            ]}>
              {tab === 'base' ? 'BASE' : tab === 'ours' ? `OURS (${file.oursBranch})` : `THEIRS (${file.theirsBranch})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={threeWayStyles.codeScroll} horizontal>
        <View style={threeWayStyles.codeBlock}>
          {lines.map((line, i) => (
            <View key={i} style={threeWayStyles.codeLine}>
              <Text style={threeWayStyles.lineNum}>{i + 1}</Text>
              <Text style={threeWayStyles.codeText}>{line || ' '}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MergeConflictsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    conflicts,
    mergeState,
    resolveConflictHunk,
    stageResolvedConflictFile,
    finalizeMerge,
    abortMerge,
    showToast,
  } = useGit();

  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showThreeWay, setShowThreeWay] = useState(false);

  const activeConflicts = mergeState?.conflicts ?? conflicts;
  const currentFile = activeConflicts[currentFileIndex];
  const resolvedCount = activeConflicts.filter(c => c.resolved).length;
  const allResolved = resolvedCount === activeConflicts.length && activeConflicts.length > 0;

  const handleResolveHunk = useCallback(
    (hunkId: string, resolution: 'ours' | 'theirs' | 'both' | 'manual', manualContent?: string) => {
      if (!currentFile) return;
      resolveConflictHunk(currentFile.id, hunkId, resolution, manualContent);
    },
    [currentFile, resolveConflictHunk],
  );

  const handleStageFile = useCallback(async () => {
    if (!currentFile || !currentFile.resolved) return;
    await stageResolvedConflictFile(currentFile);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Move to next unresolved
    const nextUnresolved = activeConflicts.findIndex((c, i) => i > currentFileIndex && !c.resolved);
    if (nextUnresolved !== -1) {
      setCurrentFileIndex(nextUnresolved);
    }
  }, [currentFile, stageResolvedConflictFile, currentFileIndex, activeConflicts]);

  const handleFinalizeMerge = useCallback(async () => {
    await finalizeMerge();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [finalizeMerge, router]);

  const handleAbortMerge = useCallback(async () => {
    await abortMerge();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    router.back();
  }, [abortMerge, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleAbortMerge} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Abort</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <GitMerge size={16} color={Colors.accentPrimary} />
          <Text style={styles.headerTitle}>Resolve Conflicts</Text>
          <Text style={styles.headerSubtitle}>
            {mergeState
              ? `${mergeState.oursBranch} ← ${mergeState.theirsBranch}`
              : `${activeConflicts.length} files`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowThreeWay(!showThreeWay)}
          style={styles.headerBtn}
        >
          <Text style={[styles.cancelText, { color: Colors.accentInfo }]}>
            {showThreeWay ? 'Hunks' : '3-Way'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${activeConflicts.length > 0 ? (resolvedCount / activeConflicts.length) * 100 : 0}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {resolvedCount}/{activeConflicts.length} files resolved
        </Text>
      </View>

      {/* File tabs */}
      <View style={styles.fileList}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileListContent}>
          {activeConflicts.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.fileChip,
                i === currentFileIndex && styles.fileChipActive,
                c.resolved && styles.fileChipResolved,
              ]}
              onPress={() => setCurrentFileIndex(i)}
            >
              {c.resolved ? (
                <CheckCircle size={12} color={Colors.accentPrimary} />
              ) : (
                <AlertTriangle size={12} color={Colors.accentDanger} />
              )}
              <Text style={[
                styles.fileChipText,
                i === currentFileIndex && styles.fileChipTextActive,
                c.resolved && { color: Colors.accentPrimary },
              ]}>
                {c.name}
              </Text>
              <Text style={styles.hunkCount}>{c.hunks.length}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      {currentFile && (
        <ScrollView style={styles.conflictContent} showsVerticalScrollIndicator={false}>
          {showThreeWay ? (
            <ThreeWayView file={currentFile} />
          ) : (
            <>
              {/* File path */}
              <View style={styles.filePathBar}>
                <Text style={styles.filePathText}>{currentFile.path}</Text>
                <Text style={styles.hunkCountLabel}>
                  {currentFile.hunks.filter(h => h.resolved).length}/{currentFile.hunks.length} hunks resolved
                </Text>
              </View>

              {/* Conflict Hunks */}
              {currentFile.hunks.map((hunk, hunkIdx) => (
                <View key={hunk.id}>
                  <View style={styles.hunkHeader}>
                    <Text style={styles.hunkHeaderText}>
                      Conflict #{hunkIdx + 1}
                    </Text>
                    {hunk.resolved && (
                      <View style={styles.hunkResolvedBadge}>
                        <CheckCircle size={10} color={Colors.accentPrimary} />
                        <Text style={styles.hunkResolvedText}>Resolved</Text>
                      </View>
                    )}
                  </View>
                  <HunkView
                    hunk={hunk}
                    fileId={currentFile.id}
                    oursBranch={currentFile.oursBranch}
                    theirsBranch={currentFile.theirsBranch}
                    onResolve={handleResolveHunk}
                  />
                </View>
              ))}
            </>
          )}
          <View style={{ height: 200 }} />
        </ScrollView>
      )}

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + Spacing.md }]}>
        {currentFile && !currentFile.resolved && (
          <Text style={styles.bottomHint}>
            Resolve all hunks in {currentFile.name} to stage it
          </Text>
        )}

        {currentFile?.resolved && !allResolved && (
          <GlowButton
            title={`Stage ${currentFile.name} & Next`}
            onPress={handleStageFile}
            fullWidth
            icon={<Check size={18} color="#FFFFFF" />}
          />
        )}

        {currentFile?.resolved && allResolved && (
          <View style={styles.finalizeRow}>
            <GlowButton
              title={`Stage ${currentFile.name}`}
              onPress={handleStageFile}
              fullWidth={false}
              variant="outline"
              icon={<Check size={16} color={Colors.accentPrimary} />}
            />
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <GlowButton
                title="Finalize Merge"
                onPress={handleFinalizeMerge}
                fullWidth
                icon={<GitMerge size={18} color="#FFFFFF" />}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerBtn: {
    width: 60,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: Colors.accentDanger,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.bgSecondary,
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
  },
  fileList: {
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  fileListContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  fileChipActive: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
  },
  fileChipResolved: {
    borderColor: 'rgba(34,197,94,0.3)',
  },
  fileChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  fileChipTextActive: {
    color: Colors.accentPrimary,
  },
  hunkCount: {
    fontSize: 10,
    color: Colors.textMuted,
    backgroundColor: Colors.bgPrimary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
    fontWeight: '700',
  },
  conflictContent: {
    flex: 1,
    padding: Spacing.md,
  },
  filePathBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  filePathText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  hunkCountLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  hunkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  hunkHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hunkResolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hunkResolvedText: {
    fontSize: 11,
    color: Colors.accentPrimary,
    fontWeight: '600',
  },
  bottomActions: {
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    padding: Spacing.md,
  },
  bottomHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  finalizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// ─── Hunk Styles ─────────────────────────────────────────────────────────────

const hunkStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  resolvedContainer: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: Colors.accentPrimaryDim,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(34,197,94,0.2)',
  },
  resolvedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
  resultBlock: {
    padding: Spacing.sm,
    backgroundColor: Colors.codeBackground,
  },
  diffBlock: {
    backgroundColor: Colors.codeBackground,
  },
  markerLine: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  markerText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  oursLine: {
    flexDirection: 'row',
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentPrimary,
  },
  theirsLine: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentDanger,
  },
  separatorLine: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: 'rgba(82,82,82,0.2)',
  },
  separatorText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.textMuted,
  },
  linePrefix: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textMuted,
    width: 16,
  },
  codeLine: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgTertiary,
  },
  resBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  resBtnOurs: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
  },
  resBtnTheirs: {
    borderColor: Colors.accentDanger,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  resBtnBoth: {
    borderColor: Colors.accentPurple,
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  resBtnManual: {
    borderColor: Colors.accentWarning,
    backgroundColor: 'rgba(234,179,8,0.08)',
  },
  resBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editorContainer: {
    padding: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgTertiary,
  },
  editorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentWarning,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editorInput: {
    backgroundColor: Colors.codeBackground,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.sm,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accentWarning,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
});

// ─── Three-Way Styles ────────────────────────────────────────────────────────

const threeWayStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: Colors.bgSecondary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  codeScroll: {
    maxHeight: 400,
  },
  codeBlock: {
    padding: Spacing.sm,
    backgroundColor: Colors.codeBackground,
  },
  codeLine: {
    flexDirection: 'row',
    minHeight: 22,
    alignItems: 'flex-start',
  },
  lineNum: {
    width: 36,
    textAlign: 'right',
    paddingRight: 8,
    fontSize: 11,
    lineHeight: 22,
    color: '#4C566A',
    fontFamily: 'monospace',
  },
  codeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
});
