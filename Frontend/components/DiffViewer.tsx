/**
 * DiffViewer
 *
 * Renders a list of DiffFile objects as colored unified diffs.
 * Used by the P2P receiver to visualise incoming changes before accepting.
 *
 * Colors:
 *  + added   → green  (Colors.diffAddBg / Colors.diffAddBorder)
 *  - removed → red    (Colors.diffRemoveBg / Colors.diffRemoveBorder)
 *  @@ hunk  → blue accent header
 *  context  → transparent / normal text
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import {
  FilePlus,
  FileMinus,
  FileCode2,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import type { DiffFile, DiffLine } from '@/services/p2p/p2pService';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Change-type chip ────────────────────────────────────────────────────────

function ChangeChip({ type }: { type: 'M' | 'A' | 'D' | 'R' }) {
  const map = {
    M: { label: 'MODIFIED', color: Colors.accentWarning, bg: 'rgba(234,179,8,0.12)' },
    A: { label: 'ADDED', color: Colors.accentPrimary, bg: Colors.accentPrimaryDim },
    D: { label: 'DELETED', color: Colors.accentDanger, bg: 'rgba(239,68,68,0.12)' },
    R: { label: 'RENAMED', color: Colors.accentInfo, bg: 'rgba(59,130,246,0.12)' },
  };
  const { label, color, bg } = map[type];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Stat badges (+ additions / - deletions) ─────────────────────────────────

function StatBadges({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <View style={styles.statRow}>
      {additions > 0 && (
        <View style={styles.statAdd}>
          <Plus size={10} color={Colors.accentPrimary} strokeWidth={3} />
          <Text style={styles.statAddText}>{additions}</Text>
        </View>
      )}
      {deletions > 0 && (
        <View style={styles.statDel}>
          <Minus size={10} color={Colors.accentDanger} strokeWidth={3} />
          <Text style={styles.statDelText}>{deletions}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Single diff line ────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.type === 'hunk' || line.content.startsWith('@@')) {
    return (
      <View style={styles.hunkRow}>
        <Text style={styles.hunkText}>{line.content}</Text>
      </View>
    );
  }

  const isAdded = line.type === 'added';
  const isRemoved = line.type === 'removed';

  return (
    <View
      style={[
        styles.lineRow,
        isAdded && styles.lineRowAdded,
        isRemoved && styles.lineRowRemoved,
      ]}
    >
      <View style={[styles.lineGutter, isAdded && styles.gutterAdded, isRemoved && styles.gutterRemoved]}>
        <Text style={[styles.lineNo, isAdded && styles.lineNoAdded, isRemoved && styles.lineNoRemoved]}>
          {isAdded ? '+' : isRemoved ? '-' : ' '}
        </Text>
      </View>
      <Text
        style={[
          styles.lineCode,
          isAdded && styles.lineCodeAdded,
          isRemoved && styles.lineCodeRemoved,
        ]}
        numberOfLines={0}
      >
        {line.content.slice(1)}
      </Text>
    </View>
  );
}

// ─── Single file card ────────────────────────────────────────────────────────

function DiffFileCard({ file, defaultExpanded = true }: { file: DiffFile; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const filename = file.filepath.split('/').pop() ?? file.filepath;
  const dir = file.filepath.includes('/')
    ? file.filepath.substring(0, file.filepath.lastIndexOf('/') + 1)
    : '';

  const FileIcon = file.changeType === 'A' ? FilePlus : file.changeType === 'D' ? FileMinus : FileCode2;
  const fileIconColor = file.changeType === 'A' ? Colors.accentPrimary : file.changeType === 'D' ? Colors.accentDanger : Colors.accentWarning;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.fileCard}>
      {/* File header */}
      <TouchableOpacity style={styles.fileHeader} onPress={toggle} activeOpacity={0.75}>
        <FileIcon size={16} color={fileIconColor} />
        <View style={styles.filePathContainer}>
          {dir.length > 0 && <Text style={styles.fileDir}>{dir}</Text>}
          <Text style={styles.fileName}>{filename}</Text>
        </View>
        <StatBadges additions={file.additions} deletions={file.deletions} />
        <ChangeChip type={file.changeType} />
        {expanded ? (
          <ChevronDown size={14} color={Colors.textMuted} />
        ) : (
          <ChevronRight size={14} color={Colors.textMuted} />
        )}
      </TouchableOpacity>

      {/* Hunks */}
      {expanded && (
        <View style={styles.hunksContainer}>
          {file.hunks.map((hunk, hi) => (
            <View key={hi} style={styles.hunkBlock}>
              <View style={styles.hunkHeaderRow}>
                <Text style={styles.hunkHeaderText}>{hunk.header}</Text>
              </View>
              {hunk.lines.map((line, li) => (
                <DiffLineRow key={li} line={line} />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

interface DiffViewerProps {
  files: DiffFile[];
  repoName?: string;
  commitCount?: number;
  loading?: boolean;
}

export default function DiffViewer({ files, repoName, commitCount, loading }: DiffViewerProps) {
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <View style={styles.root}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryTitle}>
          {repoName ?? 'Repository'}
        </Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryFiles}>{files.length} file{files.length !== 1 ? 's' : ''}</Text>
          {commitCount != null && (
            <Text style={styles.summaryCommits}>{commitCount} commit{commitCount !== 1 ? 's' : ''}</Text>
          )}
          <StatBadges additions={totalAdditions} deletions={totalDeletions} />
        </View>
      </View>

      {/* Loading overlay */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.accentPrimary} size="large" />
          <Text style={styles.emptyTitle}>Computing Diffs…</Text>
          <Text style={styles.emptySubtitle}>Reading file changes from repository</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'∅'}</Text>
          <Text style={styles.emptyTitle}>No Changes Found</Text>
          <Text style={styles.emptySubtitle}>
            {'These commits contain no file changes,\nor the repository is not available locally.'}
          </Text>
        </View>
      ) : (
        /* File list */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {files.map((file, i) => (
            <DiffFileCard key={file.filepath + i} file={file} defaultExpanded={i < 3} />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryFiles: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  summaryCommits: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  // File card
  fileCard: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    paddingHorizontal: 12,
  },
  filePathContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fileDir: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Stat badges
  statRow: {
    flexDirection: 'row',
    gap: 4,
  },
  statAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statAddText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.accentPrimary,
  },
  statDel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statDelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.accentDanger,
  },
  // Change chip
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  // Hunks
  hunksContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
  },
  hunkBlock: {},
  hunkHeaderRow: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(59,130,246,0.2)',
  },
  hunkHeaderText: {
    fontSize: 11,
    color: Colors.accentInfo,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hunkRow: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hunkText: {
    fontSize: 11,
    color: Colors.accentInfo,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Diff lines
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineRowAdded: {
    backgroundColor: Colors.diffAddBg,
  },
  lineRowRemoved: {
    backgroundColor: Colors.diffRemoveBg,
  },
  lineGutter: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  gutterAdded: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.diffAddBorder,
  },
  gutterRemoved: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.diffRemoveBorder,
  },
  lineNo: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineNoAdded: {
    color: Colors.accentPrimary,
  },
  lineNoRemoved: {
    color: Colors.accentDanger,
  },
  lineCode: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  lineCodeAdded: {
    color: Colors.accentTertiary,
  },
  lineCodeRemoved: {
    color: '#F87171',
  },
});
