import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Check, CheckCircle, Circle, ChevronRight, GitMerge,
  Pencil,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Spacing, Radius, Shadows } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import GlowButton from '@/components/GlowButton';

export default function MergeConflictsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conflicts, resolveConflict, showToast } = useGit();
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [selectedResolution, setSelectedResolution] = useState<'ours' | 'theirs' | null>(null);

  const currentFile = conflicts[currentFileIndex];
  const resolvedCount = conflicts.filter(c => c.resolved).length;
  const allResolved = resolvedCount === conflicts.length;

  const handleAcceptOurs = useCallback(() => {
    if (!currentFile) return;
    setSelectedResolution('ours');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentFile]);

  const handleAcceptTheirs = useCallback(() => {
    if (!currentFile) return;
    setSelectedResolution('theirs');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentFile]);

  const handleMarkResolved = useCallback(() => {
    if (!currentFile || !selectedResolution) return;
    const content = selectedResolution === 'ours' ? currentFile.oursContent : currentFile.theirsContent;
    resolveConflict(currentFile.id, content);
    setSelectedResolution(null);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (currentFileIndex < conflicts.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
    }
  }, [currentFile, selectedResolution, resolveConflict, currentFileIndex, conflicts.length]);

  const handleCompleteMerge = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    showToast('success', 'Merge completed successfully');
    router.back();
  }, [router, showToast]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Resolve Conflicts</Text>
          <Text style={styles.headerSubtitle}>{conflicts.length} files with conflicts</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.progressBar}>
        {conflicts.map((c, i) => (
          <View key={c.id} style={styles.progressStep}>
            {c.resolved ? (
              <CheckCircle size={20} color={Colors.accentPrimary} />
            ) : i === currentFileIndex ? (
              <View style={styles.currentDot} />
            ) : (
              <Circle size={20} color={Colors.textMuted} />
            )}
            {i < conflicts.length - 1 && (
              <View style={[styles.progressLine, c.resolved && styles.progressLineResolved]} />
            )}
          </View>
        ))}
      </View>

      <View style={styles.fileList}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fileListContent}>
          {conflicts.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.fileChip,
                i === currentFileIndex && styles.fileChipActive,
                c.resolved && styles.fileChipResolved,
              ]}
              onPress={() => {
                setCurrentFileIndex(i);
                setSelectedResolution(null);
              }}
            >
              {c.resolved && <CheckCircle size={12} color={Colors.accentPrimary} />}
              <Text style={[
                styles.fileChipText,
                i === currentFileIndex && styles.fileChipTextActive,
              ]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {currentFile && (
        <ScrollView style={styles.conflictContent} showsVerticalScrollIndicator={false}>
          <View style={[
            styles.codePane,
            selectedResolution === 'ours' && styles.codePaneSelected,
          ]}>
            <View style={styles.codePaneHeader}>
              <View style={[styles.paneIndicator, { backgroundColor: Colors.accentPrimary }]} />
              <GitMerge size={14} color={Colors.accentPrimary} />
              <Text style={styles.paneTitle}>OURS — {currentFile.oursBranch}</Text>
              {selectedResolution === 'ours' && <CheckCircle size={16} color={Colors.accentPrimary} />}
            </View>
            <View style={styles.codeBlock}>
              {currentFile.oursContent.split('\n').map((line, i) => (
                <Text key={i} style={styles.codeLine}>{line}</Text>
              ))}
            </View>
          </View>

          <View style={[
            styles.codePane,
            selectedResolution === 'theirs' && styles.codePaneSelectedPurple,
          ]}>
            <View style={styles.codePaneHeader}>
              <View style={[styles.paneIndicator, { backgroundColor: Colors.accentPurple }]} />
              <GitMerge size={14} color={Colors.accentPurple} />
              <Text style={styles.paneTitle}>THEIRS — {currentFile.theirsBranch}</Text>
              {selectedResolution === 'theirs' && <CheckCircle size={16} color={Colors.accentPurple} />}
            </View>
            <View style={styles.codeBlock}>
              {currentFile.theirsContent.split('\n').map((line, i) => (
                <Text key={i} style={styles.codeLine}>{line}</Text>
              ))}
            </View>
          </View>

          {selectedResolution && (
            <View style={styles.codePane}>
              <View style={styles.codePaneHeader}>
                <View style={[styles.paneIndicator, { backgroundColor: Colors.accentSecondary }]} />
                <Text style={[styles.paneTitle, { color: Colors.accentSecondary }]}>RESULT</Text>
              </View>
              <View style={[styles.codeBlock, { backgroundColor: 'rgba(34,197,94,0.05)' }]}>
                {(selectedResolution === 'ours' ? currentFile.oursContent : currentFile.theirsContent)
                  .split('\n').map((line, i) => (
                    <Text key={i} style={styles.codeLine}>{line}</Text>
                  ))}
              </View>
            </View>
          )}

          <View style={{ height: 200 }} />
        </ScrollView>
      )}

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + Spacing.md }]}>
        {!currentFile?.resolved ? (
          <>
            <View style={styles.resolutionButtons}>
              <TouchableOpacity
                style={[styles.resBtn, selectedResolution === 'ours' && styles.resBtnActive]}
                onPress={handleAcceptOurs}
              >
                <Text style={[styles.resBtnText, selectedResolution === 'ours' && styles.resBtnTextActive]}>
                  Accept Ours
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resBtn, styles.resBtnPurple, selectedResolution === 'theirs' && styles.resBtnPurpleActive]}
                onPress={handleAcceptTheirs}
              >
                <Text style={[styles.resBtnText, selectedResolution === 'theirs' && { color: Colors.accentPurple }]}>
                  Accept Theirs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resBtn}>
                <Pencil size={14} color={Colors.textSecondary} />
                <Text style={styles.resBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {selectedResolution && (
              <GlowButton
                title="Mark Resolved"
                onPress={handleMarkResolved}
                fullWidth
                icon={<Check size={18} color="#FFFFFF" />}
              />
            )}
          </>
        ) : allResolved ? (
          <GlowButton
            title="Complete Merge"
            onPress={handleCompleteMerge}
            fullWidth
            icon={<GitMerge size={18} color="#FFFFFF" />}
          />
        ) : (
          <GlowButton
            title="Next File"
            onPress={() => {
              const nextUnresolved = conflicts.findIndex((c, i) => i > currentFileIndex && !c.resolved);
              if (nextUnresolved !== -1) {
                setCurrentFileIndex(nextUnresolved);
                setSelectedResolution(null);
              }
            }}
            fullWidth
            variant="outline"
            icon={<ChevronRight size={18} color={Colors.accentPrimary} />}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerBtn: {
    width: 60,
  },
  cancelText: {
    fontSize: 15,
    color: Colors.accentDanger,
    fontWeight: '500' as const,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    gap: 4,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimaryDim,
  },
  progressLine: {
    width: 24,
    height: 2,
    backgroundColor: Colors.borderDefault,
  },
  progressLineResolved: {
    backgroundColor: Colors.accentPrimary,
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
    fontWeight: '500' as const,
  },
  fileChipTextActive: {
    color: Colors.accentPrimary,
  },
  conflictContent: {
    flex: 1,
    padding: Spacing.md,
  },
  codePane: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  codePaneSelected: {
    borderColor: Colors.accentPrimary,
  },
  codePaneSelectedPurple: {
    borderColor: Colors.accentPurple,
  },
  codePaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  paneIndicator: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  paneTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  codeBlock: {
    padding: Spacing.md,
    backgroundColor: Colors.codeBackground,
  },
  codeLine: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  bottomActions: {
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    padding: Spacing.md,
  },
  resolutionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  resBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  resBtnActive: {
    backgroundColor: Colors.accentPrimaryDim,
  },
  resBtnPurple: {
    borderColor: Colors.accentPurple,
  },
  resBtnPurpleActive: {
    backgroundColor: 'rgba(168,85,247,0.1)',
  },
  resBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  resBtnTextActive: {
    color: Colors.accentPrimary,
  },
});
