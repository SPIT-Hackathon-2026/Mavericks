import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, GitBranch, Clock, User, Mail, FileCode2, Plus, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';
import { useGit } from '@/contexts/GitContext';
import { getAuthorColor, getAuthorInitials } from '@/mocks/repositories';
import StatusBadge from '@/components/StatusBadge';

export default function CommitDetailModal() {
  const { sha } = useLocalSearchParams<{ sha: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { commits } = useGit();

  const commit = commits.find(c => c.sha === sha);

  if (!commit) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <X size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.notFoundText}>Commit not found</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>
    );
  }

  const authorColor = getAuthorColor(commit.author);
  const initials = getAuthorInitials(commit.author);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.shaTitle}>{commit.shortSha}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.commitMessage}>{commit.message}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.avatar, { backgroundColor: authorColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.authorName}>{commit.author}</Text>
              <Text style={styles.authorEmail}>{commit.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Clock size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{commit.date}</Text>
          </View>

          <View style={styles.metaRow}>
            <GitBranch size={14} color={Colors.accentPrimary} />
            <Text style={styles.metaText}>{commit.sha.substring(0, 12)}</Text>
          </View>

          {commit.branches.length > 0 && (
            <View style={styles.branchRow}>
              {commit.branches.map(branch => (
                <View key={branch} style={styles.branchPill}>
                  <GitBranch size={10} color={Colors.accentPrimary} />
                  <Text style={styles.branchPillText}>{branch}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{commit.filesChanged}</Text>
            <Text style={styles.statLabel}>Files</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxGreen]}>
            <View style={styles.statIconRow}>
              <Plus size={12} color={Colors.accentPrimary} />
              <Text style={[styles.statNumber, { color: Colors.accentPrimary }]}>{commit.additions}</Text>
            </View>
            <Text style={styles.statLabel}>Additions</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRed]}>
            <View style={styles.statIconRow}>
              <Minus size={12} color={Colors.accentDanger} />
              <Text style={[styles.statNumber, { color: Colors.accentDanger }]}>{commit.deletions}</Text>
            </View>
            <Text style={styles.statLabel}>Deletions</Text>
          </View>
        </View>

        {commit.files && commit.files.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={styles.filesSectionTitle}>CHANGED FILES</Text>
            {commit.files.map((file, i) => (
              <View key={file.path} style={[styles.fileItem, i === (commit.files?.length ?? 0) - 1 && { borderBottomWidth: 0 }]}>
                <FileCode2 size={16} color={Colors.textMuted} />
                <View style={styles.fileItemContent}>
                  <Text style={styles.fileItemPath} numberOfLines={1}>{file.path}</Text>
                  <View style={styles.fileItemStats}>
                    <Text style={styles.fileAdditions}>+{file.additions}</Text>
                    <Text style={styles.fileDeletions}>−{file.deletions}</Text>
                  </View>
                </View>
                <StatusBadge type={file.changeType} />
              </View>
            ))}
          </View>
        )}

        {commit.parents.length > 0 && (
          <View style={styles.parentsSection}>
            <Text style={styles.filesSectionTitle}>PARENTS</Text>
            {commit.parents.map(parent => (
              <View key={parent} style={styles.parentRow}>
                <Text style={styles.parentSha}>{parent.substring(0, 12)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  shaTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  commitMessage: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  infoContent: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  authorEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderMuted,
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  branchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  branchPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accentPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  statBoxGreen: {
    borderColor: 'rgba(34,197,94,0.2)',
  },
  statBoxRed: {
    borderColor: 'rgba(239,68,68,0.2)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  filesSection: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  filesSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderMuted,
  },
  fileItemContent: {
    flex: 1,
  },
  fileItemPath: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  fileItemStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  fileAdditions: {
    fontSize: 11,
    color: Colors.accentPrimary,
    fontWeight: '600' as const,
  },
  fileDeletions: {
    fontSize: 11,
    color: Colors.accentDanger,
    fontWeight: '600' as const,
  },
  parentsSection: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  parentRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  parentSha: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
});
