import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Dimensions, Animated, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check, CheckCircle, GitMerge, Pencil, AlertTriangle, Copy,
  CornerDownRight, ChevronDown, ChevronUp, Eye, EyeOff,
  FileWarning, ArrowRight, Layers, XCircle, Undo2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import GlowButton from '@/components/GlowButton';
import type { ConflictFile, ConflictHunk } from '@/types/git';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CODE_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// ─────────────────────────────────────────────────────────────────────────────
// Resolution Button Component
// ─────────────────────────────────────────────────────────────────────────────

function ResolutionButton({
  label, icon, color, bgColor, borderColor, onPress,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 15 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 15 }).start()}
      onPress={() => {
        onPress();
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Animated.View
        style={[
          resStyles.btn,
          { backgroundColor: bgColor, borderColor },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {icon}
        <Text style={[resStyles.btnText, { color }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const resStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hunk Diff View Component
// ─────────────────────────────────────────────────────────────────────────────

function HunkView({
  hunk,
  hunkIndex,
  fileId,
  oursBranch,
  theirsBranch,
  onResolve,
}: {
  hunk: ConflictHunk;
  hunkIndex: number;
  fileId: string;
  oursBranch: string;
  theirsBranch: string;
  onResolve: (hunkId: string, resolution: 'ours' | 'theirs' | 'both' | 'manual', manualContent?: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [manualText, setManualText] = useState(
    hunk.oursContent + '\n' + hunk.theirsContent
  );
  const [collapsed, setCollapsed] = useState(false);

  const oursLines = hunk.oursContent.split('\n');
  const theirsLines = hunk.theirsContent.split('\n');

  // ── Resolved State ──
  if (hunk.resolved) {
    const resLabel =
      hunk.resolution === 'ours' ? 'Current' :
      hunk.resolution === 'theirs' ? 'Incoming' :
      hunk.resolution === 'both' ? 'Both' : 'Manual';
    const resColor =
      hunk.resolution === 'ours' ? Colors.accentPrimary :
      hunk.resolution === 'theirs' ? Colors.accentInfo :
      hunk.resolution === 'both' ? Colors.accentPurple : Colors.accentWarning;

    return (
      <View style={hunkStyles.resolvedOuter}>
        <View style={[hunkStyles.resolvedStrip, { backgroundColor: resColor }]} />
        <View style={hunkStyles.resolvedBody}>
          <View style={hunkStyles.resolvedHeaderRow}>
            <View style={hunkStyles.resolvedBadge}>
              <CheckCircle size={13} color={resColor} />
              <Text style={[hunkStyles.resolvedBadgeText, { color: resColor }]}>
                Conflict #{hunkIndex + 1} — Accepted {resLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onResolve(hunk.id, hunk.resolution ?? 'ours')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Undo2 size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={hunkStyles.resolvedCode}>
              {hunk.resultContent.split('\n').map((line, i) => (
                <View key={i} style={hunkStyles.resolvedCodeLine}>
                  <Text style={hunkStyles.resolvedLineNum}>{i + 1}</Text>
                  <Text style={hunkStyles.resolvedLineText}>{line || ' '}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ── Unresolved State ──
  return (
    <View style={hunkStyles.container}>
      {/* Header bar */}
      <TouchableOpacity
        style={hunkStyles.headerBar}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={hunkStyles.headerLeft}>
          <View style={hunkStyles.conflictDot} />
          <Text style={hunkStyles.headerLabel}>Conflict #{hunkIndex + 1}</Text>
          <Text style={hunkStyles.headerMeta}>
            {oursLines.length + theirsLines.length} lines
          </Text>
        </View>
        {collapsed ? (
          <ChevronDown size={16} color={Colors.textMuted} />
        ) : (
          <ChevronUp size={16} color={Colors.textMuted} />
        )}
      </TouchableOpacity>

      {!collapsed && (
        <>
          {/* Diff view */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={hunkStyles.diffBlock}>
              {/* Current (ours) section */}
              <View style={hunkStyles.sectionHeader}>
                <View style={[hunkStyles.sectionDot, { backgroundColor: Colors.accentPrimary }]} />
                <Text style={[hunkStyles.sectionLabel, { color: Colors.accentPrimary }]}>
                  Current ({oursBranch})
                </Text>
              </View>
              {oursLines.map((line, i) => (
                <View key={`o-${i}`} style={hunkStyles.oursLine}>
                  <Text style={hunkStyles.lineNum}>{i + 1}</Text>
                  <Text style={hunkStyles.linePrefix}>+</Text>
                  <Text style={hunkStyles.codeText}>{line || ' '}</Text>
                </View>
              ))}

              {/* Divider */}
              <View style={hunkStyles.divider}>
                <View style={hunkStyles.dividerLine} />
                <Text style={hunkStyles.dividerText}>vs</Text>
                <View style={hunkStyles.dividerLine} />
              </View>

              {/* Incoming (theirs) section */}
              <View style={hunkStyles.sectionHeader}>
                <View style={[hunkStyles.sectionDot, { backgroundColor: Colors.accentDanger }]} />
                <Text style={[hunkStyles.sectionLabel, { color: Colors.accentDanger }]}>
                  Incoming ({theirsBranch})
                </Text>
              </View>
              {theirsLines.map((line, i) => (
                <View key={`t-${i}`} style={hunkStyles.theirsLine}>
                  <Text style={hunkStyles.lineNum}>{i + 1}</Text>
                  <Text style={hunkStyles.linePrefix}>−</Text>
                  <Text style={hunkStyles.codeText}>{line || ' '}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Resolution buttons */}
          <View style={hunkStyles.actionBar}>
            <ResolutionButton
              label="Current"
              icon={<Check size={13} color={Colors.accentPrimary} />}
              color={Colors.accentPrimary}
              bgColor="rgba(34,197,94,0.08)"
              borderColor="rgba(34,197,94,0.25)"
              onPress={() => onResolve(hunk.id, 'ours')}
            />
            <ResolutionButton
              label="Incoming"
              icon={<CornerDownRight size={13} color={Colors.accentInfo} />}
              color={Colors.accentInfo}
              bgColor="rgba(59,130,246,0.08)"
              borderColor="rgba(59,130,246,0.25)"
              onPress={() => onResolve(hunk.id, 'theirs')}
            />
            <ResolutionButton
              label="Both"
              icon={<Layers size={13} color={Colors.accentPurple} />}
              color={Colors.accentPurple}
              bgColor="rgba(168,85,247,0.08)"
              borderColor="rgba(168,85,247,0.25)"
              onPress={() => onResolve(hunk.id, 'both')}
            />
            <ResolutionButton
              label="Edit"
              icon={<Pencil size={13} color={Colors.accentWarning} />}
              color={Colors.accentWarning}
              bgColor="rgba(234,179,8,0.08)"
              borderColor="rgba(234,179,8,0.25)"
              onPress={() => setEditMode(!editMode)}
            />
          </View>

          {/* Manual editor */}
          {editMode && (
            <View style={hunkStyles.editorWrap}>
              <Text style={hunkStyles.editorTitle}>Manual Resolution</Text>
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
                placeholder="Write the resolved code…"
              />
              <TouchableOpacity
                style={hunkStyles.applyBtn}
                activeOpacity={0.7}
                onPress={() => {
                  onResolve(hunk.id, 'manual', manualText);
                  setEditMode(false);
                  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Check size={14} color="#000" />
                <Text style={hunkStyles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Three-Way View Component
// ─────────────────────────────────────────────────────────────────────────────

function ThreeWayView({ file }: { file: ConflictFile }) {
  const [activeTab, setActiveTab] = useState<'base' | 'ours' | 'theirs'>('ours');

  const tabConfig = {
    base: { label: 'BASE', color: Colors.textSecondary, icon: <Layers size={12} color={Colors.textSecondary} /> },
    ours: { label: 'CURRENT', color: Colors.accentPrimary, icon: <Check size={12} color={Colors.accentPrimary} /> },
    theirs: { label: 'INCOMING', color: Colors.accentInfo, icon: <CornerDownRight size={12} color={Colors.accentInfo} /> },
  };

  const content = activeTab === 'base' ? file.baseContent
    : activeTab === 'ours' ? file.oursContent
    : file.theirsContent;

  const lines = (content || '').split('\n');

  return (
    <View style={threeWayStyles.container}>
      <View style={threeWayStyles.tabs}>
        {(['base', 'ours', 'theirs'] as const).map((tab) => {
          const cfg = tabConfig[tab];
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[threeWayStyles.tab, isActive && { borderBottomColor: cfg.color, borderBottomWidth: 2, backgroundColor: 'rgba(255,255,255,0.02)' }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              {cfg.icon}
              <Text style={[threeWayStyles.tabText, isActive && { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView style={threeWayStyles.codeScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={threeWayStyles.codeBlock}>
            {lines.map((line, i) => (
              <View key={i} style={threeWayStyles.codeLine}>
                <Text style={threeWayStyles.lineNum}>{i + 1}</Text>
                <Text style={threeWayStyles.codeText}>{line || ' '}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File Tab Chip
// ─────────────────────────────────────────────────────────────────────────────

function FileChip({
  file,
  isActive,
  onPress,
}: {
  file: ConflictFile;
  isActive: boolean;
  onPress: () => void;
}) {
  const resolvedHunks = file.hunks.filter(h => h.resolved).length;
  const totalHunks = file.hunks.length;
  const progress = totalHunks > 0 ? resolvedHunks / totalHunks : 0;

  return (
    <TouchableOpacity
      style={[
        chipStyles.chip,
        isActive && chipStyles.chipActive,
        file.resolved && chipStyles.chipResolved,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={chipStyles.chipTop}>
        {file.resolved ? (
          <CheckCircle size={14} color={Colors.accentPrimary} />
        ) : (
          <FileWarning size={14} color={Colors.accentDanger} />
        )}
        <Text
          style={[
            chipStyles.chipName,
            isActive && chipStyles.chipNameActive,
            file.resolved && { color: Colors.accentPrimary },
          ]}
          numberOfLines={1}
        >
          {file.name}
        </Text>
      </View>
      {/* Mini progress bar */}
      <View style={chipStyles.miniTrack}>
        <View style={[chipStyles.miniFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={chipStyles.chipMeta}>
        {resolvedHunks}/{totalHunks}
      </Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    minWidth: 72,
  },
  chipActive: {
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  chipResolved: {
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(34,197,94,0.04)',
  },
  chipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    maxWidth: 100,
  },
  chipNameActive: {
    color: Colors.textPrimary,
  },
  miniTrack: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.bgPrimary,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 2,
  },
  miniFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 1,
  },
  chipMeta: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

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
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());

  const activeConflicts = mergeState?.conflicts ?? conflicts;
  const currentFile = activeConflicts[currentFileIndex];

  const resolvedFileCount = activeConflicts.filter(c => c.resolved).length;
  const totalHunks = activeConflicts.reduce((s, c) => s + c.hunks.length, 0);
  const resolvedHunks = activeConflicts.reduce((s, c) => s + c.hunks.filter(h => h.resolved).length, 0);
  const allResolved = resolvedFileCount === activeConflicts.length && activeConflicts.length > 0;
  const progressPercent = totalHunks > 0 ? (resolvedHunks / totalHunks) * 100 : 0;

  // Animated progress
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const handleResolveHunk = useCallback(
    (hunkId: string, resolution: 'ours' | 'theirs' | 'both' | 'manual', manualContent?: string) => {
      if (!currentFile) return;
      resolveConflictHunk(currentFile.id, hunkId, resolution, manualContent);
    },
    [currentFile, resolveConflictHunk],
  );

  const handleStageFile = useCallback(async () => {
    if (!currentFile || !currentFile.resolved) return;
    try {
      await stageResolvedConflictFile(currentFile);
      setStagedFiles(prev => new Set(prev).add(currentFile.id));
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Auto-advance to next unresolved file
      const nextUnresolved = activeConflicts.findIndex(
        (c, i) => i !== currentFileIndex && !c.resolved
      );
      if (nextUnresolved !== -1) {
        setCurrentFileIndex(nextUnresolved);
      }
    } catch (err) {
      showToast("error", "Failed to stage file");
    }
  }, [currentFile, stageResolvedConflictFile, currentFileIndex, activeConflicts, showToast]);

  const handleFinalizeMerge = useCallback(async () => {
    setIsFinalizing(true);
    try {
      await finalizeMerge();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      setIsFinalizing(false);
    }
  }, [finalizeMerge, router]);

  const handleAbortMerge = useCallback(async () => {
    await abortMerge();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    router.back();
  }, [abortMerge, router]);

  // ── Empty state ──
  if (activeConflicts.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyCenter}>
          <GitMerge size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Merge Conflicts</Text>
          <Text style={styles.emptySub}>All clear! Nothing to resolve.</Text>
          <GlowButton title="Go Back" onPress={() => router.back()} size="sm" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleAbortMerge} style={styles.headerSide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <XCircle size={20} color={Colors.accentDanger} />
          <Text style={styles.abortText}>Abort</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <GitMerge size={18} color={Colors.accentPrimary} />
            <Text style={styles.headerTitle}>Merge Conflicts</Text>
          </View>
          {mergeState && (
            <Text style={styles.headerBranches} numberOfLines={1}>
              {mergeState.oursBranch}
              <Text style={{ color: Colors.textMuted }}>{' ← '}</Text>
              {mergeState.theirsBranch}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setShowThreeWay(!showThreeWay)}
          style={styles.headerSide}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showThreeWay ? <EyeOff size={18} color={Colors.accentInfo} /> : <Eye size={18} color={Colors.accentInfo} />}
          <Text style={styles.threeWayText}>{showThreeWay ? 'Diff' : '3-Way'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Progress ── */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarOuter}>
          <Animated.View
            style={[
              styles.progressBarInner,
              { width: progressWidth },
              allResolved && { backgroundColor: Colors.accentPrimary },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>
            <Text style={{ color: Colors.accentPrimary, fontWeight: '800' }}>{resolvedHunks}</Text>
            <Text style={{ color: Colors.textMuted }}>/{totalHunks} hunks</Text>
          </Text>
          <Text style={styles.progressText}>
            <Text style={{ color: Colors.accentPrimary, fontWeight: '800' }}>{resolvedFileCount}</Text>
            <Text style={{ color: Colors.textMuted }}>/{activeConflicts.length} files</Text>
          </Text>
        </View>
      </View>

      {/* ── File Tabs ── */}
      <View style={styles.fileTabs}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fileTabsContent}
        >
          {activeConflicts.map((c, i) => (
            <FileChip
              key={c.id}
              file={c}
              isActive={i === currentFileIndex}
              onPress={() => setCurrentFileIndex(i)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {currentFile && (
          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {showThreeWay ? (
              <ThreeWayView file={currentFile} />
            ) : (
              <>
                {/* File path bar */}
                <View style={styles.filePathRow}>
                  <View style={styles.filePathLeft}>
                    <Text style={styles.filePathText} numberOfLines={1}>
                      {currentFile.path}
                    </Text>
                  </View>
                  <View style={styles.hunkBadge}>
                    <Text style={styles.hunkBadgeText}>
                      {currentFile.hunks.filter(h => h.resolved).length}/{currentFile.hunks.length}
                    </Text>
                  </View>
                </View>

                {/* Hunk list */}
                {currentFile.hunks.map((hunk, idx) => (
                  <HunkView
                    key={hunk.id}
                    hunk={hunk}
                    hunkIndex={idx}
                    fileId={currentFile.id}
                    oursBranch={currentFile.oursBranch}
                    theirsBranch={currentFile.theirsBranch}
                    onResolve={handleResolveHunk}
                  />
                ))}
              </>
            )}
            <View style={{ height: 180 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        {/* Status message — file has unresolved hunks */}
        {currentFile && !currentFile.resolved && (
          <View style={styles.bottomStatus}>
            <AlertTriangle size={14} color={Colors.accentWarning} />
            <Text style={styles.bottomStatusText}>
              Resolve {currentFile.hunks.filter(h => !h.resolved).length} remaining conflict{currentFile.hunks.filter(h => !h.resolved).length !== 1 ? 's' : ''} in {currentFile.name}
            </Text>
          </View>
        )}

        {/* Stage button — file resolved but not all files done yet */}
        {currentFile?.resolved && !stagedFiles.has(currentFile.id) && !allResolved && (
          <GlowButton
            title={`Stage ${currentFile.name} & Next`}
            onPress={handleStageFile}
            fullWidth
            icon={<ArrowRight size={16} color="#fff" />}
          />
        )}

        {/* Already staged — point to next file */}
        {currentFile?.resolved && stagedFiles.has(currentFile.id) && !allResolved && (
          <View style={styles.bottomStatus}>
            <CheckCircle size={14} color={Colors.accentPrimary} />
            <Text style={[styles.bottomStatusText, { color: Colors.accentPrimary }]}>
              {currentFile.name} staged — select next file
            </Text>
          </View>
        )}

        {/* Finalize — ALL files resolved */}
        {allResolved && (
          <View style={styles.finalizeSection}>
            {currentFile?.resolved && !stagedFiles.has(currentFile.id) && (
              <View style={{ marginBottom: Spacing.sm }}>
                <GlowButton
                  title={`Stage ${currentFile.name}`}
                  onPress={handleStageFile}
                  fullWidth
                  variant="outline"
                  size="sm"
                  icon={<Check size={14} color={Colors.accentPrimary} />}
                />
              </View>
            )}
            <GlowButton
              title={isFinalizing ? "Finalizing…" : "Complete Merge"}
              onPress={handleFinalizeMerge}
              fullWidth
              loading={isFinalizing}
              disabled={isFinalizing}
              icon={<GitMerge size={18} color="#fff" />}
            />
            <Text style={styles.finalizeHint}>
              All {activeConflicts.length} file{activeConflicts.length !== 1 ? 's' : ''} resolved — this will stage, commit & complete the merge
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerSide: {
    alignItems: 'center',
    gap: 2,
    width: 50,
  },
  abortText: {
    fontSize: 10,
    color: Colors.accentDanger,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  threeWayText: {
    fontSize: 10,
    color: Colors.accentInfo,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerBranches: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: CODE_FONT,
  },

  // Progress
  progressSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    gap: 6,
  },
  progressBarOuter: {
    height: 4,
    backgroundColor: Colors.bgTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: Colors.accentWarning,
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // File tabs
  fileTabs: {
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    paddingVertical: Spacing.sm,
  },
  fileTabsContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },

  // Content
  contentScroll: {
    flex: 1,
    padding: Spacing.md,
  },
  filePathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  filePathLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  filePathText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: CODE_FONT,
  },
  hunkBadge: {
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  hunkBadgeText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '800',
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  bottomStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  bottomStatusText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  finalizeSection: {
    gap: 0,
  },
  finalizeHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hunk Styles
// ─────────────────────────────────────────────────────────────────────────────

const hunkStyles = StyleSheet.create({
  // Container
  container: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.bgTertiary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conflictDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentDanger,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Diff
  diffBlock: {
    backgroundColor: Colors.codeBackground,
    paddingVertical: 4,
    minWidth: SCREEN_WIDTH - 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  oursLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.08)',
    paddingVertical: 1,
    paddingRight: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentPrimary,
  },
  theirsLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingVertical: 1,
    paddingRight: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentDanger,
  },
  lineNum: {
    width: 36,
    textAlign: 'right',
    paddingRight: 8,
    fontSize: 10,
    lineHeight: 20,
    color: '#4C566A',
    fontFamily: CODE_FONT,
  },
  linePrefix: {
    width: 14,
    textAlign: 'center',
    fontFamily: CODE_FONT,
    fontSize: 12,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  codeText: {
    flex: 1,
    fontFamily: CODE_FONT,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderDefault,
  },
  dividerText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgTertiary,
  },

  // Manual editor
  editorWrap: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.bgTertiary,
  },
  editorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.accentWarning,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editorInput: {
    backgroundColor: Colors.codeBackground,
    color: Colors.textPrimary,
    fontFamily: CODE_FONT,
    fontSize: 13,
    lineHeight: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accentWarning,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },

  // Resolved state
  resolvedOuter: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  resolvedStrip: {
    width: 4,
  },
  resolvedBody: {
    flex: 1,
  },
  resolvedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(34,197,94,0.04)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(34,197,94,0.1)',
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolvedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resolvedCode: {
    padding: 8,
    backgroundColor: Colors.codeBackground,
    minWidth: SCREEN_WIDTH - 40,
  },
  resolvedCodeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resolvedLineNum: {
    width: 32,
    textAlign: 'right',
    paddingRight: 8,
    fontSize: 10,
    lineHeight: 20,
    color: '#4C566A',
    fontFamily: CODE_FONT,
  },
  resolvedLineText: {
    flex: 1,
    fontFamily: CODE_FONT,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.accentPrimary,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Three-Way Styles
// ─────────────────────────────────────────────────────────────────────────────

const threeWayStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  codeScroll: {
    maxHeight: 400,
  },
  codeBlock: {
    padding: 8,
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
    fontSize: 10,
    lineHeight: 22,
    color: '#4C566A',
    fontFamily: CODE_FONT,
  },
  codeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontFamily: CODE_FONT,
  },
});
