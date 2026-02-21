import Colors from "@/constants/colors";
import { Radius, Spacing } from "@/constants/theme";
import { useGit } from "@/contexts/GitContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { FolderDown, FolderPlus, X } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddRepoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    cloneRepository,
    githubRepos,
    cloneGitHubRepo,
    settings,
    isCloning,
    cloneProgress,
  } = useGit();
  const [showImportForm, setShowImportForm] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [search, setSearch] = useState("");

  const handleStartImport = useCallback(async () => {
    if (!importUrl.trim() || !importName.trim() || cloning) return;
    setCloning(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await cloneRepository(importUrl.trim(), importName.trim());
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.dismiss();
    } catch {
    } finally {
      setCloning(false);
    }
  }, [importUrl, importName, cloning, cloneRepository, router]);

  const handleCreate = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace("/create-repo");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Repository</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleCreate}
          activeOpacity={0.7}
        >
          <View style={styles.optionIconWrap}>
            <FolderPlus size={40} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.optionTitle}>Create New</Text>
          <Text style={styles.optionSubtitle}>
            Initialize a fresh Git repository
          </Text>
        </TouchableOpacity>

        {!showImportForm ? (
          <TouchableOpacity
            style={[styles.optionCard, styles.optionCardSecondary]}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowImportForm(true);
            }}
          >
            <View
              style={[styles.optionIconWrap, styles.optionIconWrapSecondary]}
            >
              <FolderDown size={40} color={Colors.accentSecondary} />
            </View>
            <Text style={styles.optionTitle}>Import Existing</Text>
            <Text style={styles.optionSubtitle}>
              Clone from URL into local storage
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.optionCard, styles.optionCardSecondary]}>
            <View style={styles.importField}>
              <Text style={styles.importLabel}>Repository URL</Text>
              <View style={styles.importInputWrap}>
                <TextInput
                  value={importUrl}
                  onChangeText={setImportUrl}
                  placeholder="https://github.com/owner/repo.git"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.importInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <View style={styles.importField}>
              <Text style={styles.importLabel}>Local Name</Text>
              <View style={styles.importInputWrap}>
                <TextInput
                  value={importName}
                  onChangeText={setImportName}
                  placeholder="repo-name"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.importInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.importBtn,
                (!importUrl.trim() || !importName.trim() || cloning) &&
                  styles.importBtnDisabled,
              ]}
              onPress={handleStartImport}
              activeOpacity={0.8}
            >
              {cloning ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.importBtnText}>Importing...</Text>
                </>
              ) : (
                <Text style={styles.importBtnText}>Start Import</Text>
              )}
            </TouchableOpacity>
            {isCloning && (
              <View style={styles.cloneStatus}>
                <Text style={styles.cloneStatusText}>
                  {cloneProgress
                    ? `${cloneProgress.phase} ${Math.round(cloneProgress.loaded)}/${Math.round(cloneProgress.total)}`
                    : "Cloning…"}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>RECENT LOCATIONS</Text>
          <View style={styles.recentEmpty}>
            <Text style={styles.recentEmptyText}>No recent locations</Text>
          </View>
        </View>

        {settings.githubToken && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={styles.recentLabel}>GITHUB REPOSITORIES</Text>
            <View style={styles.importInputWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search repositories…"
                placeholderTextColor={Colors.textMuted}
                style={styles.importInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {githubRepos
              .filter((r) =>
                r.full_name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((r) => (
                <View key={r.id} style={styles.ghRow}>
                  <Text style={styles.ghName} numberOfLines={1}>
                    {r.full_name}
                  </Text>
                  <TouchableOpacity
                    style={styles.ghCloneBtn}
                    onPress={() => cloneGitHubRepo(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ghCloneText}>Clone</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
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
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.md,
    flex: 1,
  },
  optionCard: {
    backgroundColor: Colors.accentPrimaryDim,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
    alignItems: "center",
    minHeight: 140,
    justifyContent: "center",
  },
  optionCardSecondary: {
    backgroundColor: Colors.bgTertiary,
    borderColor: Colors.borderDefault,
  },
  optionIconWrap: {
    marginBottom: Spacing.md,
  },
  optionIconWrapSecondary: {},
  optionTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  importField: {
    alignSelf: "stretch",
    marginBottom: Spacing.md,
  },
  importLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  importInputWrap: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  importInput: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  importBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accentSecondary,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    alignSelf: "stretch",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  importBtnDisabled: {
    opacity: 0.6,
  },
  importBtnText: {
    color: "#FFFFFF",
    fontWeight: "600" as const,
  },
  recentSection: {
    marginTop: Spacing.lg,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  recentEmpty: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  recentEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  cloneStatus: {
    marginTop: Spacing.sm,
    alignSelf: "stretch",
    padding: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSecondary,
  },
  cloneStatusText: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    marginTop: 8,
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
});
