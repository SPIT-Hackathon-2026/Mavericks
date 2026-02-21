import React, { useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GitBranch,
  Plus,
  FolderGit2,
  FileWarning,
  FolderX,
  MoreVertical,
  Clock,
  MessageCircle,
  Shield,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Spacing, Radius, Shadows } from "@/constants/theme";
import { useGit } from "@/contexts/GitContext";
import EmptyState from "@/components/EmptyState";
import type { Repository } from "@/types/git";

function RepoCard({
  repo,
  onPress,
}: {
  repo: Repository;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 200,
      friction: 15,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 15,
    }).start();
  };

  const hasConflicts = repo.conflictCount > 0;
  const hasModified = repo.modifiedCount > 0;

  const IconComponent = hasConflicts
    ? FolderX
    : hasModified
    ? FileWarning
    : FolderGit2;
  const iconBg = hasConflicts
    ? Colors.accentDanger
    : hasModified
    ? "rgba(234,179,8,0.15)"
    : Colors.bgTertiary;
  const iconColor = hasConflicts
    ? "#FFFFFF"
    : hasModified
    ? Colors.accentWarning
    : Colors.accentPrimary;

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[styles.repoCard, { transform: [{ scale }] }]}>
        <View style={styles.repoRow}>
          <View style={[styles.repoIcon, { backgroundColor: iconBg }]}>
            <IconComponent size={24} color={iconColor} />
          </View>
          <View style={styles.repoContent}>
            <Text style={styles.repoName} numberOfLines={1}>
              {repo.name}
            </Text>
            <Text style={styles.repoPath} numberOfLines={1}>
              {repo.path}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.menuBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MoreVertical size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.repoMeta}>
          <View style={styles.branchPill}>
            <GitBranch size={12} color={Colors.accentPrimary} />
            <Text style={styles.branchText}>{repo.currentBranch}</Text>
          </View>

          {repo.stagedCount > 0 && (
            <View style={styles.statusDot}>
              <View
                style={[styles.dot, { backgroundColor: Colors.statusStaged }]}
              />
              <Text style={[styles.dotText, { color: Colors.statusStaged }]}>
                {repo.stagedCount}
              </Text>
            </View>
          )}
          {repo.modifiedCount > 0 && (
            <View style={styles.statusDot}>
              <View
                style={[styles.dot, { backgroundColor: Colors.statusModified }]}
              />
              <Text style={[styles.dotText, { color: Colors.statusModified }]}>
                {repo.modifiedCount}
              </Text>
            </View>
          )}
          {repo.conflictCount > 0 && (
            <View style={styles.statusDot}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: Colors.statusConflicted },
                ]}
              />
              <Text
                style={[styles.dotText, { color: Colors.statusConflicted }]}
              >
                {repo.conflictCount}
              </Text>
            </View>
          )}

          <View style={styles.timeRow}>
            <Clock size={11} color={Colors.textMuted} />
            <Text style={styles.timeText}>{repo.lastActivity}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default function ReposScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    repositories,
    githubRepos,
    setSelectedRepoId,
    cloneGitHubRepo,
    settings,
  } = useGit();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const openRepo = useCallback(
    (repo: Repository) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setSelectedRepoId(repo.id);
      router.push(`/repository/${repo.id}`);
    },
    [router, setSelectedRepoId]
  );

  const openAddRepo = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/add-repo");
  }, [router]);

  const openChatbot = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/chatbot");
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <GitBranch size={22} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.headerTitle}>Repositories</Text>
        </View>
        <TouchableOpacity
          onPress={openAddRepo}
          style={styles.addBtn}
          testID="add-repo-btn"
        >
          <Plus size={22} color={Colors.accentPrimary} />
        </TouchableOpacity>
      </View>

      {repositories.length === 0 ? (
        <EmptyState
          icon={<GitBranch size={80} color={Colors.accentPrimary} />}
          title="No repositories yet"
          subtitle="Initialize a new repo or import an existing one"
          primaryAction={{ label: "Create Repository", onPress: openAddRepo }}
          secondaryAction={{ label: "Import Repository", onPress: openAddRepo }}
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentPrimary}
              colors={[Colors.accentPrimary]}
              progressBackgroundColor={Colors.bgSecondary}
            />
          }
        >
          {settings.githubToken && (
            <>
              <View style={styles.ghHeader}>
                <Shield size={14} color={Colors.accentPrimary} />
                <Text style={styles.ghHeaderText}>GitHub Repositories</Text>
              </View>
              {githubRepos.map((gh) => (
                <View key={gh.id} style={styles.ghRow}>
                  <Text style={styles.ghName} numberOfLines={1}>
                    {gh.full_name}
                  </Text>
                  <TouchableOpacity
                    style={styles.ghCloneBtn}
                    onPress={() => cloneGitHubRepo(gh)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ghCloneText}>Clone</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 12 }} />
            </>
          )}
          {repositories.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onPress={() => openRepo(repo)}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, Shadows.glow, { bottom: Spacing.lg }]}
        onPress={openChatbot}
        activeOpacity={0.8}
        testID="fab-chatbot"
      >
        <MessageCircle size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentPrimaryDim,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
  },
  repoCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.md,
    marginBottom: 12,
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  repoIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  repoContent: {
    flex: 1,
  },
  repoName: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  repoPath: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  repoMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
    flexWrap: "wrap",
  },
  branchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentPrimaryDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  branchText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.accentPrimary,
  },
  statusDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  ghHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  ghHeaderText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ghRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: 8,
  },
  ghName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    marginRight: 12,
  },
  ghCloneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentPrimaryDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentPrimary,
  },
  ghCloneText: {
    color: Colors.accentPrimary,
    fontWeight: "600" as const,
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
